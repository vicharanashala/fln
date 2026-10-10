/**
 * Shared Balvatika Error Tag Taxonomy (Issue #626)
 *
 * Single source of truth for error taxonomy tags mapped per topic family.
 * Used by backend validation and frontend question-authoring dropdowns via
 * GET /api/error-tags — preventing duplicated hardcoding across layers.
 */

export const TOPIC_ERROR_TAGS: Record<string, string[]> = {
  // Gelman & Gallistel's 5 counting principles
  counting: [
    'one-to-one-slip',
    'stable-order-error',
    'cardinality-miss',
    'abstraction-error',
    'order-irrelevance-confusion',
  ],
  // Shape recognition & attribute misconceptions
  shapes: [
    'under-inclusion',
    'over-generalization',
  ],
  // Sequential pattern completion & rule extrapolation
  patterns: [
    'missing-item',
    'swapped-item',
    'extra-item',
  ],
  // Early literacy observation tags placeholder for follow-up issue
  literacy: [],
};

/**
 * Returns allowed error tags for a specific topic, or all tags keyed by topic.
 * Safely guards against prototype property lookup (e.g. 'constructor').
 */
export function getErrorTagsForTopic(topic?: string): string[] | Record<string, string[]> | null {
  if (!topic) {
    return TOPIC_ERROR_TAGS;
  }
  const normalized = topic.trim().toLowerCase();
  if (!Object.hasOwn(TOPIC_ERROR_TAGS, normalized)) {
    return null;
  }
  return TOPIC_ERROR_TAGS[normalized];
}

/**
 * Validates whether an error tag is recognized for a given topic.
 * Safely guards against prototype property lookup (e.g. 'constructor').
 */
export function isValidErrorTag(topic: string, tag: string): boolean {
  if (!topic || !tag) return false;
  const normalizedTopic = topic.trim().toLowerCase();
  if (!Object.hasOwn(TOPIC_ERROR_TAGS, normalizedTopic)) {
    return false;
  }
  const tags = TOPIC_ERROR_TAGS[normalizedTopic];
  if (!Array.isArray(tags)) return false;
  return tags.includes(tag.trim().toLowerCase());
}
