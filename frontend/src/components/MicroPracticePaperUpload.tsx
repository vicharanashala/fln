import React, { useRef, useState } from 'react';
import jsQR from 'jsqr';
import { apiFetch } from '../services/apiClient';

interface DecodedPayload {
    paperId: string;
    studentId: string;
    studentName: string;
    levelId?: number;
    subIdx?: number;
    sectionIndex?: number;
    questionCount?: number;
}

interface UploadResult extends DecodedPayload {
    imageUrl: string;
    competency: string | null;
}

interface PageCandidate {
    pageIndices: number[]; // 1-based, all physical pages belonging to this paper
    payload: DecodedPayload; // identical across all merged pages (same paperId)
    pageImageDataUrls: string[]; // one entry per physical page, in order
    filename: string;
    // 'skipped-graded': a duplicate of an already-graded paper — never
    // uploaded, no replace option. 'skipped-duplicate': a duplicate of a
    // still-pending paper the teacher chose NOT to replace.
    status: 'pending' | 'uploading' | 'uploaded' | 'error' | 'skipped-graded' | 'skipped-duplicate';
    uploadError?: string;
    skipReason?: string;
    result?: UploadResult;
}

// One entry per paperId that already has an UploadedPaper record, from
// POST /api/practice/upload-paper/check-duplicates.
interface DuplicateInfo {
    paperId: string;
    studentName: string;
    status: 'pending' | 'graded';
    uploadedPaperId: string;
}

interface DecodedPage {
    pageIndex: number;
    payload: DecodedPayload;
    imageDataUrl: string;
}

// One selected file's worth of state. Several of these accumulate as the
// teacher adds files, and everything is reviewed together before any
// upload actually happens.
interface FileBatch {
    id: string;
    fileName: string;
    status: 'decoding' | 'done' | 'error';
    candidates: PageCandidate[];
    skippedPages: number[];
    error?: string;
}

interface Props {
    token: string;
    onPaperIdentified: (results: UploadResult[]) => void;
    onCancel: () => void;
}

type Stage = 'idle' | 'reviewing' | 'uploading' | 'done';

function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function formatPageLabel(pageIndices: number[]): string {
    if (pageIndices.length === 1) return `Page ${pageIndices[0]}`;
    const sorted = [...pageIndices].sort((a, b) => a - b);
    const isContiguous = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
    return isContiguous ? `Pages ${sorted[0]}-${sorted[sorted.length - 1]}` : `Pages ${sorted.join(', ')}`;
}

// Returns null (instead of throwing) on a page with no readable/recognized
// QR code, so a multi-page scan can just skip that page rather than
// aborting the whole file.
async function decodeQrFromImageDataUrl(dataUrl: string): Promise<DecodedPayload | null> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Photo decoding is not supported in this browser.');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const result = jsQR(imageData.data, imageData.width, imageData.height);
    if (!result) return null;

    let payload: any;
    try {
        payload = JSON.parse(result.data);
    } catch {
        return null;
    }
    if (!payload || typeof payload !== 'object' || !payload.paperId || !payload.studentId) {
        return null;
    }
    return payload as DecodedPayload;
}

