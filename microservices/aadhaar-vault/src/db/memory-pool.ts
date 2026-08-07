/**
 * In-memory pool that stands in for `pg.Pool` in the test suite.
 *
 * We deliberately do *not* use `pg-mem`. `pg-mem` hung indefinitely
 * during local runs on the rewritten DDL (CREATE TABLE bodies captured
 * by lazy regex against the production migration file). After two
 * attempts to repair the rewrite we switched strategy: pre-declare the
 * schema in TypeScript, and implement just enough SQL to drive the four
 * repository adapters against an in-process map.
 *
 * The supported surface is, by construction, exactly what
 * `src/db/adapters/*.postgres.ts` issues:
 *
 *   - `CREATE TABLE / ALTER TABLE / DROP / COMMENT / BEGIN / COMMIT /
 *     SET` — no-ops (DDL is pre-declared via {@link define}).
 *   - `SELECT 1` and `SELECT now()` — used by health and CASE exprs.
 *   - `INSERT INTO t (cols) VALUES ($1,...) [RETURNING cols]`.
 *   - `UPDATE t SET col=$n[, col=CASE WHEN $n='x' THEN now() ELSE col END]
 *     WHERE col=$n [AND ...] [RETURNING cols]`.
 *   - `SELECT cols FROM t [WHERE col=$n [AND ...]] [ORDER BY col [DESC]]
 *     [LIMIT $n]`.
 *
 * Anything outside that envelope throws. That is the point: a
 * divergent query is caught in CI instead of silently returning the
 * wrong rows.
 */
import type { PoolLike } from './pool.js';

export type ColumnType = 'text' | 'int' | 'bytes' | 'json' | 'date';

export interface ColumnSpec {
  name: string;
  type: ColumnType;
  nullable: boolean;
}

export interface TableSpec {
  name: string;
  columns: ColumnSpec[];
  pk: string;
  /**
   * Default factories invoked when an INSERT omits the column.
   * Mirrors the SQL `DEFAULT <expr>` on the corresponding column.
   */
  defaults?: Partial<Record<string, () => unknown>>;
  /**
   * Treat the PK column as auto-incrementing (SERIAL). When true, the
   * pool assigns the next sequence value to `pk` whenever an INSERT
   * does not list that column.
   */
  autoIncrement?: boolean;
}

type Row = Record<string, unknown>;

export class MemoryPool implements PoolLike {
  private readonly tables = new Map<string, TableSpec>();
  private readonly data = new Map<string, Row[]>();
  /** Per-table monotonically-increasing sequence; powers PK auto-fill. */
  private readonly seq = new Map<string, number>();
  private readonly listeners: Array<(err: Error) => void> = [];

  define(spec: TableSpec): void {
    if (this.tables.has(spec.name)) {
      throw new Error(`MemoryPool: table "${spec.name}" already defined`);
    }
    this.tables.set(spec.name, spec);
    this.data.set(spec.name, []);
    this.seq.set(spec.name, 0);
  }

  async query<T = unknown>(
    text: string,
    params: unknown[] = [],
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    const sql = collapseWhitespace(text).trim();
    const upper = sql.toUpperCase();

    if (upper === 'SELECT 1') {
      return { rows: [{ '?column?': 1 }] as unknown as T[], rowCount: 1 };
    }
    if (upper === 'SELECT NOW()') {
      return { rows: [{ now: new Date() }] as unknown as T[], rowCount: 1 };
    }
    if (
      upper.startsWith('CREATE ') ||
      upper.startsWith('DROP ') ||
      upper.startsWith('ALTER ') ||
      upper.startsWith('COMMENT ') ||
      upper.startsWith('BEGIN ') ||
      upper === 'COMMIT' ||
      upper === 'ROLLBACK' ||
      upper.startsWith('SET ')
    ) {
      // DDL / transaction markers — the production migrator and the
      // production pool driver emit these; we silently no-op.
      return { rows: [], rowCount: 0 };
    }

    if (upper.startsWith('INSERT')) {
      return this.handleInsert<T>(sql, params);
    }
    if (upper.startsWith('UPDATE')) {
      return this.handleUpdate<T>(sql, params);
    }
    if (upper.startsWith('SELECT')) {
      return this.handleSelect<T>(sql, params);
    }

    if (process.env['VAULT_DEBUG_SQL'] === '1') {
      // eslint-disable-next-line no-console
      console.error('[memory-pool] unsupported SQL:', sql.slice(0, 120));
    }
    throw new Error(`MemoryPool: unsupported SQL: ${sql.slice(0, 120)}`);
  }

