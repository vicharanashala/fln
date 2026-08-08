import { IRemediationLedger } from '../interfaces/remediationLedger.interface';

export function formatRemediationSheetSimple(ledger: IRemediationLedger): string {
    // Header line
    let output = `${ledger.studentName ?? ledger.studentId}\t\tExam: ${ledger.examId}\n`;
    output += `--------------------------------------------------\n\n`;

    // Practice questions
    (ledger.responses || []).forEach((r, idx) => {
        output += `Concept ${idx + 1}: ${r.conceptName}\n`;
        output += `Original Question: ${r.originalQuestion}\n\n`;
        (r.practiceQuestions || []).forEach((pq, i) => {
            output += `${i + 1}. ${pq.question} → Answer: ${pq.answer}\n`;
        });
        output += `\n`;
    });

    return output;
}
