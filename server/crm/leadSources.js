// Registry of EVChamp tables that the CRM shows as leads.
//
// Every `select` maps its table onto one common lead shape so they can be UNION ALL'd:
//   source, source_id, name, email, phone, city, company, summary, source_status, created_at,
//   channel, workspace_id
// Columns must appear in exactly that order and with those types. EVChamp leads have no channel
// and belong to every CRM workspace (workspace_id NULL); manually added leads have both.
//
// These strings are constants and the only SQL that is ever interpolated into queries.
// Never build a select from request input: filter with query parameters instead.
// EVChamp owns these tables in the `public` schema (see EVChamp/api/index.js initDB) - the CRM only reads them.
// Always schema-qualify: zipcrm's own tables live in `crm`, and public also holds Zeflash's "User".

export const LEAD_SOURCES = {
    contact: {
        label: 'Contact & Franchise',
        table: 'public.contact_submissions',
        select: `
            SELECT 'contact'::text, id, name, email, NULL::text, NULL::text, company,
                   concat_ws(' · ', inquiry_type, left(message, 160)),
                   NULL::text, created_at, NULL::text, NULL::text
            FROM public.contact_submissions`,
    },

    test_drive: {
        label: 'Test Drive',
        table: 'public.test_drive_bookings',
        // TODO(you): map test_drive_bookings onto the lead shape.
        // Available columns: id, reference, car_id, first_name, last_name, email, country_code,
        //   phone, city, preferred_date (TEXT), address, time_slot, created_at
        // Decide: what goes in `summary`, and is the lead's date `created_at` (when they booked)
        //   or the preferred drive date? The list is sorted by this date.
        select: null,
    },

    ze_xperience: {
        label: 'Ze.Xperience',
        table: 'public.ze_xperience_registrations',
        select: `
            SELECT 'ze_xperience'::text, id, name, email, NULL::text, city, NULL::text,
                   concat_ws(' · ', CASE mode WHEN 'testride' THEN 'Test ride' ELSE 'Registered interest' END, finish),
                   NULL::text, created_at, NULL::text, NULL::text
            FROM public.ze_xperience_registrations`,
    },

    offer: {
        label: 'Marketplace Offer',
        table: 'public.offer_leads',
        select: `
            SELECT 'offer'::text, id, full_name, email, concat_ws(' ', country_code, phone), NULL::text, NULL::text,
                   concat_ws(' · ', 'Car ' || car_id, '₹' || offer_total, source),
                   NULL::text, created_at, NULL::text, NULL::text
            FROM public.offer_leads`,
    },

    used_ev: {
        label: 'Used EV Enquiry',
        table: 'public.used_ev_enquiries',
        select: `
            SELECT 'used_ev'::text, id, customer_name, customer_email, NULL::text, NULL::text, NULL::text,
                   concat_ws(' · ', concat_ws(' ', car_brand, car_name), '₹' || car_price),
                   NULL::text, created_at, NULL::text, NULL::text
            FROM public.used_ev_enquiries`,
    },

    sell_ev: {
        label: 'Sell My EV',
        table: 'public.sell_ev_listings',
        select: `
            SELECT 'sell_ev'::text, id, user_name, user_email, contact_number, location, NULL::text,
                   concat_ws(' · ', concat_ws(' ', brand, vehicle_model, year), price, mileage),
                   status, created_at, NULL::text, NULL::text
            FROM public.sell_ev_listings`,
    },

    service_centre: {
        label: 'Service Centre',
        table: 'public.service_centre_listings',
        select: `
            SELECT 'service_centre'::text, id, coalesce(manager_name, business_name), email, phone, city, business_name,
                   service_type,
                   status, created_at, NULL::text, NULL::text
            FROM public.service_centre_listings`,
    },

    manual: {
        label: 'Added manually',
        table: 'crm."ManualLead"',
        workspaceScoped: true,
        // `ws` is a query placeholder such as $1 chosen by our own code, never request input
        select: (ws) => `
            SELECT 'manual'::text, id, name, email, phone, city, company,
                   left(notes, 160),
                   NULL::text, "createdAt" AT TIME ZONE 'UTC', channel::text, "workspaceId"
            FROM crm."ManualLead" WHERE "workspaceId" = ${ws}`,
    },
}

// Sources whose mapping is filled in; unfinished ones are skipped rather than breaking the union
export const ACTIVE_SOURCES = Object.keys(LEAD_SOURCES).filter((key) => LEAD_SOURCES[key].select)

export const isLeadSource = (key) => ACTIVE_SOURCES.includes(key)

// UNION ALL of every active source, with column names applied once.
// `ws` is the placeholder that holds the workspace id in the calling query (e.g. '$1'):
// workspace-scoped sources only return that workspace's rows.
export const leadsUnionSql = (ws) => `
    SELECT * FROM (
        ${ACTIVE_SOURCES.map((key) => {
            const {select} = LEAD_SOURCES[key];
            return typeof select === 'function' ? select(ws) : select;
        }).join('\n        UNION ALL\n')}
    ) AS all_leads (source, source_id, name, email, phone, city, company, summary, source_status, created_at,
                    channel, workspace_id)`

// Query for one source row by id, scoped to the workspace where the source requires it.
// Returns [text, params] so the parameter count always matches the placeholders.
export const sourceRowQuery = (source, id, workspaceId, columns = '*') => {
    const text = `SELECT ${columns} FROM ${LEAD_SOURCES[source].table} WHERE id = $1`;
    return LEAD_SOURCES[source].workspaceScoped
        ? [`${text} AND "workspaceId" = $2`, [id, workspaceId]]
        : [text, [id]];
}
