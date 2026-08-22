/**
 * Unit tests for the `ReadAuditHistory` command (Session 5C).
 *
 * Scope: behaviour of the command as a piece of orchestration. We
 * stub the single port — `AuditRepository` — so a failure here is
 * a command-logic failure, not an adapter failure. Adapter
 * correctness is verified in the per-adapter suites.
 *
 * The eight cases below are the minimum a green build needs to
 * consider the read command done:
 *
 *   1. Happy path: returns the records the repository yields,
 *      shaped per the §6 surface, with `pageSize` matching the
 *      number of records.
 *   2. Identity with no audit history: returns an empty list, not
 *      a thrown error.
 *   3. Default limit: when `limit` is omitted, the command passes
 *      `DEFAULT_LIMIT` (50) to the repository.
 *   4. Capped limit: a `limit` larger than `MAX_LIMIT` is silently
 *      clamped, and the response echoes the *effective* value.
 *   5. Empty `identityId` throws `INVALID_INPUT` and never touches
 *      the repository.
 *   6. Non-positive `limit` throws `INVALID_INPUT` and never
 *      touches the repository.
 *   7. Non-integer `limit` throws `INVALID_INPUT` and never
 *      touches the repository.
 *   8. Optional fields (reason / requestId / meta) are normalized
 *      to `null` in the response, never `undefined`, so the
 *      response shape is predictable for JSON consumers.
 */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    makeReadAuditHistory,
    ReadAuditHistoryCommandError,
    type ReadAuditHistoryCallerContext,
    type ReadAuditHistoryDeps,
} from '../src/application/commands/read-audit-history.js';
import type {
    AuditEntry,
    AuditRecord,
    AuditRepository,
} from '../src/db/ports/audit.repository.js';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

/**
 * Recording `AuditRepository` fake. Records the most recent call so
 * the test can assert the command delegated the right `identityId`
 * and `limit`; yields a configurable list of records (or throws a
 * pre-set error) so the command's response-shaping branch is
 * exercised in isolation.
 */
type ListCall = {
    identityId: string;
    limit: number;
};

type FakeAuditRepo = AuditRepository & {
    calls: ListCall[];
    nextRecords: AuditRecord[];
    failNext?: Error;
    appendCalls: AuditEntry[];
};

