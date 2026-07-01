import React, { useState } from "react";
import {
  generateQuestionPaper,
  generateAnswerKey,
  SUPPORTED_CLASS_LEVELS,
  CLASS_LABELS,
} from "../generators/classGenerators";
import "../styles/dashboard.css";

const API_BASE = "http://localhost:5000/api/downloads";
const DEFAULT_TOTAL_QUESTIONS = 20;

/**
 * Triggers a real browser file download from an in-memory Blob.
 * This is the standard client-side download pattern — no server
 * round-trip needed, since generation already happened in-browser.
 */
function triggerBrowserDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Logs a completed download to the Express/MongoDB backend.
 * This never blocks or reverses the download itself — if logging fails,
 * the file the operator already has on disk is unaffected.
 */
async function logDownload({ classLevel, fileType, fileName, totalQuestions }) {
  try {
    await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classLevel, fileType, fileName, totalQuestions }),
    });
  } catch (err) {
    // Logging is best-effort; surface in console without disrupting the UI.
    console.error("Failed to log download:", err.message);
  }
}

/**
 * ClassDownloadPanel
 * One unified panel listing all 4 classes. Each row lets the operator
 * pick how many questions to generate, then download the question paper
 * and/or answer key for that specific class.
 *
 * Props:
 *  - onDownloadLogged: () => void   -> called after each successful log,
 *                                       so parent can refresh the history grid
 */
export default function ClassDownloadPanel({ onDownloadLogged }) {
  const [totalQuestionsByClass, setTotalQuestionsByClass] = useState(
    () =>
      Object.fromEntries(
        SUPPORTED_CLASS_LEVELS.map((level) => [level, DEFAULT_TOTAL_QUESTIONS])
      )
  );
  const [busyKey, setBusyKey] = useState(null); // `${classLevel}:${fileType}` while generating
  const [errorByClass, setErrorByClass] = useState({});

  const handleTotalQuestionsChange = (classLevel, rawValue) => {
    const parsed = Number(rawValue);
    const safeValue = Number.isNaN(parsed) ? "" : Math.max(1, Math.min(200, Math.floor(parsed)));
    setTotalQuestionsByClass((prev) => ({ ...prev, [classLevel]: safeValue }));
  };

  const handleDownload = async (classLevel, fileType) => {
    const key = `${classLevel}:${fileType}`;
    const totalQuestions = totalQuestionsByClass[classLevel] || DEFAULT_TOTAL_QUESTIONS;

    setBusyKey(key);
    setErrorByClass((prev) => ({ ...prev, [classLevel]: null }));

    try {
      const result =
        fileType === "question_paper"
          ? await generateQuestionPaper(classLevel, totalQuestions)
          : await generateAnswerKey(classLevel, totalQuestions);

      triggerBrowserDownload(result.blob, result.fileName);

      await logDownload({
        classLevel,
        fileType,
        fileName: result.fileName,
        totalQuestions: result.totalQuestions,
      });

      if (typeof onDownloadLogged === "function") {
        onDownloadLogged();
      }
    } catch (err) {
      setErrorByClass((prev) => ({
        ...prev,
        [classLevel]: err.message || "Generation failed.",
      }));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="fln-panel">
      <div className="fln-panel__head">
        <span>Class Worksheet Downloads</span>
      </div>
      <div className="fln-panel__body">
        <div className="fln-class-download-grid">
          {SUPPORTED_CLASS_LEVELS.map((classLevel) => {
            const isPaperBusy = busyKey === `${classLevel}:question_paper`;
            const isKeyBusy = busyKey === `${classLevel}:answer_key`;
            const isAnyBusy = isPaperBusy || isKeyBusy;

            return (
              <div className="fln-class-download-row" key={classLevel}>
                <div className="fln-class-download-row__label">
                  {CLASS_LABELS[classLevel]}
                </div>

                <input
                  className="fln-numeric-input fln-class-download-row__input"
                  type="number"
                  min={1}
                  max={200}
                  value={totalQuestionsByClass[classLevel]}
                  disabled={isAnyBusy}
                  onChange={(e) =>
                    handleTotalQuestionsChange(classLevel, e.target.value)
                  }
                />

                <button
                  type="button"
                  className="fln-launch-btn fln-class-download-row__btn"
                  disabled={isAnyBusy}
                  onClick={() => handleDownload(classLevel, "question_paper")}
                >
                  {isPaperBusy ? "GENERATING…" : "Download Question Paper"}
                </button>

                <button
                  type="button"
                  className="fln-launch-btn fln-class-download-row__btn fln-launch-btn--secondary"
                  disabled={isAnyBusy}
                  onClick={() => handleDownload(classLevel, "answer_key")}
                >
                  {isKeyBusy ? "GENERATING…" : "Download Answer Key"}
                </button>

                {errorByClass[classLevel] && (
                  <div className="fln-form-error fln-class-download-row__error">
                    {errorByClass[classLevel]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
