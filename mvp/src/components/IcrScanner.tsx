import React, { useState } from 'react';
import jsQR from 'jsqr';
import { EvaluationReport, Student, User } from '../types';

interface IcrScannerProps {
  token: string;
  user: User;
  onBack: () => void;
}

type ScannerStep = 'select' | 'processing' | 'review' | 'result';
type ScanSource = 'upload' | 'camera';
type FinalMark = 'correct' | 'partial' | 'incorrect';

interface RoiRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PageFrame {
  left: number;
  top: number;
  width: number;
  height: number;
  source: 'fiducials' | 'full-image';
}

interface QrIdentity {
  studentId: string;
  paperId: string;
  testId: string;
  pageNumber: number;
  raw: string;
}

interface TemplateQuestion {
  questionId: string;
  questionLabel: string;
  questionType: 'text' | 'multiple_choice' | 'match_pair' | 'fill_blank' | string;
  prompt?: string;
  answerKey?: string;
  choices?: string[];
  marks?: number;
  autoScoreEligible?: boolean;
  questionBox: RoiRect;
  answerBoxes: RoiRect[];
}

interface ReviewItem {
  questionId: string;
  questionLabel: string;
  questionType: string;
  question: string;
  expectedAnswer: string;
  roi: RoiRect | null;
  cropImageDataUrl: string;
  extractedText: string;
  confidence: number;
  modelName: string;
  modelStatus: string;
  autoEvaluated: boolean;
  needsReview: boolean;
  finalMark: FinalMark | null;
  marks: number;
  maxMarks: number;
}

interface ScanResult {
  detectedQr: QrIdentity;
  student: Student;
  paper: {
    id: string;
    testId: string;
    pageNumber: number;
    page: { width: number; height: number };
    questions: TemplateQuestion[];
    templateUrl: string;
  };
}

function parseQrPayload(rawText: string): QrIdentity | null {
  const raw = rawText.trim();
  if (!raw) return null;

  if (raw.startsWith('{')) {
    try {
      const payload = JSON.parse(raw);
      return {
        studentId: payload.student_id || payload.studentId || '',
        paperId: payload.paper_id || payload.paperId || payload.paperPageId || '',
        testId: payload.test_id || payload.testId || payload.assessmentId || '',
        pageNumber: Number(payload.page || payload.pageNumber || 1),
        raw
      };
    } catch {
      return null;
    }
  }

  if (raw.includes('|') && !raw.includes(':')) {
    const [studentId, paperId, testId, page] = raw.split('|').map(part => part.trim());
    return { studentId, paperId, testId, pageNumber: Number(page) || 1, raw };
  }

  const parsed: QrIdentity = { studentId: '', paperId: '', testId: '', pageNumber: 1, raw };
  raw.split('|').forEach(part => {
    const [rawKey, ...rest] = part.split(':');
    const key = rawKey.trim().toUpperCase();
    const value = rest.join(':').trim();
    if (key === 'SID' || key === 'STUDENT' || key === 'STUDENT_ID') parsed.studentId = value;
    if (key === 'PAPER' || key === 'PAPER_ID') parsed.paperId = value;
    if (key === 'TEST' || key === 'TEST_ID') parsed.testId = value;
    if (key === 'PAGE' || key === 'PAGE_NUMBER') parsed.pageNumber = Number(value) || 1;
  });
  return parsed.studentId && parsed.paperId && parsed.testId ? parsed : null;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read the selected paper image.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the selected paper image.'));
    image.src = src;
  });
}

function decodeCanvasQr(canvas: HTMLCanvasElement, crop?: { x: number; y: number; width: number; height: number; scale?: number }) {
  const sourceContext = canvas.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) return null;
  if (!crop) {
    const imageData = sourceContext.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
  }

  const scale = crop.scale || 1;
  const workCanvas = document.createElement('canvas');
  workCanvas.width = Math.max(1, Math.round(crop.width * scale));
  workCanvas.height = Math.max(1, Math.round(crop.height * scale));
  const workContext = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!workContext) return null;
  workContext.imageSmoothingEnabled = false;
  workContext.drawImage(
    canvas,
    Math.max(0, crop.x),
    Math.max(0, crop.y),
    Math.min(canvas.width - crop.x, crop.width),
    Math.min(canvas.height - crop.y, crop.height),
    0,
    0,
    workCanvas.width,
    workCanvas.height
  );
  const imageData = workContext.getImageData(0, 0, workCanvas.width, workCanvas.height);
  return jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
}

