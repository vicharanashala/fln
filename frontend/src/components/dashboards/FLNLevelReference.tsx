//this directory has been splitted from frontend/src/components/RoleDashboards.tsx for easy deployment
import React, { useState } from 'react';

export const FLN_LEVELS_LIST = [
  // Stage 1: Preschool 1 (Age 3-4)
  { id: 1, class: "Preschool 1", name: "One-to-One Correspondence", strand: "Pre-Number Foundations" },
  { id: 2, class: "Preschool 1", name: "Classification (Single Property)", strand: "Pre-Number Foundations" },
  { id: 3, class: "Preschool 1", name: "Perceptual Same/Different", strand: "Pre-Number Foundations" },
  { id: 4, class: "Preschool 1", name: "Rote Verbal Counting to 10", strand: "Number Sense" },
  { id: 5, class: "Preschool 1", name: "Counting Small Sets (1-3)", strand: "Number Sense" },
  { id: 6, class: "Preschool 1", name: "Shape Matching (Perceptual)", strand: "Shapes & Spatial" },
  { id: 7, class: "Preschool 1", name: "Perceptual Subitizing", strand: "Number Sense" },

  // Stage 2: Preschool 2 (Age 4-5)
  { id: 8, class: "Preschool 2", name: "Quantity Comparison", strand: "Pre-Number Foundations" },
  { id: 9, class: "Preschool 2", name: "Seriation (3 Objects)", strand: "Pre-Number Foundations" },
  { id: 10, class: "Preschool 2", name: "Classification (Increasing Complexity)", strand: "Pre-Number Foundations" },
  { id: 11, class: "Preschool 2", name: "Counting to 5 (Cardinality)", strand: "Number Sense" },
  { id: 12, class: "Preschool 2", name: "Counting 6-10", strand: "Number Sense" },
  { id: 13, class: "Preschool 2", name: "Shape Identification", strand: "Shapes & Spatial" },
  { id: 14, class: "Preschool 2", name: "2-Item Patterns", strand: "Patterns" },
  { id: 15, class: "Preschool 2", name: "Comparative Vocabulary", strand: "Measurement" },
  { id: 16, class: "Preschool 2", name: "Conceptual Subitizing", strand: "Number Sense" },
  { id: 17, class: "Preschool 2", name: "Basic Shape Composition", strand: "Shapes & Spatial" },

  // Stage 3: Preschool 3 / Balvatika (Age 5-6)
  { id: 18, class: "Preschool 3", name: "Numeral Recognition (1-10)", strand: "Number Sense" },
  { id: 19, class: "Preschool 3", name: "Numeral-Quantity Correspondence", strand: "Number Sense" },
  { id: 20, class: "Preschool 3", name: "Numeral Comparison (Object-Mediated)", strand: "Pre-Number Foundations" },
  { id: 21, class: "Preschool 3", name: "Seriation with Transitivity", strand: "Pre-Number Foundations" },
  { id: 22, class: "Preschool 3", name: "Flexible Classification", strand: "Pre-Number Foundations" },
  { id: 23, class: "Preschool 3", name: "Numeral Sequencing", strand: "Number Sense" },
  { id: 24, class: "Preschool 3", name: "Comparative Vocabulary (Formalizing)", strand: "Measurement" },
  { id: 25, class: "Preschool 3", name: "Patterns (2-Item Indep & 3-Item Intro)", strand: "Patterns" },
  { id: 26, class: "Preschool 3", name: "Basic Shape Properties", strand: "Shapes & Spatial" },
  { id: 27, class: "Preschool 3", name: "Shape Composition & Decomposition", strand: "Shapes & Spatial" },

  // Stage 4: Class 1 (Age 6-7)
  { id: 28, class: "Class 1", name: "Abstract Numeral Comparison", strand: "Number Sense" },
  { id: 29, class: "Class 1", name: "Close Numeral Comparison", strand: "Number Sense" },
  { id: 30, class: "Class 1", name: "Counting Objects to 20", strand: "Number Sense" },
  { id: 31, class: "Class 1", name: "Reading & Writing Numerals to 99", strand: "Number Sense" },
  { id: 32, class: "Class 1", name: "Tens and Ones", strand: "Number Sense" },
  { id: 33, class: "Class 1", name: "Single-Digit Addition", strand: "Number Operations" },
  { id: 34, class: "Class 1", name: "Single-Digit Subtraction", strand: "Number Operations" },
  { id: 35, class: "Class 1", name: "3D Shape Properties", strand: "Shapes & Spatial" },
  { id: 36, class: "Class 1", name: "Non-Standard Length Estimation", strand: "Measurement" },
  { id: 37, class: "Class 1", name: "Non-Standard Capacity Estimation", strand: "Measurement" },
  { id: 38, class: "Class 1", name: "3-Item Pattern Completion", strand: "Patterns" },
  { id: 39, class: "Class 1", name: "Concept of Zero", strand: "Number Sense" },
  { id: 40, class: "Class 1", name: "Ordinal Positions (1st-10th)", strand: "Number Sense" },
  { id: 41, class: "Class 1", name: "Informal Number Line (0-20)", strand: "Number Sense" },
  { id: 42, class: "Class 1", name: "Advanced Shape Composition", strand: "Shapes & Spatial" },

  // Stage 5: Class 2 (Age 7-8)
  { id: 43, class: "Class 2", name: "Reading & Writing 3-Digit Numbers", strand: "Number Sense" },
  { id: 44, class: "Class 2", name: "Tens as Bundles/Groups", strand: "Number Sense" },
  { id: 45, class: "Class 2", name: "Flexible 2-Digit Decomposition", strand: "Number Sense" },
  { id: 46, class: "Class 2", name: "2-Digit Addition with Regrouping", strand: "Number Operations" },
  { id: 47, class: "Class 2", name: "2-Digit Subtraction with Regrouping", strand: "Number Operations" },
  { id: 48, class: "Class 2", name: "Multiplication as Repeated Addition", strand: "Number Operations" },
  { id: 49, class: "Class 2", name: "Division as Equal Sharing", strand: "Number Operations" },
  { id: 50, class: "Class 2", name: "Multiplication Tables (2,3,4,5,10)", strand: "Number Operations" },
  { id: 51, class: "Class 2", name: "Currency Recognition", strand: "Money" },
  { id: 52, class: "Class 2", name: "Informal Fractions (Folding)", strand: "Fractions" },
  { id: 53, class: "Class 2", name: "Uniform Non-Standard Measurement", strand: "Measurement" },
  { id: 54, class: "Class 2", name: "2D Shape Set Identification", strand: "Shapes & Spatial" },
  { id: 55, class: "Class 2", name: "Spatial Vocabulary", strand: "Shapes & Spatial" },
  { id: 56, class: "Class 2", name: "Calendar Reading", strand: "Calendar & Time" },
  { id: 57, class: "Class 2", name: "Data Handling (Sorting & Tallies)", strand: "Data Handling" },
  { id: 58, class: "Class 2", name: "Number Patterns & Sequences", strand: "Patterns" },
  { id: 59, class: "Class 2", name: "Zero as a Placeholder", strand: "Number Sense" },
  { id: 60, class: "Class 2", name: "Extended Number Line (0-100)", strand: "Number Sense" },
  { id: 61, class: "Class 2", name: "Skip Counting (2s, 5s, 10s)", strand: "Patterns" },

  // Stage 6: Class 3 (Age 8-9)
  { id: 62, class: "Class 3", name: "3-Digit Place Value & Expanded Form", strand: "Number Sense" },
  { id: 63, class: "Class 3", name: "Flexible 3-Digit Decomposition", strand: "Number Sense" },
  { id: 64, class: "Class 3", name: "3-Digit Comparison & Ordering", strand: "Number Sense" },
  { id: 65, class: "Class 3", name: "Reading & Writing 4-Digit Numbers", strand: "Number Sense" },
  { id: 66, class: "Class 3", name: "3-Digit Addition & Subtraction Problems", strand: "Number Operations" },
  { id: 67, class: "Class 3", name: "Full Multiplication Tables (2-10)", strand: "Number Operations" },
  { id: 68, class: "Class 3", name: "Division Facts & Inverse Relation", strand: "Number Operations" },
  { id: 69, class: "Class 3", name: "Standard Measurement Units", strand: "Measurement" },
  { id: 70, class: "Class 3", name: "Relating 2D Faces to 3D Solids", strand: "Shapes & Spatial" },
  { id: 71, class: "Class 3", name: "Telling Time (Hours & Half-Hours)", strand: "Calendar & Time" },
  { id: 72, class: "Class 3", name: "Money Arithmetic", strand: "Money" },
  { id: 73, class: "Class 3", name: "Formal Fractions (Half/Quarter)", strand: "Fractions" },
  { id: 74, class: "Class 3", name: "Pattern Rules & Generalization", strand: "Patterns" },
  { id: 75, class: "Class 3", name: "Data Handling (Pictographs & Bar Graphs)", strand: "Data Handling" },

  // Stage 7: Class 4 (Age 9-10)
  { id: 76, class: "Class 4", name: "4-Digit & 5-Digit Place Value", strand: "Number Sense" },
  { id: 77, class: "Class 4", name: "Large Number Operations & Regrouping", strand: "Number Sense" },
  { id: 78, class: "Class 4", name: "Complex Multi-Digit Word Problems", strand: "Number Operations" },
  { id: 79, class: "Class 4", name: "Extended Multiplication", strand: "Number Operations" },
  { id: 80, class: "Class 4", name: "Formal Long Division", strand: "Number Operations" },
  { id: 81, class: "Class 4", name: "Fractional Notation & Equivalence", strand: "Fractions" },
  { id: 82, class: "Class 4", name: "Standard Unit Conversion", strand: "Measurement" },
  { id: 83, class: "Class 4", name: "Applied Measurement Word Problems", strand: "Measurement" },
  { id: 84, class: "Class 4", name: "3D Nets & Spatial Perspective", strand: "Shapes & Spatial" },
  { id: 85, class: "Class 4", name: "Advanced Time Calculation", strand: "Calendar & Time" },
  { id: 86, class: "Class 4", name: "Complex Money Problems", strand: "Money" },
  { id: 87, class: "Class 4", name: "Advanced Number Patterns", strand: "Patterns" },
  { id: 88, class: "Class 4", name: "Bar Graphs & Data Interpretation", strand: "Data Handling" },
  { id: 89, class: "Class 4", name: "Factors & Multiples", strand: "Number Operations" },
  { id: 90, class: "Class 4", name: "Decimals (Tenths & Hundredths)", strand: "Number Sense" },
  { id: 91, class: "Class 4", name: "Angles & Turn", strand: "Shapes & Spatial" },
  { id: 92, class: "Class 4", name: "Symmetry & Reflection", strand: "Shapes & Spatial" },
  { id: 93, class: "Class 4", name: "Perimeter & Area", strand: "Measurement" }
];