  async end(): Promise<void> {
    /* no resources to release */
  }

  on(event: 'error', listener: (err: Error) => void): this {
    if (event === 'error') {
      this.listeners.push(listener);
    }
    return this;
  }

  // ---- handlers ---------------------------------------------------------

  private handleInsert<T>(
    sql: string,
    params: unknown[],
  ): { rows: T[]; rowCount: number | null } {
    const m = sql.match(
      /^INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)(?:\s+RETURNING\s+(.+))?$/i,
    );
    if (!m) {
      throw new Error(
        `MemoryPool: cannot parse INSERT: ${sql.slice(0, 120)}`,
      );
    }
    const tableName = m[1]!;
    const insertCols = m[2]!.split(',').map((s) => s.trim());
    const valueTokens = m[3]!.split(',').map((s) => s.trim());
    const returning = m[4];

    const table = this.requireTable(tableName);
    const rows = this.data.get(table.name)!;

    const values = valueTokens.map((tok) => this.resolveValue(tok, params));

    const row: Row = {};
    insertCols.forEach((col, i) => {
      const spec = this.columnOrThrow(table, col);
      row[col] = this.coerce(values[i], spec);
    });

    // Apply defaults / nulls / sequences for columns the INSERT omitted.
    for (const col of table.columns) {
      if (col.name in row && row[col.name] !== undefined) continue;
      const factory = table.defaults?.[col.name];
      if (factory) {
        row[col.name] = factory();
        continue;
      }
      if (table.autoIncrement && col.name === table.pk) {
        this.seq.set(table.name, (this.seq.get(table.name) ?? 0) + 1);
        row[col.name] = this.seq.get(table.name);
        continue;
      }
      if (col.nullable) {
        row[col.name] = null;
      } else {
        row[col.name] = defaultFor(col.type);
      }
    }

    rows.push(row);

