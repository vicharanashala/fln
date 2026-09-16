import type { MisconceptionCluster } from './db';
import type { StudentFingerprint } from './misconceptionFingerprint';
import { DEFAULT_GEMINI_MODEL, generateContentWithRetry } from './gemini';
import { Type } from '@google/genai';

export interface GeminiClusterDecision {
  action: 'join' | 'create';
  clusterId?: string;
  confidence: number;
  reasoning: string;
  cluster?: {
    name: string;
    description: string;
    teacherAction: string;
    forwardRisk: string;
  };
}

function parseGeminiText(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  const text = (raw as { text?: unknown; response?: { text?: unknown } })?.text;
  if (typeof text === 'string') return text;
  const responseText = (raw as { response?: { text?: unknown } })?.response?.text;
  if (typeof responseText === 'string') return responseText;
  throw new Error('Gemini response did not contain text.');
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid Gemini response: ${field} must be a non-empty string.`);
  }
  return value.trim();
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid Gemini response: ${field} must be a finite number.`);
  }
  return value;
}

function validateDecision(parsed: unknown): GeminiClusterDecision {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid Gemini response: expected a JSON object.');
  }

  const decision = parsed as {
    action?: unknown;
    clusterId?: unknown;
    confidence?: unknown;
    reasoning?: unknown;
    cluster?: unknown;
  };

  const action = requireString(decision.action, 'action');
  if (action !== 'join' && action !== 'create') {
    throw new Error('Invalid Gemini response: action must be "join" or "create".');
  }

  const confidence = requireNumber(decision.confidence, 'confidence');
  const reasoning = requireString(decision.reasoning, 'reasoning');

  if (action === 'join') {
    return {
      action,
      clusterId: requireString(decision.clusterId, 'clusterId'),
      confidence,
      reasoning,
    };
  }

  const cluster = decision.cluster;
  if (!cluster || typeof cluster !== 'object' || Array.isArray(cluster)) {
    throw new Error('Invalid Gemini response: cluster must be an object when action is "create".');
  }

  const clusterObject = cluster as {
    name?: unknown;
    description?: unknown;
    teacherAction?: unknown;
    forwardRisk?: unknown;
  };

  return {
    action,
    confidence,
    reasoning,
    cluster: {
      name: requireString(clusterObject.name, 'cluster.name'),
      description: requireString(clusterObject.description, 'cluster.description'),
      teacherAction: requireString(clusterObject.teacherAction, 'cluster.teacherAction'),
      forwardRisk: requireString(clusterObject.forwardRisk, 'cluster.forwardRisk'),
    },
  };
}

function summarizeFingerprint(fingerprint: StudentFingerprint): Record<string, unknown> {
  return {
    studentId: fingerprint.studentId,
    studentName: fingerprint.studentName,
    classGroup: fingerprint.classGroup,
    currentLevel: fingerprint.currentLevel,
    score: fingerprint.score,
    totalAnswered: fingerprint.totalAnswered,
    totalIncorrect: fingerprint.totalIncorrect,
    weakness: fingerprint.weakness,
    signature: fingerprint.signature,
    mixedProfile: fingerprint.mixedProfile ?? false,
    secondaryClusterId: fingerprint.secondaryClusterId,
    secondaryDistance: fingerprint.secondaryDistance,
    insufficientEvidence: fingerprint.insufficientEvidence ?? false,
    evidenceReason: fingerprint.evidenceReason,
  };
}

function summarizeClusters(clusters: MisconceptionCluster[]): Array<Record<string, unknown>> {
  return clusters.map(cluster => ({
    id: cluster.id,
    name: cluster.name,
    description: cluster.description,
    teacherAction: cluster.teacherAction,
    forwardRisk: cluster.forwardRisk,
    centroid: cluster.centroid,
    createdAt: cluster.createdAt,
    updatedAt: cluster.updatedAt,
  }));
}

export function buildGeminiClusterPrompt(
  fingerprint: StudentFingerprint,
  clusters: MisconceptionCluster[]
): string {
  const payload = {
    task: 'Assign a student to a persistent misconception archetype.',
    instructions: [
      'You are deciding whether a student fingerprint belongs to an existing misconception archetype.',
      'Use the fingerprint and the existing archetypes only.',
      'Do not invent studentIds.',
      'Do not include full student records.',
      'Return JSON only. No markdown, no code fences, no commentary.',
      'If joining an existing archetype, return action "join" and clusterId.',
      'If creating a new archetype, return action "create" and include a cluster object with the proposed archetype details.',
    ],
    studentFingerprint: summarizeFingerprint(fingerprint),
    existingArchetypes: summarizeClusters(clusters),
    expectedJSONExamples: [
      {
        action: 'join',
        clusterId: 'cluster_4',
        confidence: 0.94,
        reasoning: '...'
      },
      {
        action: 'create',
        confidence: 0.91,
        reasoning: '...',
        cluster: {
          name: '',
          description: '',
          teacherAction: '',
          forwardRisk: ''
        }
      }
    ]
  };

  return [
    'Assign this student to a persistent misconception archetype.',
    '',
    'You are an AI assistant helping classify a student fingerprint into an existing archetype or deciding that a new archetype should be created.',
    'Use the student fingerprint and the list of existing archetypes below.',
    'Do not use studentIds from the archetype records.',
    'Do not infer from full student records because they are not provided.',
    'Return JSON only.',
    '',
    'Input:',
    JSON.stringify(payload, null, 2),
    '',
    'Return exactly one JSON object in one of these shapes:',
    JSON.stringify(
      {
        action: 'join',
        clusterId: 'cluster_4',
        confidence: 0.94,
        reasoning: '...'
      },
      null,
      2
    ),
    '',
    JSON.stringify(
      {
        action: 'create',
        confidence: 0.91,
        reasoning: '...',
        cluster: {
          name: '',
          description: '',
          teacherAction: '',
          forwardRisk: ''
        }
      },
      null,
      2
    )
  ].join('\n');
}

  export async function classifyFingerprintWithGemini(
    fingerprint: StudentFingerprint,
    clusters: MisconceptionCluster[]
  ): Promise<GeminiClusterDecision> {
    const prompt = buildGeminiClusterPrompt(fingerprint, clusters);
    const raw = await generateContentWithRetry({
      model: DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING },
            clusterId: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
            cluster: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                teacherAction: { type: Type.STRING },
                forwardRisk: { type: Type.STRING },
              },
              required: ['name', 'description', 'teacherAction', 'forwardRisk'],
            },
          },
          required: ['action', 'confidence', 'reasoning'],
        },
      },
    });

    const text = parseGeminiText(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`Invalid Gemini JSON response: ${(error as Error).message}`);
    }

    return validateDecision(parsed);
  }
