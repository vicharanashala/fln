import { qrModules, qrSvgPath } from './qr';

/** A QR code as a printable picture: black squares on white, with its quiet zone, `mm` wide. */
export function QrCode({ text, mm = 24, label = 'Code for this paper' }: { text: string; mm?: number; label?: string }) {
  const { size, d } = qrSvgPath(qrModules(text));
  return (
    <svg className="qr" role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} width={`${mm}mm`} height={`${mm}mm`} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
