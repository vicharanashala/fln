import React, { useState, useCallback } from "react";
import WorksheetModal from "./WorksheetModal";
import "../styles/dashboard.css";

const API_BASE = "http://localhost:5000/api/downloads";

// Map each class to its real, already-built HTML file under public/worksheets/.
// Edit these paths/filenames if yours differ.
const CLASS_FILE_MAP = {
  CLASS_1: "/worksheets/class1.html",
  CLASS_2: "/worksheets/class2.html",
  CLASS_3: "/worksheets/class3.html",
  CLASS_4: "/worksheets/class4.html",
};

const CLASS_LABELS = {
  CLASS_1: "Class 1",
  CLASS_2: "Class 2",
  CLASS_3: "Class 3",
  CLASS_4: "Class 4",
};

async function logDownload(payload) {
  try {
    const pathResponse = await fetch("http://localhost:5000/api/generate/download-path");
    const pathData = pathResponse.ok ? await pathResponse.json() : {};
    await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        outputFolderPath: pathData.outputFolderPath || "",
      }),
    });
  } catch (err) {
    console.error("Failed to log download:", err.message);
  }
}

/**
 * ClassWorksheetLauncher
 * One unified panel: 4 buttons, one per class. Clicking a button opens
 * that class's real, already-built HTML file inside a modal iframe.
 * When that file fires its postMessage hook (see public/worksheets/README.md),
 * this component logs the download to MongoDB and tells the parent to
 * refresh the history grid.
 *
 * Props:
 *  - onDownloadLogged: () => void
 */
export default function ClassWorksheetLauncher({ onDownloadLogged }) {
  const [openClassLevel, setOpenClassLevel] = useState(null);

  const handleOpen = (classLevel) => setOpenClassLevel(classLevel);
  const handleClose = () => setOpenClassLevel(null);

  const handleWorksheetDownloaded = useCallback(
    async ({ classLevel, fileType, fileName, totalQuestions }) => {
      if (!fileType || !fileName) {
        console.error(
          "Worksheet postMessage missing fileType/fileName — check the snippet added to the HTML file."
        );
        return;
      }

      await logDownload({ classLevel, fileType, fileName, totalQuestions });

      if (typeof onDownloadLogged === "function") {
        onDownloadLogged();
      }
    },
    [onDownloadLogged]
  );

  return (
    <section className="fln-panel">
      <div className="fln-panel__head">
        <span>Class Worksheet Downloads</span>
      </div>
      <div className="fln-panel__body">
        <div className="fln-class-launcher-grid">
          {Object.keys(CLASS_FILE_MAP).map((classLevel) => (
            <button
              key={classLevel}
              type="button"
              className="fln-launch-btn fln-class-launcher-grid__btn"
              onClick={() => handleOpen(classLevel)}
            >
              Open {CLASS_LABELS[classLevel]} Worksheet
            </button>
          ))}
        </div>
      </div>

      <WorksheetModal
        classLevel={openClassLevel}
        fileMap={CLASS_FILE_MAP}
        onClose={handleClose}
        onWorksheetDownloaded={handleWorksheetDownloaded}
      />
    </section>
  );
}
