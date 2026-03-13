import {
  ChatSuggestion,
  type SuggestionItem,
  suggestions,
} from '@ui/components/suggestions';
import { useMemo, useRef, useState } from 'react';

const VISIBLE_COUNT = 3;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function StepSuggestions({
  onSuggestionClick,
}: {
  onSuggestionClick?: (suggestion: {
    id: string;
    url: string;
    prompt: string;
  }) => void;
}) {
  const shuffled = useMemo(() => shuffle(suggestions), []);
  const nextIndex = useRef(VISIBLE_COUNT);
  const [visible, setVisible] = useState<SuggestionItem[]>(
    shuffled.slice(0, VISIBLE_COUNT),
  );

  const handleRemove = (id: string) => {
    setVisible((prev) => {
      const without = prev.filter((item) => item.id !== id);
      if (nextIndex.current < shuffled.length) {
        without.push(shuffled[nextIndex.current]);
        nextIndex.current++;
      }
      return without;
    });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-2 pb-4">
        <h1 className="font-medium text-foreground text-xl">Get started</h1>
        <p className="text-muted-foreground text-sm">
          A few ideas to start with.
        </p>
      </div>
      <div className="app-no-drag flex w-full max-w-md flex-col items-center justify-center gap-2">
        {visible.map((item) => (
          <ChatSuggestion
            key={item.id}
            {...item}
            onClick={() =>
              onSuggestionClick?.({
                id: item.id,
                url: item.origin.url,
                prompt: item.prompt,
              })
            }
            onRemove={() => handleRemove(item.id)}
            className="h-8 w-max"
          />
        ))}
      </div>
    </div>
  );
}
