import qrcode from 'qrcode-generator';

/** The dark (true) and light (false) squares of a QR code for this text. Error correction M, size chosen to fit. */
export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** QR quiet zone, in squares, kept white on every side so a phone can find the code. The QR standard asks for 4. */
export const QR_QUIET_ZONE = 4;

/** One SVG path for every dark square, in a square of `size` units that includes the quiet zone. */
export function qrSvgPath(modules: boolean[][]): { size: number; d: string } {
  const parts: string[] = [];
  modules.forEach((row, r) => row.forEach((dark, c) => { if (dark) parts.push(`M${c + QR_QUIET_ZONE} ${r + QR_QUIET_ZONE}h1v1h-1z`); }));
  return { size: modules.length + 2 * QR_QUIET_ZONE, d: parts.join('') };
}
