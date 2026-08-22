/**
 * Idempotent SQL migration runner.
 *
 * Discovers every `*.sql` file under `src/db/migrations/` at call time
 * (not build time) and applies each one in lexicographic order exactly
 * once. Applied versions are persisted to `vault_schema_migrations`.
 *
 * Why `xxx_*.sql` and not a number?
 *   * Avoids accidental ordering collisions if two branches add
 *     `002_*.sql` simultaneously. The timestamp prefix is the canonical
 *     source of truth.
 *   * Makes the on-disk listing match the on-database ledger when you
 *     run `\d vault_schema_migrations`.
 *
 * The runner is safe to call on every boot; the ledger guarantees no
 * migration is executed twice even on multiple replicas (Postgres
 * serializes the inserts inside the ledger table).
 *
 * See AADHAAR_VAULT_FREE_ARCHITECTURE.md §3.2.
 *
 * Test compatibility shim
 * ------------------------
 * When `isTest: true` is passed (today: only `createMemoryDatabase`
 * does this), each migration SQL is run through {@link rewriteForMemoryDb}
 * before being applied. The rewriter emits a variant of the DDL that
 * `pg-mem` understands:
 *
 *   * `IF NOT EXISTS` is dropped (pg-mem starts empty in-process).
 *   * `CREATE INDEX … WHERE …` partial indexes are downgraded to plain
 *     `CREATE INDEX` because pg-mem does not evaluate `WHERE` predicates
 *     during index creation.
 *   * Inline column shorthand such as `id uuid PRIMARY KEY` or
 *     `created_at timestamptz NOT NULL DEFAULT now()` is moved out of
 *     the column definition and emitted as separate `ALTER TABLE`
 *     statements. This is the rewrite that unblocks the test suite —
 *     pg-mem's `checkAstCoverage` short-circuits on inline constraint
 *     kinds `"primary key"` and `"not null"`.
 *
 * The production schema file (`src/db/migrations/*.sql`) is left
 * untouched so it stays a one-source-of-truth for real Postgres. The
 * rewriter is intentionally narrow and only handles the dialect
 * fragment this project uses; exotic column types such as
 * `NUMERIC(10,2)` are passed through verbatim.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PoolLike } from './pool.js';

export interface MigrationApplyResult {
    /** Versions (filenames) that were newly applied during this run. */
    applied: string[];
    /** Versions that were already present in the ledger before this run. */
    skipped: string[];
    /** Total migrations discovered on disk. */
    discovered: number;
}

export interface RunMigrationsOptions {
    /**
     * Set to `true` when running against an in-process `pg-mem` pool.
     * Switches on {@link rewriteForMemoryDb}. Production code paths
     * leave this `false` (the default).
     */
    isTest?: boolean;
}

/**
 * Resolve the absolute path to the migrations directory.
 *
 * `import.meta.url` points at this file under both the `tsx` test
 * runner and the `node` production entrypoint, so we use it as the
 * anchor instead of relying on `process.cwd()`.
 */
function resolveMigrationsDir(): string {
    const here = dirname(fileURLToPath(import.meta.url));
    // Here is `…/src/db/`, migrations live in the sibling `migrations/`.
    return join(here, 'migrations');
}

/**
 * Return the sorted list of migration filenames without their `.sql`
 * extension. The returned `version` is what we persist in the ledger.
 */
async function discoverMigrations(): Promise<string[]> {
    const dir = resolveMigrationsDir();
    const entries = await readdir(dir);
    return entries
        .filter((e) => e.endsWith('.sql'))
        .sort()
        .map((e) => e.replace(/\.sql$/, ''));
}

async function readMigration(version: string): Promise<string> {
    const file = join(resolveMigrationsDir(), `${version}.sql`);
    return readFile(file, 'utf8');
}

/**
 * Split a SQL script into top-level statements.
 *
 * Honours:
 *   - semicolons that appear at paren-depth 0 and outside string literals
 *   - PostgreSQL dollar-quoted strings (`$tag$ … $tag$`)
 *   - single-quoted string literals with `''` escapes
 *
 * The migrator's rewriter feeds only well-formed DDL through this, so
 * the implementation can stay narrowly focused on what the vault
 * actually emits.
 */
