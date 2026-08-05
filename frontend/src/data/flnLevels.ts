/**
 * Canonical frontend source for the FLN 59-level framework hierarchy.
 * Field-for-field compatible with backend/src/curriculum.ts:FLNLevelDescriptor
 * (without the brief field, which is not needed by the Developer Test Mode UI).
 */

export interface FLNLevelDescriptor {
  id: number;
  classGroup: string;
  name: string;
  strand: string;
}

export const FLN_LEVELS: FLNLevelDescriptor[] = [
  { id: 1, classGroup: "Preschool 1", name: "Quantity Comparison", strand: "Number Sense" },
  { id: 2, classGroup: "Preschool 1", name: "Odd One Out", strand: "Number Sense" },
  { id: 3, classGroup: "Preschool 1", name: "Matching + Tracing Lines", strand: "Shapes" },
  { id: 4, classGroup: "Preschool 2", name: "Numbers 1-10", strand: "Number Sense" },
  { id: 5, classGroup: "Preschool 2", name: "Finger Gesture Counting", strand: "Number Sense" },
  { id: 6, classGroup: "Preschool 2", name: "After, Between, Before", strand: "Number Sense" },
  { id: 7, classGroup: "Preschool 3", name: "Addition through objects", strand: "Number Operations" },
  { id: 8, classGroup: "Preschool 3", name: "Subtraction(1-10)", strand: "Number Operations" },
  { id: 9, classGroup: "Preschool 3", name: "Pattern Recognition+Draw by Tracing", strand: "Patterns" },
  { id: 10, classGroup: "Preschool 3", name: "Comparison – Numeral", strand: "Number Sense" },
  { id: 11, classGroup: "Review", name: "Review Assessment", strand: "Review" },
  { id: 12, classGroup: "Class 1", name: "Tens and Ones", strand: "Number Sense" },
  { id: 13, classGroup: "Class 1", name: "Numbers 11–30", strand: "Number Sense" },
  { id: 14, classGroup: "Class 1", name: "Counting + Fun Trace", strand: "Number Sense" },
  { id: 15, classGroup: "Class 1", name: "After, Between & Before", strand: "Number Sense" },
  { id: 16, classGroup: "Class 1", name: "Addition (1-30)", strand: "Number Operations" },
  { id: 17, classGroup: "Class 1", name: "Subtraction (1-30)", strand: "Number Operations" },
  { id: 18, classGroup: "Class 1", name: "Ordering (1-30)", strand: "Number Sense" },
  { id: 19, classGroup: "Class 1", name: "Numering 31-50", strand: "Number Sense" },
  { id: 20, classGroup: "Class 1", name: "Skip Counting in 2s/3s", strand: "Number Sense" },
  { id: 21, classGroup: "Class 1", name: "Comparison (1-50)", strand: "Number Sense" },
  { id: 22, classGroup: "Class 1", name: "Ordering (1-50)", strand: "Number Sense" },
  { id: 23, classGroup: "Review", name: "Review Assessment", strand: "Review" },
  { id: 24, classGroup: "Class 2", name: "Numbers 51-100", strand: "Number Sense" },
  { id: 25, classGroup: "Class 2", name: "Place Value (Tens & Ones)", strand: "Number Sense" },
  { id: 26, classGroup: "Class 2", name: "Carry Addition", strand: "Number Operations" },
  { id: 27, classGroup: "Class 2", name: "Borrow Subtraction", strand: "Number Operations" },
  { id: 28, classGroup: "Class 2", name: "Comparison (Greater Than, Less Than, Equal)", strand: "Number Sense" },
  { id: 29, classGroup: "Class 2", name: "Ordering (Ascending & Descending)", strand: "Number Sense" },
  { id: 30, classGroup: "Class 2", name: "Data Handling (Tally Marks)", strand: "Data Handling" },
  { id: 31, classGroup: "Class 2", name: "Time", strand: "Calendar & Time" },
  { id: 32, classGroup: "Class 2", name: "Ordinal Positions (1st–10th)", strand: "Number Sense" },
  { id: 33, classGroup: "Class 2", name: "Multiplication (Repeated Addition)", strand: "Number Operations" },
  { id: 34, classGroup: "Class 2", name: "Measurement (Non-Standard & Standard)", strand: "Measurement" },
  { id: 35, classGroup: "Review", name: "Review Assessment", strand: "Review" },
  { id: 36, classGroup: "Class 3", name: "Numbers 101–1000 (Place Value)", strand: "Number Sense" },
  { id: 37, classGroup: "Class 3", name: "Comparison (Greater Than, Less Than, Equal)", strand: "Number Sense" },
  { id: 38, classGroup: "Class 3", name: "Ordering (Ascending & Descending)", strand: "Number Sense" },
  { id: 39, classGroup: "Class 3", name: "Addition (Up to 1000)", strand: "Number Operations" },
  { id: 40, classGroup: "Class 3", name: "Subtraction (Up to 1000)", strand: "Number Operations" },
  { id: 41, classGroup: "Class 3", name: "Multiplication (Tables 2–10)", strand: "Number Operations" },
  { id: 42, classGroup: "Class 3", name: "Division (Introduction)", strand: "Number Operations" },
  { id: 43, classGroup: "Class 3", name: "Standard Measurement & Simple Conversions", strand: "Measurement" },
  { id: 44, classGroup: "Class 3", name: "Time & Calendar", strand: "Calendar & Time" },
  { id: 45, classGroup: "Class 3", name: "Fractions", strand: "Fractions" },
  { id: 46, classGroup: "Class 3", name: "Money", strand: "Money" },
  { id: 47, classGroup: "Class 3", name: "Data Handling", strand: "Data Handling" },
  { id: 48, classGroup: "Review", name: "Foundation Mastery Assessment", strand: "Review" },
  { id: 49, classGroup: "Class 4", name: "Numbers up to 10,000", strand: "Number Sense" },
  { id: 50, classGroup: "Class 4", name: "Advanced Multiplication", strand: "Number Operations" },
  { id: 51, classGroup: "Class 4", name: "Advanced Division", strand: "Number Operations" },
  { id: 52, classGroup: "Class 4", name: "Maps & Directions", strand: "Shapes" },
  { id: 53, classGroup: "Class 4", name: "Factors & Multiples", strand: "Number Operations" },
  { id: 54, classGroup: "Class 4", name: "Fraction Operations", strand: "Fractions" },
  { id: 55, classGroup: "Class 4", name: "Decimals (Introduction)", strand: "Number Sense" },
  { id: 56, classGroup: "Class 4", name: "Area & Perimeter", strand: "Measurement" },
  { id: 57, classGroup: "Class 4", name: "Angles", strand: "Measurement" },
  { id: 58, classGroup: "Class 4", name: "Symmetry & Reflection", strand: "Shapes" },
  { id: 59, classGroup: "Review", name: "Advanced Mastery Assessment", strand: "Review" }
];
