import Tesseract from 'tesseract.js';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';

// Use local trained data if present (placed in project root)
const LOCAL_TRAINEDDATA = resolve(process.cwd(), 'eng.traineddata');
const WORKER_OPTS = existsSync(LOCAL_TRAINEDDATA) ? { langPath: process.cwd() } : {};

export async function pdfToImages(filePath: string): Promise<string[]> {
  const tempDir = mkdtempSync(join(tmpdir(), 'ws-ocr-'));
  // Ghostscript renders reliably at 300 DPI; ImageMagick convert is not always available
  execFileSync('gs', [
    '-dBATCH', '-dNOPAUSE', '-dQUIET',
    '-sDEVICE=png16m', '-r600',
    `-sOutputFile=${join(tempDir, 'page%d.png')}`,
    filePath,
  ]);
  return readdirSync(tempDir)
    .filter(f => f.endsWith('.png'))
    .sort()
    .map(f => join(tempDir, f));
}

export async function ocrImage(imagePath: string): Promise<string> {
  const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', WORKER_OPTS);
  return text;
}

export async function ocrPdf(filePath: string): Promise<string> {
  const imagePaths = await pdfToImages(filePath);
  if (imagePaths.length === 0) return '';

  const tempDir = dirname(imagePaths[0]);
  const worker = await Tesseract.createWorker('eng', undefined, WORKER_OPTS);

  try {
    const texts: string[] = [];
    for (const imgPath of imagePaths) {
      const { data: { text } } = await worker.recognize(imgPath);
      texts.push(text);
    }
    return texts.join('\n');
  } finally {
    await worker.terminate();
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