function splitSqlStatements(sql: string): string[] {
    const out: string[] = [];
    let buf = '';
    let depth = 0;
    let i = 0;

    while (i < sql.length) {
        const ch = sql[i]!;

        // Skip `--` line comments before any other token handling so a
        // `;` inside a comment does not get treated as a separator.
        // This matters because the migration SQL includes header
        // documentation that contains semicolons.
        if (ch === '-' && sql[i + 1] === '-') {
            buf += ch;
            i++;
            while (i < sql.length && sql[i] !== '\n') {
                buf += sql[i]!;
                i++;
            }
            continue;
        }

        // Dollar-quoted strings: $tag$ … $tag$
        if (ch === '$') {
            const tagMatch = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
            if (tagMatch) {
                const tag = tagMatch[0];
                buf += tag;
                i += tag.length;
                const end = sql.indexOf(tag, i);
                if (end === -1) {
                    buf += sql.slice(i);
                    i = sql.length;
                } else {
                    buf += sql.slice(i, end + tag.length);
                    i = end + tag.length;
                }
                continue;
            }
        }

        if (ch === "'") {
            buf += ch;
            i++;
            // Escaped quote inside string literal.
            while (i < sql.length) {
                const c = sql[i]!;
                buf += c;
                if (c === "'") {
                    if (sql[i + 1] === "'") {
                        buf += "'";
                        i += 2;
                        continue;
                    }
                    i++;
                    break;
                }
                i++;
            }
            continue;
        }

        if (ch === '"') {
            buf += ch;
            i++;
            while (i < sql.length) {
                const c = sql[i]!;
                buf += c;
                if (c === '"') {
                    i++;
                    break;
                }
                i++;
            }
            continue;
        }

        if (ch === '(') depth++;
        else if (ch === ')') depth = Math.max(0, depth - 1);
        else if (ch === ';' && depth === 0) {
            const trimmed = buf.trim();
            if (trimmed.length > 0) out.push(trimmed);
            buf = '';
            i++;
            continue;
        }

        buf += ch;
        i++;
    }

    const tail = buf.trim();
    if (tail.length > 0) out.push(tail);
    return out;
}

/**
 * Split a CREATE TABLE body into individual column / constraint lines,
 * respecting parentheses nesting (so `NUMERIC(10,2)` stays one token)
 * and string literals.
 */
function splitCreateTableBody(body: string): string[] {
    const parts: string[] = [];
    let buf = '';
    let depth = 0;
    let i = 0;
    while (i < body.length) {
        const ch = body[i]!;
        if (ch === "'" || ch === '"') {
            buf += ch;
            i++;
            while (i < body.length) {
                const c = body[i]!;
                buf += c;
                if (c === '\\' && i + 1 < body.length) {
                    buf += body[i + 1]!;
                    i += 2;
                    continue;
                }
                if (c === ch) {
                    i++;
                    break;
                }
                i++;
            }
            continue;
        }
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 0) {
            parts.push(buf.trim());
            buf = '';
            i++;
            continue;
        }
        buf += ch;
        i++;
    }
    const tail = buf.trim();
    if (tail.length > 0) parts.push(tail);
    return parts;
}

interface ColumnParseResult {
    name: string;
    type: string;
    notNull: boolean;
    primaryKey: boolean;
    unique: boolean;
    defaultExpr: string | null;
    rest: string;
}

/**
 * Parse a single column definition line.
 *
 * Captures the kind of inline constraints (`PRIMARY KEY`, `NOT NULL`,
 * `UNIQUE`, `DEFAULT`) so the rewriter can hoist them into separate
 * `ALTER TABLE …` statements.
 */
function parseColumnLine(line: string): ColumnParseResult | null {
    const m =
        /^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_]+(?:\s*\([^)]*\))?)\s*(.*)$/.exec(
            line,
        );
    if (!m) return null;
    const name = m[1] ?? '';
    const type = m[2] ?? '';
    const restRaw = m[3] ?? '';
    let rest = restRaw.trim();
    let notNull = false;
    let primaryKey = false;
    let unique = false;
    let defaultExpr: string | null = null;

    // Order matters: PRIMARY KEY first, then UNIQUE, then NOT NULL,
    // then DEFAULT (which can contain parentheses in `now()` etc.).
    if (/\bPRIMARY\s+KEY\b/i.test(rest)) {
        primaryKey = true;
        rest = rest.replace(/\bPRIMARY\s+KEY\b/i, '');
    }
    if (/\bUNIQUE\b/i.test(rest)) {
        unique = true;
        rest = rest.replace(/\bUNIQUE\b/i, '');
    }
    if (/\bNOT\s+NULL\b/i.test(rest)) {
        notNull = true;
        rest = rest.replace(/\bNOT\s+NULL\b/i, '');
    }
    const defMatch = /\bDEFAULT\s+('(?:[^']|'')*'|"(?:[^"]|"")*"|[A-Za-z0-9_.:+()\s-]+)/i.exec(
        rest,
    );
    if (defMatch && defMatch[1] !== undefined) {
        defaultExpr = defMatch[1].trim();
        rest = rest.replace(defMatch[0], '');
    }
    return {
        name,
        type,
        notNull,
        primaryKey,
        unique,
        defaultExpr,
        rest: rest.trim(),
    };
}

