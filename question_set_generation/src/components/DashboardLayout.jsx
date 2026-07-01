import React from "react";
import "../styles/dashboard.css";

/**
 * DashboardLayout
 * Quiet, utilitarian frame for the print engine console.
 * Renders a structural top header strip carrying the engine's
 * mechanical status signature, then a two-column workspace grid
 * for everything else.
 *
 * Props:
 *  - isProcessing: boolean   -> drives the header status dot/text
 *  - hasError: boolean       -> drives an alert-colored status state
 *  - controlSlot: node       -> left column content (control form)
 *  - children: node          -> right column content (progress + history)
 */
export default function DashboardLayout({
  isProcessing = false,
  hasError = false,
  controlSlot = null,
  children = null,
}) {
  const dotClass = hasError
    ? "fln-status-dot is-alert"
    : isProcessing
    ? "fln-status-dot"
    : "fln-status-dot is-idle";

  const statusTextClass = hasError
    ? "fln-header__status-text is-alert"
    : isProcessing
    ? "fln-header__status-text is-running"
    : "fln-header__status-text";

  const statusLabel = hasError
    ? "ENGINE FAULT"
    : isProcessing
    ? "SPOOLING ACTIVE"
    : "ENGINE IDLE";

  return (
    <div className="fln-shell">
      <header className="fln-header">
        <div className="fln-header__signature">
          <span className={dotClass} aria-hidden="true" />
          <div>
            <div className="fln-header__title">
              FLN MATHEMATICS PROGRAMMATIC PRINT ENGINE
            </div>
            <div className="fln-header__subtitle">
              OMR / ICR WORKSHEET BATCH PRESS — LOCAL CONTROL NODE
            </div>
          </div>
        </div>
        <div className={statusTextClass}>{statusLabel}</div>
      </header>

      <main className="fln-main">
        <div className="fln-stack">{controlSlot}</div>
        <div className="fln-stack">{children}</div>
      </main>
    </div>
  );
}
