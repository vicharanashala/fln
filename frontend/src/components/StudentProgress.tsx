import React from 'react';

interface ProgressProps {
  studentName: string;
  mathScore: number;
  literacyScore: number;
}

export const StudentProgress = ({ studentName, mathScore, literacyScore }: ProgressProps) => {
  const averageScore = (mathScore + literacyScore) / 2;
  const isPassing = averageScore >= 50;

  return (
    <div className="border border-slate-200 p-5 rounded-xl bg-white shadow-md max-w-96 my-5 mx-auto font-sans text-slate-800">
      <h3 className="m-0 mb-2 text-slate-800 text-lg font-semibold">
        👤 Student: {studentName}
      </h3>
      
      <div className="mb-3">
        <p className="my-1 text-sm text-slate-600">
          📐 Math Score: <strong className="font-bold">{mathScore}%</strong>
        </p>
        <p className="my-1 text-sm text-slate-600">
          📚 Literacy Score: <strong className="font-bold">{literacyScore}%</strong>
        </p>
      </div>

      <div className={`p-2.5 rounded-lg text-center font-bold text-sm ${
        isPassing ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {isPassing ? `✅ Assessment Passed (${averageScore}%)` : `❌ Re-assessment Required (${averageScore}%)`}
      </div>
    </div>
  );
};
