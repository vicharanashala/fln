import React, { useEffect } from 'react';

const TOAST_DURATION = 4000;

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div
      className={`toast toast-${type}`}
      role="alert"
      aria-live="polite"
    >
      <span className="toast-icon">
        {type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
      </span>
      <span className="toast-message">{message}</span>
      <button
        className="toast-close"
        onClick={onClose}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

export default Toast;
