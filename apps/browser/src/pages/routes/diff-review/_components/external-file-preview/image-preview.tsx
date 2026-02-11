import { useState, useEffect, memo, type FC } from 'react';
import { Loader2Icon } from 'lucide-react';
import type { FilePreviewProps } from './types';
import { inferImageMimeType } from './utils';

export const ImagePreview: FC<FilePreviewProps> = memo(
  ({ oid, getContent, filePath }) => {
    const [imageData, setImageData] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      if (!oid) return;

      let cancelled = false;
      setIsLoading(true);
      setError(null);

      getContent(oid)
        .then((result) => {
          if (cancelled) return;
          if (result) {
            setImageData(result.content);
            // Use detected MIME type or infer from extension
            const detectedMime =
              result.mimeType ?? inferImageMimeType(filePath);
            setMimeType(detectedMime);
          } else setError('Content not found');
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Failed to load');
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [oid, getContent, filePath]);

    if (!oid) {
      return (
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-32 w-full items-center justify-center rounded-md border border-border border-dashed bg-surface-1 text-muted-foreground text-sm">
            No file
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-32 w-full items-center justify-center rounded-md border border-border bg-surface-1">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-32 w-full items-center justify-center rounded-md border border-error border-dashed bg-error/5 text-error-foreground text-sm">
            {error}
          </div>
        </div>
      );
    }

    const dataUrl = `data:${mimeType ?? 'image/png'};base64,${imageData}`;

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex max-h-64 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-1">
          <img
            src={dataUrl}
            className="max-h-64 max-w-full object-contain"
            alt="Preview"
          />
        </div>
      </div>
    );
  },
);
