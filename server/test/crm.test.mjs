// Runs the real lead/customer controllers against an in-memory Postgres (PGlite) laid out like production:
// EVChamp's tables and a Zeflash-style "User" in `public`, zipcrm's tables in `crm` (from prisma/sql/).
// Only the two database modules are swapped out; every SQL string the API sends is executed for real.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const server = new URL('../', import.meta.url);
const db = new PGlite();

// Zeflash's table of the same name lives in public on the real database - a decoy that must never be hit
await db.exec(`CREATE TABLE public."User" (id text PRIMARY KEY, "clerkUserId" text NOT NULL, email text NOT NULL);
               INSERT INTO public."User" VALUES ('u1', 'zeflash_clerk', 'WRONG-TABLE@zeflash.io');`);
await db.exec(readFileSync(new URL('test/fixtures/evchamp_ddl.sql', server), 'utf8'));
for (const file of readdirSync(new URL('prisma/sql/', server)).sort()) {
    await db.exec(readFileSync(new URL(`prisma/sql/${file}`, server), 'utf8'));
}

const q = async (text, params = []) => (await db.query(text, params)).rows;

// zipcrm workspace with one member (u1) and one outsider (u2)
await db.exec(`
  INSERT INTO crm."User"(id,name,email,"updatedAt") VALUES ('u1','Asha','asha@z.co',now()),('u2','Outsider','o@x.co',now()),
    ('u3','Meena','meena@z.co',now()),('u4','Other Co','oc@y.co',now());
  INSERT INTO crm."Workspace"(id,name,slug,"ownerId","updatedAt") VALUES ('ws1','ZipSure','zipsure','u1',now()),('ws2','OtherCo','otherco','u4',now());
  INSERT INTO crm."WorkspaceMember"(id,"userId","workspaceId",role) VALUES ('m1','u1','ws1','ADMIN'),('m3','u3','ws1','MEMBER'),('m4','u4','ws2','ADMIN');
`);
// EVChamp rows, including the same email across two sources
await db.exec(`
  INSERT INTO contact_submissions(name,email,company,inquiry_type,message,created_at) VALUES
    ('Ravi Kumar','ravi@ex.com','RK Motors','franchise','Want a franchise in Pune', now()-interval '2 days'),
    ('Old Lead','old@ex.com',NULL,'general','hello', now()-interval '30 days');
  INSERT INTO ze_xperience_registrations(mode,name,email,city,finish) VALUES ('testride','Ravi Kumar','RAVI@ex.com','Pune','Matte');
  INSERT INTO offer_leads(car_id,full_name,email,country_code,phone,offer_total,source) VALUES ('c9','Meera','meera@ex.com','+91','98765',150000,'web');
  INSERT INTO used_ev_enquiries(customer_name,customer_email,car_id,car_brand,car_name,car_price) VALUES ('Jay','jay@ex.com',4,'Tata','Nexon EV',900000);
  INSERT INTO sell_ev_listings(user_name,user_email,brand,vehicle_model,year,price,location,contact_number) VALUES ('Sam','sam@ex.com','MG','ZS EV','2022','12L','Delhi','99999');
  INSERT INTO service_centre_listings(business_name,manager_name,phone,email,city,service_type) VALUES ('Volt Care',NULL,'111','vc@ex.com','Mumbai','Battery');
  INSERT INTO test_drive_bookings(reference,car_id,first_name,last_name,email) VALUES ('EVC-1','c1','T','D','td@ex.com');
  INSERT INTO users(clerk_id,email,first_name,last_name) VALUES ('user_ravi','ravi@ex.com','Ravi','Kumar'),('user_nop','nop@ex.com',NULL,NULL);
  INSERT INTO plan_purchases(razorpay_order_id,razorpay_payment_id,clerk_user_id,plan_name,amount_paise) VALUES
    ('o1','p1','user_ravi','RSA Gold',49900),('o2','p2','user_ravi','RSA Gold',49900);
`);

