import { COMPRESS_ABOVE_BYTES, MAX_PICK_BYTES, MAX_STORED_BYTES } from '@dastaan/shared';

/**
 * Files over 20 MB are made smaller in the browser before they are uploaded, so a slow network
 * and the server never carry the big original.
 *  - Pictures: scaled down and re-encoded as JPEG.
 *  - Word and PowerPoint (.docx/.pptx): the pictures inside are scaled down, the rest is untouched.
 *  - PDF: embedded JPEG pictures are scaled down and the file structure is repacked.
 *  - Old .doc/.ppt files cannot be repacked safely; they are sent as they are.
 */
export interface Prepared { blob: Blob; name: string; originalSize: number; compressed: boolean }

const TARGET = COMPRESS_ABOVE_BYTES - 1_000_000;
const ext = (n: string) => (n.split('.').pop() ?? '').toLowerCase();
const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;

export class CompressError extends Error {}

function canvasFor(w: number, h: number): { ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D; toBlob: (type: string, q: number) => Promise<Blob> } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext('2d')!;
    return { ctx, toBlob: (type, q) => c.convertToBlob({ type, quality: q }) };
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { ctx: c.getContext('2d')!, toBlob: (type, q) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), type, q)) };
}

async function decode(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob);
  } catch {
    throw new CompressError('This picture format cannot be read here. Please save it as JPG or PNG and try again.');
  }
}

/** Re-encode a picture so its longest side is at most `maxSide`. */
async function shrinkImage(blob: Blob, maxSide: number, quality: number, asPng = false): Promise<Blob> {
  const bmp = await decode(blob);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const { ctx, toBlob } = canvasFor(w, h);
  if (!asPng) {
    ctx.fillStyle = '#fff'; // JPEG has no transparency
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return toBlob(asPng ? 'image/png' : 'image/jpeg', quality);
}

async function compressPicture(file: File, step: (s: string) => void): Promise<Prepared> {
  let side = 3200;
  let q = 0.82;
  let out: Blob = file;
  for (let i = 0; i < 9; i++) {
    step(`Making the picture smaller (${i + 1}/9)`);
    out = await shrinkImage(file, side, q);
    if (out.size <= TARGET) break;
    side = Math.round(side * 0.8);
    q = Math.max(0.5, q - 0.05);
  }
  return { blob: out, name: file.name.replace(/\.[^.]+$/, '') + '.jpg', originalSize: file.size, compressed: true };
}

function unzipAsync(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return import('fflate').then(({ unzip }) => new Promise((res, rej) => unzip(data, (e, r) => (e ? rej(e) : res(r)))));
}
async function zipAsync(files: Record<string, Uint8Array | [Uint8Array, { level: 0 | 6 }]>): Promise<Uint8Array> {
  const { zip } = await import('fflate');
  return new Promise((res, rej) => zip(files as never, { level: 6 }, (e, r) => (e ? rej(e) : res(r))));
}

async function compressOffice(file: File, step: (s: string) => void): Promise<Prepared> {
  step('Opening the document');
  const entries = await unzipAsync(new Uint8Array(await file.arrayBuffer()));
  const out: Record<string, Uint8Array | [Uint8Array, { level: 0 | 6 }]> = {};
  const names = Object.keys(entries);
  const media = names.filter((n) => /^(word|ppt|xl)\/media\/.+\.(jpe?g|png)$/i.test(n) && entries[n]!.length > 150_000);
  let done = 0;
  for (const n of names) {
    const data = entries[n]!;
    const e = ext(n);
    if (media.includes(n)) {
      step(`Making pictures smaller (${++done}/${media.length})`);
      try {
        const png = e === 'png';
        const small = await shrinkImage(new Blob([data as BlobPart]), png ? 1800 : 1600, 0.72, png);
        out[n] = [new Uint8Array(await (small.size < data.length ? small : new Blob([data as BlobPart])).arrayBuffer()), { level: 0 }];
      } catch {
        out[n] = [data, { level: 0 }];
      }
    } else {
      out[n] = ['jpg', 'jpeg', 'png', 'mp4', 'mp3', 'zip'].includes(e) ? [data, { level: 0 }] : data;
    }
  }
  step('Packing the document');
  const zipped = await zipAsync(out);
  return { blob: new Blob([zipped as BlobPart], { type: file.type }), name: file.name, originalSize: file.size, compressed: true };
}

async function compressPdf(file: File, step: (s: string) => void): Promise<Prepared> {
  step('Opening the PDF');
  const { PDFDocument, PDFName, PDFNumber, PDFRawStream } = await import('pdf-lib');
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
  const targets: [import('pdf-lib').PDFRef, import('pdf-lib').PDFRawStream][] = [];
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const d = obj.dict;
    if (d.get(PDFName.of('Subtype')) !== PDFName.of('Image') || d.get(PDFName.of('Filter')) !== PDFName.of('DCTDecode')) continue;
    if (obj.contents.length > 150_000 && !d.get(PDFName.of('Decode'))) targets.push([ref, obj]);
  }
  let i = 0;
  for (const [ref, obj] of targets) {
    step(`Making pictures smaller (${++i}/${targets.length})`);
    try {
      const small = await shrinkImage(new Blob([obj.contents as BlobPart], { type: 'image/jpeg' }), 1700, 0.62);
      if (small.size > obj.contents.length * 0.9) continue;
      const bmp = await decode(small);
      const dict = obj.dict.clone(doc.context);
      dict.set(PDFName.of('Width'), PDFNumber.of(bmp.width));
      dict.set(PDFName.of('Height'), PDFNumber.of(bmp.height));
      dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
      dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
      dict.delete(PDFName.of('SMask'));
      dict.delete(PDFName.of('Mask'));
      bmp.close();
      doc.context.assign(ref, PDFRawStream.of(dict, new Uint8Array(await small.arrayBuffer())));
    } catch {
      /* keep the original picture */
    }
  }
  step('Packing the PDF');
  const bytes = await doc.save({ useObjectStreams: true });
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  // Never make a file bigger.
  return blob.size < file.size ? { blob, name: file.name, originalSize: file.size, compressed: true } : { blob: file, name: file.name, originalSize: file.size, compressed: false };
}

/** Decide what to do with a file before uploading. Small files go as they are. */
export async function prepareForUpload(file: File, step: (s: string) => void = () => {}): Promise<Prepared> {
  if (file.size > MAX_PICK_BYTES) throw new CompressError(`This file is ${mb(file.size)}. Please choose one under ${mb(MAX_PICK_BYTES)}.`);
  if (file.size <= COMPRESS_ABOVE_BYTES) return { blob: file, name: file.name, originalSize: file.size, compressed: false };
  const e = ext(file.name);
  let p: Prepared;
  if (['jpg', 'jpeg', 'png', 'webp'].includes(e)) p = await compressPicture(file, step);
  else if (e === 'docx' || e === 'pptx') p = await compressOffice(file, step);
  else if (e === 'pdf') p = await compressPdf(file, step);
  else p = { blob: file, name: file.name, originalSize: file.size, compressed: false };
  if (p.blob.size > MAX_STORED_BYTES) {
    throw new CompressError(`This file is still ${mb(p.blob.size)} after compression. The limit is ${mb(MAX_STORED_BYTES)}. Please remove large pictures or videos and try again.`);
  }
  return p;
}
