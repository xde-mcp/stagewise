import type { RendererProps } from '../types';
import { ExpandedShell } from '../shared/expanded-shell';

export default function ImageExpanded({ blobUrl, fileName }: RendererProps) {
  return (
    <ExpandedShell fileName={fileName}>
      <img
        src={blobUrl}
        alt={fileName}
        className="max-h-56 max-w-72 rounded object-contain"
      />
    </ExpandedShell>
  );
}
