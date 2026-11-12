/** Validate Render startup without logging credentials or touching the database. */
export function renderRuntime(env) {
 if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required. Reuse the existing external database; local storage is not persistent on Render Free.');
 const database = new URL(env.DATABASE_URL);
 if (!['postgres:', 'postgresql:'].includes(database.protocol)) throw new Error('DATABASE_URL must point to PostgreSQL.');
 if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) throw new Error('Set the existing BETTER_AUTH_SECRET (at least 32 characters).');
 const url = new URL(env.APP_URL || env.RENDER_EXTERNAL_URL || '');
 if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('APP_URL must be an HTTPS origin without credentials, path or query.');
 const port = Number(env.PORT || 10000);
 if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
 return {origin:url.origin,port};
}
