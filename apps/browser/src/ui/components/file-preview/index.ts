import type { FilePreviewEntry, PreviewComponent } from './types';
import { buildMimeLookup } from './mime-lookup';
import { imagePreview } from './previews/image';
import { videoPreview } from './previews/video';
import { audioPreview } from './previews/audio';
import { pdfPreview } from './previews/pdf';
import { fallbackPreview } from './previews/fallback';

export type {
  FilePreviewProps,
  FilePreviewEntry,
  PreviewComponent,
} from './types';
export { buildMimeLookup } from './mime-lookup';

const entries: FilePreviewEntry[] = [
  pdfPreview,
  imagePreview,
  videoPreview,
  audioPreview,
  fallbackPreview,
];

export const getFilePreview = buildMimeLookup(entries, fallbackPreview);

/**
 * Resolve a variant component from an entry, falling back to `compact`
 * when the requested variant doesn't exist.
 */
export function getPreviewVariant(
  entry: FilePreviewEntry,
  variant: string,
): PreviewComponent {
  return entry.variants[variant] ?? entry.variants.compact;
}
