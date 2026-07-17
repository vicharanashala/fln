import React from 'react';

interface SvgResolverProps {
  category: string; // e.g. fruits, animals, shapes, numbers, tracing
  count?: number; // how many items to repeat for counting questions
}

export const SvgLibraryResolver: React.FC<SvgResolverProps> = ({ category, count = 4 }) => {
  const normCategory = category.toLowerCase().trim();

  // Renders beautiful, clean SVG vector math graphics natively to match black & white print specs
  switch (normCategory) {
    case 'fruits':
      return (
        <div className="flex flex-wrap gap-3 my-4 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg justify-center bg-zinc-50 dark:bg-zinc-800 max-w-sm mx-auto" id="svg-fruits">
          {Array.from({ length: count }).map((_, i) => (
            <svg key={i} viewBox="0 0 100 100" className="w-12 h-12 text-zinc-800" referrerPolicy="no-referrer">
              {/* Apple with leaf */}
              <path d="M50,20 C35,20 25,30 25,45 C25,65 40,85 50,85 C60,85 75,65 75,45 C75,30 65,20 50,20 Z" fill="none" stroke="currentColor" strokeWidth="4" />
              <path d="M50,20 Q55,10 60,10" fill="none" stroke="currentColor" strokeWidth="4" />
              <path d="M60,10 Q50,15 50,20" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          ))}
        </div>
      );

    case 'animals':
      return (
        <div className="flex flex-wrap gap-3 my-4 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg justify-center bg-zinc-50 dark:bg-zinc-800 max-w-sm mx-auto" id="svg-animals">
          {Array.from({ length: count }).map((_, i) => (
            <svg key={i} viewBox="0 0 100 100" className="w-12 h-12 text-zinc-800" referrerPolicy="no-referrer">
              {/* Cute Cat/Teddy head outline */}
              <circle cx="50" cy="55" r="30" fill="none" stroke="currentColor" strokeWidth="4" />
              {/* Ears */}
              <path d="M25,35 Q15,15 35,25" fill="none" stroke="currentColor" strokeWidth="4" />
              <path d="M75,35 Q85,15 65,25" fill="none" stroke="currentColor" strokeWidth="4" />
              {/* Eyes & Nose */}
              <circle cx="40" cy="48" r="3" fill="currentColor" />
              <circle cx="60" cy="48" r="3" fill="currentColor" />
              <polygon points="50,55 46,51 54,51" fill="currentColor" />
            </svg>
          ))}
        </div>
      );

    case 'shapes':
      return (
        <div className="flex flex-wrap gap-4 my-4 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg justify-center bg-zinc-50 dark:bg-zinc-800 max-w-sm mx-auto" id="svg-shapes">
          {/* Renders distinct geometry cards */}
          <svg viewBox="0 0 100 100" className="w-16 h-16 text-zinc-800" referrerPolicy="no-referrer">
            <polygon points="50,15 85,80 15,80" fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
          <svg viewBox="0 0 100 100" className="w-16 h-16 text-zinc-800" referrerPolicy="no-referrer">
            <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
          <svg viewBox="0 0 100 100" className="w-16 h-16 text-zinc-800" referrerPolicy="no-referrer">
            <rect x="20" y="20" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
        </div>
      );

    case 'patterns':
      return (
        <div className="flex gap-4 my-4 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg justify-center bg-zinc-50 dark:bg-zinc-800 max-w-md mx-auto items-center" id="svg-patterns">
          {/* Triangle */}
          <svg viewBox="0 0 100 100" className="w-10 h-10 text-zinc-800" referrerPolicy="no-referrer">
            <polygon points="50,15 85,80 15,80" fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
          {/* Arrow pointing right */}
          <span className="text-xl text-zinc-400 dark:text-zinc-500">→</span>
          {/* Circle */}
          <svg viewBox="0 0 100 100" className="w-10 h-10 text-zinc-800 dark:text-zinc-200" referrerPolicy="no-referrer">
            <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
          {/* Arrow */}
          <span className="text-xl text-zinc-400 dark:text-zinc-500">→</span>
          {/* Triangle again */}
          <svg viewBox="0 0 100 100" className="w-10 h-10 text-zinc-800" referrerPolicy="no-referrer">
            <polygon points="50,15 85,80 15,80" fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
          {/* Arrow */}
          <span className="text-xl text-zinc-400">→</span>
          {/* Blank space with a question mark for children to solve */}
          <div className="w-10 h-10 border-2 border-dashed border-zinc-400 dark:border-zinc-500 rounded-md flex items-center justify-center font-bold text-zinc-500 dark:text-zinc-400">
            ?
          </div>
        </div>
      );

    case 'tracing':
      return (
        <div className="my-4 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 max-w-sm mx-auto" id="svg-tracing">
          <svg viewBox="0 0 300 80" className="w-full h-16 text-zinc-800" referrerPolicy="no-referrer">
            {/* Guide tracing shapes with standard dashed outlines */}
            <path d="M10,40 Q50,10 90,40 T170,40 T250,40" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="6,6" />
            <circle cx="30" cy="40" r="5" fill="currentColor" />
            <text x="35" y="45" className="text-[10px] font-sans fill-zinc-500">Start here</text>
          </svg>
        </div>
      );

    case 'numbers':
    default:
      return (
        <div className="flex gap-2 my-4 justify-center" id="svg-numbers">
          <div className="px-4 py-2 border-2 border-zinc-800 rounded bg-white font-mono font-bold text-lg text-zinc-800 shadow-sm">
            {count}
          </div>
          <span className="text-xl text-zinc-400 items-center flex">⭐</span>
          <div className="px-4 py-2 border-2 border-zinc-800 rounded bg-white font-mono font-semibold text-zinc-600">
            Level Milestone
          </div>
        </div>
      );
  }
};
