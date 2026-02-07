import React, {
  useCallback,
  useMemo,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Button } from '@stagewise/stage-ui/components/button';
import { MessageUser } from './message-user';
import { MessageAssistant } from './message-assistant';
import { MessageLoading } from './message-loading';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import { cn } from '@ui/utils';
import type { History, ChatMessage } from '@shared/karton-contracts/ui';
import { IconXmark } from 'nucleo-micro-bold';
import { useAutoScroll } from '@/hooks/use-auto-scroll';
import { useMessageEditState } from '@/hooks/use-message-edit-state';
import { useScrollbarWidth } from '@/hooks/use-scrollbar-width';
import { AttachmentMetadataProvider } from '@/hooks/use-attachment-metadata';
import { isEmptyAssistantMessage } from './message-utils';
import { useOpenAgent } from '@/hooks/use-open-chat';

export const ChatHistory = () => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [spacerHeight, setSpacerHeight] = useState(0);
  const scrollbarWidth = useScrollbarWidth();

  // Ref to store latest containerHeight for use in callback ref (avoids stale closure)
  const containerHeightRef = useRef(0);

  const paddingRight = useMemo(() => {
    return scrollbarWidth === 0 ? 18 : 5;
  }, [scrollbarWidth]);

  // Element refs for direct measurement in useLayoutEffect
  const lastUserElementRef = useRef<HTMLDivElement | null>(null);
  const lastAssistantElementRef = useRef<HTMLDivElement | null>(null);

  // Extracted measurement function - called from both callback ref and useLayoutEffect
  const updateSpacerHeight = useCallback(() => {
    const userMessageHeight =
      lastUserElementRef.current?.getBoundingClientRect().height ?? 0;
    const currentContainerHeight = containerHeightRef.current;
    const minHeight = currentContainerHeight - (userMessageHeight + 10);
    setSpacerHeight(minHeight);
    if (lastAssistantElementRef.current)
      lastAssistantElementRef.current.style.minHeight = `${minHeight}px`;
  }, []);

  // Callback ref for last user message - stores element for measurement AND triggers height update
  const lastUserMessageRef = useCallback(
    (node: HTMLDivElement | null) => {
      lastUserElementRef.current = node;
      // Trigger height measurement when a new element is mounted
      if (node) updateSpacerHeight();
    },
    [updateSpacerHeight],
  );

  // Callback ref for last assistant message - stores element for measurement
  const lastAssistantMessageRef = useCallback((node: HTMLDivElement | null) => {
    lastAssistantElementRef.current = node;
  }, []);

  // Auto-scroll hook
  const {
    scrollerRef: autoScrollRef,
    isAutoScrollEnabled,
    scrollToBottom,
    forceEnableAutoScroll,
  } = useAutoScroll({
    scrollEndThreshold: 100,
  });

  // Track scroller element for spacerHeight calculation
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const scrollerRef = useCallback(
    (element: HTMLElement | Window | null) => {
      // Chain to auto-scroll hook
      autoScrollRef(element);
      // Store element for local use (spacerHeight, etc.)
      if (element instanceof HTMLElement) {
        setScroller(element);
      } else {
        setScroller(null);
      }
    },
    [autoScrollRef],
  );

  const { activeEditMessageId } = useMessageEditState();
  const createTab = useKartonProcedure((s) => s.browser.createTab);
  const sendUserMessage = useKartonProcedure((s) => s.agents.sendUserMessage);
  const [openAgent] = useOpenAgent();
  const isWorking = useKartonState(
    (s) => s.agents.instances[openAgent]?.state.isWorking,
  );
  const history = useKartonState(
    (s) => s.agents.instances[openAgent]?.state.history,
  );
  const [removedSuggestionUrls, setRemovedSuggestionUrls] = useState<
    Set<string>
  >(new Set());

  // Track container height to set the spacer
  useEffect(() => {
    let rafId: number;
    let resizeObserver: ResizeObserver | null = null;
    const checkViewport = () => {
      if (!scroller) {
        rafId = requestAnimationFrame(checkViewport);
        return;
      }
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newHeight = entry.contentRect.height;
          containerHeightRef.current = newHeight;
          setContainerHeight(newHeight);
          if (isAutoScrollEnabled()) updateSpacerHeight();
        }
      });
      resizeObserver.observe(scroller);
    };
    checkViewport();
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
    };
  }, [isAutoScrollEnabled, scrollToBottom, scroller]);

  // Enable auto-scroll when a new message is sent (scrolls to bottom as well)
  useEffect(() => {
    window.addEventListener('chat-message-sent', () => {
      forceEnableAutoScroll();
    });
    return () => {
      window.removeEventListener('chat-message-sent', () => {
        forceEnableAutoScroll();
      });
    };
  }, [forceEnableAutoScroll]);

  // Shuffle suggestions once on mount using Fisher-Yates algorithm
  const [shuffledSuggestions] = useState(() => {
    const shuffled = [...suggestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  const visibleSuggestions = useMemo(() => {
    return shuffledSuggestions
      .filter((s) => !removedSuggestionUrls.has(s.url))
      .slice(0, 3);
  }, [removedSuggestionUrls, shuffledSuggestions]);

  const handleRemoveSuggestion = (url: string) => {
    setRemovedSuggestionUrls((prev) => new Set([...Array.from(prev), url]));
  };

  // All messages after filtering and merging consecutive assistant messages
  const filteredMessages = useMemo(() => {
    if (!history) return [];

    return history
      .filter(
        (message) => message.role === 'user' || message.role === 'assistant',
      )
      .reduce<History>((curr, message) => {
        const lastMessage = curr[curr.length - 1];
        if (!lastMessage) {
          curr.push({ ...message, parts: [...message.parts] });
          return curr;
        }

        if (lastMessage.role === message.role && message.role === 'assistant') {
          lastMessage.parts = [...lastMessage.parts, ...message.parts];
          if (
            message.metadata?.thinkingDurations &&
            message.metadata.thinkingDurations.length >
              (lastMessage.metadata?.thinkingDurations?.length ?? 0)
          ) {
            lastMessage.metadata = {
              ...lastMessage.metadata,
              thinkingDurations: message.metadata.thinkingDurations,
            };
          }
        } else {
          curr.push({ ...message, parts: [...message.parts] });
        }
        return curr;
      }, []);
  }, [history]);

  // Determine if we should show the "Working..." indicator
  const showWorkingIndicator = useMemo(() => {
    if (!isWorking) return false;
    const lastMessage = filteredMessages[filteredMessages.length - 1];
    if (!lastMessage) return false;
    if (lastMessage.role === 'user') return true;
    if (
      lastMessage.role === 'assistant' &&
      isEmptyAssistantMessage(lastMessage)
    )
      return true;
    return false;
  }, [isWorking, filteredMessages]);

  // Find the index of the last user message (for attaching measurement ref)
  const lastUserMsgIndex = useMemo(() => {
    for (let i = filteredMessages.length - 1; i >= 0; i--)
      if (filteredMessages[i].role === 'user') return i;

    return -1;
  }, [filteredMessages]);

  // Set spacer height synchronously before paint
  useLayoutEffect(() => {
    // Update ref so callback ref can access latest value
    containerHeightRef.current = containerHeight;
    updateSpacerHeight();
  }, [
    activeEditMessageId,
    containerHeight,
    filteredMessages.length,
    updateSpacerHeight,
  ]);

  // Render individual message item
  const itemContent = useCallback(
    (index: number, message: ChatMessage) => {
      const isLastMessage = index === filteredMessages.length - 1;
      const isLastUserMessage = index === lastUserMsgIndex;
      const isLastAssistantMessage =
        isLastMessage && message.role === 'assistant';

      const messageComponent =
        message.role === 'user' ? (
          <MessageUser
            message={message as ChatMessage & { role: 'user' }}
            isLastMessage={isLastMessage}
          />
        ) : (
          <MessageAssistant
            message={message as ChatMessage & { role: 'assistant' }}
            isLastMessage={isLastMessage}
          />
        );

      // Attach ref to last assistant message wrapper for height measurement
      if (isLastAssistantMessage)
        return (
          <div
            ref={lastAssistantMessageRef}
            className="flex flex-col pb-[calc(64px+var(--status-card-height,0px))] pl-4"
            style={{ minHeight: spacerHeight, paddingRight }}
          >
            {messageComponent}
            {/* history?.error && <MessageError error={history.error} /> */}
            {showWorkingIndicator && <MessageLoading />}
          </div>
        );

      // Attach ref to last user message wrapper for height measurement
      if (isLastUserMessage) {
        return (
          <div
            className={cn('flex flex-col pl-4', index === 0 && 'pt-2.5')}
            style={{ paddingRight }}
          >
            <div ref={lastUserMessageRef}>{messageComponent}</div>
            {showWorkingIndicator &&
              (filteredMessages.length === 0 ||
                filteredMessages[filteredMessages.length - 1]?.role ===
                  'user') && <MessageLoading />}
          </div>
        );
      }

      return (
        <div
          className={cn('pl-4', index === 0 && 'pt-2.5')}
          style={{ paddingRight }}
        >
          {messageComponent}
        </div>
      );
    },
    [
      filteredMessages.length,
      lastUserMsgIndex,
      history,
      showWorkingIndicator,
      paddingRight,
    ],
  );

  // Empty state component for suggestions
  const EmptyPlaceholder = useCallback(() => {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-1 px-4 pb-2 text-sm">
        {visibleSuggestions.map((suggestion) => (
          <ChatSuggestion
            key={suggestion.url}
            {...suggestion}
            onClick={async () => {
              await createTab(suggestion.url);
              await sendUserMessage(openAgent, {
                id: crypto.randomUUID(),
                role: 'user',
                parts: [
                  {
                    type: 'text',
                    text: suggestion.prompt,
                  },
                ],
              });
            }}
            onRemove={() => handleRemoveSuggestion(suggestion.url)}
          />
        ))}
      </div>
    );
  }, [visibleSuggestions, createTab, sendUserMessage, paddingRight]);

  // If no messages, show empty state directly
  if (filteredMessages.length === 0) {
    return (
      <AttachmentMetadataProvider messages={filteredMessages}>
        <section
          aria-label="Agent message display"
          className={cn(
            'pointer-events-auto mb-1 block h-max min-h-[inherit] text-foreground text-sm focus-within:outline-none focus:outline-none',
          )}
        >
          {EmptyPlaceholder()}
        </section>
      </AttachmentMetadataProvider>
    );
  }

  return (
    <AttachmentMetadataProvider messages={filteredMessages}>
      <Virtuoso
        style={{ scrollbarGutter: 'stable' }}
        key={openAgent ?? 'no-chat'}
        data={filteredMessages}
        ref={virtuosoRef}
        className="scrollbar-hover-only -mr-[2px]"
        scrollerRef={scrollerRef}
        increaseViewportBy={{ top: 3000, bottom: 3000 }} // Render items above and below viewport
        itemContent={itemContent}
        followOutput={false} // We use our own auto-scroll logic
        computeItemKey={(_, message) => message.id}
        totalCount={filteredMessages.length}
      />
    </AttachmentMetadataProvider>
  );
};

type ChatSuggestionProps = {
  prompt: string;
  suggestion: string | React.ReactNode;
  faviconUrl: string;
  url: string;
};

const ChatSuggestion: React.FC<
  ChatSuggestionProps & { onClick?: () => void; onRemove?: () => void }
> = ({ suggestion, faviconUrl, url: _url, onClick, onRemove }) => {
  return (
    <div
      onClick={onClick}
      className="group/suggestion relative flex w-full cursor-pointer flex-row items-center justify-start gap-3 rounded-lg px-2.5 py-2 text-muted-foreground hover:bg-hover-derived hover:text-foreground"
    >
      <span className="flex shrink-0 items-center">
        <img src={faviconUrl} className="size-3 rounded-sm" alt="Favicon" />
      </span>
      <span className="group-hover/suggestion:mask-[linear-gradient(to_left,transparent_0px,transparent_24px,black_48px)] w-full overflow-hidden text-sm leading-tight transition-[mask-image] duration-200">
        {suggestion}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="-translate-y-1/2 absolute top-1/2 right-1 ml-auto hidden text-muted-foreground group-hover/suggestion:flex"
        onClick={(e) => {
          e.stopPropagation();
          onRemove?.();
        }}
      >
        <IconXmark className="size-3" />
      </Button>
    </div>
  );
};

const suggestions: ChatSuggestionProps[] = [
  {
    prompt:
      'You are looking at airbnb.com. Please inspect the page to find out how their icons work, and provide a simple explanation. If possible, find and focus on a specific, interesting icon that you could clone and use in my own application.',
    suggestion: (
      <span className="font-normal">
        How do{' '}
        <span className="font-medium text-primary-foreground group-hover/suggestion:text-hover-derived">
          airbnb.com
        </span>{' '}
        icons work?
      </span>
    ),
    faviconUrl: 'https://airbnb.com/favicon.ico',
    url: 'https://airbnb.com',
  },
  {
    prompt:
      'You are looking at reflect.app. Please inspect the page to find out how their glow effect works, and extract all the necessary styles you need to replicate it 1:1 in my own application.',
    suggestion: (
      <span className="font-normal">
        Take the glow effect from{' '}
        <span className="font-medium text-primary-foreground group-hover/suggestion:text-hover-derived">
          reflect.app
        </span>
      </span>
    ),
    faviconUrl: 'https://reflect.app/favicon.ico',
    url: 'https://reflect.app',
  },
  {
    prompt:
      'You are looking at react.email. Please inspect the page to find out how their frosted glass effect works, and extract all the necessary styles you need to replicate it 1:1 in my own application.',
    suggestion: (
      <span className="font-normal">
        Copy the glass effect from{' '}
        <span className="font-medium text-primary-foreground group-hover/suggestion:text-hover-derived">
          react.email
        </span>{' '}
      </span>
    ),
    faviconUrl: 'https://react.email/meta/favicon.ico',
    url: 'https://react.email',
  },
  {
    prompt:
      'You are looking at posthog.com. Please inspect the page to find out exactly what their button looks like, and extract all the necessary styles and animations you need to make the button in our application look and behave exactly like it.',
    suggestion: (
      <span className="font-normal">
        Make our button look like{' '}
        <span className="font-medium text-primary-foreground group-hover/suggestion:text-hover-derived">
          posthog.com
        </span>
      </span>
    ),
    faviconUrl: 'https://posthog.com/favicon-32x32.png',
    url: 'https://posthog.com',
  },
  {
    prompt:
      'You are looking at cursor.com. Please inspect the page to find out what their color theme is, and provide a concise summary of the colors and their usage, so I can learn something from it for my own application.',
    suggestion: (
      <span className="font-normal">
        What's the theme of{' '}
        <span className="font-medium text-primary-foreground group-hover/suggestion:text-hover-derived">
          cursor.com
        </span>
        ?
      </span>
    ),
    faviconUrl: 'https://cursor.com/favicon.ico',
    url: 'https://cursor.com',
  },
];
