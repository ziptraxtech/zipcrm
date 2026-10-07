// Copies Clerk users, organizations and memberships into zipcrm's crm tables.
//
// In production the Clerk -> Inngest webhooks (inngest/index.js) keep these in sync. Webhooks cannot
// reach localhost, so run this after signing up locally, or to backfill after connecting Inngest late:
//   npm run sync:clerk
// Safe to re-run: every write is an upsert. It never deletes and only touches crm.* tables.
import 'dotenv/config';
import prisma from '../configs/prisma.js';

const CLERK_API = 'https://api.clerk.com/v1';

const clerk = async (path) => {
    const res = await fetch(`${CLERK_API}${path}`, {headers: {Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`}});
    if (!res.ok) throw new Error(`Clerk ${path} -> ${res.status} ${await res.text()}`);
    return res.json();
}

// Clerk list endpoints return either an array or {data, total_count}; page through both shapes
const listAll = async (path) => {
    const items = [];
    for (let offset = 0; ; offset += 100) {
        const page = await clerk(`${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${offset}`);
        const rows = Array.isArray(page) ? page : page.data;
        items.push(...rows);
        if (rows.length < 100) return items;
    }
}

const fullName = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Unnamed user';
const primaryEmail = (u) => (u.email_addresses.find((e) => e.id === u.primary_email_address_id) || u.email_addresses[0])?.email_address;

const users = await listAll('/users');
for (const u of users) {
    const data = {email: primaryEmail(u), name: fullName(u), image: u.image_url || ''};
    await prisma.user.upsert({where: {id: u.id}, create: {id: u.id, ...data}, update: data});
}
console.log(`users: ${users.length} synced`);

const orgs = await listAll('/organizations');
let memberships = 0;
for (const o of orgs) {
    const data = {name: o.name, slug: o.slug || o.id, ownerId: o.created_by, image_url: o.image_url || ''};
    await prisma.workspace.upsert({where: {id: o.id}, create: {id: o.id, ...data}, update: data});

    for (const m of await listAll(`/organizations/${o.id}/memberships`)) {
        const userId = m.public_user_data.user_id;
        const role = m.role === 'org:admin' ? 'ADMIN' : 'MEMBER';
        await prisma.workspaceMember.upsert({
            where: {userId_workspaceId: {userId, workspaceId: o.id}},
            create: {userId, workspaceId: o.id, role},
            update: {role},
        });
        memberships++;
    }
    console.log(`workspace: "${o.name}"  id=${o.id}`);
}
console.log(`workspaces: ${orgs.length}, memberships: ${memberships} synced`);
await prisma.$disconnect();
