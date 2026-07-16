export const SET_STATUS_ORDER = [
  'Created',
  'Question Papers Generated',
  'Printed',
  'Dispatched',
  'Delivered to School',
  'Assessment Conducted',
  'Answer Sheets Returned',
  'Scanning Completed',
  'Evaluation Completed',
] as const;

export function isValidStatusTransition(current: string, next: string): boolean {
  const currentIndex = SET_STATUS_ORDER.indexOf(current as any);
  const nextIndex = SET_STATUS_ORDER.indexOf(next as any);

  if (currentIndex === -1 || nextIndex === -1) {
    return false; // Unknown status
  }

  // Next status must be strictly one step ahead
  return nextIndex === currentIndex + 1;
}
