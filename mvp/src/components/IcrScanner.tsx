import React, { useEffect, useState } from 'react';
import jsQR from 'jsqr';
import { Student, User } from '../types';

interface IcrScannerProps {
  token: string;
  user: User;
  onBack: () => void;
}

type ScanSource = 'upload' | 'camera';

interface QrIdentity {
  studentId: string;
  paperId: string;
  testId: string;
  pageNumber: number;
  raw: string;
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
    return {
      studentId,
      paperId,
      testId,
      pageNumber: Number(page) || 1,
      raw
    };
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

export const IcrScanner: React.FC<IcrScannerProps> = ({ token, onBack }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [scanSource, setScanSource] = useState<ScanSource | null>(null);
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [identity, setIdentity] = useState<QrIdentity | null>(null);
  const [detectedStudent, setDetectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await fetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setStudents(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStudents();
  }, [token]);

  const processPaperImage = async (file: File | undefined, source: ScanSource) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload or scan an image file. PDF-to-image conversion is not part of this QR check.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setScanSource(source);
    setFileName(file.name);
    setIdentity(null);
    setDetectedStudent(null);

    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      setPreviewUrl(imageDataUrl);
      const qrText = await decodeQrFromImage(imageDataUrl);
      const parsed = parseQrPayload(qrText);
      if (!parsed?.studentId) {
        throw new Error('QR decoded, but student ID was not found in the payload.');
      }

      const student = students.find(s => s.id === parsed.studentId);
      if (!student) {
        throw new Error(`QR decoded student ID "${parsed.studentId}", but that student was not found in this login scope.`);
      }

      setIdentity(parsed);
      setDetectedStudent(student);
      setSuccess(`QR verified. Student detected: ${student.name}.`);
    } catch (err: any) {
      setError(err.message || 'QR scan failed.');
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setError('');
    setSuccess('');
    setScanSource(null);
    setFileName('');
    setPreviewUrl('');
    setIdentity(null);
    setDetectedStudent(null);
    setLoading(false);
  };

  return (
    <div className="space-y-6" id="icr-scanner">
      <div className="flex justify-between items-center border-b border-zinc-200 pb-4">
        <div>
          <button onClick={onBack} className="text-zinc-500 hover:text-zinc-800 text-xs font-mono mb-2 block">
            Back to Dashboard
          </button>
          <h2 className="text-2xl font-display font-semibold text-zinc-900 tracking-tight">
            ICR Answer Sheet Scanner
          </h2>
          <p className="text-zinc-500 text-sm mt-0.5">
            Upload or scan a QR-coded answer sheet. Student details are detected from the QR, no manual student selection.
          </p>
        </div>
        {(identity || previewUrl || error) && (
          <button
            onClick={resetScanner}
            className="text-zinc-500 hover:text-zinc-700 text-xs font-mono border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 rounded-lg"
          >
            New Scan
          </button>
        )}
      </div>

      {error && <div className="p-3 text-sm bg-red-50 text-red-700 border border-red-100 rounded-lg">{error}</div>}
      {success && <div className="p-3 text-sm bg-green-50 text-green-700 border border-green-100 rounded-lg">{success}</div>}

      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
        <span className={!identity ? 'text-zinc-900 font-bold' : 'text-green-600'}>{identity ? 'Done: ' : ''}Upload / Scan</span>
        <span className="text-zinc-300">/</span>
        <span className={identity ? 'text-zinc-900 font-bold' : 'text-zinc-300'}>QR Student Match</span>
      </div>

      <div className="bg-white p-8 border border-zinc-200 rounded-2xl shadow-sm max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-display font-semibold text-zinc-900">Scan Paper QR</h3>
          <p className="text-zinc-500 text-sm max-w-md mx-auto">
            Choose one option. The QR must be visible in the uploaded photo or camera scan.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-xl p-5 cursor-pointer transition">
            <span className="block text-xs font-mono font-bold uppercase text-indigo-900">Upload Paper</span>
            <span className="block text-sm text-indigo-950 mt-1">Upload a clear scanned paper image.</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => processPaperImage(e.target.files?.[0], 'upload')}
            />
          </label>

          <label className="border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-xl p-5 cursor-pointer transition">
            <span className="block text-xs font-mono font-bold uppercase text-emerald-900">Scan Paper</span>
            <span className="block text-sm text-emerald-950 mt-1">Use camera capture on mobile or supported devices.</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => processPaperImage(e.target.files?.[0], 'camera')}
            />
          </label>
        </div>

        {loading && (
          <div className="bg-zinc-900 rounded-xl p-5 text-center text-white">
            <div className="text-sm font-mono">Reading QR from {scanSource === 'camera' ? 'camera scan' : 'uploaded image'}...</div>
          </div>
        )}

        {(previewUrl || identity) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {previewUrl && (
              <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50">
                <div className="text-[10px] font-mono font-bold uppercase text-zinc-400 mb-2">Selected Paper</div>
                <img src={previewUrl} alt="Selected answer sheet" className="w-full max-h-80 object-contain bg-white border border-zinc-100" />
                <div className="text-[10px] font-mono text-zinc-400 mt-2">{fileName}</div>
              </div>
            )}

            {identity && detectedStudent && (
              <div className="border border-green-200 rounded-xl p-5 bg-green-50 space-y-4">
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase text-green-700">Student Detected From QR</div>
                  <div className="text-2xl font-display font-semibold text-zinc-900 mt-1">{detectedStudent.name}</div>
                  <div className="text-xs font-mono text-zinc-500 mt-1">
                    {detectedStudent.classGroup} | Section {detectedStudent.section}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                  <div className="flex justify-between border border-green-100 bg-white rounded-lg px-3 py-2">
                    <span className="text-zinc-400">Student ID</span>
                    <span className="text-zinc-900">{identity.studentId}</span>
                  </div>
                  <div className="flex justify-between border border-green-100 bg-white rounded-lg px-3 py-2">
                    <span className="text-zinc-400">Paper ID</span>
                    <span className="text-zinc-900">{identity.paperId}</span>
                  </div>
                  <div className="flex justify-between border border-green-100 bg-white rounded-lg px-3 py-2">
                    <span className="text-zinc-400">Test ID</span>
                    <span className="text-zinc-900">{identity.testId}</span>
                  </div>
                  <div className="flex justify-between border border-green-100 bg-white rounded-lg px-3 py-2">
                    <span className="text-zinc-400">Page</span>
                    <span className="text-zinc-900">{identity.pageNumber}</span>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-green-700 bg-white border border-green-100 rounded-lg p-3 break-all">
                  QR raw: {identity.raw}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