const activeSources = (await import(new URL('crm/leadSources.js', server))).ACTIVE_SOURCES;
const testDriveMapped = activeSources.includes('test_drive');
const TOTAL = testDriveMapped ? 8 : 7;

// Minimal Prisma stand-in over the same database, covering only the calls the CRM code makes
const stateKey = (where) => where.workspaceId_source_sourceId;
const findState = async ({workspaceId, source, sourceId}) =>
    (await q(`SELECT * FROM crm."LeadState" WHERE "workspaceId"=$1 AND source=$2 AND "sourceId"=$3`, [workspaceId, source, sourceId]))[0];
const fakePrisma = {
    user: {
        findUnique: async ({where: {id}}) => (await q(`SELECT * FROM crm."User" WHERE id=$1`, [id]))[0] || null,
    },
    manualLead: {
        findUnique: async ({where: {id}}) => (await q(`SELECT * FROM crm."ManualLead" WHERE id=$1`, [id]))[0] || null,
        create: async ({data}) => (await q(
            `INSERT INTO crm."ManualLead"("workspaceId",channel,name,email,phone,city,company,notes,"createdById","updatedAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now()) RETURNING *`,
            [data.workspaceId, data.channel, data.name, data.email, data.phone, data.city, data.company, data.notes, data.createdById]))[0],
        update: async ({where: {id}, data}) => (await q(
            `UPDATE crm."ManualLead" SET channel=$2,name=$3,email=$4,phone=$5,city=$6,company=$7,notes=$8,"updatedAt"=now() WHERE id=$1 RETURNING *`,
            [id, data.channel, data.name, data.email, data.phone, data.city, data.company, data.notes]))[0],
        delete: async ({where: {id}}) => (await q(`DELETE FROM crm."ManualLead" WHERE id=$1 RETURNING *`, [id]))[0],
    },
    workspaceMember: {
        findUnique: async ({where: {userId_workspaceId: {userId, workspaceId}}}) =>
            (await q(`SELECT * FROM crm."WorkspaceMember" WHERE "userId"=$1 AND "workspaceId"=$2`, [userId, workspaceId]))[0] || null,
    },
    leadState: {
        findUnique: async ({where}) => {
            const state = await findState(stateKey(where));
            if (!state) return null;
            return {
                ...state,
                notes: await q(`SELECT * FROM crm."LeadNote" WHERE "leadStateId"=$1 ORDER BY "createdAt" DESC`, [state.id]),
                tasks: await q(`SELECT * FROM crm."Task" WHERE "leadStateId"=$1`, [state.id]),
            };
        },
        create: async ({data}) => (await q(
            `INSERT INTO crm."LeadState"(id,"workspaceId",source,"sourceId",status,"ownerId","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING *`,
            [randomUUID(), data.workspaceId, data.source, data.sourceId, data.status, data.ownerId]))[0],
        deleteMany: async ({where}) => {
            await q(`DELETE FROM crm."LeadState" WHERE "workspaceId"=$1 AND source=$2 AND "sourceId"=$3`, [where.workspaceId, where.source, where.sourceId]);
        },
        upsert: async ({where, create, update}) => {
            const k = stateKey(where);
            const existing = await findState(k);
            const changes = existing ? update : create;
            if (!existing) await q(`INSERT INTO crm."LeadState"(id,"workspaceId",source,"sourceId","updatedAt") VALUES ($1,$2,$3,$4,now())`, [randomUUID(), k.workspaceId, k.source, k.sourceId]);
            for (const col of ['status', 'ownerId', 'value']) {
                if (col in changes) await q(`UPDATE crm."LeadState" SET "${col}"=$1 WHERE "workspaceId"=$2 AND source=$3 AND "sourceId"=$4`, [changes[col], k.workspaceId, k.source, k.sourceId]);
            }
            return findState(k);
        },
    },
    leadNote: {
        create: async ({data}) => (await q(`INSERT INTO crm."LeadNote"(id,"leadStateId","userId",content) VALUES ($1,$2,$3,$4) RETURNING *`,
            [randomUUID(), data.leadStateId, data.userId, data.content]))[0],
    },
};

