import React, { useCallback, useEffect, useState } from "react";
import DashboardLayout from "./components/DashboardLayout";
import ControlForm from "./components/ControlForm";
import LiveProgressMeter from "./components/LiveProgressMeter";
import ClassWorksheetLauncher from "./components/ClassWorksheetLauncher";
import DownloadHistoryGrid from "./components/DownloadHistoryGrid";
import "./styles/dashboard.css";

const API_BASE = "http://localhost:5000/api/generate";

export default function App() {
  // ---- Core controller state ----
  const [classLevel, setClassLevel] = useState("CLASS_1");
  const [totalSets, setTotalSets] = useState(500);

  // activeJobStatus tracks the in-flight batch run, if any.
  // { jobId, isProcessing, completed, total, status } | null
  const [activeJobStatus, setActiveJobStatus] = useState(null);

  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyError, setHistoryError] = useState(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [launchError, setLaunchError] = useState(null);
  const [outputFolderPath, setOutputFolderPath] = useState("");

  // Bumped after each logged class download so DownloadHistoryGrid refetches.
  const [downloadsRefreshKey, setDownloadsRefreshKey] = useState(0);
  const handleDownloadLogged = useCallback(() => {
    setDownloadsRefreshKey((prev) => prev + 1);
  }, []);

  const isProcessing = Boolean(activeJobStatus && activeJobStatus.isProcessing);

  // ---- History log: fetched on mount, and refreshed after each run ----
  const fetchHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch(`${API_BASE}/history`, { method: "GET" });

      if (!response.ok) {
        throw new Error(`History endpoint returned status ${response.status}`);
      }

      const data = await response.json();
      const logs = Array.isArray(data) ? data : data.history || [];
      setHistoryLogs(logs);
    } catch (err) {
      setHistoryError(err.message || "Unable to load print history.");
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    fetch(`${API_BASE}/download-path`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setOutputFolderPath(data?.outputFolderPath || ""))
      .catch(() => setOutputFolderPath(""));
  }, []);

  // ---- Batch dispatch ----
  const handleLaunch = useCallback(async () => {
    if (isProcessing) {
      return; // guard against multi-click thread collisions
    }

    setLaunchError(null);

    // Lock controls immediately, before the network round-trip resolves,
    // so a second click during the fetch can't slip through.
    setActiveJobStatus({
      jobId: null,
      isProcessing: true,
      completed: 0,
      total: totalSets,
      status: "dispatching",
    });

    try {
      const response = await fetch(`${API_BASE}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          classLevel,
          totalSets,
          outputFolderPath,
        }),
      });

      if (!response.ok) {
        throw new Error(`Batch dispatch returned status ${response.status}`);
      }

      const data = await response.json();
      const jobId = data.jobId || data.id;

      if (!jobId) {
        throw new Error("Batch dispatch did not return a jobId.");
      }

      setActiveJobStatus({
        jobId,
        isProcessing: true,
        completed: 0,
        total: totalSets,
        status: "running",
      });
    } catch (err) {
      setLaunchError(err.message || "Failed to dispatch batch run.");
      setActiveJobStatus(null);
    }
  }, [classLevel, totalSets, outputFolderPath, isProcessing]);

  const handleCancel = useCallback(async () => {
    const jobId = activeJobStatus?.jobId;
    if (!jobId) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/cancel/${jobId}`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Cancel endpoint returned status ${response.status}`);
      }
      const data = await response.json();
      setActiveJobStatus({
        jobId: data.jobId,
        isProcessing: false,
        completed: data.completed,
        total: data.total,
        status: data.status,
      });
      fetchHistory();
    } catch (err) {
      setLaunchError(err.message || "Failed to cancel batch run.");
    }
  }, [activeJobStatus, fetchHistory]);

  // ---- Progress completion handoff from LiveProgressMeter ----
  const handleProgressComplete = useCallback(
    (finalStatus) => {
      setActiveJobStatus({
        jobId: finalStatus.jobId,
        isProcessing: false,
        completed: finalStatus.completed,
        total: finalStatus.total,
        status: finalStatus.status,
      });

      if (finalStatus.status === "failed") {
        setLaunchError("Batch run failed during spooling. See history log.");
      }

      // Pull the freshly completed (or failed) run into the history grid.
      fetchHistory();
    },
    [fetchHistory]
  );

  const handleProgressError = useCallback((message) => {
    setLaunchError(message);
    setActiveJobStatus((prev) =>
      prev ? { ...prev, isProcessing: false, status: "failed" } : prev
    );
  }, []);

  const hasError = Boolean(launchError) || Boolean(historyError);

  return (
    <DashboardLayout
      isProcessing={isProcessing}
      hasError={hasError}
      controlSlot={
        <ControlForm
          classLevel={classLevel}
          onClassLevelChange={setClassLevel}
          totalSets={totalSets}
          onTotalSetsChange={setTotalSets}
          onLaunch={handleLaunch}
          onCancel={handleCancel}
          isProcessing={isProcessing}
          errorMessage={launchError}
        />
      }
    >
      <LiveProgressMeter
        jobId={activeJobStatus ? activeJobStatus.jobId : null}
        totalSets={totalSets}
        onComplete={handleProgressComplete}
        onError={handleProgressError}
      />

      <ClassWorksheetLauncher onDownloadLogged={handleDownloadLogged} />

      <DownloadHistoryGrid refreshKey={downloadsRefreshKey} />

      <section className="fln-panel">
        <div className="fln-panel__head">
          <span>Print Run History</span>
          <span>{historyLogs.length} records</span>
        </div>
        <div className="fln-panel__body">
          {historyError && (
            <div className="fln-form-error">{historyError}</div>
          )}

          {isHistoryLoading && historyLogs.length === 0 && !historyError && (
            <div className="fln-history-empty">Loading history…</div>
          )}

          {!isHistoryLoading && historyLogs.length === 0 && !historyError && (
            <div className="fln-history-empty">
              No completed runs yet. Dispatch a batch to populate this log.
            </div>
          )}

          {historyLogs.length > 0 && (
            <div className="fln-history-scroll">
              <table className="fln-history-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Class</th>
                    <th>Sets</th>
                    <th>Status</th>
                    <th>Output Folder</th>
                    <th>Completed At</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map((entry, index) => {
                    const rowKey = entry.jobId || entry.id || index;
                    const rowStatus = (entry.status || "").toLowerCase();
                    const tagClass =
                      rowStatus === "failed"
                        ? "fln-tag is-failed"
                        : "fln-tag is-complete";

                    return (
                      <tr key={rowKey}>
                        <td>{entry.jobId || entry.id || "—"}</td>
                        <td>{entry.classLevel || "—"}</td>
                        <td>{entry.totalSets ?? entry.total ?? "—"}</td>
                        <td>
                          <span className={tagClass}>
                            {entry.status || "unknown"}
                          </span>
                        </td>
                        <td>{entry.outputFolderPath || "â€”"}</td>
                        <td>
                          {entry.completedAt
                            ? new Date(entry.completedAt).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </DashboardLayout>
  );
}
