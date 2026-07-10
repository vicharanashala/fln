export function validateGeneration({ selectedClass, assessmentCycle, classList }) {
  const errors = [];
  if (!selectedClass) {
    errors.push('Please select a class');
  }
  if (!assessmentCycle) {
    errors.push('Please select an assessment cycle');
  }
  if (selectedClass && classList.length > 0) {
    const cls = classList.find(c => c._id === selectedClass);
    if (!cls) {
      errors.push('Selected class not found');
    } else if (!cls.grade) {
      errors.push('Selected class does not have a grade assigned');
    }
  }
  return errors;
}

export function getErrorMessage(err) {
  if (!err) return 'An unexpected error occurred';
  if (err.code === 'ERR_NETWORK') {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }
  if (err.code === 'ECONNABORTED') {
    return 'Request timed out. The server may be busy. Please try again.';
  }
  if (err.response) {
    const status = err.response.status;
    const msg = err.response.data?.error || err.response.data?.message;
    if (status === 0 || status === 502 || status === 503 || status === 504) {
      return 'Server is currently unavailable. Please try again later.';
    }
    if (status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (status === 409) {
      return msg || 'This resource is locked by another user.';
    }
    if (msg) return msg;
    return `Server error (${status}). Please try again.`;
  }
  if (err.message?.includes('AI')) {
    return err.message;
  }
  return err.message || 'An unexpected error occurred. Please try again.';
}