process.env.NODE_ENV = 'development';
mock.module(new URL('crm/evchamp.js', server).href, {namedExports: {query: q}, defaultExport: null});
mock.module(new URL('configs/prisma.js', server).href, {defaultExport: fakePrisma});
const leads = await import(new URL('controllers/leadController.js', server));
const customers = await import(new URL('controllers/customerController.js', server));

// Call a controller the way Express would
const call = async (fn, {query = {}, params = {}, body = {}, userId = 'u1'} = {}) => {
    let status = 200, json;
    const res = {status(c) { status = c; return this; }, json(j) { json = j; return this; }};
    await fn({query, params, body, auth: async () => ({userId})}, res);
    return {status, json};
};
const raviContactId = async () => (await q(`SELECT id FROM contact_submissions WHERE email='ravi@ex.com'`))[0].id;

test('lists every active source, newest first, with counts', async () => {
    const {status, json} = await call(leads.getLeads, {query: {workspaceId: 'ws1'}});
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.total, TOTAL);
    assert.deepEqual(
        {...json.countsBySource, test_drive: undefined},
        {contact: 2, ze_xperience: 1, offer: 1, used_ev: 1, sell_ev: 1, service_centre: 1, test_drive: undefined});
    if (testDriveMapped) assert.equal(json.countsBySource.test_drive, 1);
    assert.equal(json.leads.at(-1).name, 'Old Lead');
    assert.equal(json.countsByStatus.NEW, TOTAL);
    const offer = json.leads.find((l) => l.source === 'offer');
    assert.equal(offer.summary, 'Car c9 · ₹150000 · web');
    assert.equal(offer.phone, '+91 98765');
    assert.equal(json.leads.find((l) => l.source === 'service_centre').name, 'Volt Care');
});

test('filters by source, search and date; unknown sources are never interpolated', async () => {
    let r = await call(leads.getLeads, {query: {workspaceId: 'ws1', source: 'contact'}});
    assert.equal(r.json.total, 2);
    r = await call(leads.getLeads, {query: {workspaceId: 'ws1', q: 'ravi'}});
    assert.equal(r.json.total, 2);
    r = await call(leads.getLeads, {query: {workspaceId: 'ws1', from: new Date(Date.now() - 7 * 864e5).toISOString()}});
    assert.equal(r.json.total, TOTAL - 1);
    r = await call(leads.getLeads, {query: {workspaceId: 'ws1', source: "contact'; DROP TABLE users; --"}});
    assert.equal(r.json.total, 0);
    assert.equal((await q('SELECT count(*)::int c FROM users'))[0].c, 2);
});

test('paginates', async () => {
    const r = await call(leads.getLeads, {query: {workspaceId: 'ws1', limit: '3', page: '3'}});
    assert.equal(r.json.leads.length, TOTAL - 6);
    assert.equal(r.json.total, TOTAL);
});

test('rejects non-members', async () => {
    const r = await call(leads.getLeads, {query: {workspaceId: 'ws1'}, userId: 'u2'});
    assert.equal(r.status, 403);
});

test('status update creates LeadState and drives the status filter', async () => {
    const params = {source: 'contact', sourceId: String(await raviContactId())};
    let r = await call(leads.updateLead, {params, body: {workspaceId: 'ws1', status: 'QUALIFIED', ownerId: 'u1', value: 250000}});
    assert.equal(r.status, 200, JSON.stringify(r.json));
    r = await call(leads.getLeads, {query: {workspaceId: 'ws1', status: 'QUALIFIED'}});
    assert.equal(r.json.total, 1);
    assert.equal(r.json.leads[0].owner_name, 'Asha'); // from crm."User", not Zeflash's public."User"
    assert.equal(r.json.leads[0].value, 250000);
    assert.equal(r.json.countsByStatus.NEW, TOTAL - 1);

    r = await call(leads.updateLead, {params, body: {workspaceId: 'ws1', status: 'BOGUS'}});
    assert.equal(r.status, 400);
    r = await call(leads.updateLead, {params: {source: 'contact', sourceId: '99999'}, body: {workspaceId: 'ws1', status: 'WON'}});
    assert.equal(r.status, 404);
    r = await call(leads.updateLead, {params, body: {workspaceId: 'ws1', ownerId: 'u2'}});
    assert.equal(r.status, 400); // owner must be a workspace member
});

