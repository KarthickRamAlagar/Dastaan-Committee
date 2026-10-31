import { portalOrigin, type Bindings } from '../env.js';
import { hmacHex, safeEqual } from './crypto.js';

export async function signedFileUrl(env: Bindings, attachmentId: string, days: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + days * 86400;
  const sig = await hmacHex(env.SESSION_SECRET, `file:${attachmentId}:${exp}`);
  return `${portalOrigin(env, 'lead')}/api/files/${attachmentId}?exp=${exp}&sig=${sig}`;
}
export async function verifyFileSignature(env: Bindings, id: string, exp: string | undefined, sig: string | undefined) {
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmacHex(env.SESSION_SECRET, `file:${id}:${exp}`));
}

const BLOCKED_MAIL_EXT = new Set(['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'js', 'mjs', 'vbs', 'ps1', 'jar', 'html', 'htm', 'svg', 'dll', 'apk', 'sh']);
export const extOf = (name: string) => (name.split('.').pop() ?? '').toLowerCase();
export const isBlockedForMail = (name: string) => BLOCKED_MAIL_EXT.has(extOf(name));

/** Check the first bytes against the file's extension, so a renamed program cannot pass as a picture. */
export function magicMatches(ext: string, head: Uint8Array): boolean {
  const s = (i: number, n: number) => String.fromCharCode(...head.slice(i, i + n));
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return head[0] === 0xff && head[1] === 0xd8;
    case 'png':
      return head[0] === 0x89 && s(1, 3) === 'PNG';
    case 'gif':
      return s(0, 3) === 'GIF';
    case 'webp':
      return s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP';
    case 'heic':
      return s(4, 4) === 'ftyp';
    case 'pdf':
      return s(0, 5) === '%PDF-';
    case 'docx':
    case 'pptx':
    case 'xlsx':
    case 'zip':
      return head[0] === 0x50 && head[1] === 0x4b;
    case 'doc':
    case 'ppt':
    case 'xls':
      return head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
    default:
      return true; // other types are only offered for mail attachments, which are always downloaded, never displayed
  }
}
export const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
