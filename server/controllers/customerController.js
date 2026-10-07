import { query } from "../crm/evchamp.js";
import { requireCrmMember } from "../crm/access.js";
import { leadsUnionSql } from "../crm/leadSources.js";

// EVChamp signed-up users (Clerk) with their plan purchases and a count of leads sharing their email
// `ws` is the placeholder holding the workspace id, so manual leads are counted per workspace
const customersSql = (ws) => `
    WITH leads AS (${leadsUnionSql(ws)}),
         lead_counts AS (SELECT lower(email) AS email, count(*)::int AS lead_count FROM leads WHERE email IS NOT NULL GROUP BY 1),
         purchases AS (
            SELECT clerk_user_id, count(*)::int AS purchase_count, sum(amount_paise)::bigint AS total_paise, max(created_at) AS last_purchase_at
            FROM public.plan_purchases WHERE clerk_user_id IS NOT NULL GROUP BY 1
         )
    SELECT u.clerk_id, nullif(concat_ws(' ', u.first_name, u.last_name), '') AS name, u.email, u.image_url,
           u.created_at, u.last_sign_in_at,
           COALESCE(p.purchase_count, 0) AS purchase_count, COALESCE(p.total_paise, 0) AS total_paise, p.last_purchase_at,
           COALESCE(lc.lead_count, 0) AS lead_count
    FROM public.users u
    LEFT JOIN purchases p ON p.clerk_user_id = u.clerk_id
    LEFT JOIN lead_counts lc ON lc.email = lower(u.email)`;

// get customers
export const getCustomers = async (req, res) => {
    try {
        const {workspaceId, q} = req.query;
        if (!await requireCrmMember(req, res, workspaceId)) return;

        const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
        const page = Math.max(Number(req.query.page) || 1, 1);

        const rows = await query(`
            SELECT c.*, count(*) OVER()::int AS total FROM (${customersSql('$4')}) c
            WHERE ($1::text IS NULL OR c.name ILIKE $1 OR c.email ILIKE $1)
            ORDER BY c.last_sign_in_at DESC NULLS LAST
            LIMIT $2 OFFSET $3`,
            [q ? `%${q}%` : null, limit, (page - 1) * limit, workspaceId]);

        res.json({customers: rows.map(({total, ...c}) => c), total: rows[0]?.total || 0, page, limit});
    } catch (error) {
        console.log(error);
        res.status(500).json({message: error.code || error.message});
    }
}

// get one customer with purchases and matching leads
export const getCustomer = async (req, res) => {
    try {
        const {workspaceId} = req.query;
        if (!await requireCrmMember(req, res, workspaceId)) return;

        const [customer] = await query(`SELECT * FROM (${customersSql('$2')}) c WHERE c.clerk_id = $1`, [req.params.clerkId, workspaceId]);
        if (!customer) return res.status(404).json({message: "Customer not found"});

        const [purchases, leads] = await Promise.all([
            query(`SELECT id, plan_name, description, amount_paise, currency, razorpay_payment_id, created_at
                   FROM public.plan_purchases WHERE clerk_user_id = $1 ORDER BY created_at DESC`, [customer.clerk_id]),
            customer.email
                ? query(`WITH leads AS (${leadsUnionSql('$2')})
                         SELECT l.*, COALESCE(s.status::text, 'NEW') AS status FROM leads l
                         LEFT JOIN crm."LeadState" s ON s.source = l.source AND s."sourceId" = l.source_id AND s."workspaceId" = $2
                         WHERE lower(l.email) = lower($1) ORDER BY l.created_at DESC`, [customer.email, workspaceId])
                : [],
        ]);

        res.json({customer, purchases, leads});
    } catch (error) {
        console.log(error);
        res.status(500).json({message: error.code || error.message});
    }
}