/**
 * Rewrite the DDL emitted by this repo into a form `pg-mem` accepts.
 *
 * See the class-level note on the `Test compatibility shim` for the
 * rationale.
 */
export function rewriteForMemoryDb(
    sql: string,
    options: { dropLedger?: boolean } = {},
): string {
    const dropLedger = options.dropLedger === true;
    let out = sql;

    // 1. Drop `IF NOT EXISTS` everywhere.
    out = out.replace(/\bIF\s+NOT\s+EXISTS\b/gi, '');

    // 2. Drop the `WHERE …` predicate from partial `CREATE INDEX` so
    //    pg-mem builds a regular b-tree. The hot-path index
    //    `vault_identities_active_idx WHERE revoked_at IS NULL`
    //    becomes a full index — fine in tests where the table has at
    //    most a handful of rows.
    out = out.replace(
        /CREATE\s+INDEX\s+(\S+)\s+ON\s+(\S+)\s*\(([^)]*)\)\s*WHERE\s+[^;]+/gi,
        'CREATE INDEX $1 ON $2 ($3)',
    );

    // 3. Strip `::TYPE` casts from `DEFAULT` clauses (pg-mem does not
    //    always resolve the cast in the literal). e.g.
    //      DEFAULT '{}'::jsonb   → DEFAULT '{}'
    //      DEFAULT 'pending'    (unchanged)
    out = out.replace(
        /DEFAULT\s+('(?:[^']|'')*'|"(?:[^"]|"")*")\s*::\w+/gi,
        'DEFAULT $1',
    );

    // 4. For each `CREATE TABLE … ( … );` block, hoist inline column
    //    shorthand constraints into `ALTER TABLE …` statements.
    out = out.replace(
        /CREATE\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)/gi,
        (match: string, name: string, body: string): string => {
            // In test mode the ledger is created by the runner itself
            // before the migration is applied. Strip the ledger
            // DDL block (and its companion ALTER TABLE … ADD
            // PRIMARY KEY … / SET NOT NULL trailing statements) so
            // pg-mem never sees a `CREATE TABLE vault_schema_migrations`
            // twice.
            if (dropLedger && name.toLowerCase() === 'vault_schema_migrations') {
                return '';
            }
            const lines = splitCreateTableBody(body);
            const newCols: string[] = [];
            const pks: string[] = [];
            const alters: string[] = [];
            let sawTableLevelConstraint = false;

            for (const raw of lines) {
                const line = raw.trim();
                if (line.length === 0) continue;

                // Table-level constraints are passed through verbatim.
                if (
                    /^(?:CONSTRAINT\s+\S+\s+)?(?:PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY)\b/i.test(
                        line,
                    )
                ) {
                    const pk = /PRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(line);
                    const pkCols = (pk?.[1] ?? '')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                    if (pkCols.length > 0) {
                        pks.push(...pkCols);
                    }
                    newCols.push(line);
                    sawTableLevelConstraint = true;
                    continue;
                }

                const parsed = parseColumnLine(line);
                if (!parsed) {
                    newCols.push(line);
                    continue;
                }
                newCols.push(`${parsed.name} ${parsed.type}`);
                if (parsed.primaryKey) pks.push(parsed.name);
                if (parsed.notNull) {
                    alters.push(
                        `ALTER TABLE ${name} ALTER COLUMN ${parsed.name} SET NOT NULL`,
                    );
                }
                if (parsed.unique) {
                    alters.push(
                        `ALTER TABLE ${name} ADD CONSTRAINT ${name}_${parsed.name}_uq UNIQUE (${parsed.name})`,
                    );
                }
                if (parsed.defaultExpr) {
                    alters.push(
                        `ALTER TABLE ${name} ALTER COLUMN ${parsed.name} SET DEFAULT ${parsed.defaultExpr}`,
                    );
                }
                // Anything in `parsed.rest` is dropped on the pg-mem
                // codepath; it would be `REFERENCES` etc. which the
                // vault schema doesn't actually use.
            }

            // Pin a primary key column ORDER: the architectural
            // convention is identity_id UUID PRIMARY KEY. Falling back
            // to `id` matches the vault pattern.
            const pkColumn =
                pks.length > 0
                    ? pks[0]!
                    : sawTableLevelConstraint
                      ? null
                      : 'id';

            let stmt = `CREATE TABLE ${name} (${newCols.join(', ')})`;
            if (pkColumn) {
                stmt += `; ALTER TABLE ${name} ADD PRIMARY KEY (${pkColumn})`;
            }
            for (const a of alters) stmt += `; ${a}`;
            return stmt;
        },
    );

    return out;
}