    if (!returning) {
      return { rows: [], rowCount: 1 };
    }
    const retCols = returning.split(',').map((s) => s.trim());
    return {
      rows: [projectRow(row, retCols)] as unknown as T[],
      rowCount: 1,
    };
  }

  private handleUpdate<T>(
    sql: string,
    params: unknown[],
  ): { rows: T[]; rowCount: number | null } {
    const m = sql.match(
      /^UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+?)(?:\s+RETURNING\s+(.+))?$/i,
    );
    if (!m) {
      throw new Error(
        `MemoryPool: cannot parse UPDATE: ${sql.slice(0, 120)}`,
      );
    }
    const tableName = m[1]!;
    const setClause = m[2]!;
    const whereClause = m[3]!;
    const returning = m[4];

    const table = this.requireTable(tableName);
    const allRows = this.data.get(table.name)!;

    const setItems = splitTopLevelCommas(setClause).map((s) => s.trim());
    const whereItems = splitTopLevelAnd(whereClause).map((s) => s.trim());

    const projected: Row[] = [];
    let changed = 0;
    for (const row of allRows) {
      if (!whereItems.every((w) => evalPredicate(w, row, params))) continue;
      for (const item of setItems) {
        const eq = item.indexOf('=');
        if (eq < 0) {
          throw new Error(`MemoryPool: bad SET clause: ${item}`);
        }
        const col = item.slice(0, eq).trim();
        const expr = item.slice(eq + 1).trim();
        const spec = this.columnOrThrow(table, col);
        row[col] = this.assignFromExpr(expr, row, params, spec);
      }
      changed += 1;
      if (returning) {
        const retCols = returning.split(',').map((s) => s.trim());
        projected.push(projectRow(row, retCols));
      }
    }

    return {
      rows: (returning ? projected : []) as unknown as T[],
      rowCount: changed,
    };
  }

  private handleSelect<T>(
    sql: string,
    params: unknown[],
  ): { rows: T[]; rowCount: number | null } {
    const m = sql.match(
      /^SELECT\s+([\s\S]+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\$?\d+))?$/i,
    );
    if (!m) {
      throw new Error(
        `MemoryPool: cannot parse SELECT: ${sql.slice(0, 120)}`,
      );
    }
    const colList = m[1]!;
    const tableName = m[2]!;
    const whereClause = m[3];
    const orderCol = m[4];
    const orderDir = m[5];
    const limitTok = m[6];

    const table = this.requireTable(tableName);
    const allRows = this.data.get(table.name)!;

    const filtered = whereClause
      ? allRows.filter((row) =>
          splitTopLevelAnd(whereClause)
            .map((s) => s.trim())
            .every((w: string) => evalPredicate(w, row, params)),
        )
      : allRows;

    const sorted = orderCol
      ? [...filtered].sort((a, b) => {
          const av = a[orderCol];
          const bv = b[orderCol];
          // Primary key: same value → tie.
          if (av === bv) return 0;
          if (av === undefined || av === null) return 1;
          if (bv === undefined || bv === null) return -1;
          let cmp: number;
          if (av instanceof Date && bv instanceof Date) {
            cmp = av.getTime() - bv.getTime();
          } else if (av < bv) {
            cmp = -1;
          } else if (av > bv) {
            cmp = 1;
          } else {
            cmp = 0;
          }
          // Stable tie-breaker on insertion order so the audit list
          // returns newest-first even when two rows share a millisecond.
          if (cmp === 0) {
            const ai = allRows.indexOf(a);
            const bi = allRows.indexOf(b);
            cmp = ai - bi;
          }
          return orderDir && orderDir.toUpperCase() === 'DESC' ? -cmp : cmp;
        })
      : filtered;

    const limited =
      limitTok !== undefined
        ? sorted.slice(0, parseLimit(limitTok, params))
        : sorted;

    const cols =
      colList.trim() === '*'
        ? null
        : colList.split(',').map((s) => s.trim());
    const projected = limited.map((row) =>
      cols ? projectRow(row, cols) : { ...row },
    );

    return {
      rows: projected as unknown as T[],
      rowCount: projected.length,
    };
  }

  // ---- value helpers ----------------------------------------------------

  private resolveValue(tok: string, params: unknown[]): unknown {
    // Strip a trailing `::type` cast; we parse JSON ourselves when
    // the column spec asks for it.
    const cleaned = tok.replace(/::\w+$/, '').trim();
    if (/^\$\d+$/.test(cleaned)) {
      return params[Number(cleaned.slice(1)) - 1];
    }
    if (cleaned === 'now()') return new Date();
    if (cleaned === 'NULL') return null;
    if (cleaned === 'true') return true;
    if (cleaned === 'false') return false;
    if (/^'.*'$/.test(cleaned)) {
      return cleaned.slice(1, -1).replace(/''/g, "'");
    }
    if (/^-?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
    if (/^\w+$/.test(cleaned)) return cleaned; // bare identifier → string
    throw new Error(`MemoryPool: unsupported INSERT value: ${tok}`);
  }

  private assignFromExpr(
    expr: string,
    row: Row,
    params: unknown[],
    spec: ColumnSpec,
  ): unknown {
    let v: unknown;
    if (/^CASE\s+WHEN[\s\S]+END$/i.test(expr)) {
      v = evalCaseExpression(expr, row, params);
    } else {
      v = this.resolveValue(expr, params);
    }
    return this.coerce(v, spec);
  }

  private coerce(v: unknown, spec: ColumnSpec): unknown {
    if (v === null || v === undefined) {
      if (!spec.nullable) {
        return defaultFor(spec.type);
      }
      return null;
    }
    switch (spec.type) {
      case 'int':
        return typeof v === 'number' ? v : Number(v);
      case 'text':
        return String(v);
      case 'bytes':
        // The adapters pass `Buffer` for BYTEA; preserve identity so
        // the tests can compare with `.equals()`.
        return Buffer.isBuffer(v) ? v : Buffer.from(String(v));
      case 'json':
        return typeof v === 'string' ? JSON.parse(v) : v;
      case 'date':
        return v instanceof Date ? v : new Date(v as string);
    }
  }

  private columnOrThrow(table: TableSpec, name: string): ColumnSpec {
    const spec = table.columns.find((c) => c.name === name);
    if (!spec) {
      throw new Error(
        `MemoryPool: unknown column "${name}" on table "${table.name}"`,
      );
    }
    return spec;
  }

  private requireTable(name: string): TableSpec {
    const t = this.tables.get(name);
    if (!t) {
      throw new Error(`MemoryPool: table "${name}" not defined`);
    }
    return t;
  }
}

