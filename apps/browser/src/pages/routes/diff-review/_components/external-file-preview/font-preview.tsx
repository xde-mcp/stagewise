import { useState, useEffect, memo, useRef, type FC } from 'react';
import { Loader2Icon } from 'lucide-react';
import type { FilePreviewProps } from './types';
import { inferFontMimeType } from './utils';

const FONT_SAMPLE_TEXT = 'The quick brown fox jumps over the lazy dog';
const FONT_SAMPLE_CHARS =
  'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz';
const FONT_SAMPLE_NUMBERS = '0123456789';

export const FontPreview: FC<FilePreviewProps> = memo(
  ({ oid, getContent, filePath }) => {
    const [fontFamily, setFontFamily] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fontFaceRef = useRef<FontFace | null>(null);

    useEffect(() => {
      if (!oid) return;

      let cancelled = false;
      setIsLoading(true);
      setError(null);

      // Generate unique font family name to avoid collisions
      const uniqueFontFamily = `preview-font-${oid.slice(0, 8)}`;

      getContent(oid)
        .then(async (result) => {
          if (cancelled) return;
          if (!result) {
            setError('Content not found');
            return;
          }

          try {
            const mimeType = result.mimeType ?? inferFontMimeType(filePath);
            const dataUrl = `url(data:${mimeType};base64,${result.content})`;

            // Create and load the font using FontFace API
            const fontFace = new FontFace(uniqueFontFamily, dataUrl);
            await fontFace.load();

            if (cancelled) return;

            // Add to document fonts
            // Note: TypeScript types for FontFaceSet are incomplete
            (document.fonts as FontFaceSet & { add(font: FontFace): void }).add(
              fontFace,
            );
            fontFaceRef.current = fontFace;
            setFontFamily(uniqueFontFamily);
          } catch (err) {
            if (cancelled) return;
            setError(
              err instanceof Error ? err.message : 'Failed to load font',
            );
          }
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
        // Cleanup: remove font from document.fonts
        if (fontFaceRef.current) {
          (
            document.fonts as FontFaceSet & { delete(font: FontFace): void }
          ).delete(fontFaceRef.current);
          fontFaceRef.current = null;
        }
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

    return (
      <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-1 p-4">
        <div
          className="text-center text-2xl text-foreground leading-relaxed"
          style={{ fontFamily: fontFamily ?? undefined }}
        >
          {FONT_SAMPLE_TEXT}
        </div>
        <div
          className="text-center text-lg text-muted-foreground"
          style={{ fontFamily: fontFamily ?? undefined }}
        >
          {FONT_SAMPLE_CHARS}
        </div>
        <div
          className="text-center text-lg text-muted-foreground"
          style={{ fontFamily: fontFamily ?? undefined }}
        >
          {FONT_SAMPLE_NUMBERS}
        </div>
      </div>
    );
  },
);
