import React, { useCallback, useEffect, useState } from "react";
import "../styles/dashboard.css";

const API_BASE = "http://localhost:5000/api/downloads";

/**
 * DownloadHistoryGrid
 * Fetches logged download metadata (class, file type, file name, timestamp)
 * from MongoDB via the Express backend. Exposes a `refreshKey` prop so the
 * parent can force a refetch right after a new download is logged.
 */
export default function DownloadHistoryGrid({ refreshKey }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_BASE, { method: "GET" });
      if (!response.ok) {
        throw new Error(`Download log endpoint returned status ${response.status}`);
      }
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load download history.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, refreshKey]);

  return (
    <section className="fln-panel">
      <div className="fln-panel__head">
        <span>Download History</span>
        <span>{logs.length} records</span>
      </div>
      <div className="fln-panel__body">
        {error && <div className="fln-form-error">{error}</div>}

        {isLoading && logs.length === 0 && !error && (
          <div className="fln-history-empty">Loading download history…</div>
        )}

        {!isLoading && logs.length === 0 && !error && (
          <div className="fln-history-empty">
            No downloads logged yet. Download a question paper or answer
            key above to populate this log.
          </div>
        )}

        {logs.length > 0 && (
          <div className="fln-history-scroll">
            <table className="fln-history-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>File Type</th>
                  <th>File Name</th>
                  <th>Output Folder</th>
                  <th>Questions</th>
                  <th>Downloaded At</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry) => (
                  <tr key={entry._id}>
                    <td>{entry.classLevel}</td>
                    <td>
                      <span
                        className={
                          entry.fileType === "answer_key"
                            ? "fln-tag is-complete"
                            : "fln-tag"
                        }
                      >
                        {entry.fileType === "answer_key"
                          ? "Answer Key"
                          : "Question Paper"}
                      </span>
                    </td>
                    <td>{entry.fileName}</td>
                    <td>{entry.outputFolderPath || entry.filePath || "-"}</td>
                    <td>{entry.totalQuestions ?? "—"}</td>
                    <td>
                      {entry.downloadedAt
                        ? new Date(entry.downloadedAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
