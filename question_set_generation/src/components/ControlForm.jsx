import React from "react";
import "../styles/dashboard.css";

const CLASS_LEVELS = [
  { id: "CLASS_1", label: "Class 1" },
  { id: "CLASS_2", label: "Class 2" },
  { id: "CLASS_3", label: "Class 3" },
  { id: "CLASS_4", label: "Class 4" },
];

const MAX_TOTAL_SETS = 5000;
const MIN_TOTAL_SETS = 1;

export default function ControlForm({
  classLevel,
  onClassLevelChange,
  totalSets,
  onTotalSetsChange,
  onLaunch,
  onCancel,
  isProcessing = false,
  errorMessage = null,
}) {
  const handleNumericChange = (event) => {
    const rawValue = event.target.value;

    if (rawValue === "") {
      onTotalSetsChange("");
      return;
    }

    const parsed = Number(rawValue);

    if (Number.isNaN(parsed)) {
      return;
    }

    const clamped = Math.max(0, Math.min(MAX_TOTAL_SETS, Math.floor(parsed)));
    onTotalSetsChange(clamped);
  };

  const isValidTotalSets =
    typeof totalSets === "number" &&
    totalSets >= MIN_TOTAL_SETS &&
    totalSets <= MAX_TOTAL_SETS;

  const isLaunchDisabled = isProcessing || !classLevel || !isValidTotalSets;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isLaunchDisabled) {
      return;
    }
    onLaunch();
  };

  return (
    <section className="fln-panel">
      <div className="fln-panel__head">
        <span>Batch Run Controller</span>
      </div>
      <div className="fln-panel__body">
        <form onSubmit={handleSubmit}>
          <label className="fln-field-label" htmlFor="fln-class-grid">
            Baseline Class Level
          </label>
          <div className="fln-class-grid" id="fln-class-grid" role="group">
            {CLASS_LEVELS.map((level) => {
              const isActive = classLevel === level.id;
              return (
                <button
                  key={level.id}
                  type="button"
                  className={
                    isActive
                      ? "fln-class-toggle is-active"
                      : "fln-class-toggle"
                  }
                  aria-pressed={isActive}
                  disabled={isProcessing}
                  onClick={() => onClassLevelChange(level.id)}
                >
                  {level.label}
                </button>
              );
            })}
          </div>

          <label className="fln-field-label" htmlFor="fln-total-sets">
            Total Sets Allocation
          </label>
          <input
            id="fln-total-sets"
            className="fln-numeric-input"
            type="number"
            inputMode="numeric"
            min={MIN_TOTAL_SETS}
            max={MAX_TOTAL_SETS}
            step={1}
            value={totalSets}
            disabled={isProcessing}
            onChange={handleNumericChange}
            placeholder="e.g. 1500"
          />
          <div
            className={
              !isValidTotalSets && totalSets !== ""
                ? "fln-numeric-hint is-alert"
                : "fln-numeric-hint"
            }
          >
            Accepts {MIN_TOTAL_SETS} - {MAX_TOTAL_SETS} sheets per run.
          </div>

          <button
            type="submit"
            className="fln-launch-btn"
            disabled={isLaunchDisabled}
          >
            {isProcessing ? "Batch Run In Progress..." : "Start Batch Run"}
          </button>

          {isProcessing && (
            <button
              type="button"
              className="fln-launch-btn fln-launch-btn--secondary"
              onClick={onCancel}
            >
              Cancel Batch Run
            </button>
          )}

          {errorMessage && (
            <div className="fln-form-error">{errorMessage}</div>
          )}
        </form>
      </div>
    </section>
  );
}
