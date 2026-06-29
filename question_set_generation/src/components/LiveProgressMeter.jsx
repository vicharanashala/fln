import React, { useEffect, useRef, useState } from "react";
import "../styles/dashboard.css";

const POLL_INTERVAL_MS = 1000;
const API_BASE = "http://localhost:5000/api/generate";

/**
 * LiveProgressMeter
 * Polls the backend press engine every second while a job is active
 * and renders a mechanical process monitor: spooled-vs-requested
 * counter plus a computed percentage progress bar.
 *
 * Props:
 *  - jobId: string | null     -> active job id, null when idle
 *  - totalSets: number        -> requested total, used as a fallback target
 *  - onComplete: (finalStatus) => void   -> called once when job finishes
 *  - onError: (message) => void          -> called if polling fails
 */
export default function LiveProgressMeter({
  jobId,
  totalSets,
  onComplete,
  onError,
}) {
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(totalSets || 0);
  const [status, setStatus] = useState("idle"); // idle | running | completed | cancelled | failed
  const intervalRef = useRef(null);

  useEffect(() => {
    // Reset local readout whenever a new job starts.
    if (jobId) {
      setCompleted(0);
      setTotal(totalSets || 0);
      setStatus("running");
    } else {
      setStatus("idle");
    }
  }, [jobId, totalSets]);

  useEffect(() => {
    if (!jobId) {
      return undefined;
    }

    const pollProgress = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/progress/${jobId}`,
          { method: "GET" }
        );

        if (!response.ok) {
          throw new Error(
            `Progress endpoint returned status ${response.status}`
          );
        }

        const data = await response.json();

        const nextCompleted =
          typeof data.completed === "number" ? data.completed : 0;
        const nextTotal =
          typeof data.total === "number" && data.total > 0
            ? data.total
            : totalSets || 0;
        const nextStatus = data.status || "running";

        setCompleted(nextCompleted);
        setTotal(nextTotal);
        setStatus(nextStatus);

        if (
          nextStatus === "completed" ||
          nextStatus === "cancelled" ||
          nextStatus === "failed"
        ) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          if (typeof onComplete === "function") {
            onComplete({
              jobId,
              status: nextStatus,
              completed: nextCompleted,
              total: nextTotal,
            });
          }
        }
      } catch (err) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setStatus("failed");
        if (typeof onError === "function") {
          onError(err.message || "Lost connection to progress endpoint.");
        }
      }
    };

    // Fire immediately, then on the 1s cadence.
    pollProgress();
    intervalRef.current = setInterval(pollProgress, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  if (!jobId) {
    return (
      <section className="fln-panel">
        <div className="fln-panel__head">
          <span>Live Process Monitor</span>
        </div>
        <div className="fln-panel__body">
          <div className="fln-progress-idle">
            No active batch run. Dispatch a job to begin spooling.
          </div>
        </div>
      </section>
    );
  }

  const safeTotal = total > 0 ? total : 1; // guard against divide-by-zero
  const rawPercent = (completed / safeTotal) * 100;
  const percent = Math.max(0, Math.min(100, Math.round(rawPercent * 10) / 10));
  const isFailed = status === "failed";

  return (
    <section className="fln-panel">
      <div className="fln-panel__head">
        <span>Live Process Monitor</span>
        <span>{jobId}</span>
      </div>
      <div className="fln-panel__body">
        <div className="fln-progress-readout">
          <span className="fln-progress-readout__label">
            Spooled: {completed} / {total} Sheets
          </span>
          <span className="fln-progress-percent">
            {percent.toFixed(1)}%
          </span>
        </div>

        <div className="fln-progress-track">
          <div
            className={
              isFailed ? "fln-progress-fill is-alert" : "fln-progress-fill"
            }
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        <div className="fln-progress-footer">
          <span>Status: {status.toUpperCase()}</span>
          <span>Poll: 1000ms</span>
        </div>
      </div>
    </section>
  );
}
