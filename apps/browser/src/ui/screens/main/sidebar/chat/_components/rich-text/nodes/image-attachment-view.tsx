import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';
import type { ImageAttachmentAttrs, AttachmentNodeViewProps } from '../types';
import {
  truncateLabel,
  AttachmentBadge,
  AttachmentBadgeWrapper,
} from '../view-utils';
import { PreviewCardContent } from '@stagewise/stage-ui/components/preview-card';
import { useMessageAttachments } from '@ui/hooks/use-message-elements';
import { useOpenAgent } from '@ui/hooks/use-open-chat';

const MAX_RETRIES = 8;
const RETRY_DELAY_MS = 10;

/**
 * Tiny image thumbnail that retries loading when the blob isn't on
 * disk yet (race between async store and first render).
 * Shows an ImageIcon placeholder until the image successfully loads
 * to avoid any broken-image flicker.
 */
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

/**
 * Custom NodeView for image attachments.
 * Displays a thumbnail icon and shows a larger preview on hover.
 * URL is derived from the sw-blob:// protocol using agentId + attachment ID.
 */
export function ImageAttachmentView(props: AttachmentNodeViewProps) {
  const attrs = props.node.attrs as ImageAttachmentAttrs;
  const isEditable = !('viewOnly' in props);
  const [openAgent] = useOpenAgent();

  const { fileAttachments } = useMessageAttachments();
  const attachment = useMemo(
    () => fileAttachments.find((f) => f.id === attrs.id),
    [fileAttachments, attrs.id],
  );

  const label = attachment?.fileName ?? attrs.label;

  const url = openAgent ? `sw-blob://${openAgent}/${attrs.id}` : '';

  const displayLabel = useMemo(
    () => truncateLabel(label, attrs.id),
    [label, attrs.id],
  );

  const icon = url ? (
    <RetryingThumbnail src={url} alt={label} />
  ) : (
    <ImageIcon className="size-3 shrink-0" />
  );

  const previewContent = url ? (
    <PreviewCardContent className="flex max-w-64 flex-col items-stretch gap-2">
      <div className="flex min-h-24 w-full items-center justify-center overflow-hidden rounded-sm bg-background ring-1 ring-border-subtle">
        <img
          src={url}
          className="max-h-36 max-w-full object-contain"
          alt={label}
        />
      </div>
      <span className="font-medium text-foreground text-xs">{label}</span>
    </PreviewCardContent>
  ) : undefined;

  return (
    <AttachmentBadgeWrapper
      viewOnly={!isEditable}
      previewContent={previewContent}
    >
      <AttachmentBadge
        icon={icon}
        label={displayLabel}
        selected={props.selected}
        isEditable={isEditable}
        onDelete={() =>
          'deleteNode' in props ? props.deleteNode() : undefined
        }
      />
    </AttachmentBadgeWrapper>
  );
}
