import { useMessageEditState } from '@/hooks/use-message-edit-state';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ChatHistory } from './chat-history';
import { ChatPanelFooter } from './panel-footer';
import {
  useComparingSelector,
  useKartonConnected,
  useKartonState,
} from '@/hooks/use-karton';
import { cn } from '@/utils';
import { useOpenAgent } from '@/hooks/use-open-chat';

export function ChatPanel() {
  const { forwardDropEvent } = useMessageEditState();
  const [openAgent, setOpenAgent] = useOpenAgent();
  const agents = useKartonState((s) => s.agents.instances);

  useEffect(() => {
    if (openAgent === null && Object.keys(agents).length > 0) {
      const firstAgent = Object.keys(agents)[0];
      setOpenAgent(firstAgent);
    }
  }, [agents, openAgent]);

  const isWorking = useKartonState(
    useComparingSelector(
      (s) => s.agents.instances[openAgent]?.state.isWorking || false,
    ),
  );
  const isConnected = useKartonConnected();

  const enableInputField = useMemo(() => {
    // Disable input if agent is not connected
    if (!isConnected) return false;

    return !isWorking;
  }, [isWorking, isConnected]);

  /* If the user clicks on prompt creation mode, we force-focus the input field all the time. */
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Start prompt creation mode when chat panel opens
  useEffect(() => {
    if (enableInputField) {
      inputRef.current?.focus();
    }
  }, []);

  // Track drag-over state for visual feedback
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    // Accept Files (from file system) OR text/uri-list (from web pages - images/links)
    if (
      e.dataTransfer.types.includes('Files') ||
      e.dataTransfer.types.includes('text/uri-list')
    ) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Forward drop events to the active input handler (editing message or main chat)
  // The actual processing (URL→image conversion, etc.) is done by the receiving handler
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragOver(false);

      // Forward the raw event to the active handler
      forwardDropEvent(e);
    },
    [forwardDropEvent],
  );

  if (openAgent === null || !agents[openAgent])
    return (
      <div className="flex size-full items-center justify-center text-muted-foreground">
        No agent selected
      </div>
    );

  return (
    <div
      className={cn(
        'relative flex size-full flex-col items-stretch justify-center rounded-b-lg bg-transparent transition-colors',
        isDragOver && 'bg-hover-derived!',
      )}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      role="region"
      aria-label="Chat panel drop zone"
    >
      <ChatHistory />
      <ChatPanelFooter />
    </div>
  );
}