function makeFakeAuditRepo(): FakeAuditRepo {
    const calls: ListCall[] = [];
    const nextRecords: AuditRecord[] = [];
    const appendCalls: AuditEntry[] = [];
    const repo: FakeAuditRepo = {
        calls,
        nextRecords,
        appendCalls,
        // ReadAuditHistory never calls append; this stub exists
        // only to satisfy the AuditRepository port shape. Record
        // the call so a future write-path test can observe it.
        async append(entry: AuditEntry): Promise<void> {
            appendCalls.push(entry);
        },
        async listByIdentity(identityId, opts) {
            if (repo.failNext) {
                const err = repo.failNext;
                repo.failNext = undefined;
                throw err;
            }
            calls.push({
                identityId,
                limit: opts?.limit ?? 0,
            });
            return nextRecords;
        },
    };
    return repo;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONTEXT: ReadAuditHistoryCallerContext = {
    actorId: 'auditor-1',
    actorRole: 'SUPER_ADMIN',
    reason: 'routine compliance review',
    requestId: 'req-read-1',
    sourceIp: '10.0.0.9',
    userAgent: 'fln-portal/0.1',
};

function makeAuditRecord(overrides: Partial<AuditRecord> = {}): AuditRecord {
    return {
        auditId: 1,
        identityId: 'idem-uuid-1',
        actor: 'teacher-101',
        action: 'TOKENIZE',
        outcome: 'allow',
        reason: 'student enrollment',
        requestId: 'req-1',
        meta: { last4: '9012' },
        occurredAt: new Date('2026-01-15T12:00:00Z'),
        ...overrides,
    };
}

interface DepsHandle {
    deps: ReadAuditHistoryDeps;
    repo: FakeAuditRepo;
}

function makeDeps(): DepsHandle {
    const repo = makeFakeAuditRepo();
    const deps: ReadAuditHistoryDeps = {
        audit: repo,
    };
    return { deps, repo };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ReadAuditHistory command', () => {
    let handle: DepsHandle;

    beforeEach(() => {
        handle = makeDeps();
    });

    afterEach(() => {
        // Defensive — if a test set `failNext` but didn't trigger
        // it, the next test would unexpectedly fail. Clear it.
        if (handle?.repo?.failNext) {
            handle.repo.failNext = undefined;
        }
    });

    it('1. happy path — returns repository records, shaped per contract, pageSize matches', async () => {
        const { deps, repo } = handle;
        const r1 = makeAuditRecord({ auditId: 1 });
        const r2 = makeAuditRecord({ auditId: 2, actor: 'teacher-202' });
        repo.nextRecords.push(r1, r2);

        const cmd = makeReadAuditHistory(deps);
        const result = await cmd({
            identityId: 'idem-uuid-1',
            limit: 10,
            context: BASE_CONTEXT,
        });

        // Repository was called once with the right (identityId, limit).
        expect(repo.calls).toEqual([
            { identityId: 'idem-uuid-1', limit: 10 },
        ]);

        // Response shape — §6 surface.
        expect(result.identityId).toBe('idem-uuid-1');
        expect(result.limit).toBe(10);
        expect(result.pageSize).toBe(2);
        expect(result.entries).toHaveLength(2);

        // Entries are projected 1:1, in the order the repository
        // yielded them (the command does not re-sort).
        expect(result.entries[0]).toMatchObject({
            auditId: 1,
            identityId: 'idem-uuid-1',
            actor: 'teacher-101',
            action: 'TOKENIZE',
            outcome: 'allow',
            reason: 'student enrollment',
            requestId: 'req-1',
            meta: { last4: '9012' },
        });
        expect(result.entries[0]!.occurredAt).toBe('2026-01-15T12:00:00.000Z');

        expect(result.entries[1]!.actor).toBe('teacher-202');
        expect(result.entries[1]!.auditId).toBe(2);
    });

    it('2. identity with no history — returns an empty entries list, does not throw', async () => {
        const { deps, repo } = handle;
        // No records pushed.
        const cmd = makeReadAuditHistory(deps);

        const result = await cmd({
            identityId: 'idem-empty',
            context: BASE_CONTEXT,
        });

        expect(repo.calls).toEqual([
            { identityId: 'idem-empty', limit: 50 },
        ]);
        expect(result.pageSize).toBe(0);
        expect(result.entries).toEqual([]);
        expect(result.limit).toBe(50);
        expect(result.identityId).toBe('idem-empty');
    });

    it('3. default limit — when omitted, repository is called with DEFAULT_LIMIT (50)', async () => {
        const { deps, repo } = handle;
        const cmd = makeReadAuditHistory(deps);

        await cmd({
            identityId: 'idem-uuid-2',
            context: BASE_CONTEXT,
        });

        expect(repo.calls).toEqual([
            { identityId: 'idem-uuid-2', limit: 50 },
        ]);
    });

    it('4. limit larger than MAX_LIMIT is silently clamped to MAX_LIMIT (200)', async () => {
        const { deps, repo } = handle;
        const cmd = makeReadAuditHistory(deps);

        const result = await cmd({
            identityId: 'idem-uuid-3',
            limit: 10_000,
            context: BASE_CONTEXT,
        });

        // The repository was told the *effective* limit, not the
        // requested one — capping happens before delegation.
        expect(repo.calls).toEqual([
            { identityId: 'idem-uuid-3', limit: 200 },
        ]);

        // The response echoes the *effective* limit so the caller
        // can tell their request was clamped.
        expect(result.limit).toBe(200);
    });

    it('5. empty identityId — throws INVALID_INPUT, never touches the repository', async () => {
        const { deps, repo } = handle;
        const cmd = makeReadAuditHistory(deps);

        await expect(
            cmd({
                identityId: '',
                context: BASE_CONTEXT,
            }),
        ).rejects.toBeInstanceOf(ReadAuditHistoryCommandError);
        await expect(
            cmd({
                identityId: '',
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

        // The first invocation should not have delegated. The
        // second invocation would also not have delegated, so the
        // record (or absence) is the same.
        expect(repo.calls).toEqual([]);
    });

    it('6. non-positive limit — throws INVALID_INPUT, never touches the repository', async () => {
        const { deps, repo } = handle;
        const cmd = makeReadAuditHistory(deps);

        // limit: 0
        await expect(
            cmd({
                identityId: 'idem-uuid-4',
                limit: 0,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

        // limit: -5
        await expect(
            cmd({
                identityId: 'idem-uuid-4',
                limit: -5,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

        expect(repo.calls).toEqual([]);
    });

    it('7. non-integer limit — throws INVALID_INPUT, never touches the repository', async () => {
        const { deps, repo } = handle;
        const cmd = makeReadAuditHistory(deps);

        // Float
        await expect(
            cmd({
                identityId: 'idem-uuid-5',
                limit: 10.5,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

        // NaN
        await expect(
            cmd({
                identityId: 'idem-uuid-5',
                limit: Number.NaN,
                context: BASE_CONTEXT,
            }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

        expect(repo.calls).toEqual([]);
    });

    it('8. optional fields are normalized to null (not undefined) in the response', async () => {
        const { deps, repo } = handle;
        // Record with NO reason / requestId / meta — simulates a
        // partially-populated audit row from a future adapter.
        repo.nextRecords.push(
            makeAuditRecord({
                auditId: 7,
                reason: undefined,
                requestId: undefined,
                meta: undefined,
            }),
        );

        const cmd = makeReadAuditHistory(deps);
        const result = await cmd({
            identityId: 'idem-uuid-6',
            context: BASE_CONTEXT,
        });

        const entry = result.entries[0]!;
        expect(entry.auditId).toBe(7);
        expect(entry.reason).toBeNull();
        expect(entry.requestId).toBeNull();
        expect(entry.meta).toBeNull();

        // `null` is *not* `undefined` — JSON.stringify preserves it.
        const json = JSON.stringify(entry);
        expect(json).toContain('"reason":null');
        expect(json).toContain('"requestId":null');
        expect(json).toContain('"meta":null');
    });

    it('repository error is re-thrown to the caller (defensive — the port can fail)', async () => {
        // The port failure is the caller's concern, not the
        // command's. The command should let the original error
        // bubble so the HTTP layer can map it to a 5xx.
        const { deps, repo } = handle;
        const sentinel = new Error('postgres offline');
        repo.failNext = sentinel;
        const cmd = makeReadAuditHistory(deps);

        // Spy on console.error to silence the expected unhandled
        // rejection noise in test output.
        const errSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        await expect(
            cmd({
                identityId: 'idem-uuid-7',
                context: BASE_CONTEXT,
            }),
        ).rejects.toBe(sentinel);

        errSpy.mockRestore();
    });
});