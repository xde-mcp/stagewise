import type { RendererProps } from '../types';
import { ExpandedShell } from '../shared/expanded-shell';

export default function PdfExpanded({ blobUrl, fileName }: RendererProps) {
  return (
    <ExpandedShell fileName={fileName} className="min-w-72">
      <embed
        src={blobUrl}
        type="application/pdf"
        className="h-80 w-full rounded"
      />
    </ExpandedShell>
  );
}
