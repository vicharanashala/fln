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
    'orientation-confusion',
    'attribute-confusion',
  ],
  // Sequential pattern completion & rule extrapolation
  patterns: [
    'missing-item',
    'rule-drift',
    'unit-misidentification',
  ],
  // Early literacy observation tags
  literacy: [
    'letter-reversal',
    'phoneme-confusion',
    'omission',
  ],
};

/**
 * Returns allowed error tags for a specific topic, or all tags keyed by topic.
 */
export function getErrorTagsForTopic(topic?: string): string[] | Record<string, string[]> | null {
  if (!topic) {
    return TOPIC_ERROR_TAGS;
  }
  const normalized = topic.trim().toLowerCase();
  return TOPIC_ERROR_TAGS[normalized] || null;
}

/**
 * Validates whether an error tag is recognized for a given topic.
 */
export function isValidErrorTag(topic: string, tag: string): boolean {
  if (!topic || !tag) return false;
  const tags = TOPIC_ERROR_TAGS[topic.trim().toLowerCase()];
  if (!tags) return false;
  return tags.includes(tag.trim().toLowerCase());
}
