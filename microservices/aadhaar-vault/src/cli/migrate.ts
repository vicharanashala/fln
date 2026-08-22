/**
 * CLI entrypoint for `npm run migrate`.
 *
 * This file is intentionally a *thin process-boundary wrapper* around
 * the library {@link runMigrations}. It owns the Node-only concerns
 * (env-var resolution, banner formatting, exit codes, pool teardown)
 * and nothing else. The library API stays untouched so that
 * `tests/db.test.ts` can exercise `runMigrations` against `pg-mem`
 * without dragging in `process.exit` or argv-parsing.
 *
 * Why a dedicated migration CLI rather than automatic startup migrations
 * ─────────────────────────────────────────────────────────────────────
 *
 * The library `runMigrations` in `src/db/migrator.ts` is *idempotent*
 * (the `vault_schema_migrations` ledger guarantees a given SQL file is
 * applied at most once), but idempotence is **not** the same as
 * "automatically safe on every API boot". We deliberately keep
 * migrations as an explicit operator step — not a side effect of
 * `node dist/server.js` — for four reasons:
 *
 *   1. Failure isolation. A failed migration aborts the CLI with
 *      exit 1; it does not wedge Fastify's readiness probe in a
 *      half-migrated state where `/health/ready` oscillates between
 *      "ok" and "degraded" while the operator races to intervene.
 *
 *   2. Replica stampede control. With N API replicas booting in
 *      parallel, each one would race to create the ledger table and
 *      replay the migrations. Postgres serializes the inserts so the
 *      ledger is safe — but you get N copies of every `CREATE TABLE`
 *      statement contending on the catalog lock, wasting bandwidth on
 *      every production deploy.
 *
 *   3. Explicit operator action in the deploy pipeline. Migrations
 *      belong to the *schema* step of a rollout (run before the new
 *      code goes live, with the old code still serving traffic). A
 *      boot-time hook couples the schema change to the application
 *      rollout and prevents staged rollbacks ("roll the API back to
 *      vN, keep schema at vN+1"). Keeping them separate also makes
 *      schema-only hotfixes (e.g. a `CREATE INDEX CONCURRENTLY` to
 *      unblock a slow query) cheap to ship without a deploy.
 *
 *   4. Testability. Keeping `runMigrations` a pure library lets
 *      `tests/db.test.ts` exercise the runner via `pg-mem` directly,
 *      without dragging in `process.exit` / argv-parsing concerns. The
 *      CLI is process glue; the runner is the artifact under test.
 *
 * How `VAULT_DB_URI` reaches `process.env`
 * ─────────────────────────────────────────
 *
 * Three layers, in priority order:
 *
 *   1. Shell-exported variable. `export VAULT_DB_URI=postgres://…`
 *      always wins. Production / CI uses this path — no `.env` file
 *      lives on the box, the orchestrator hands the secret in
 *      directly. This is the only path that survives a missing
 *      `.env`.
 *
 *   2. `.env` auto-load via `tsx --env-file=.env`. The `package.json`
 *      script wires this in directly:
 *
 *          "migrate": "tsx --env-file=.env src/cli/migrate.ts"
 *
 *      so a developer running `npm run migrate` from a clone with a
 *      populated `.env` does not need to `source` it manually. The
 *      flag was added to Node in 20.6.0 and is passed through by
 *      `tsx` 4.x. No `dotenv` runtime dep is added — that matches the
 *      explicit-env philosophy of `src/config.ts` and keeps the
 *      dependency surface flat.
 *
 *   3. Documented fallback. If neither (1) nor (2) provides a
 *      non-empty `VAULT_DB_URI`, the CLI exits 1 with an actionable
 *      hint pointing at `cp .env.example .env`,
 *      `docker compose up -d postgres`, and a raw `export …` example.
 *      A developer who doesn't want a `.env` file at all can run the
 *      script with `npx tsx src/cli/migrate.ts` (skipping the
 *      `--env-file` flag) and supply `VAULT_DB_URI` in the shell.
 *
 * Scope
 * ──────
 *
 * This file is the *only* place in the vault that:
 *   - calls `process.exit`
 *   - reads `VAULT_DB_URI` directly
 *   - calls `pool.end()`
 *
 * See AADHAAR_VAULT_FREE_ARCHITECTURE.md §3.2 (migrations) and §5.1
 * (process-boundary concerns kept out of `application/`).
 */
import { createRealPool } from '../db/pool.js';
import { runMigrations } from '../db/migrator.js';

const TAG = '[aadhaar-vault]';

interface SafeDbTarget {
    scheme: string;
    host: string;
    port: string;
    database: string;
}

