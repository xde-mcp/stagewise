import { useRef, useEffect } from 'react';
import type { RendererProps } from '../types';
import { ExpandedShell } from '../shared/expanded-shell';

export default function VideoExpanded({
  blobUrl,
  fileName,
  params,
}: RendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const t = params.t ? Number.parseFloat(params.t) : undefined;
    if (t && Number.isFinite(t) && videoRef.current) {
      videoRef.current.currentTime = t;
    }
  }, [params.t]);

  return (
    <ExpandedShell fileName={fileName}>
      <video
        ref={videoRef}
        src={blobUrl}
        controls
        className="max-h-56 max-w-72 rounded"
      />
    </ExpandedShell>
  );
}
