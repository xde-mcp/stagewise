import type { RendererProps } from '../types';
import { ExpandedShell } from '../shared/expanded-shell';

export default function AudioExpanded({ blobUrl, fileName }: RendererProps) {
  return (
    <ExpandedShell fileName={fileName}>
      <audio src={blobUrl} controls className="w-64" />
    </ExpandedShell>
  );
}
