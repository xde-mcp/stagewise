import type { AttachmentRendererEntry, ParamDescriptor } from './types';
import { buildMimeLookup } from '@ui/components/file-preview';
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

export const getRenderer = buildMimeLookup(renderers, fallbackRenderer);

export function getAllParamDescriptors(): Array<{
  rendererId: string;
  params: ParamDescriptor[];
}> {
  return renderers
    .filter((r) => r.params && r.params.length > 0)
    .map((r) => ({ rendererId: r.id, params: r.params! }));
}
