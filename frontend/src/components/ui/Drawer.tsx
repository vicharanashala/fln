import { ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  width?: number;
}

export default function Drawer({ open, onClose, title, children, width = 480 }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: width }}
            animate={{ x: 0 }}
            exit={{ x: width }}
            transition={{ type: "tween", duration: 0.22 }}
            style={{ width }}
            className="absolute right-0 top-0 h-full bg-white shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="h-14 px-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}