async function decodeQrFromImage(imageDataUrl: string) {
  const BarcodeDetectorCtor = (window as any).BarcodeDetector;
  const image = await loadImage(imageDataUrl);
  if (BarcodeDetectorCtor) {
    const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
    const results = await detector.detect(image);
    const qr = results.find((item: any) => item.format === 'qr_code') || results[0];
    if (qr?.rawValue) return String(qr.rawValue);
  }

  const canvas = document.createElement('canvas');
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not prepare the image for QR decoding.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const fullDecoded = decodeCanvasQr(canvas);
  if (fullDecoded?.data) return fullDecoded.data;

  const regions = [
    { x: canvas.width * 0.58, y: 0, width: canvas.width * 0.42, height: canvas.height * 0.28, scale: 3 },
    { x: canvas.width * 0.68, y: 0, width: canvas.width * 0.32, height: canvas.height * 0.22, scale: 4 },
    { x: canvas.width * 0.72, y: canvas.height * 0.02, width: canvas.width * 0.24, height: canvas.height * 0.18, scale: 5 },
    { x: canvas.width * 0.45, y: 0, width: canvas.width * 0.55, height: canvas.height * 0.35, scale: 3 }
  ];
  for (const region of regions) {
    const decoded = decodeCanvasQr(canvas, region);
    if (decoded?.data) return decoded.data;
  }
  throw new Error('No QR code detected. Upload a clear image of the newly generated paper with the QR visible.');
}

function isTextQuestion(questionType: string) {
  return questionType === 'text' || questionType === 'fill_blank';
}

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findMarkerInZone(imageData: ImageData, zone: RoiRect) {
  const minX = Math.max(0, Math.floor(zone.x));
  const minY = Math.max(0, Math.floor(zone.y));
  const maxX = Math.min(imageData.width, Math.ceil(zone.x + zone.width));
  const maxY = Math.min(imageData.height, Math.ceil(zone.y + zone.height));
  let left = maxX;
  let top = maxY;
  let right = minX;
  let bottom = minY;
  let count = 0;

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const index = (y * imageData.width + x) * 4;
      const red = imageData.data[index];
      const green = imageData.data[index + 1];
      const blue = imageData.data[index + 2];
      if (red < 55 && green < 55 && blue < 55) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
        count += 1;
      }
    }
  }

  const width = right - left + 1;
  const height = bottom - top + 1;
  if (count < 80 || width < 8 || height < 8) return null;
  return { left, top, right, bottom, width, height };
}

function detectPageFrameFromFiducials(image: HTMLImageElement, page: { width: number; height: number }): PageFrame {
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const canvas = document.createElement('canvas');
  canvas.width = naturalWidth;
  canvas.height = naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return { left: 0, top: 0, width: naturalWidth, height: naturalHeight, source: 'full-image' };
  context.drawImage(image, 0, 0, naturalWidth, naturalHeight);
  const imageData = context.getImageData(0, 0, naturalWidth, naturalHeight);

  const zoneWidth = naturalWidth * 0.22;
  const zoneHeight = naturalHeight * 0.18;
  const topLeft = findMarkerInZone(imageData, { x: 0, y: 0, width: zoneWidth, height: zoneHeight });
  const topRight = findMarkerInZone(imageData, { x: naturalWidth - zoneWidth, y: 0, width: zoneWidth, height: zoneHeight });
  const bottomLeft = findMarkerInZone(imageData, { x: 0, y: naturalHeight - zoneHeight, width: zoneWidth, height: zoneHeight });
  const bottomRight = findMarkerInZone(imageData, { x: naturalWidth - zoneWidth, y: naturalHeight - zoneHeight, width: zoneWidth, height: zoneHeight });

  if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
    return { left: 0, top: 0, width: naturalWidth, height: naturalHeight, source: 'full-image' };
  }

  const markerInsetPt = 12;
  const markerSizePt = 28;
  const markerTravelXPt = page.width - (markerInsetPt * 2) - markerSizePt;
  const markerTravelYPt = page.height - (markerInsetPt * 2) - markerSizePt;
  const scaleX = (topRight.left - topLeft.left) / markerTravelXPt;
  const scaleY = (bottomLeft.top - topLeft.top) / markerTravelYPt;
  const left = Math.max(0, topLeft.left - markerInsetPt * scaleX);
  const top = Math.max(0, topLeft.top - markerInsetPt * scaleY);
  const right = Math.min(naturalWidth, topRight.right + markerInsetPt * scaleX);
  const bottom = Math.min(naturalHeight, bottomLeft.bottom + markerInsetPt * scaleY);

  if (right <= left || bottom <= top) {
    return { left: 0, top: 0, width: naturalWidth, height: naturalHeight, source: 'full-image' };
  }

  return { left, top, width: right - left, height: bottom - top, source: 'fiducials' };
}

