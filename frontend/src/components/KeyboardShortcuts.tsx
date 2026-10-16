import React, { useState, useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsProps {
  visible: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { category: 'Navigation', items: [
    { keys: ['/', '⌘K'], description: 'Open student search' },
    { keys: ['Esc'], description: 'Close search / dropdown / modal' },
    { keys: ['?'], description: 'Toggle this shortcuts panel' },
  ]},
  { category: 'Student Profile', items: [
    { keys: ['1'], description: 'Overview tab' },
    { keys: ['2'], description: 'Academic Record tab' },
    { keys: ['3'], description: 'Personal Details tab' },
    { keys: ['4'], description: 'Activity Log tab' },
  ]},
  { category: 'General', items: [
    { keys: ['⌘/Ctrl', 'L'], description: 'Focus sidebar search' },
    { keys: ['T'], description: 'Toggle dark/light mode' },
    { keys: ['P'], description: 'Print current view' },
  ]},
];

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({ visible, onClose }) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) onClose();
    };
    if (visible) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">
          {SHORTCUTS.map(group => (
            <div key={group.category}>
              <h3 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">
                {group.category}
              </h3>
              <div className="space-y-1.5">
                {group.items.map(item => (
                  <div key={item.description} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span className="text-sm text-slate-700 dark:text-slate-300">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="text-[10px] text-slate-300 dark:text-slate-600">+</span>}
                          <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[11px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 text-center text-[10px] text-slate-400 dark:text-slate-500">
          Press <kbd className="rounded border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-1 py-0.5 font-mono">?</kbd> or <kbd className="rounded border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-1 py-0.5 font-mono">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
};

export const useKeyboardShortcuts = (onToggle: () => void) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        onToggle();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onToggle]);
};