test('lead detail returns raw row, notes and same-email enquiries', async () => {
    const params = {source: 'contact', sourceId: String(await raviContactId())};
    const n = await call(leads.addLeadNote, {params, body: {workspaceId: 'ws1', content: '  Called, wants Pune  '}});
    assert.equal(n.status, 200, JSON.stringify(n.json));
    const r = await call(leads.getLead, {params, query: {workspaceId: 'ws1'}});
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.raw.message, 'Want a franchise in Pune');
    assert.equal(r.json.lead.status, 'QUALIFIED');
    assert.equal(r.json.notes[0].content, 'Called, wants Pune');
    assert.deepEqual(r.json.related.map((l) => l.source), ['ze_xperience']); // case-insensitive email match
});

test('stats', async () => {
    const r = await call(leads.getLeadStats, {query: {workspaceId: 'ws1'}});
    assert.deepEqual(r.json.stats, {total: TOTAL, new_this_week: TOTAL - 1, untouched: TOTAL - 1, won: 0});
});

test('customers with purchases and lead counts', async () => {
    let r = await call(customers.getCustomers, {query: {workspaceId: 'ws1'}});
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.total, 2);
    const ravi = r.json.customers.find((c) => c.clerk_id === 'user_ravi');
    assert.equal(ravi.purchase_count, 2);
    assert.equal(Number(ravi.total_paise), 99800);
    assert.equal(ravi.lead_count, 2);
    assert.equal(r.json.customers.find((c) => c.clerk_id === 'user_nop').name, null);
    r = await call(customers.getCustomer, {params: {clerkId: 'user_ravi'}, query: {workspaceId: 'ws1'}});
    assert.equal(r.json.purchases.length, 2);
    assert.equal(r.json.leads.find((l) => l.source === 'contact').status, 'QUALIFIED');
});