/**
 * Parse a postgres URI and return only the *non-secret* components.
 *
 * `userinfo` (`user:password`) is intentionally dropped — passwords
 * belong in a vault, not in startup logs. If `URL` cannot parse the
 * URI we return `<unparseable>` placeholders rather than echoing the
 * raw string (which might contain credentials).
 */
function describeTarget(uri: string): SafeDbTarget {
    try {
        const u = new URL(uri);
        return {
            scheme: u.protocol.replace(/:$/, ''),
            host: u.hostname || '<unknown>',
            port: u.port || '5432',
            database: u.pathname.replace(/^\//, '') || '<unknown>',
        };
    } catch {
        return {
            scheme: 'unknown',
            host: '<unparseable>',
            port: '<unparseable>',
            database: '<unparseable>',
        };
    }
}

/**
 * Render the startup banner. Includes target DB host/port/db (no
 * credentials), `NODE_ENV`, and the Node runtime version. Useful for
 * confirming which environment a CI job actually targeted.
 */
function logBanner(target: SafeDbTarget): void {
    console.log(
        `${TAG}\n\n` +
            `Migrating database\n\n` +
            `Target:\n${target.scheme}://${target.host}:${target.port}/${target.database}\n\n` +
            `Environment:\n${process.env['NODE_ENV'] ?? 'unset'}\n\n` +
            `Node:\n${process.version}\n`,
    );
}

/**
 * Render an error + cause chain so the operator can act on it without
 * a debugger.
 *
 * `pg` driver errors carry SQLSTATE in `code`, severity in `severity`,
 * and human hints in `detail` / `hint` / `position`. We surface every
 * one of those verbatim. Wrapped errors (e.g. a `pg`-driver error
 * bubbling through a higher layer) are walked via `Error.cause` up to
 * 5 hops so the operator sees the full chain. The stack is appended
 * once, on the topmost error, so logs stay scannable.
 */
function renderError(err: unknown): string {
    const parts: string[] = [];
    let cur: unknown = err;
    let depth = 0;
    while (cur && depth < 5) {
        if (cur instanceof Error) {
            const e = cur as Error & {
                code?: unknown;
                severity?: unknown;
                detail?: unknown;
                hint?: unknown;
                position?: unknown;
            };
            const head =
                depth === 0
                    ? `${e.name}: ${e.message}`
                    : `caused by ${e.name}: ${e.message}`;
            parts.push(head);
            if (typeof e.code === 'string') parts.push(`  code: ${e.code}`);
            if (typeof e.severity === 'string')
                parts.push(`  severity: ${e.severity}`);
            if (typeof e.detail === 'string') parts.push(`  detail: ${e.detail}`);
            if (typeof e.hint === 'string') parts.push(`  hint: ${e.hint}`);
            if (typeof e.position === 'string')
                parts.push(`  position: ${e.position}`);
            cur = e.cause;
        } else {
            parts.push(`non-Error thrown: ${String(cur)}`);
            break;
        }
        depth++;
    }
    if (err instanceof Error && err.stack) {
        parts.push(`stack:\n${err.stack}`);
    }
    return parts.join('\n');
}

function missingUriMessage(): string {
    return (
        `${TAG} migrate FAILED: VAULT_DB_URI is not set.\n` +
        `  - Copy .env.example to .env and fill VAULT_DB_URI, OR\n` +
        `  - Run \`docker compose up -d postgres\` (it prints a ready URI), OR\n` +
        `  - export VAULT_DB_URI=postgres://user:pass@host:5432/db in your shell.\n` +
        `  Then re-run \`npm run migrate\`.`
    );
}

function formatList(label: string, items: readonly string[]): string {
    if (items.length === 0) return `${label} (0):\n  (none)`;
    const body = items.map((v) => `  - ${v}`).join('\n');
    return `${label} (${items.length}):\n${body}`;
}

async function main(): Promise<void> {
    const connectionString = process.env['VAULT_DB_URI'];
    if (
        connectionString === undefined ||
        connectionString.length === 0
    ) {
        console.error(missingUriMessage());
        process.exit(1);
    }

    const target = describeTarget(connectionString);
    logBanner(target);

    const pool = createRealPool(connectionString);
    try {
        const result = await runMigrations(pool);
        console.log(
            `${TAG} migrate ok\n\n` +
                `${formatList('Applied', result.applied)}\n\n` +
                `${formatList('Skipped', result.skipped)}\n\n` +
                `Discovered: ${result.discovered}\n`,
        );
    } finally {
        // Always end the pool. On the error path the process is about
        // to exit anyway, but node's default SIGTERM handling can leak
        // Postgres sockets on CI if we skip this.
        await pool.end().catch(() => undefined);
    }
}

main().catch((err: unknown) => {
    console.error(`${TAG} migrate FAILED:\n${renderError(err)}`);
    process.exit(1);
});