// ---- module-level helpers ----------------------------------------------

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ');
}

/**
 * Split a comma-separated list while respecting:
 *   - balanced parentheses (`(`, `)`),
 *   - balanced brackets (`[`, `]`),
 *   - SQL single-quoted strings with `''` escapes.
 */
function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inSingle = false;
  let buf = '';
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]!;
    if (inSingle) {
      buf += ch;
      if (ch === "'" && s[i + 1] === "'") {
        buf += "'";
        i += 1;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      continue;
    }
    if (ch === '(' || ch === '[') {
      depth += 1;
      buf += ch;
      continue;
    }
    if (ch === ')' || ch === ']') {
      depth -= 1;
      buf += ch;
      continue;
    }
    if (ch === ',' && depth === 0) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim().length > 0) out.push(buf);
  return out;
}

/**
 * Split a string into top-level boolean conjuncts on the keyword
 * `AND`. We only implement AND: every predicate our adapters issue is
 * a conjunction. The splitter respects the same nesting rules as
 * {@link splitTopLevelCommas} (parens, brackets, single quotes).
 *
 * Example input:
 *   identity_id = $1 AND revoked_at IS NULL
 * Output:
 *   ["identity_id = $1", "revoked_at IS NULL"]
 */
function splitTopLevelAnd(s: string): string[] {
  // Match the literal ` AND ` token at depth 0 (i.e. outside parens,
  // brackets, and single-quoted strings). A word-boundary regex on
  // the trimmed upper-cased haystack is enough for our predicate
  // grammar.
  const out: string[] = [];
  let depth = 0;
  let inSingle = false;
  const parts = [''];
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]!;
    if (inSingle) {
      parts[parts.length - 1] += ch;
      if (ch === "'" && s[i + 1] === "'") {
        parts[parts.length - 1] += "'";
        i += 1;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      parts[parts.length - 1] += ch;
      continue;
    }
    if (ch === '(' || ch === '[') {
      depth += 1;
      parts[parts.length - 1] += ch;
      continue;
    }
    if (ch === ')' || ch === ']') {
      depth -= 1;
      parts[parts.length - 1] += ch;
      continue;
    }
    // Top-level `AND` keyword between non-identifier boundaries.
    // We require whitespace (or string start/end) on BOTH sides so
    // that identifiers like `brand` or `demand` are not split.
    if (
      depth === 0 &&
      s.slice(i, i + 3).toUpperCase() === 'AND' &&
      /\s/.test(s[i - 1] ?? ' ') &&
      /\s/.test(s[i + 3] ?? ' ')
    ) {
      parts.push('');
      i += 2; // skip `ND`; loop will consume the trailing space
      continue;
    }
    parts[parts.length - 1] += ch;
  }
  for (const p of parts) {
    const trimmed = p.trim();
    if (trimmed) out.push(trimmed);
  }
  return out;
}

function parseLimit(tok: string, params: unknown[]): number {
  if (tok.startsWith('$')) {
    return Number(params[Number(tok.slice(1)) - 1]);
  }
  return Number(tok);
}

function defaultFor(type: ColumnType): unknown {
  switch (type) {
    case 'int':
      return 0;
    case 'text':
      return '';
    case 'bytes':
      return Buffer.alloc(0);
    case 'json':
      return {};
    case 'date':
      return new Date(0);
  }
}

