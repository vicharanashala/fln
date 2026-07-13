import React, { useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';

interface WorksheetIframeModalProps {
  isOpen: boolean;
  onClose: () => void;
  className: string; // e.g. "Class 1", "Class 2", "Class 3", "Class 4"
  token: string;
}

const CLASS_FILE_MAP: { [key: string]: string } = {
  'Class 1': '/worksheets/class1.html',
  'Class 2': '/worksheets/class2.html',
  'Class 3': '/worksheets/class3.html',
  'Class 4': '/worksheets/class4.html',
  'LEVEL_PERSONALIZED': '/worksheets/levels_main.html',
  'Level Personalized': '/worksheets/levels_main.html',
};

export const WorksheetIframeModal: React.FC<WorksheetIframeModalProps> = ({
  isOpen,
  onClose,
  className,
  token,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'FLN_WORKSHEET_DOWNLOADED') {
        return;
      }
      
      console.log('Worksheet successfully generated inside browser:', data);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen]);

  if (!isOpen) return null;

  const src = CLASS_FILE_MAP[className];

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-55 px-6">
          <div>
            <h2 className="text-lg font-display font-semibold text-zinc-900 flex items-center gap-2">
              <span>Interactive Worksheet Generator</span>
              <span className="text-xs bg-zinc-900 text-white font-mono px-2 py-0.5 rounded-full">
                {className}
              </span>
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Personalize, view, and print diagnostic answer sheets directly in your browser.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {src && (
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-600 hover:text-zinc-900 font-medium text-xs border border-zinc-200 bg-white hover:bg-zinc-50 p-2 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Fullscreen</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-650 text-sm font-semibold border border-zinc-200 bg-white hover:bg-zinc-100 p-2 rounded-lg transition-all"
            >
              <span className="sr-only">Close</span>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content / Iframe */}
        <div className="flex-1 bg-zinc-100 relative">
          {!src ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <div className="bg-white p-6 border border-zinc-200 rounded-xl shadow-sm max-w-sm">
                <p className="text-sm font-medium text-red-600">Configuration Error</p>
                <p className="text-xs text-zinc-505 mt-2">
                  No canvas file mapping found for {className}. Please make sure class1.html to class4.html are uploaded.
                </p>
              </div>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={src}
              title={`${className} in-browser worksheet generator`}
              className="w-full h-full border-none bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
};
