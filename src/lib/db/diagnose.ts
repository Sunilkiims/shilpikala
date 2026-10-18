/**
 * Turns a raw database failure during start-up (connect, migrate, seed) into a message that says
 * what failed and what to check. The original error is kept as `cause` and its message is kept in
 * the text, so nothing is hidden; this only adds the missing context (which host, which step).
 */

type PgLikeError = Error & { code?: string; migrationId?: string };

/** `host:port/dbname` with no user name or password. */
export function describeDatabaseTarget(url: string | undefined): string {
  if (!url) return "embedded database";
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname || ""}`;
  } catch {
    return "(DATABASE_URL is not a valid URL)";
  }
}

export function hintForDatabaseError(error: PgLikeError): string | undefined {
  const text = `${error.code ?? ""} ${error.message ?? ""}`;
  if (/Tenant or user not found/i.test(text))
    return "The pooler rejected the user name. Supabase pooler URLs need the user in the form postgres.<project-ref>; copy the exact connection string from the provider.";
  if (/password authentication failed|authentication failed|SASL/i.test(text))
    return "Wrong user or password in DATABASE_URL. If the password contains characters like @ # / : ? it must be URL-encoded.";
  if (/ENOTFOUND|EAI_AGAIN/i.test(text))
    return "The database host name could not be found. Check the host in DATABASE_URL.";
  if (/ECONNREFUSED|ETIMEDOUT|timeout|Connection terminated/i.test(text))
    return "The database could not be reached from this machine. Check the host and port, and that the database allows connections from Vercel (IP allow-list, paused or sleeping database).";
  if (/SSL|TLS|self-signed|certificate/i.test(text))
    return "SSL mismatch. Add ?sslmode=require to DATABASE_URL, or set DATABASE_SSL=true (or no-verify for providers with self-signed certificates). Use DATABASE_SSL=false for a database without SSL.";
  if (
    /too many (clients|connections)|max(imum)? clients|remaining connection slots|MaxClients|EMAXCONN/i.test(
      text,
    )
  )
    return "The database's connection limit was reached. Use the provider's pooled connection string and keep DATABASE_POOL_MAX low (1 to 3) on Vercel.";
  if (/prepared statement/i.test(text))
    return "The connection pooler is in a mode that does not support this. Use the pooler's session-mode or direct connection string for DATABASE_URL.";
  if (/permission denied/i.test(text))
    return "The database user cannot create tables. Use a user that owns the database (the app creates its own tables on first start).";
  if (/already exists|does not exist/i.test(text))
    return "The tables in this database do not match this version of the app. Run `npm run db:check` against it, and do not point two different projects at the same database.";
  return undefined;
}

export function explainDatabaseFailure(
  error: unknown,
  url: string | undefined,
): Error {
  const err = (
    error instanceof Error ? error : new Error(String(error))
  ) as PgLikeError;
  const step = err.migrationId
    ? `migration ${err.migrationId}`
    : "connecting or preparing the database";
  const hint = hintForDatabaseError(err);
  const code = err.code ? ` [code ${err.code}]` : "";
  const wrapped = new Error(
    `Database setup failed while ${step} (${describeDatabaseTarget(url)}): ${err.message || err.name}${code}${hint ? `\n  Hint: ${hint}` : ""}`,
    { cause: error },
  );
  wrapped.name = "DatabaseSetupError";
  return wrapped;
}
