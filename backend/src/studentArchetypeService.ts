import { randomUUID } from 'crypto';
import {
	dbStore,
	type DBStore,
	type Student,
	type EvaluationReport,
	type Worksheet,
	type MisconceptionCluster,
} from './db';
import {
	aiNamingEnabled,
	buildFingerprint,
	buildFingerprintFromEvaluationReport,
	deterministicArchetypeProfile,
	toCentroid,
	MIN_ERRORS_FOR_CLUSTERING,
	type StudentFingerprint,
} from './misconceptionFingerprint';
import { classifyFingerprintWithGemini, type GeminiClusterDecision } from './geminiClusterMatcher';

export type { GeminiClusterDecision };

export interface PersistedMisconceptionCluster extends MisconceptionCluster {
	studentCount: number;
}

/** Sort key for picking a student's most recent report; unparseable dates sort oldest. */
function reportTime(report: EvaluationReport): number {
	const parsed = Date.parse(report.timestamp);
	return Number.isFinite(parsed) ? parsed : 0;
}

function toOrderedVector(vector: StudentFingerprint['vector']): number[] {
	return toCentroid(vector);
}

/**
 * How far a child's signature may sit from an archetype's centroid and still
 * count as the same way of failing.
 *
 * Measured on this cohort: two children who fail the same way sit a median
 * 0.114 apart; two who fail differently are never closer than 0.272. The radius
 * sits just under that floor, so no cross-pattern pair can be admitted.
 *
 * It has to be tight, because a centroid is the running mean of its members and
 * every wrong admission drags it toward the cohort average, where it sits within
 * reach of everybody. At 0.6 that ran away exactly once: a single archetype
 * absorbed eleven of twenty children across four different morphologies.
 *
 * The gate exists because asking the model to decide membership does not hold
 * the property this feature promises. Given the free choice it put thirteen of
 * twenty children — reversal, omission, gross magnitude, near miss and
 * off-by-one alike — into whichever archetype happened to be created first,
 * while splitting the digit reversers across three separate archetypes. Naming
 * a newly discovered pattern is a language problem and stays with Gemini;
 * deciding whether two children fail the same way is a distance comparison.
 */
const SAME_PATTERN_DISTANCE = 0.25;

function euclideanDistance(a: number[], b: number[]): number {
	const length = Math.max(a.length, b.length);
	let sum = 0;
	for (let i = 0; i < length; i++) {
		const delta = (a[i] ?? 0) - (b[i] ?? 0);
		sum += delta * delta;
	}
	return Math.sqrt(sum);
}

/**
 * The existing archetype this child most resembles, or null when none is close
 * enough to be the same pattern.
 *
 * Clusters persisted before centroids were stored are skipped rather than
 * treated as distance zero, which would silently capture every new child.
 */
function findSamePatternCluster(
	clusters: MisconceptionCluster[],
	vector: number[]
): { cluster: MisconceptionCluster; distance: number } | null {
	let best: { cluster: MisconceptionCluster; distance: number } | null = null;
	for (const cluster of clusters) {
		if (!Array.isArray(cluster.centroid) || cluster.centroid.length === 0) continue;
		const distance = euclideanDistance(cluster.centroid, vector);
		if (!best || distance < best.distance) best = { cluster, distance };
	}
	return best && best.distance <= SAME_PATTERN_DISTANCE ? best : null;
}

// `aiNamingEnabled` now lives in ./misconceptionFingerprint so this path and the
// cohort naming pass read one switch. Two copies meant MISCONCEPTION_AI_NAMING
// could silence one and not the other.

/**
 * Legacy placeholder names, written by an earlier fallback that could produce no
 * name at all when a child's `signature` was empty. Retained only so
 * `scripts/renameUnnamedArchetypes.ts` can still recognise and replace what is
 * already in the database — nothing writes these any more.
 */
const UNNAMED_PREFIX = 'Unnamed pattern:';
const UNNAMED_BARE = 'Unnamed error pattern';

/**
 * Is this name a stand-in written because the model could not be reached?
 *
 * Defined next to the code that writes them so the two cannot drift: the
 * re-naming pass in `scripts/renameUnnamedArchetypes.ts` decides what to
 * replace by asking this, and it missed the bare form when it had its own copy.
 */
export function isPlaceholderArchetypeName(name: string | undefined): boolean {
	const trimmed = (name ?? '').trim();
	return trimmed === '' || trimmed === UNNAMED_BARE || trimmed.startsWith(UNNAMED_PREFIX);
}

/**
 * The archetype's own name and prose, derived from the founding child's vector.
 *
 * Reads the vector rather than `fingerprint.signature`: `signature` is filtered
 * to components above 0.05 and so can be empty, which is how the bare
 * "Unnamed error pattern" got written. Every vector has a largest component.
 */
function describeFingerprint(fingerprint: StudentFingerprint) {
	return deterministicArchetypeProfile(fingerprint.vector);
}

