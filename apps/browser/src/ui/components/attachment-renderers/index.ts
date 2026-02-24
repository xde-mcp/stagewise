import type { AttachmentRendererEntry, ParamDescriptor } from './types';
import { imageRenderer } from './image';
import { fallbackRenderer } from './fallback';
import { videoRenderer } from './video';
import { audioRenderer } from './audio';
import { pdfRenderer } from './pdf';

export type { RendererProps, BadgeProps, BadgeContext } from './types';
export type { AttachmentRendererEntry, ParamDescriptor } from './types';

const renderers: AttachmentRendererEntry[] = [
  pdfRenderer,
  imageRenderer,
  videoRenderer,
  audioRenderer,
  fallbackRenderer,
];

const exactMap = new Map<string, AttachmentRendererEntry>();
const prefixMap: Array<{ prefix: string; entry: AttachmentRendererEntry }> = [];
const wildcardMap = new Map<string, AttachmentRendererEntry>();
let fallback: AttachmentRendererEntry = fallbackRenderer;

for (const entry of renderers) {
  for (const pattern of entry.mimePatterns) {
    if (pattern === '*/*') {
      fallback = entry;
    } else if (pattern.endsWith('/*')) {
      const typePrefix = pattern.slice(0, -1);
      wildcardMap.set(typePrefix, entry);
    } else if (pattern.endsWith('*')) {
      prefixMap.push({ prefix: pattern.slice(0, -1), entry });
    } else {
      exactMap.set(pattern, entry);
    }
  }
}

prefixMap.sort((a, b) => b.prefix.length - a.prefix.length);

export function getRenderer(mediaType: string): AttachmentRendererEntry {
  const mime = mediaType.toLowerCase();

  const exact = exactMap.get(mime);
  if (exact) return exact;

  for (const { prefix, entry } of prefixMap) {
    if (mime.startsWith(prefix)) return entry;
  }

  const slashIdx = mime.indexOf('/');
  if (slashIdx > 0) {
    const typePrefix = `${mime.slice(0, slashIdx)}/`;
    const wc = wildcardMap.get(typePrefix);
    if (wc) return wc;
  }

  return fallback;
}

export function getAllParamDescriptors(): Array<{
  rendererId: string;
  params: ParamDescriptor[];
}> {
  return renderers
    .filter((r) => r.params && r.params.length > 0)
    .map((r) => ({ rendererId: r.id, params: r.params! }));
}
