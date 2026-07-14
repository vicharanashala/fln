import jsPDF from "jspdf";

interface ExportPdfOptions {
  assessmentCode: string;
  title: string;
  grade: string;
  subject: string;
  setNumber?: string;
  status: string;
  totalMarks: number;
  questions: Array<{
    questionNo: number;
    pageNumber?: number;
    questionText: string;
    questionType: string;
    difficulty: string;
    marks: number;
    correctAnswer: string;
    alternateAnswers?: string[];
    evaluationRule: string;
    images?: Array<{ imageUrl: string }>;
  }>;
  generatedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
}

/**
 * Fetch a remote image and convert it to a base64 data URL.
 * Returns null if the fetch fails (we silently skip rather than break the PDF).
 */
async function fetchImageAsDataUrl(url: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const format = blob.type.includes("png") ? "PNG" : "JPEG";
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ dataUrl: reader.result as string, format });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Generate a printable PDF answer key for an assessment.
 * Pure client-side via jspdf — no backend round-trip needed.
 * Includes question images when present.
 */
export async function exportAnswerKeyPdf(opts: ExportPdfOptions): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Pre-load all question images so we can embed them below the question text
  const imageCache: Record<string, { dataUrl: string; format: "PNG" | "JPEG" } | null> = {};
  const imagePromises: Promise<void>[] = [];
  opts.questions.forEach((q) => {
    if (q.images && q.images.length > 0) {
      q.images.forEach((img, idx) => {
        const key = `${q.questionNo}-${idx}`;
        if (!imageCache[key] && img.imageUrl) {
          imagePromises.push(
            fetchImageAsDataUrl(img.imageUrl).then((result) => {
              imageCache[key] = result;
            })
          );
        }
      });
    }
  });
  if (imagePromises.length > 0) {
    await Promise.all(imagePromises);
  }

  const COLORS = {
    primary: [37, 99, 235] as [number, number, number],
    text: [15, 23, 42] as [number, number, number],
    muted: [100, 116, 139] as [number, number, number],
    green: [22, 163, 74] as [number, number, number],
    amber: [217, 119, 6] as [number, number, number],
    lightBg: [241, 245, 249] as [number, number, number],
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const setColor = (rgb: [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

  // ============ HEADER ============
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ANSWER KEY", margin, 14);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(opts.assessmentCode || "AS0000", pageWidth - margin, 14, { align: "right" });

  doc.setFontSize(8);
  doc.setTextColor(220, 230, 250);
  doc.text("FLN Assessment Platform · Foundational Literacy & Numeracy", margin, 21);

  // Status pill
  const statusText = (opts.status || "Draft").toUpperCase();
  const pillX = pageWidth - margin - 25;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pillX, 6, 25, 6, 1.5, 1.5, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setColor(opts.status === "Approved" ? COLORS.green : COLORS.amber);
  doc.text(statusText, pillX + 12.5, 10.2, { align: "center" });

  y = 36;

  // ============ METADATA TABLE ============
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, "S");

  const metaY = y + 6;
  const col1X = margin + 4;
  const col2X = margin + contentWidth / 2;
  const metaRows: Array<[string, string, string, string]> = [
    ["Title", opts.title || "—", "Grade", opts.grade || "—"],
    ["Subject", opts.subject || "—", "Set", opts.setNumber || "—"],
    ["Total Marks", String(opts.totalMarks || 0), "Questions", String(opts.questions.length)],
  ];

  metaRows.forEach((row, i) => {
    const ry = metaY + i * 6.5;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.muted);
    doc.text(row[0].toUpperCase(), col1X, ry);
    doc.text(row[2].toUpperCase(), col2X, ry);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    setColor(COLORS.text);
    doc.text(String(row[1]), col1X + 18, ry);
    doc.text(String(row[3]), col2X + 12, ry);
  });

  y += 32;

  // ============ APPROVAL METADATA ============
  if (opts.approvedAt) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    setColor(COLORS.muted);
    const approvedDate = new Date(opts.approvedAt).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    doc.text(
      `Approved${opts.approvedBy ? ` by ${opts.approvedBy}` : ""} on ${approvedDate}`,
      margin,
      y
    );
    y += 5;
  }

  // ============ QUESTIONS ============
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  setColor(COLORS.primary);
  doc.text("Questions & Answer Key", margin, y);
  y += 2;
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + 40, y);
  y += 6;

  opts.questions.forEach((q, idx) => {
    const imgCount = q.images?.length || 0;
    const blockHeight = 18 + (q.alternateAnswers?.length || 0) * 4 + imgCount * 50;
    checkPageBreak(blockHeight);

    // Question number badge
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(margin, y, 8, 8, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(String(q.questionNo), margin + 4, y + 5.5, { align: "center" });

    // Question meta line
    const metaX = margin + 11;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.muted);
    const metaLine = [
      q.questionType,
      q.difficulty,
      `${q.marks} mark${q.marks === 1 ? "" : "s"}`,
      q.pageNumber ? `Page ${q.pageNumber}` : null,
    ]
      .filter(Boolean)
      .join("  ·  ");
    doc.text(metaLine.toUpperCase(), metaX, y + 3);

    // Question text
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    setColor(COLORS.text);
    const qLines = doc.splitTextToSize(q.questionText || "(no question text)", contentWidth - 11);
    doc.text(qLines, metaX, y + 8);
    y += 8 + qLines.length * 4.2;

    // Question images (cropped from PDF page or uploaded)
    if (q.images && q.images.length > 0) {
      const maxImgH = 50; // mm — keep images compact on the page
      for (let i = 0; i < q.images.length; i++) {
        const key = `${q.questionNo}-${i}`;
        const img = imageCache[key];
        if (img) {
          checkPageBreak(maxImgH + 6);
          try {
            // Fit image into available width
            const props = doc.getImageProperties(img.dataUrl);
            const ratio = props.height / props.width;
            let imgW = Math.min(contentWidth - 11, 80);
            let imgH = imgW * ratio;
            if (imgH > maxImgH) {
              imgH = maxImgH;
              imgW = imgH / ratio;
            }
            const imgX = metaX + (contentWidth - 11 - imgW) / 2;
            doc.addImage(img.dataUrl, img.format, imgX, y + 2, imgW, imgH);
            // Border
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.rect(imgX, y + 2, imgW, imgH);
            y += imgH + 4;
          } catch (e) {
            // Skip image if format not supported
          }
        }
      }
    }

    // Answer box
    const answerY = y;
    checkPageBreak(10);
    doc.setFillColor(...COLORS.lightBg);
    const answerBoxH = 8 + (q.alternateAnswers?.length || 0) * 4;
    doc.roundedRect(metaX, y, contentWidth - 11, answerBoxH, 1.5, 1.5, "F");

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.muted);
    doc.text("ANSWER", metaX + 2, y + 3);

    if (q.evaluationRule === "manual") {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      setColor(COLORS.muted);
      doc.text("Manual grading — no auto answer key", metaX + 2, y + 6.5);
    } else if (q.correctAnswer) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      setColor(COLORS.green);
      doc.text(q.correctAnswer, metaX + 2, y + 7);

      if (q.alternateAnswers && q.alternateAnswers.length > 0) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        setColor(COLORS.muted);
        doc.text("Also accepted: " + q.alternateAnswers.join(", "), metaX + 2, y + 11);
      }
    } else {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      setColor(COLORS.muted);
      doc.text("— no answer provided —", metaX + 2, y + 6.5);
    }

    y += answerBoxH + 4;
  });

  // ============ FOOTER ON EVERY PAGE ============
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(COLORS.muted);
    doc.text(
      `${opts.assessmentCode || "AS0000"} · Generated ${new Date().toLocaleDateString("en-IN")}`,
      margin,
      pageHeight - 8
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  // ============ SAVE ============
  const safeTitle = (opts.title || "answer-key")
    .replace(/[^a-z0-9-_]/gi, "_")
    .slice(0, 40);
  const filename = `${opts.assessmentCode || "AS0000"}_${safeTitle}_AnswerKey.pdf`;
  doc.save(filename);
}
