import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { PDFPage, rgb } from 'pdf-lib';

let qrcodeFactory: any;

/** Create a portable PNG QR data URL using the worksheet project's local QR library. */
export function createQrDataUrl(payload: unknown): string {
  if (!qrcodeFactory) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const script = fs.readFileSync(
      path.resolve(here, '..', '..', 'frontend', 'public', 'worksheets', 'qrcode.min.js'),
      'utf8'
    );
    const sandbox: Record<string, any> = {};
    vm.runInNewContext(script, sandbox, { filename: 'qrcode.min.js' });
    qrcodeFactory = sandbox.qrcode;
  }
  const qr = qrcodeFactory(0, 'M');
  qr.addData(JSON.stringify(payload));
  qr.make();
  return qr.createDataURL(4, 2);
}

export function drawQrCode(page: PDFPage, payload: unknown, x: number, y: number, size: number): void {
  if (!qrcodeFactory) createQrDataUrl(payload);
  const qr = qrcodeFactory(0, 'M');
  qr.addData(JSON.stringify(payload));
  qr.make();
  const moduleCount = qr.getModuleCount();
  const moduleSize = size / moduleCount;
  page.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1) });
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (qr.isDark(row, column)) {
        page.drawRectangle({
          x: x + column * moduleSize,
          y: y + (moduleCount - row - 1) * moduleSize,
          width: moduleSize,
          height: moduleSize,
          color: rgb(0, 0, 0),
        });
      }
    }
  }
}