function averageCentroid(
	previous: number[] | undefined,
	next: number[],
	currentStudentCount: number
): number[] {
	if (!previous || previous.length === 0 || currentStudentCount <= 0) {
		return [...next];
	}

	const length = Math.max(previous.length, next.length);
	const averaged: number[] = [];
	for (let i = 0; i < length; i++) {
		const previousValue = previous[i] ?? 0;
		const nextValue = next[i] ?? 0;
		averaged.push((previousValue * currentStudentCount + nextValue) / (currentStudentCount + 1));
	}
	return averaged;
}

export interface ArchetypeAssignmentResult {
	studentId: string;
	student?: Student;
	fingerprint?: StudentFingerprint;
	archetype?: PersistedMisconceptionCluster;
	clusterId?: string;
	decision?: GeminiClusterDecision;
	createdNewArchetype: boolean;
	assignedAt?: string;
	/** Too few wrong answers to carry a signature; deliberately not assigned. */
	insufficientEvidence?: boolean;
}

export interface StudentArchetypeServiceDependencies {
	dbStore?: DBStore;
}

export class StudentArchetypeService {
	constructor(private readonly dependencies: StudentArchetypeServiceDependencies = {}) {}

	/**
	 * The clustering evidence for one child.
	 *
	 * The child's *latest* `EvaluationReport` decides which evaluation is read,
	 * so re-evaluating a student re-clusters them on their current state rather
	 * than on a stale first attempt. Every graded diagnostic writes one,
	 * including the 36-question paper.
	 *
	 * *What* is read for that evaluation is then the richest record available:
	 *
	 * 1. The submission filed against the report's own worksheet, when there is
	 *    one. A report keeps the score but never what the child wrote, so the
	 *    nine morphology features — the heaviest block in the distance — are
	 *    structurally zero on the report-derived path, and every child evaluated
	 *    that way lands near the origin within one archetype of each other. The
	 *    submission carries the responses and covers the same evaluation, so it
	 *    is strictly better evidence at no cost in staleness.
	 * 2. Otherwise the report itself, for evaluations that record no answers.
	 * 3. Otherwise every submission on file, for worksheets graded before
	 *    reports were written.
	 */
	private async buildStudentFingerprint(
		store: DBStore,
		student: Student
	): Promise<StudentFingerprint | null> {
		const [reports, submissions, worksheets] = await Promise.all([
			store.getEvaluationReports(),
			store.getAnswerSubmissions(),
			store.getWorksheets(),
		]);

		const studentSubmissions = submissions.filter(s => s.studentId === student.id);
		const worksheetsById = new Map<string, Worksheet>(worksheets.map(ws => [ws.id, ws]));

		const latestReport = (reports as EvaluationReport[])
			.filter(report => report.studentId === student.id)
			.sort((a, b) => reportTime(a) - reportTime(b))
			.pop();

		if (latestReport) {
			// The questions have to come from somewhere: either a persisted
			// worksheet, or the paper the submission carries itself (a diagnostic
			// and an ICR scan have no worksheet, so they record their own).
			// Without either there is nothing to compare the answers against.
			const reportSubmissions = studentSubmissions.filter(
				s => s.worksheetId === latestReport.worksheetId
			);
			const questionsResolvable =
				worksheetsById.has(latestReport.worksheetId) ||
				reportSubmissions.some(s => (s.questions?.length ?? 0) > 0);
			if (questionsResolvable && reportSubmissions.length > 0) {
				const fromSubmission = buildFingerprint(student, reportSubmissions, worksheetsById);
				if (fromSubmission) return fromSubmission;
			}

			const fingerprint = buildFingerprintFromEvaluationReport(student, latestReport);
			if (fingerprint) return fingerprint;
		}

		return buildFingerprint(student, studentSubmissions, worksheetsById);
	}

