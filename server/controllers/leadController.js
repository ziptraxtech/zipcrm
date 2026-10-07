import prisma from "../configs/prisma.js";
import { query } from "../crm/evchamp.js";
import { requireCrmMember } from "../crm/access.js";
import { ACTIVE_SOURCES, LEAD_SOURCES, isLeadSource, leadsUnionSql } from "../crm/leadSources.js";

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];

// EVChamp leads joined with this workspace's CRM state. $1 is always the workspaceId.
const leadsWithStateSql = () => `
    WITH leads AS (${leadsUnionSql()})
    SELECT l.*,
           COALESCE(s.status::text, 'NEW') AS status,
           s.id AS lead_state_id, s."ownerId" AS owner_id, s.value,
           u.name AS owner_name, u.image AS owner_image
    FROM leads l
    LEFT JOIN crm."LeadState" s ON s.source = l.source AND s."sourceId" = l.source_id AND s."workspaceId" = $1
    LEFT JOIN crm."User" u ON u.id = s."ownerId"`;

const parseSourceParams = (req, res) => {
    const {source, sourceId} = req.params;
    const id = Number(sourceId);
    if (!isLeadSource(source) || !Number.isInteger(id)) {
        res.status(404).json({message: "Lead not found"});
        return null;
    }
    return {source, sourceId: id};
}