test('zipcrm data stays in the crm schema; Zeflash public."User" untouched', async () => {
    assert.deepEqual(await q(`SELECT email FROM public."User"`), [{email: 'WRONG-TABLE@zeflash.io'}]);
    const tables = (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='crm' ORDER BY 1`)).map((r) => r.table_name);
    assert.deepEqual(tables, ['Comment', 'LeadNote', 'LeadState', 'ManualLead', 'Project', 'ProjectMember', 'Task', 'User', 'Workspace', 'WorkspaceMember']);
});

// ---- Manually added leads ----

const addLead = (body, userId) => call(leads.createManualLead, {body: {workspaceId: 'ws1', ...body}, userId});

test('a member adds a WhatsApp lead; it lists with its channel and can be filtered by channel', async () => {
    const before = (await call(leads.getLeads, {query: {workspaceId: 'ws1'}})).json.total;
    const r = await addLead({name: ' Priya Shah ', phone: '+91 90000 11111', channel: 'WHATSAPP', city: 'Pune', notes: 'Wants a franchise in Baner', ownerId: 'u3'}, 'u3');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.source, 'manual');

    let list = await call(leads.getLeads, {query: {workspaceId: 'ws1'}});
    assert.equal(list.json.total, before + 1);
    const priya = list.json.leads.find((l) => l.source === 'manual');
    assert.equal(priya.name, 'Priya Shah');
    assert.equal(priya.channel, 'WHATSAPP');
    assert.equal(priya.summary, 'Wants a franchise in Baner');
    assert.equal(priya.owner_name, 'Meena');
    assert.equal(list.json.leads[0].source, 'manual'); // newest first

    list = await call(leads.getLeads, {query: {workspaceId: 'ws1', channel: 'WHATSAPP'}});
    assert.deepEqual(list.json.leads.map((l) => l.name), ['Priya Shah']);
    list = await call(leads.getLeads, {query: {workspaceId: 'ws1', channel: 'INSTAGRAM'}});
    assert.equal(list.json.total, 0);

    const detail = await call(leads.getLead, {params: {source: 'manual', sourceId: String(r.json.sourceId)}, query: {workspaceId: 'ws1'}});
    assert.equal(detail.status, 200, JSON.stringify(detail.json));
    assert.equal(detail.json.raw.added_by, 'Meena');
});

test('manual leads are private to their workspace', async () => {
    const [{id}] = await q(`SELECT id FROM crm."ManualLead" WHERE name='Priya Shah'`);
    const list = await call(leads.getLeads, {query: {workspaceId: 'ws2'}, userId: 'u4'});
    assert.equal(list.json.leads.filter((l) => l.source === 'manual').length, 0);
    assert.equal(list.json.total, TOTAL); // still sees the shared EVChamp leads
    const detail = await call(leads.getLead, {params: {source: 'manual', sourceId: String(id)}, query: {workspaceId: 'ws2'}, userId: 'u4'});
    assert.equal(detail.status, 404);
    const patch = await call(leads.updateLead, {params: {source: 'manual', sourceId: String(id)}, body: {workspaceId: 'ws2', status: 'WON'}, userId: 'u4'});
    assert.equal(patch.status, 404);
});

test('validation: name, phone or email, and a known channel', async () => {
    assert.equal((await addLead({phone: '1', channel: 'WHATSAPP'}, 'u1')).status, 400);
    assert.equal((await addLead({name: 'No Contact', channel: 'WHATSAPP'}, 'u1')).status, 400);
    assert.equal((await addLead({name: 'Bad Mail', email: 'nope', channel: 'EMAIL'}, 'u1')).status, 400);
    assert.equal((await addLead({name: 'No Channel', phone: '1'}, 'u1')).status, 400);
    assert.equal((await addLead({name: 'Fake Channel', phone: '1', channel: 'MYSPACE'}, 'u1')).status, 400);
    assert.equal((await addLead({name: 'Outsider', phone: '1', channel: 'OTHER'}, 'u2')).status, 403);
});

test('only the person who added a lead, or an admin, can edit or delete it', async () => {
    const admins = await addLead({name: 'Insta Lead', email: 'insta@ex.com', channel: 'INSTAGRAM'}, 'u1');
    const id = String(admins.json.sourceId);
    // member u3 cannot edit or delete the admin's lead
    let r = await call(leads.updateManualLead, {params: {id}, body: {workspaceId: 'ws1', name: 'Hacked', email: 'insta@ex.com', channel: 'INSTAGRAM'}, userId: 'u3'});
    assert.equal(r.status, 403);
    r = await call(leads.deleteManualLead, {params: {id}, query: {workspaceId: 'ws1'}, userId: 'u3'});
    assert.equal(r.status, 403);
    // the admin edits their own lead
    r = await call(leads.updateManualLead, {params: {id}, body: {workspaceId: 'ws1', name: 'Insta Lead', email: 'insta@ex.com', phone: '999', channel: 'INSTAGRAM'}, userId: 'u1'});
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.lead.phone, '999');

    // the admin can delete the member's lead, and its CRM state goes with it
    const [{id: priya}] = await q(`SELECT id FROM crm."ManualLead" WHERE name='Priya Shah'`);
    await call(leads.updateLead, {params: {source: 'manual', sourceId: String(priya)}, body: {workspaceId: 'ws1', status: 'CONTACTED'}, userId: 'u3'});
    r = await call(leads.deleteManualLead, {params: {id: String(priya)}, query: {workspaceId: 'ws1'}, userId: 'u1'});
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await q(`SELECT count(*)::int c FROM crm."LeadState" WHERE source='manual' AND "sourceId"=$1`, [priya]))[0].c, 0);
    const list = await call(leads.getLeads, {query: {workspaceId: 'ws1', channel: 'WHATSAPP'}});
    assert.equal(list.json.total, 0);
});