	async assignStudentToArchetype(studentId: string): Promise<ArchetypeAssignmentResult> {
		const store = this.dependencies.dbStore ?? dbStore;

		const student = await store.getStudentById(studentId);
		if (!student) {
			throw new Error(`Student not found: ${studentId}`);
		}

		const fingerprint = await this.buildStudentFingerprint(store, student);
		if (!fingerprint) {
 			return {
 				studentId,
 				student,
 				createdNewArchetype: false,
 			};
 		}

		// The same bar the cohort view applies. A child with one or two wrong
		// answers has a one-hot vector: they would found or join an archetype on
		// the evidence of a single slip, and then be listed under "Not enough
		// evidence yet" on the very screen that shows the group.
		if (fingerprint.totalIncorrect < MIN_ERRORS_FOR_CLUSTERING) {
			return {
				studentId,
				student,
				fingerprint,
				createdNewArchetype: false,
				insufficientEvidence: true,
			};
		}

		// Scoped to the child's own class. An archetype is a teaching group, and a
		// teacher cannot pull a Class 4 child into a Class 2 remedial session; the
		// same error shape also means different things at different levels.
		const misconceptionClusters = await store.getMisconceptionClusters(student.classGroup);
		const now = new Date().toISOString();

		const orderedFingerprintVector = toOrderedVector(fingerprint.vector);

		// Does this child already fail the way one of the archetypes describes?
		// Settled on the vectors, so every child failing that way lands in the
		// same archetype no matter what order the class is graded in.
		const samePattern = findSamePatternCluster(
			misconceptionClusters as MisconceptionCluster[],
			orderedFingerprintVector
		);

		let decision: GeminiClusterDecision;
		if (samePattern) {
			decision = {
				action: 'join',
				clusterId: samePattern.cluster.id,
				// Distance nought to the threshold, expressed as a 0..1 confidence.
				confidence: Number((1 - samePattern.distance / SAME_PATTERN_DISTANCE).toFixed(2)),
				reasoning:
					`Signature sits ${samePattern.distance.toFixed(3)} from this archetype's centroid, ` +
					`within the ${SAME_PATTERN_DISTANCE} same-pattern radius.`,
			};
		} else {
			// Nothing on file fails this way: a genuinely new pattern. The decision
			// is already made; all that remains is what to call it.
			const deterministic = describeFingerprint(fingerprint);

			if (!aiNamingEnabled()) {
				decision = {
					action: 'create',
					confidence: 1,
					reasoning: `Named from the centroid; AI naming is off. Signature sits beyond the ${SAME_PATTERN_DISTANCE} same-pattern radius of every existing archetype.`,
					cluster: deterministic,
				};
			} else {
				try {
					const named = await classifyFingerprintWithGemini(
						fingerprint,
						misconceptionClusters as MisconceptionCluster[]
					);
					decision =
						named.action === 'create'
							? named
							: // The model wanted to file this under an existing archetype the
								// distance check already ruled out. Keep its prose, drop its choice.
								{
									action: 'create',
									confidence: named.confidence,
									reasoning: named.reasoning,
									cluster: {
										...deterministic,
										description: named.reasoning || deterministic.description,
									},
								};
				} catch (error) {
					// Naming failed, membership did not. The archetype is still fully
					// described — the model was never the source of the criteria.
					decision = {
						action: 'create',
						confidence: 0,
						reasoning: `AI naming unavailable (${(error as Error).message.slice(0, 120)}); named from the centroid instead.`,
						cluster: deterministic,
					};
				}
			}
		}

		if (decision.action === 'join') {
			const selectedCluster = misconceptionClusters.find(cluster => cluster.id === decision.clusterId);
			if (!selectedCluster) {
				throw new Error(`Unknown cluster selected: ${decision.clusterId}`);
			}
			const alreadyMember = selectedCluster.studentIds.includes(studentId);

			const studentIds = alreadyMember
				? [...selectedCluster.studentIds]
				: [...selectedCluster.studentIds, studentId];
			// Weight of the existing centroid. On a re-evaluation the child is
			// already inside that average, so they are blended back in at 1/n
			// instead of being folded in a second time as an (n+1)th member.
			const priorStudentCount = alreadyMember
				? selectedCluster.studentIds.length - 1
				: selectedCluster.studentIds.length;
			const updatedCentroid = averageCentroid(selectedCluster.centroid, orderedFingerprintVector, priorStudentCount);
			const updatedCluster: PersistedMisconceptionCluster = {
				...selectedCluster,
				studentIds,
				studentCount: studentIds.length,
				centroid: updatedCentroid,
				updatedAt: now,
			};

			await store.updateMisconceptionCluster(updatedCluster);

			return {
				studentId,
				student,
				fingerprint,
				archetype: updatedCluster,
				clusterId: updatedCluster.id,
				decision,
				createdNewArchetype: false,
			};
		}

		const createdCluster: PersistedMisconceptionCluster = {
			id: `cluster_${randomUUID().slice(0, 8)}`,
			name: decision.cluster?.name ?? '',
			description: decision.cluster?.description ?? '',
			teacherAction: decision.cluster?.teacherAction ?? '',
			forwardRisk: decision.cluster?.forwardRisk ?? '',
			studentIds: [studentId],
			centroid: orderedFingerprintVector,
			classGroup: student.classGroup,
			createdAt: now,
			updatedAt: now,
			studentCount: 1,
		};

		await store.createMisconceptionCluster(createdCluster);

		return {
			studentId,
			student,
			fingerprint,
			archetype: createdCluster,
			clusterId: createdCluster.id,
			decision,
			createdNewArchetype: true,
		};
	}
}

export const studentArchetypeService = new StudentArchetypeService();

export async function assignStudentToArchetype(studentId: string): Promise<ArchetypeAssignmentResult> {
	return studentArchetypeService.assignStudentToArchetype(studentId);
}