// Builds the candidate list for a selected file. PDFs are rasterized
// page-by-page and every page tried (a PDF can hold multiple students'
// papers); pages sharing the same paperId are merged into one candidate.
async function buildCandidatesFromFile(
    file: File,
    token: string
): Promise<{ candidates: PageCandidate[]; skippedPages: number[]; isPdf: boolean }> {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const decodedPages: DecodedPage[] = [];
    const skippedPages: number[] = [];

    if (!isPdf) {
        const dataUrl = await fileToDataUrl(file);
        const payload = await decodeQrFromImageDataUrl(dataUrl);
        if (payload) {
            decodedPages.push({ pageIndex: 1, payload, imageDataUrl: dataUrl });
        }
    } else {
        const dataUrl = await fileToDataUrl(file);
        const res = await apiFetch('/api/icr/rasterize-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ fileBase64: dataUrl, allPages: true })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to convert the PDF to images.');
        }

        const pageDataUrls: string[] = data.imageDataUrls || [];
        for (let i = 0; i < pageDataUrls.length; i++) {
            const pageNum = i + 1;
            const payload = await decodeQrFromImageDataUrl(pageDataUrls[i]);
            if (payload) {
                decodedPages.push({ pageIndex: pageNum, payload, imageDataUrl: pageDataUrls[i] });
            } else {
                skippedPages.push(pageNum);
            }
        }
    }

    const byPaperId = new Map<string, { pageIndices: number[]; payload: DecodedPayload; pageImageDataUrls: string[] }>();
    for (const page of decodedPages) {
        const existing = byPaperId.get(page.payload.paperId);
        if (existing) {
            existing.pageIndices.push(page.pageIndex);
            existing.pageImageDataUrls.push(page.imageDataUrl);
        } else {
            byPaperId.set(page.payload.paperId, {
                pageIndices: [page.pageIndex],
                payload: page.payload,
                pageImageDataUrls: [page.imageDataUrl]
            });
        }
    }

    const candidates: PageCandidate[] = Array.from(byPaperId.values()).map(group => ({
        pageIndices: group.pageIndices,
        payload: group.payload,
        pageImageDataUrls: group.pageImageDataUrls,
        filename: group.pageImageDataUrls.length > 1
            ? `paper_pages${group.pageIndices.join('-')}.pdf`
            : (isPdf ? `page${group.pageIndices[0]}.png` : file.name),
        status: 'pending'
    }));

    return { candidates, skippedPages, isPdf };
}

