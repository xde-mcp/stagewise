import { useState, useCallback, useRef, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';
import { PreviewCardContent } from '@stagewise/stage-ui/components/preview-card';
import type { BadgeProps } from '../types';
import { BadgeShell } from '../shared/badge-shell';

const MAX_RETRIES = 8;
const RETRY_DELAY_MS = 10;

function RetryingThumbnail({
  src,
  alt,
}: {
  src: string;
  alt: string | undefined;
}) {
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleError = useCallback(() => {
    if (retry >= MAX_RETRIES) return;
    timerRef.current = setTimeout(() => setRetry((r) => r + 1), RETRY_DELAY_MS);
  }, [retry]);

  const handleLoad = useCallback(() => setLoaded(true), []);

  const gaveUp = retry >= MAX_RETRIES && !loaded;
  const cacheBustedSrc = retry > 0 ? `${src}?r=${retry}` : src;

  return (
    <div className="relative size-3 shrink-0 overflow-hidden rounded">
      {!loaded && <ImageIcon className="size-3 shrink-0" />}
      {!gaveUp && (
        <img
          src={cacheBustedSrc}
          alt={alt}
          className={`absolute inset-0 size-full object-cover ${loaded ? '' : 'invisible'}`}
          onError={handleError}
          onLoad={handleLoad}
        />
      )}
    </div>
  );
}

export function ImageBadge(props: BadgeProps) {
  const { blobUrl, fileName } = props;

  const icon = blobUrl ? (
    <RetryingThumbnail src={blobUrl} alt={fileName} />
  ) : (
    <ImageIcon className="size-3 shrink-0" />
  );

  const previewContent = blobUrl ? (
    <PreviewCardContent className="flex max-w-64 flex-col items-stretch gap-2">
      <div className="flex min-h-24 w-full items-center justify-center overflow-hidden rounded-sm bg-background ring-1 ring-border-subtle">
        <img
          src={blobUrl}
          className="max-h-36 max-w-full object-contain"
          alt={fileName}
        />
      </div>
      <span className="font-medium text-foreground text-xs">{fileName}</span>
    </PreviewCardContent>
  ) : undefined;

  return <BadgeShell {...props} icon={icon} previewContent={previewContent} />;
}
