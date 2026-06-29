import React, { useEffect, useRef } from "react";
import "../styles/dashboard.css";

/**
 * WorksheetModal
 * Loads one of your already-built class HTML files in an iframe, unmodified
 * apart from the tiny postMessage hook described in public/worksheets/README.md.
 * Listens for that message and forwards it to the parent App as a logged
 * download, then leaves the iframe open so the operator can keep using it
 * (e.g. to download both the question paper and the answer key) until they
 * close the modal themselves.
 *
 * Props:
 *  - classLevel: string | null   -> e.g. "CLASS_2"; null/undefined = closed
 *  - fileMap: { [classLevel]: string }  -> classLevel -> public path, e.g.
 *        { CLASS_1: "/worksheets/class1.html", ... }
 *  - onClose: () => void
 *  - onWorksheetDownloaded: ({ classLevel, fileType, fileName, totalQuestions }) => void
 */
export default function WorksheetModal({
  classLevel,
  fileMap,
  onClose,
  onWorksheetDownloaded,
}) {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!classLevel) {
      return undefined;
    }

    const handleMessage = (event) => {
      const data = event.data;
      if (!data || data.type !== "FLN_WORKSHEET_DOWNLOADED") {
        return;
      }

      onWorksheetDownloaded({
        classLevel: data.classLevel || classLevel,
        fileType: data.fileType,
        fileName: data.fileName,
        totalQuestions:
          typeof data.totalQuestions === "number" ? data.totalQuestions : null,
      });
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [classLevel, onWorksheetDownloaded]);

  if (!classLevel) {
    return null;
  }

  const src = fileMap[classLevel];

  return (
    <div className="fln-modal-overlay" role="dialog" aria-modal="true">
      <div className="fln-modal">
        <div className="fln-modal__head">
          <span>{classLevel.replace("_", " ")} Worksheet</span>
          <button
            type="button"
            className="fln-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!src && (
          <div className="fln-form-error" style={{ padding: 16 }}>
            No file mapped for {classLevel}. Add it to public/worksheets/
            and to the fileMap in ClassWorksheetLauncher.jsx.
          </div>
        )}

        {src && (
          <iframe
            ref={iframeRef}
            src={src}
            title={`${classLevel} worksheet generator`}
            className="fln-modal__iframe"
          />
        )}
      </div>
    </div>
  );
}