export const MicroPracticePaperUpload: React.FC<Props> = ({ token, onPaperIdentified, onCancel }) => {
    const [stage, setStage] = useState<Stage>('idle');
    const [fileBatches, setFileBatches] = useState<FileBatch[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Blocks handleConfirmUploadAll until the teacher answers the
    // replace-duplicates dialog, rendered as a full takeover (no portal needed).
    const [confirmReplace, setConfirmReplace] = useState<{ names: string[] } | null>(null);
    const confirmReplaceResolver = useRef<((accepted: boolean) => void) | null>(null);

    function askConfirmReplace(names: string[]): Promise<boolean> {
        return new Promise(resolve => {
            confirmReplaceResolver.current = resolve;
            setConfirmReplace({ names });
        });
    }

    function resolveConfirmReplace(accepted: boolean) {
        setConfirmReplace(null);
        confirmReplaceResolver.current?.(accepted);
        confirmReplaceResolver.current = null;
    }

    // Appends a new batch for the selected file rather than replacing
    // anything — repeated selections (via "Upload More Files") just keep
    // accumulating batches until the teacher confirms.
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        e.target.value = '';
        if (!selected) return;

        const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        setFileBatches(prev => [...prev, {
            id: batchId,
            fileName: selected.name,
            status: 'decoding',
            candidates: [],
            skippedPages: []
        }]);
        setStage('reviewing');

        try {
            const { candidates, skippedPages, isPdf } = await buildCandidatesFromFile(selected, token);
            if (candidates.length === 0) {
                const message = isPdf
                    ? `No readable QR code found on any of the ${skippedPages.length} page(s) in this file.`
                    : "Couldn't find a QR code in this photo. Retake it with better lighting, and make sure the QR code in the top-right corner of the paper is fully visible.";
                setFileBatches(prev => prev.map(b => b.id === batchId ? { ...b, status: 'error', error: message } : b));
                return;
            }
            setFileBatches(prev => prev.map(b => b.id === batchId ? { ...b, status: 'done', candidates, skippedPages } : b));
        } catch (err: any) {
            setFileBatches(prev => prev.map(b => b.id === batchId ? { ...b, status: 'error', error: err.message || 'Failed to read this file.' } : b));
        }
    };

    // If a batch is removed while its decode is still in flight, the late
    // update below just finds no matching id and no-ops — no separate
    // cancellation tracking needed.
    const removeBatch = (batchId: string) => {
        const next = fileBatches.filter(b => b.id !== batchId);
        setFileBatches(next);
        if (next.length === 0) setStage('idle');
    };

    // Uploads every candidate sequentially; checks paperIds against existing
    // UploadedPaper records first (graded duplicates skip, pending ones ask via askConfirmReplace).
    const handleConfirmUploadAll = async () => {
        const flatWork = fileBatches.flatMap(b =>
            b.candidates.map((c, candidateIndex) => ({ batchId: b.id, candidateIndex, candidate: c }))
        );

        let duplicates: DuplicateInfo[] = [];
        try {
            const paperIds = Array.from(new Set(flatWork.map(w => w.candidate.payload.paperId)));
            const res = await apiFetch('/api/practice/upload-paper/check-duplicates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ paperIds })
            });
            if (res.ok) {
                const data = await res.json();
                duplicates = data.duplicates || [];
            }
            // A non-ok response here just leaves `duplicates` empty — every
            // candidate proceeds as a fresh upload, same as before this
            // feature existed, rather than blocking on a check failure.
        } catch {
            // Network error checking duplicates — same fail-open reasoning.
        }
        const dupByPaperId = new Map(duplicates.map(d => [d.paperId, d]));

        const gradedDupKeys = new Set<string>();
        const pendingDupWork: typeof flatWork = [];
        let proceedWork: (typeof flatWork[number] & { replaceUploadedPaperId?: string })[] = [];

        for (const work of flatWork) {
            const dup = dupByPaperId.get(work.candidate.payload.paperId);
            if (!dup) {
                proceedWork.push(work);
            } else if (dup.status === 'graded') {
                gradedDupKeys.add(`${work.batchId}:${work.candidateIndex}`);
            } else {
                pendingDupWork.push(work);
            }
        }

        if (gradedDupKeys.size > 0) {
            setFileBatches(prev => prev.map(b => ({
                ...b,
                candidates: b.candidates.map((c, idx) => gradedDupKeys.has(`${b.id}:${idx}`)
                    ? { ...c, status: 'skipped-graded' as const, skipReason: 'This paper has already been graded.' }
                    : c)
            })));
        }

        if (pendingDupWork.length > 0) {
            const names = pendingDupWork.map(w => w.candidate.payload.studentName);
            const accepted = await askConfirmReplace(names);
            if (accepted) {
                for (const w of pendingDupWork) {
                    const dup = dupByPaperId.get(w.candidate.payload.paperId)!;
                    proceedWork.push({ ...w, replaceUploadedPaperId: dup.uploadedPaperId });
                }
            } else {
                const declinedKeys = new Set(pendingDupWork.map(w => `${w.batchId}:${w.candidateIndex}`));
                setFileBatches(prev => prev.map(b => ({
                    ...b,
                    candidates: b.candidates.map((c, idx) => declinedKeys.has(`${b.id}:${idx}`)
                        ? { ...c, status: 'skipped-duplicate' as const, skipReason: "Skipped — you chose not to replace the previous upload." }
                        : c)
                })));
            }
        }

        // Everything was skipped/declined — close the panel instead of
        // landing on a 'done' screen with nothing to review.
        if (proceedWork.length === 0) {
            onCancel();
            return;
        }

        setStage('uploading');

        // Shared by every candidate in this confirm action, so the
        // pending-grading list can group them by batch, not drifting timestamps.
        const uploadBatchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const finalResults: PageCandidate[] = [];

        for (const work of proceedWork) {
            const { batchId, candidateIndex, candidate: c, replaceUploadedPaperId } = work;
            setFileBatches(prev => prev.map(b => b.id !== batchId ? b : {
                ...b,
                candidates: b.candidates.map((x, idx) => idx === candidateIndex ? { ...x, status: 'uploading' } : x)
            }));

            let updated: PageCandidate;
            try {
                const res = await apiFetch('/api/practice/upload-paper', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        imageBase64s: c.pageImageDataUrls, filename: c.filename, uploadBatchId, ...c.payload,
                        ...(replaceUploadedPaperId ? { replaceUploadedPaperId } : {})
                    })
                });
                const data = await res.json();
                if (!res.ok) {
                    updated = { ...c, status: 'error', uploadError: data.error || 'Failed to upload the paper.' };
                } else {
                    updated = {
                        ...c,
                        status: 'uploaded',
                        result: { ...c.payload, imageUrl: data.imageUrl, competency: data.competency ?? null }
                    };
                }
            } catch {
                updated = { ...c, status: 'error', uploadError: 'Network error uploading the paper.' };
            }

            finalResults.push(updated);
            setFileBatches(prev => prev.map(b => b.id !== batchId ? b : {
                ...b,
                candidates: b.candidates.map((x, idx) => idx === candidateIndex ? updated : x)
            }));
        }

        const successResults = finalResults.filter(c => c.status === 'uploaded').map(c => c.result!);

        if (finalResults.length === 1 && successResults.length === 1) {
            onPaperIdentified(successResults);
            return;
        }

        setStage('done');
    };

    const allCandidates = fileBatches.flatMap(b => b.candidates);
    const successResults = allCandidates.filter(c => c.status === 'uploaded').map(c => c.result!);
    const anyDecoding = fileBatches.some(b => b.status === 'decoding');

    return (
        <div className="bg-white dark:bg-slate-900 p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm space-y-4">
            <div className="flex justify-between items-start">
                <h3 className="text-lg font-display font-medium text-zinc-900 dark:text-white">
                    Upload a Completed Micro-Practice Paper
                </h3>
                <button onClick={onCancel} className="text-sm font-bold text-zinc-500 hover:underline">Close</button>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileSelect}
                className="hidden"
            />

            {confirmReplace && (
                <div className="space-y-4 text-center">
                    <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-1">
                        <p>You've already uploaded papers for: <b>{confirmReplace.names.join(', ')}</b>.</p>
                        <p>Do you want to replace their previously uploaded papers with these new ones?</p>
                    </div>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => resolveConfirmReplace(false)}
                            className="px-5 py-2 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        >
                            No, Skip Them
                        </button>
                        <button
                            onClick={() => resolveConfirmReplace(true)}
                            className="px-5 py-2 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                        >
                            Yes, Replace
                        </button>
                    </div>
                </div>
            )}

            {stage === 'idle' && (
                <div className="space-y-3">
                    <label className="block text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                        📷 Upload Completed Paper Image or PDF (PNG, JPG, WEBP, PDF)
                    </label>
                    <p className="text-xs text-zinc-500">
                        Make sure the QR code in the top-right corner of the paper is fully visible. For a multi-page PDF, every page is scanned — great for uploading a whole class's papers in one file.
                    </p>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg py-2.5 px-4 cursor-pointer"
                    >
                        Choose File
                    </button>
                </div>
            )}

            {stage === 'reviewing' && !confirmReplace && (
                <div className="space-y-4">
                    <div className="space-y-3">
                        {fileBatches.map(batch => (
                            <div key={batch.id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                                <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">{batch.fileName}</span>
                                    <button
                                        onClick={() => removeBatch(batch.id)}
                                        className="text-zinc-400 hover:text-red-600 text-sm font-bold px-1.5"
                                        aria-label={`Remove ${batch.fileName}`}
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="p-3 space-y-1.5">
                                    {batch.status === 'decoding' && (
                                        <p className="text-sm text-zinc-400">Uploading and scanning...</p>
                                    )}
                                    {batch.status === 'error' && (
                                        <div className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">{batch.error}</div>
                                    )}
                                    {batch.status === 'done' && (
                                        <>
                                            <p className="text-xs text-zinc-500">
                                                Found <b>{batch.candidates.length}</b> paper{batch.candidates.length !== 1 ? 's' : ''}
                                            </p>
                                            {batch.candidates.map(c => {
                                                const isSkipped = c.status === 'skipped-graded' || c.status === 'skipped-duplicate';
                                                return (
                                                    <div
                                                        key={c.pageIndices.join('-')}
                                                        className={`flex items-center gap-2 text-sm p-2 border rounded-lg ${isSkipped ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40' : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40'}`}
                                                    >
                                                        <span className={isSkipped ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-400'}>{isSkipped ? '⏭' : '✓'}</span>
                                                        <span className="text-zinc-400 text-xs font-mono">{formatPageLabel(c.pageIndices)}</span>
                                                        <span className="font-medium text-zinc-800 dark:text-zinc-100">{c.payload.studentName}</span>
                                                        {isSkipped && <span className="text-xs text-amber-700 dark:text-amber-300">— {c.skipReason}</span>}
                                                    </div>
                                                );
                                            })}
                                            {batch.skippedPages.map(p => (
                                                <p key={`skip-${p}`} className="text-xs text-zinc-400 px-2">
                                                    Page {p}: no readable QR code — skipped
                                                </p>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-medium text-sm py-2.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        >
                            + Upload More Files
                        </button>
                        <button
                            onClick={handleConfirmUploadAll}
                            disabled={anyDecoding || allCandidates.length === 0}
                            className="flex-1 bg-emerald-600 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                            Confirm &amp; Upload{allCandidates.length > 1 ? ` All (${allCandidates.length})` : ''}
                        </button>
                    </div>
                </div>
            )}

            {stage === 'uploading' && (
                <div className="space-y-2">
                    <p className="text-sm text-zinc-400">
                        Uploading {allCandidates.length > 1 ? `${allCandidates.length} papers` : 'paper'}...
                    </p>
                    {allCandidates.length > 1 && (
                        <div className="space-y-1">
                            {allCandidates.map((c, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs p-2 border border-zinc-100 dark:border-zinc-700 rounded-lg">
                                    <span>{formatPageLabel(c.pageIndices)} — {c.payload.studentName}</span>
                                    <span className={
                                        c.status === 'uploaded' ? 'text-emerald-600 font-bold' :
                                        c.status === 'error' ? 'text-red-600 font-bold' :
                                        c.status === 'uploading' ? 'text-blue-600' :
                                        (c.status === 'skipped-graded' || c.status === 'skipped-duplicate') ? 'text-amber-600 font-bold' : 'text-zinc-400'
                                    }>
                                        {c.status === 'uploaded' ? '✓ Uploaded' :
                                         c.status === 'error' ? '✗ Failed' :
                                         c.status === 'uploading' ? 'Uploading…' :
                                         (c.status === 'skipped-graded' || c.status === 'skipped-duplicate') ? '⏭ Skipped' : 'Waiting…'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {stage === 'done' && (() => {
                const skippedCount = allCandidates.filter(c => c.status === 'skipped-graded' || c.status === 'skipped-duplicate').length;
                return (
                <div className="space-y-4">
                    <p className="text-sm text-zinc-700 dark:text-zinc-200">
                        {successResults.length} of {allCandidates.length} paper{allCandidates.length !== 1 ? 's' : ''} uploaded successfully.
                        {skippedCount > 0 && ` ${skippedCount} skipped.`}
                    </p>
                    <div className="space-y-1.5">
                        {allCandidates.map((c, idx) => {
                            const isSkipped = c.status === 'skipped-graded' || c.status === 'skipped-duplicate';
                            return (
                                <div
                                    key={idx}
                                    className={`flex items-center justify-between text-sm p-2.5 rounded-lg border ${
                                        c.status === 'uploaded' ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40' :
                                        isSkipped ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40'
                                    }`}
                                >
                                    <span className="font-medium text-zinc-800 dark:text-zinc-100">{formatPageLabel(c.pageIndices)} — {c.payload.studentName}</span>
                                    {c.status === 'uploaded' ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">✓ Uploaded</span>
                                    ) : isSkipped ? (
                                        <span className="text-amber-700 dark:text-amber-300 text-xs" title={c.skipReason}>⏭ Skipped — {c.skipReason}</span>
                                    ) : (
                                        <span className="text-red-600 dark:text-red-400 text-xs" title={c.uploadError}>✗ {c.uploadError || 'Failed'}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex gap-3">
                        {successResults.length > 0 && (
                            <button
                                onClick={() => onPaperIdentified(successResults)}
                                className="flex-1 bg-indigo-700 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-indigo-600"
                            >
                                Continue
                            </button>
                        )}
                        <button
                            onClick={onCancel}
                            className={successResults.length > 0
                                ? 'flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-medium text-sm py-2.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                : 'w-full bg-zinc-900 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-zinc-800'}
                        >
                            Close
                        </button>
                    </div>
                </div>
                );
            })()}
        </div>
    );
};
