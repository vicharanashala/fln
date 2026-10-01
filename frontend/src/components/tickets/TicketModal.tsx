import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { UserRole } from '../../types';
import { TicketSubmission } from '../TicketSubmission';

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  userRole: UserRole;
}

/**
 * Modal shell around the existing TicketSubmission panel so the navbar
 * "Support Tickets" action can open the same list/create flow in place.
 * All fetching, validation and state live in TicketSubmission — this only
 * supplies the dialog chrome (backdrop, close button, Escape handling).
 */
export const TicketModal: React.FC<TicketModalProps> = ({ isOpen, onClose, token, userRole }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-modal-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h3 id="ticket-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
              Support Tickets
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Raise and track your feedback tickets.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close support tickets"
            className="rounded bg-slate-100 p-1.5 text-slate-400 hover:text-slate-600 dark:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">
          <TicketSubmission token={token} userRole={userRole} />
        </div>
      </div>
    </div>
  );
};