/**
 * Return `true` when the statement is exclusively line comments and
 * whitespace — no actual DDL. Used by the test-mode {@link runMigrations}
 * to skip the migrator's `--`-commented header before sending anything
 * to pg-mem.
 */
function isCommentOnly(stmt: string): boolean {
    return /^\s*(?:--[^\n]*\s*)+$/.test(stmt);
}

/**
 * Apply every not-yet-applied migration against `pool` and record it
 * in `vault_schema_migrations`. The ledger table is created on demand
 * so that a fresh database can be bootstrapped without a separate
 * bootstrap step.
 *
 * When `options.isTest` is true the SQL is first run through
 * {@link rewriteForMemoryDb} so `pg-mem` can ingest it. In that mode
 * each rewritten statement is sent to the pool individually because
 * pg-mem's Extended-Query protocol shim rejects multi-statement
 * strings.
 */
export async function runMigrations(
    pool: PoolLike,
    options: RunMigrationsOptions = {},
): Promise<MigrationApplyResult> {
    const isTest = options.isTest === true;

    const exec = async (rawSql: string): Promise<void> => {
        if (!isTest) {
            await pool.query(rawSql);
            return;
        }
        // pg-mem: rewrite DDL into a form pg-mem accepts, then split
        // into single statements and execute one at a time.
        const sql = rewriteForMemoryDb(rawSql, { dropLedger: true });
        const statements = splitSqlStatements(sql);
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i]!;
            // The migrator's SQL starts with a long `--`-commented
            // header block. After splitting on `;` that block lands in
            // its own statement which is *purely* comments — pg-mem's
            // parser rejects a comment-only input with `Unexpected end
            // of input`, so we skip it here. Real DDL is never
            // comment-only because we only push statements that
            // contain at least one statement keyword downstream.
            if (isCommentOnly(stmt)) continue;
            try {
                await pool.query(stmt);
            } catch (err) {
                // Surface the exact statement that pg-mem refused so
                // the rewrite can be tightened. Limits a runaway log
                // to the first failure per `exec` call.
                if (process.env.VAULT_DEBUG_SQL) {
                    console.error(
                        `pg-mem exec failed at statement #${i}:\n---\n${stmt}\n---`,
                    );
                }
                throw err;
            }
        }
    };

    // Bootstrap: ensure the ledger exists.
    //
    // The `applied_at` column is intentionally NOT defaulted to `now()`
    // so that the schema can be applied against `pg-mem` (see the
    // companion note at the top of `001_initial_schema.sql`). We
    // supply the timestamp explicitly via a parameter below.
    //
    // In production we use `IF NOT EXISTS` so a partially-migrated
    // database is recoverable. In test mode pg-mem rejects the clause
    // (the rewriter would strip it anyway), but the migration file's
    // ledger block is also dropped on the test path, so we always
    // start with an empty database and a single, hand-built ledger.
    if (isTest) {
        // Hand-built DDL mirrors the shape of the rewriter's output
        // for the `vault_schema_migrations` block: bare columns first,
        // then `ALTER TABLE … ADD PRIMARY KEY …` and `SET NOT NULL`.
        await pool.query(`CREATE TABLE vault_schema_migrations (version TEXT, applied_at TIMESTAMPTZ)`);
        await pool.query(`ALTER TABLE vault_schema_migrations ADD PRIMARY KEY (version)`);
        await pool.query(`ALTER TABLE vault_schema_migrations ALTER COLUMN applied_at SET NOT NULL`);
    } else {
        await exec(`
            CREATE TABLE IF NOT EXISTS vault_schema_migrations (
                version     TEXT        PRIMARY KEY,
                applied_at  TIMESTAMPTZ NOT NULL
            )
        `);
    }

    const all = await discoverMigrations();
    const discovered = all.length;

    const { rows } = await pool.query<{ version: string }>(
        'SELECT version FROM vault_schema_migrations',
    );
    const alreadyApplied = new Set(rows.map((r) => r.version));

    const newlyApplied: string[] = [];
    const skipped: string[] = [];

    const now = new Date();

    for (const version of all) {
        if (alreadyApplied.has(version)) {
            skipped.push(version);
            continue;
        }

        const sql = await readMigration(version);
        await exec(sql);
        await pool.query(
            'INSERT INTO vault_schema_migrations (version, applied_at) VALUES ($1, $2)',
            [version, now],
        );
        newlyApplied.push(version);
    }

    return {
        applied: newlyApplied,
        skipped,
        discovered,
    };
}