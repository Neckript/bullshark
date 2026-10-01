import { db } from '.';

// Drizzle rebuilds the SQL on every call. Measured on this machine: the
// one-row `settings` select costs 233us rebuilt against 0.5us prepared, while
// the database itself answers in 0.4us, and the heavier `getUserById` select
// (24 columns, two left joins) is worse still - the whole function drops from
// 1411us to 65us once its two queries are prepared.
//
// Preparing rather than caching results: the statement still hits the
// database, so there is nothing to invalidate and no way to serve stale rows.
// That matters here - `cli/new-owner-token.ts` writes from a SECOND process
// while the server is running, and a result cache would never see it.
//
// The statements cannot simply live in a module-level variable. The test
// harness builds a fresh in-memory database in `beforeEach` and injects it
// through a Proxy, so a statement held across that swap would be bound to a
// closed sqlite handle and every test after the first would fail. Keying on
// `db.$client` - verified by probe to be a distinct object per test database -
// rebuilds them per database and lets the old ones be collected with it.
const byClient = new WeakMap<object, Map<object, unknown>>();

/**
 * Wraps a statement builder so the statement is prepared once per database.
 *
 * ```ts
 * const userStatement = prepared(() =>
 *   db.select().from(users).where(eq(users.id, sql.placeholder('id'))).prepare()
 * );
 *
 * const user = await userStatement().get({ id: 1 });
 * ```
 */
const prepared = <T>(build: () => T): (() => T) => {
  return () => {
    // $client exists at runtime (drizzle() returns it, and the test Proxy
    // forwards it) but is not on the exported BunSQLiteDatabase type.
    const client = (db as unknown as { $client: object }).$client;

    let statements = byClient.get(client);

    if (!statements) {
      statements = new Map();
      byClient.set(client, statements);
    }

    let statement = statements.get(build) as T | undefined;

    if (!statement) {
      statement = build();
      statements.set(build, statement);
    }

    return statement;
  };
};

export { prepared };
