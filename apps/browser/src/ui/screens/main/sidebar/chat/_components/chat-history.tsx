import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from 'react';
import { useMessageEditState } from '@/hooks/use-message-edit-state';
import { useEventListener } from '@/hooks/use-event-listener';
import { useAutoScroll } from '@/hooks/use-auto-scroll';
import { useScrollFadeMask } from '@/hooks/use-scroll-fade-mask';
import { Button } from '@stagewise/stage-ui/components/button';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import { MessageUser } from './message-user';
import { MessageAssistant } from './message-assistant';
import { MessageLoading } from './message-loading';
import {
  useComparingSelector,
  useKartonState,
  useKartonProcedure,
} from '@/hooks/use-karton';
import { cn } from '@/utils';
import { MessageError } from './message-error';
import type { History, ChatMessage } from '@shared/karton-contracts/ui';
import { IconXmark } from 'nucleo-micro-bold';
import { isEmptyAssistantMessage } from './message-utils';

export const ChatHistory = () => {
  const {
    scrollbarRef,
    scrollToBottom,
    forceEnableAutoScroll,
    isAutoScrollEnabled,
  } = useAutoScroll();

  // Viewport ref for scroll fade mask
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const viewportRef = useMemo(
    () => ({ current: viewport }),
    [viewport],
  ) as React.RefObject<HTMLElement>;
  const { maskStyle } = useScrollFadeMask(viewportRef, {
    axis: 'vertical',
    fadeDistances: { top: 4, bottom: 0 },
  });
  const [containerHeight, setContainerHeight] = useState(0);
  const lastUserMessageRef = useRef<HTMLDivElement | null>(null);
  const workingIndicatorRef = useRef<HTMLDivElement | null>(null);
  const lastAssistantMessageWrapperRef = useRef<HTMLDivElement | null>(null);
  const [spacerMinHeight, setSpacerMinHeight] = useState(0);
  const { activeEditMessageId } = useMessageEditState();
  const createTab = useKartonProcedure((s) => s.browser.createTab);
  const sendUserMessage = useKartonProcedure(
    (s) => s.agentChat.sendUserMessage,
  );
  const { activeChatId, chats, isWorking } = useKartonState(
    useComparingSelector((s) => ({
      activeChatId: s.agentChat?.activeChatId,
      isWorking: s.agentChat?.isWorking ?? false,
      chats: s.agentChat?.chats,
      workspaceStatus: s.workspaceStatus,
    })),
  );
  const [removedSuggestionUrls, setRemovedSuggestionUrls] = useState<
    Set<string>
  >(new Set());
  // Callback ref for the last user message -> Called when a new user message is sent or one is removed!
  const lastUserMessageMeasureRef = useCallback((el: HTMLDivElement | null) => {
    lastUserMessageRef.current = el;
  }, []);

  const activeChat = useMemo(() => {
    return activeChatId ? chats?.[activeChatId] : null;
  }, [activeChatId, chats]);

  // Setting the spacer min-height synchronously in the DOM
  useLayoutEffect(() => {
    const userMessageHeight =
      lastUserMessageRef.current?.getBoundingClientRect().height ?? 0;
    const lastAssistantMessageWrapper = lastAssistantMessageWrapperRef.current;
    const workingIndicator = workingIndicatorRef.current;
    const minHeight = containerHeight - userMessageHeight;
    setSpacerMinHeight(minHeight);
    if (lastAssistantMessageWrapper)
      lastAssistantMessageWrapper.style.minHeight = `${minHeight}px`;
    if (workingIndicator) workingIndicator.style.minHeight = `${minHeight}px`;
  }, [
    activeEditMessageId,
    containerHeight,
    lastUserMessageRef,
    activeChat?.messages.length,
  ]);

  // Track container height to set the spacer
  useEffect(() => {
    let rafId: number;
    let resizeObserver: ResizeObserver | null = null;
    const checkViewport = () => {
      const viewport = scrollbarRef.current?.getViewport();
      if (!viewport) {
        rafId = requestAnimationFrame(checkViewport);
        return;
      }
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (
            entry.contentRect.height !== containerHeight &&
            isAutoScrollEnabled()
          )
            scrollToBottom();
          setContainerHeight(entry.contentRect.height);
        }
      });
      resizeObserver.observe(viewport);
    };
    checkViewport();
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
    };
  }, [isAutoScrollEnabled, scrollToBottom]);

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

  // Force scroll to bottom when user sends a message
  useEventListener('chat-message-sent', forceEnableAutoScroll);

  // Adjust scroll position when FileDiffCard height changes
  // This makes it look like the container grew/shrank at the bottom
  const handleFileDiffCardHeightChanged = useCallback(
    (e: CustomEvent<{ delta: number; height: number }>) => {
      const viewport = scrollbarRef.current?.getViewport();
      if (!viewport) return;

      const { delta } = e.detail;
      if (delta !== 0) viewport.scrollTop += delta;
    },
    [],
  );

  useEventListener(
    'file-diff-card-height-changed',
    handleFileDiffCardHeightChanged as EventListener,
  );

  const renderedMessages = useMemo(() => {
    if (!activeChat?.messages) return [];

    return activeChat?.messages
      .filter(
        (message) => message.role === 'user' || message.role === 'assistant',
      )
      .reduce<History>((curr, message) => {
        // If the last message is the same role as the current message and the role is 'assistant, we append the parts to the previous message instead of pushing the new message to the array.
        const lastMessage = curr[curr.length - 1];
        if (!lastMessage) {
          // Shallow copy to avoid mutating original, but preserve part references
          curr.push({ ...message, parts: [...message.parts] });
          return curr;
        }

        if (lastMessage.role === message.role && message.role === 'assistant') {
          lastMessage.parts = [...lastMessage.parts, ...message.parts];
          // Use the longer thinkingDurations array (each message has cumulative durations)
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
          // Shallow copy to avoid mutating original, but preserve part references
          curr.push({ ...message, parts: [...message.parts] });
        }
        return curr;
      }, []);
  }, [activeChat]);

  // Find the index of the last user message
  const lastUserMessageIndex = useMemo(() => {
    for (let i = renderedMessages.length - 1; i >= 0; i--) {
      if (renderedMessages[i].role === 'user') {
        return i;
      }
    }
    return -1;
  }, [renderedMessages]);

  // Determine if we should show the "Working..." indicator
  const showWorkingIndicator = useMemo(() => {
    if (!isWorking) return false;

    const lastMessage = renderedMessages[renderedMessages.length - 1];
    if (!lastMessage) return false;

    // Show if last message is from user (agent hasn't responded yet)
    if (lastMessage.role === 'user') return true;

    // Show if last message is an empty assistant message (agent just started)
    if (
      lastMessage.role === 'assistant' &&
      isEmptyAssistantMessage(lastMessage)
    )
      return true;

    return false;
  }, [isWorking, renderedMessages]);

  return (
    <OverlayScrollbar
      ref={scrollbarRef}
      onViewportRef={setViewport}
      element="section"
      aria-label="Agent message display"
      className={cn(
        'mask-alpha pointer-events-auto block h-full text-foreground text-sm focus-within:outline-none focus:outline-none',
        renderedMessages.length > 0 && 'flex-1',
        renderedMessages.length === 0 && 'mb-1 h-max min-h-[inherit]',
        'pb-[calc(1rem+var(--file-diff-card-height,0px))]',
      )}
      style={maskStyle}
      contentClassName="px-4"
      options={
        renderedMessages.length === 0
          ? { overflow: { x: 'hidden', y: 'hidden' } }
          : undefined
      }
    >
      {renderedMessages.map((message, index) => {
        const isLastMessage = index === renderedMessages.length - 1;
        const isLastAssistantMessage =
          isLastMessage && message.role === 'assistant';

        const messageComponent =
          message.role === 'user' ? (
            <MessageUser
              key={message.id ?? `user-${index}`}
              message={message as ChatMessage & { role: 'user' }}
              isLastMessage={isLastMessage}
              measureRef={
                index === lastUserMessageIndex
                  ? lastUserMessageMeasureRef
                  : undefined
              }
            />
          ) : (
            <MessageAssistant
              key={message.id ?? `assistant-${index}`}
              message={message as ChatMessage & { role: 'assistant' }}
              isLastMessage={isLastMessage}
            />
          );

        // Wrap last assistant message + error + loading in a flex container with minHeight
        if (isLastAssistantMessage)
          return (
            <div
              ref={lastAssistantMessageWrapperRef}
              style={{ minHeight: spacerMinHeight }}
              key={`wrapper-${message.id ?? index}`}
              className="flex flex-col"
            >
              {messageComponent}
              {activeChat?.error && <MessageError error={activeChat.error} />}
              {/* Working indicator inside wrapper when last message is assistant */}
              {showWorkingIndicator && <MessageLoading />}
            </div>
          );

        return messageComponent;
      }) ?? []}

      {/* Render error after messages only if last message is user (or no messages) */}
      {(renderedMessages.length === 0 ||
        renderedMessages[renderedMessages.length - 1]?.role === 'user') &&
        activeChat?.error && <MessageError error={activeChat.error} />}

      {/* Working indicator outside wrapper when last message is user (or no messages) */}
      {showWorkingIndicator &&
        (renderedMessages.length === 0 ||
          renderedMessages[renderedMessages.length - 1]?.role === 'user') && (
          <div
            ref={workingIndicatorRef}
            style={{ minHeight: spacerMinHeight }}
            className="flex flex-col"
          >
            <MessageLoading />
          </div>
        )}

      {renderedMessages.length === 0 && (
        <div className="flex w-full flex-col items-center justify-center gap-1 text-sm">
          {visibleSuggestions.map((suggestion) => (
            <ChatSuggestion
              key={suggestion.url}
              {...suggestion}
              onClick={async () => {
                await createTab(suggestion.url);
                await sendUserMessage({
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
      )}
    </OverlayScrollbar>
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
      className="group/suggestion relative flex w-full cursor-pointer flex-row items-center justify-start gap-3 rounded-lg p-2 text-muted-foreground hover:bg-hover-derived hover:text-foreground"
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
        className="-translate-y-1/2 absolute top-1/2 right-2 ml-auto hidden text-muted-foreground group-hover/suggestion:flex"
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
