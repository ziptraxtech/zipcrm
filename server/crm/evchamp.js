import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

// Read-only access to the EVChamp tables, which live in the same Neon database as zipcrm.
// EVCHAMP_DATABASE_URL lets this point at a SELECT-only Neon role; it falls back to DATABASE_URL.
// Queries go through `sql.query(text, params)` so every request value is a bound parameter.
const sql = neon(process.env.EVCHAMP_DATABASE_URL || process.env.DATABASE_URL);

export const query = (text, params = []) => sql.query(text, params);

export default sql;