function projectRow(row: Row, cols: string[]): Row {
  const out: Row = {};
  for (const c of cols) {
    const trimmed = c.trim();
    out[trimmed] = row[trimmed] ?? null;
  }
  return out;
}

function evalPredicate(
  pred: string,
  row: Row,
  params: unknown[],
): boolean {
  // Predicates that the adapters issue are one of:
  //   <col> = $N
  //   <col> IS NULL
  //   <col> IS NOT NULL
  //   <col> = 'literal'
  // The outer `splitTopLevelAnd` gives us one conjunct at a time,
  // and `=` plus `IS*` is the entire surface.
  const isNullMatch = pred.match(/^(\w+)\s+IS\s+NULL$/i);
  if (isNullMatch) {
    const lhs = row[isNullMatch[1]!] ?? null;
    return lhs === null;
  }
  const isNotNullMatch = pred.match(/^(\w+)\s+IS\s+NOT\s+NULL$/i);
  if (isNotNullMatch) {
    const lhs = row[isNotNullMatch[1]!] ?? null;
    return lhs !== null;
  }
  const inMatch = pred.match(/^(\w+)\s+IN\s*\(([^)]+)\)$/i);
  if (inMatch) {
    const lhs = row[inMatch[1]!] ?? null;
    const options = splitTopLevelCommas(inMatch[2]!).map((s) =>
      resolveRhs(s.trim(), row, params),
    );
    return options.some((v) => v === lhs);
  }
  const eqMatch = pred.match(/^(\w+)\s*=\s*(.+)$/i);
  if (!eqMatch) {
    throw new Error(`MemoryPool: cannot evaluate predicate: ${pred}`);
  }
  const col = eqMatch[1]!;
  const rhs = resolveRhs(eqMatch[2]!.trim(), row, params);
  const lhs = row[col] ?? null;
  return lhs === rhs;
}

function resolveRhs(tok: string, row: Row, params: unknown[]): unknown {
  if (tok === 'NULL') return null;
  if (/^\$\d+$/.test(tok)) {
    return params[Number(tok.slice(1)) - 1];
  }
  if (tok.startsWith("'") && tok.endsWith("'")) {
    return tok.slice(1, -1).replace(/''/g, "'");
  }
  if (/^\d+$/.test(tok)) return Number(tok);
  if (/^\w+$/.test(tok)) return row[tok] ?? null;
  throw new Error(`MemoryPool: cannot resolve RHS: ${tok}`);
}

/**
 * Evaluate the single CASE shape used by the MFA adapter:
 *
 *   CASE WHEN $N = 'value' THEN now() ELSE <col_ref> END
 *
 * Kept narrow on purpose — the unit tests only assert this layout.
 */
function evalCaseExpression(
  expr: string,
  row: Row,
  params: unknown[],
): unknown {
  const m = expr.match(
    /^CASE\s+WHEN\s+(\$\d+)\s*=\s*'([^']*)'\s+THEN\s+(\w+\(\)|NULL|[A-Za-z_]\w*|\$\d+)(?:\s+ELSE\s+(\w+|\$\d+|'[^']*'|NULL))?\s+END$/i,
  );
  if (!m) {
    throw new Error(`MemoryPool: cannot parse CASE: ${expr}`);
  }
  const placeholder = m[1]!;
  const expected = m[2]!;
  const thenExpr = m[3]!;
  const elseExpr = m[4];
  if (params[Number(placeholder.slice(1)) - 1] === expected) {
    if (thenExpr.toLowerCase() === 'now()') return new Date();
    if (thenExpr === 'NULL') return null;
    if (/^'.*'$/.test(thenExpr)) {
      return thenExpr.slice(1, -1).replace(/''/g, "'");
    }
  }
  if (elseExpr === undefined || elseExpr === 'NULL') return null;
  if (/^'.*'$/.test(elseExpr)) {
    return elseExpr.slice(1, -1).replace(/''/g, "'");
  }
  return resolveRhs(elseExpr, row, params);
}