// get leads: filters are applied as bound parameters on top of the fixed union
export const getLeads = async (req, res) => {
    try {
        const {workspaceId, source, status, q, from, to} = req.query;
        if (!await requireCrmMember(req, res, workspaceId)) return;

        const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const sources = source ? String(source).split(',').filter(isLeadSource) : ACTIVE_SOURCES;
        const statuses = status ? String(status).split(',').filter((s) => LEAD_STATUSES.includes(s)) : LEAD_STATUSES;

        // $1 workspaceId, $2 search, $3 from, $4 to - shared by all three queries
        const params = [workspaceId, q ? `%${q}%` : null, from || null, to || null];
        const base = `
            SELECT * FROM (${leadsWithStateSql()}) x
            WHERE ($2::text IS NULL OR x.name ILIKE $2 OR x.email ILIKE $2 OR x.phone ILIKE $2 OR x.company ILIKE $2)
              AND ($3::timestamptz IS NULL OR x.created_at >= $3::timestamptz)
              AND ($4::timestamptz IS NULL OR x.created_at < $4::timestamptz)`;

        const [rows, bySource, byStatus] = await Promise.all([
            query(`${base} AND x.source = ANY($5::text[]) AND x.status = ANY($6::text[])
                   ORDER BY x.created_at DESC NULLS LAST, x.source, x.source_id DESC
                   LIMIT $7 OFFSET $8`,
                [...params, sources, statuses, limit, (page - 1) * limit]),
            query(`SELECT x.source, count(*)::int AS count FROM (${base}) x
                   WHERE x.status = ANY($5::text[]) GROUP BY x.source`,
                [...params, statuses]),
            query(`SELECT x.status, count(*)::int AS count FROM (${base}) x
                   WHERE x.source = ANY($5::text[]) GROUP BY x.status`,
                [...params, sources]),
        ]);

        const countsBySource = Object.fromEntries(bySource.map((r) => [r.source, r.count]));
        const total = sources.reduce((sum, key) => sum + (countsBySource[key] || 0), 0);

        res.json({
            leads: rows,
            total,
            page,
            limit,
            countsBySource,
            countsByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
            sources: ACTIVE_SOURCES.map((key) => ({key, label: LEAD_SOURCES[key].label})),
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({message: error.code || error.message});
    }
}

// get one lead: the full EVChamp row, CRM state, notes, tasks and other enquiries by the same email
export const getLead = async (req, res) => {
    try {
        const {workspaceId} = req.query;
        if (!await requireCrmMember(req, res, workspaceId)) return;
        const parsed = parseSourceParams(req, res);
        if (!parsed) return;
        const {source, sourceId} = parsed;

        const [lead] = await query(`SELECT * FROM (${leadsWithStateSql()}) x WHERE x.source = $2 AND x.source_id = $3`,
            [workspaceId, source, sourceId]);
        if (!lead) return res.status(404).json({message: "Lead not found"});

        // table name comes from the constant registry, never from the request
        const [raw] = await query(`SELECT * FROM ${LEAD_SOURCES[source].table} WHERE id = $1`, [sourceId]);

        const [state, related] = await Promise.all([
            prisma.leadState.findUnique({
                where: {workspaceId_source_sourceId: {workspaceId, source, sourceId}},
                include: {
                    notes: {include: {user: true}, orderBy: {createdAt: 'desc'}},
                    tasks: {include: {assignee: true, project: true}},
                }
            }),
            lead.email
                ? query(`SELECT * FROM (${leadsWithStateSql()}) x
                         WHERE lower(x.email) = lower($2) AND NOT (x.source = $3 AND x.source_id = $4)
                         ORDER BY x.created_at DESC LIMIT 20`,
                    [workspaceId, lead.email, source, sourceId])
                : [],
        ]);

        res.json({lead, raw, notes: state?.notes || [], tasks: state?.tasks || [], related});
    } catch (error) {
        console.log(error);
        res.status(500).json({message: error.code || error.message});
    }
}

// update lead: creates the LeadState row on first change
export const updateLead = async (req, res) => {
    try {
        const {workspaceId, status, ownerId, value} = req.body;
        if (!await requireCrmMember(req, res, workspaceId)) return;
        const parsed = parseSourceParams(req, res);
        if (!parsed) return;
        const {source, sourceId} = parsed;

        const [exists] = await query(`SELECT 1 FROM ${LEAD_SOURCES[source].table} WHERE id = $1`, [sourceId]);
        if (!exists) return res.status(404).json({message: "Lead not found"});

        const data = {};
        if (status !== undefined) {
            if (!LEAD_STATUSES.includes(status)) return res.status(400).json({message: "Invalid status"});
            data.status = status;
        }
        if (ownerId !== undefined) {
            if (ownerId) {
                const owner = await prisma.workspaceMember.findUnique({where: {userId_workspaceId: {userId: ownerId, workspaceId}}});
                if (!owner) return res.status(400).json({message: "Owner must be a member of the workspace"});
            }
            data.ownerId = ownerId || null;
        }
        if (value !== undefined) {
            if (value !== null && !(Number.isInteger(value) && value >= 0)) return res.status(400).json({message: "Invalid value"});
            data.value = value;
        }

        const leadState = await prisma.leadState.upsert({
            where: {workspaceId_source_sourceId: {workspaceId, source, sourceId}},
            create: {workspaceId, source, sourceId, ...data},
            update: data,
        });

        res.json({leadState, message: "Lead updated"});
    } catch (error) {
        console.log(error);
        res.status(500).json({message: error.code || error.message});
    }
}

// add a note to a lead
export const addLeadNote = async (req, res) => {
    try {
        const {userId} = await req.auth();
        const {workspaceId, content} = req.body;
        if (!await requireCrmMember(req, res, workspaceId)) return;
        const parsed = parseSourceParams(req, res);
        if (!parsed) return;
        const {source, sourceId} = parsed;

        if (!content?.trim()) return res.status(400).json({message: "Note cannot be empty"});

        const [exists] = await query(`SELECT 1 FROM ${LEAD_SOURCES[source].table} WHERE id = $1`, [sourceId]);
        if (!exists) return res.status(404).json({message: "Lead not found"});

        const leadState = await prisma.leadState.upsert({
            where: {workspaceId_source_sourceId: {workspaceId, source, sourceId}},
            create: {workspaceId, source, sourceId},
            update: {},
        });
        const note = await prisma.leadNote.create({
            data: {leadStateId: leadState.id, userId, content: content.trim()},
            include: {user: true},
        });

        res.json({note, leadStateId: leadState.id});
    } catch (error) {
        console.log(error);
        res.status(500).json({message: error.code || error.message});
    }
}

// dashboard tiles: new leads this week, per-source totals, won count
export const getLeadStats = async (req, res) => {
    try {
        const {workspaceId} = req.query;
        if (!await requireCrmMember(req, res, workspaceId)) return;

        const [stats] = await query(`
            SELECT count(*)::int AS total,
                   count(*) FILTER (WHERE x.created_at >= now() - interval '7 days')::int AS new_this_week,
                   count(*) FILTER (WHERE x.status = 'NEW')::int AS untouched,
                   count(*) FILTER (WHERE x.status = 'WON')::int AS won
            FROM (${leadsWithStateSql()}) x`, [workspaceId]);

        res.json({stats});
    } catch (error) {
        console.log(error);
        res.status(500).json({message: error.code || error.message});
    }
}
