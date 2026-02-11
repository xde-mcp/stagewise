import { useState } from 'react';
import { cn } from '@/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@stagewise/stage-ui/components/collapsible';

/** Extract text content from a AgentMessage's parts */
export function getMessageText(message: {
  parts: { type: string; text?: string }[];
}): string {
  const textPart = message.parts.find((p) => p.type === 'text');
  return textPart && 'text' in textPart ? (textPart.text ?? '') : '';
}

export type FormattedFileDiff = {
  fileId: string;
  path: string;
  fileName: string;
  linesAdded: number;
  linesRemoved: number;
  hunkIds: string[];
};

export interface StatusCardSection {
  trigger: (isOpen: boolean) => React.ReactNode;
  contentClassName?: string;
  content: React.ReactNode;
  key: string;
  defaultOpen?: boolean;
}

export function StatusCardSectionComponent({
  item,
  showDivider,
}: {
  item: StatusCardSection;
  showDivider: boolean;
}) {
  const [isOpen, setIsOpen] = useState(item.defaultOpen ?? true);

  return (
    <div className="w-full">
      <Collapsible className="w-full" open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger
          size="condensed"
          className="w-full cursor-pointer p-0 hover:bg-transparent active:bg-transparent"
        >
          {item.trigger(isOpen)}
        </CollapsibleTrigger>
        {item.content && (
          <CollapsibleContent
            className={cn('w-full overflow-hidden', item.contentClassName)}
          >
            {item.content}
          </CollapsibleContent>
        )}
      </Collapsible>
      {showDivider && (
        <hr className="my-1 h-px w-[calc(100%+6px)] border-derived-subtle bg-background" />
      )}
    </div>
  );
}

export function StatusCardComponent({
  items,
  ref,
}: {
  items: StatusCardSection[];
  ref?: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      className="-z-10 absolute right-2 bottom-[calc(100%+1px)] left-2 flex flex-col items-center justify-between rounded-t-lg border-derived border-t border-r border-l bg-background p-1 backdrop-blur-lg"
    >
      {items.map((item, index) => (
        <StatusCardSectionComponent
          key={item.key}
          item={item}
          showDivider={index < items.length - 1}
        />
      ))}
    </div>
  );
}