function cropRoiFromImage(image: HTMLImageElement, page: { width: number; height: number }, roi: RoiRect, frame: PageFrame) {
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const scaleX = frame.width / page.width;
  const scaleY = frame.height / page.height;
  const padX = 4 * scaleX;
  const padY = 4 * scaleY;
  const sx = Math.max(0, frame.left + roi.x * scaleX - padX);
  const sy = Math.max(0, frame.top + roi.y * scaleY - padY);
  const sw = Math.min(naturalWidth - sx, roi.width * scaleX + padX * 2);
  const sh = Math.min(naturalHeight - sy, roi.height * scaleY + padY * 2);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not crop answer ROI.');
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

function reviewMarkToMarks(mark: FinalMark | null, maxMarks = 1) {
  if (mark === 'correct') return maxMarks;
  if (mark === 'partial') return maxMarks / 2;
  return 0;
}

export const IcrScanner: React.FC<IcrScannerProps> = ({ token, onBack }) => {
  const [step, setStep] = useState<ScannerStep>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [scanSource, setScanSource] = useState<ScanSource | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [report, setReport] = useState<EvaluationReport | null>(null);

  const callTrocr = async (item: ReviewItem, identity: QrIdentity) => {
    const res = await fetch('/api/ocr/trocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        studentId: identity.studentId,
        paperId: identity.paperId,
        testId: identity.testId,
        questionId: item.questionId,
        questionType: item.questionType,
        prompt: item.question,
        expectedAnswer: item.expectedAnswer,
        imageDataUrl: item.cropImageDataUrl
      })
    });
    return res.json();
  };

  const processPaperImage = async (file: File | undefined, source: ScanSource) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload or scan an image file. PDF-to-image conversion is not part of this MVP workflow.');
      return;
    }

    setStep('processing');
    setLoading(true);
    setError('');
    setSuccess('');
    setReport(null);
    setReviewItems([]);
    setScanResult(null);
    setScanSource(source);

    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      setPreviewUrl(imageDataUrl);
      const qrText = await decodeQrFromImage(imageDataUrl);
      const parsed = parseQrPayload(qrText);
      if (!parsed) throw new Error('QR decoded, but the payload format is not valid.');

      const templateRes = await fetch('/api/ocr/scan/template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ qrText })
      });
      const templateData = await templateRes.json();
      if (!templateRes.ok) throw new Error(templateData.error || 'Could not load scan template for this paper.');

      const loadedImage = await loadImage(imageDataUrl);
      const paper = templateData.paper;
      const pageFrame = detectPageFrameFromFiducials(loadedImage, paper.page);
      const items: ReviewItem[] = [];

      for (const question of paper.questions as TemplateQuestion[]) {
        const textBased = isTextQuestion(question.questionType);
        const roi = textBased ? question.answerBoxes?.[0] : question.questionBox;
        const maxMarks = Number(question.marks || 1);
        const cropImageDataUrl = roi ? cropRoiFromImage(loadedImage, paper.page, roi, pageFrame) : '';
        const baseItem: ReviewItem = {
          questionId: question.questionId,
          questionLabel: question.questionLabel,
          questionType: question.questionType,
          question: question.prompt || question.questionLabel,
          expectedAnswer: question.answerKey || '',
          roi: roi || null,
          cropImageDataUrl,
          extractedText: '',
          confidence: textBased ? 0 : 0,
          modelName: textBased ? 'microsoft/trocr-base-handwritten' : 'visual-review',
          modelStatus: textBased ? 'pending' : 'manual_visual_review',
          autoEvaluated: false,
          needsReview: true,
          finalMark: null,
          marks: 0,
          maxMarks
        };

        if (!textBased) {
          items.push(baseItem);
          continue;
        }

        const trocr = await callTrocr(baseItem, parsed);
        const confidence = Math.max(0, Math.min(1, Number(trocr.confidence || 0)));
        const extractedText = String(trocr.extractedText || '');
        const autoEvaluated = confidence >= 0.4;
        const isCorrect = autoEvaluated && normalizeAnswer(extractedText) === normalizeAnswer(baseItem.expectedAnswer);
        items.push({
          ...baseItem,
          extractedText,
          confidence,
          modelName: trocr.modelName || baseItem.modelName,
          modelStatus: trocr.modelStatus || (autoEvaluated ? 'ok' : 'needs_review'),
          autoEvaluated,
          needsReview: !autoEvaluated,
          finalMark: autoEvaluated ? (isCorrect ? 'correct' : 'incorrect') : null,
          marks: autoEvaluated ? (isCorrect ? maxMarks : 0) : 0
        });
      }

      setScanResult(templateData);
      setReviewItems(items);
      setStep('review');
      setSuccess(`QR verified. Student detected: ${templateData.student.name}. ${items.length} answer ROIs cropped using ${pageFrame.source === 'fiducials' ? 'corner markers' : 'full-image fallback'}.`);
    } catch (err: any) {
      setError(err.message || 'OCR scan failed.');
      setStep('select');
    } finally {
      setLoading(false);
    }
  };

  const setFinalMark = (questionId: string, finalMark: FinalMark) => {
    setReviewItems(prev => prev.map(item => {
      if (item.questionId !== questionId) return item;
      return { ...item, finalMark, marks: reviewMarkToMarks(finalMark, item.maxMarks) };
    }));
  };

  const finalizeScan = async () => {
    if (!scanResult) return;
    const unresolved = reviewItems.some(item => item.needsReview && !item.finalMark);
    if (unresolved) {
      setError('Please mark every volunteer-review answer before saving.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ocr/scan/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: scanResult.detectedQr.studentId,
          paperId: scanResult.detectedQr.paperId,
          testId: scanResult.detectedQr.testId,
          reviewItems
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save OCR evaluation.');
      setReport(data.report);
      setSuccess('Final OCR evaluation saved with marks, confidence, OCR output, and review status.');
      setStep('result');
    } catch (err: any) {
      setError(err.message || 'Failed to save OCR evaluation.');
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setStep('select');
    setLoading(false);
    setError('');
    setSuccess('');
    setScanSource(null);
    setPreviewUrl('');
    setScanResult(null);
    setReviewItems([]);
    setReport(null);
  };

  const reviewCount = reviewItems.filter(item => item.needsReview).length;
  const autoCount = reviewItems.filter(item => item.autoEvaluated).length;

  return (
    <div className="space-y-6" id="icr-scanner">
      <div className="flex justify-between items-center border-b border-zinc-200 pb-4">
        <div>
          <button onClick={onBack} className="text-zinc-500 hover:text-zinc-800 text-xs font-mono mb-2 block">
            Back to Dashboard
          </button>
          <h2 className="text-2xl font-display font-semibold text-zinc-900 tracking-tight">
            OCR Answer Sheet Scanner
          </h2>
          <p className="text-zinc-500 text-sm mt-0.5">
            Upload or scan a QR-coded paper. Student and paper details come from the QR; answers are cropped from stored ROIs.
          </p>
        </div>
        {step !== 'select' && (
          <button onClick={resetScanner} className="text-zinc-500 hover:text-zinc-700 text-xs font-mono border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 rounded-lg">
            New Scan
          </button>
        )}
      </div>

      {error && <div className="p-3 text-sm bg-red-50 text-red-700 border border-red-100 rounded-lg">{error}</div>}
      {success && <div className="p-3 text-sm bg-green-50 text-green-700 border border-green-100 rounded-lg">{success}</div>}

      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
        <span className={step === 'select' ? 'text-zinc-900 font-bold' : 'text-green-600'}>{step !== 'select' ? 'Done: ' : ''}Upload / Scan</span>
        <span className="text-zinc-300">/</span>
        <span className={step === 'processing' ? 'text-zinc-900 font-bold' : step === 'review' || step === 'result' ? 'text-green-600' : 'text-zinc-300'}>QR + ROI + TrOCR</span>
        <span className="text-zinc-300">/</span>
        <span className={step === 'review' ? 'text-zinc-900 font-bold' : step === 'result' ? 'text-green-600' : 'text-zinc-300'}>Review</span>
        <span className="text-zinc-300">/</span>
        <span className={step === 'result' ? 'text-zinc-900 font-bold' : 'text-zinc-300'}>Saved</span>
      </div>

      {step === 'select' && (
        <div className="bg-white p-8 border border-zinc-200 rounded-2xl shadow-sm max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-display font-semibold text-zinc-900">OCR Scan</h3>
            <p className="text-zinc-500 text-sm max-w-md mx-auto">
              No manual student selection. Upload a scan or use camera capture; QR identifies the student and template.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-xl p-5 cursor-pointer transition">
              <span className="block text-xs font-mono font-bold uppercase text-indigo-900">Upload Paper</span>
              <span className="block text-sm text-indigo-950 mt-1">Upload a clear scanned answer-sheet image.</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => processPaperImage(e.target.files?.[0], 'upload')} />
            </label>
            <label className="border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-xl p-5 cursor-pointer transition">
              <span className="block text-xs font-mono font-bold uppercase text-emerald-900">Scan Paper</span>
              <span className="block text-sm text-emerald-950 mt-1">Use camera capture on mobile or supported devices.</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => processPaperImage(e.target.files?.[0], 'camera')} />
            </label>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="bg-zinc-900 rounded-2xl shadow-xl max-w-2xl mx-auto p-8 border border-zinc-700 text-center space-y-4">
          <h3 className="text-xl font-display font-semibold text-white">{loading ? 'Reading QR, Cropping ROIs, Calling TrOCR...' : 'Processing'}</h3>
          <p className="text-zinc-400 text-sm">
            Source: {scanSource === 'camera' ? 'Scan Paper' : 'Upload Paper'}. Text crops use the Microsoft TrOCR service when configured.
          </p>
        </div>
      )}

      {step === 'review' && scanResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
              <h4 className="text-sm font-display font-semibold text-zinc-900">Detected Student</h4>
              <div className="mt-3 space-y-1 text-xs font-mono text-zinc-500">
                <div>Name: <span className="text-zinc-900">{scanResult.student.name}</span></div>
                <div>Student ID: <span className="text-zinc-900">{scanResult.detectedQr.studentId}</span></div>
                <div>Paper ID: <span className="text-zinc-900">{scanResult.detectedQr.paperId}</span></div>
                <div>Test ID: <span className="text-zinc-900">{scanResult.detectedQr.testId}</span></div>
                <div>Page: <span className="text-zinc-900">{scanResult.detectedQr.pageNumber}</span></div>
              </div>
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs font-mono text-zinc-600">
              Auto-evaluated: {autoCount}<br />
              Needs volunteer review: {reviewCount}<br />
              Template: <a className="underline" href={scanResult.paper.templateUrl} target="_blank" rel="noreferrer">ROI JSON</a>
            </div>
            {previewUrl && (
              <div className="bg-white border border-zinc-200 rounded-xl p-3">
                <img src={previewUrl} alt="Uploaded answer sheet" className="w-full max-h-64 object-contain bg-white" />
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl p-6 shadow-sm space-y-4">
            <div>
              <h4 className="text-lg font-display font-medium text-zinc-900">Question Review</h4>
              <p className="text-xs text-zinc-500 mt-1">
                Visual answers and text answers below 40% confidence require volunteer marking.
              </p>
            </div>

            {reviewItems.map(item => (
              <div key={item.questionId} className={`border rounded-lg p-4 space-y-3 ${item.needsReview ? 'border-amber-200 bg-amber-50/40' : 'border-green-200 bg-green-50/40'}`}>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold bg-zinc-900 text-white px-2 py-0.5 rounded">{item.questionLabel}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{item.questionType}</span>
                    </div>
                    <p className="text-sm text-zinc-800 mt-2">{item.question}</p>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded ${item.needsReview ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                    {item.needsReview ? 'Volunteer Review' : 'Auto Evaluated'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border border-dashed border-zinc-300 bg-white rounded-lg p-3">
                    <span className="block text-[9px] font-mono font-bold uppercase text-zinc-400 mb-2">Student Cropped Answer</span>
                    {item.cropImageDataUrl ? (
                      <img src={item.cropImageDataUrl} alt={`${item.questionLabel} cropped answer`} className="w-full max-h-40 object-contain border border-zinc-100 bg-white" />
                    ) : (
                      <div className="text-xs font-mono text-zinc-500">No crop available</div>
                    )}
                    <div className="text-[10px] text-zinc-400 mt-1">
                      ROI: {item.roi ? `${Math.round(item.roi.x)}, ${Math.round(item.roi.y)}, ${Math.round(item.roi.width)} x ${Math.round(item.roi.height)}` : 'not available'}
                    </div>
                  </div>
                  <div className="border border-zinc-200 bg-white rounded-lg p-3">
                    <span className="block text-[9px] font-mono font-bold uppercase text-zinc-400 mb-2">Answer Key / Expected Answer</span>
                    <div className="min-h-20 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-base font-mono font-bold text-zinc-950">
                      {item.expectedAnswer || 'Manual reference needed'}
                    </div>
                    <p className="mt-2 text-[10px] text-zinc-500">
                      Use this key to mark the cropped student answer as correct, partial, or incorrect.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white border border-zinc-200 rounded-lg p-3">
                    <span className="block text-[9px] font-mono font-bold uppercase text-zinc-400">Extracted OCR Text</span>
                    <span className="font-mono text-zinc-900">{item.extractedText || 'N/A'}</span>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-lg p-3">
                    <span className="block text-[9px] font-mono font-bold uppercase text-zinc-400">Confidence</span>
                    <span className="font-mono text-zinc-900">{Math.round(item.confidence * 100)}%</span>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-lg p-3">
                    <span className="block text-[9px] font-mono font-bold uppercase text-zinc-400">Model</span>
                    <span className="font-mono text-zinc-900">{item.modelName}</span>
                    <span className="block text-[10px] text-zinc-400">{item.modelStatus}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(['correct', 'partial', 'incorrect'] as FinalMark[]).map(mark => (
                    <button
                      key={mark}
                      type="button"
                      onClick={() => setFinalMark(item.questionId, mark)}
                      className={`text-xs font-mono font-bold px-3 py-2 rounded border capitalize ${
                        item.finalMark === mark
                          ? mark === 'correct'
                            ? 'bg-green-600 text-white border-green-600'
                            : mark === 'partial'
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      {mark}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button onClick={finalizeScan} disabled={loading} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Final OCR Evaluation'}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && report && (
        <div className="max-w-2xl mx-auto bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-5 text-center">
          <h3 className="text-xl font-display font-semibold text-zinc-900">OCR Evaluation Saved</h3>
          <div className="grid grid-cols-2 gap-4 border-y border-zinc-200 py-4">
            <div>
              <span className="block text-xs font-mono text-zinc-400 uppercase">Score</span>
              <span className="text-2xl font-display font-bold text-zinc-900">{report.score} / {report.totalQuestions}</span>
            </div>
            <div>
              <span className="block text-xs font-mono text-zinc-400 uppercase">Status</span>
              <span className="text-2xl font-display font-bold text-green-600">Saved</span>
            </div>
          </div>
          <p className="text-sm text-zinc-600">{report.narrative}</p>
          <div className="flex gap-3">
            <button onClick={resetScanner} className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-2.5 rounded-lg">
              Scan Another Paper
            </button>
            <button onClick={onBack} className="flex-1 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-medium text-sm py-2.5 rounded-lg">
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