export const FLNLevelReferenceModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('All');

  if (!isOpen) return null;

  const classesList = ['All', 'Preschool 1', 'Preschool 2', 'Preschool 3', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Review'];

  const filtered = FLN_LEVELS_LIST.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.strand.toLowerCase().includes(search.toLowerCase());
    const matchClass = selectedClass === 'All' || l.class === selectedClass;
    return matchSearch && matchClass;
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-zinc-200 dark:border-zinc-700">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-display font-semibold text-zinc-900 dark:text-white">📖 FLN Levels Framework Reference</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Explore details of the 93 curriculum levels spanning Preschool 1 to Class 4</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-650 text-sm font-semibold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-900 hover:bg-zinc-100 dark:hover:bg-zinc-700 p-2 rounded-lg">Close</button>
        </div>

        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-900">
          <div>
            <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Search Level/Strand</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Addition, shapes, numbers..."
              className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 outline-none focus:border-zinc-500 bg-white dark:bg-slate-900 text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Filter by Class</label>
            <div className="flex flex-wrap gap-1">
              {classesList.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedClass(c)}
                  className={`text-[10px] font-mono font-semibold px-2 py-1.5 rounded border transition-colors ${
                    selectedClass === c ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white dark:bg-slate-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-800/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((l) => (
              <div key={l.id} className="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 shadow-sm hover:border-zinc-350 dark:hover:border-zinc-500 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                      Level {l.id}
                    </span>
                    <span className="text-[9px] font-mono font-semibold uppercase text-zinc-400 dark:text-zinc-500">
                      {l.class}
                    </span>
                  </div>
                  <h4 className="font-display font-semibold text-zinc-900 dark:text-white text-sm mt-2">{l.name}</h4>
                </div>
                <div className="mt-4 pt-2 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 flex justify-between items-center text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                  <span>Strand: <strong className="text-zinc-700 dark:text-zinc-200">{l.strand}</strong></span>
                  </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
