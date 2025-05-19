// SPDX-License-Identifier: AGPL-3.0-only
// Draggable box component for the toolbar
// Copyright (C) 2025 Goetze, Scharpff & Toews GbR

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.

// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

// This component represents the box in which the toolbar is placed.
// It is only used in desktop cases, since the mobile toolbar is placed inside a modal card.

import { Button } from '@headlessui/react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GripVertical,
  MessageCircleIcon,
} from 'lucide-react';
import { ToolbarChatArea } from '../chat-box';
import { useDraggable } from '@/hooks/use-draggable';
import { useContext } from 'preact/hooks';
import { DraggableContext } from '@/hooks/use-draggable';
import type { DraggableContextType } from '@/hooks/use-draggable';
import { usePlugins } from '@/hooks/use-plugins';
import { ToolbarSection } from '../section';
import { ToolbarButton } from '../button';
import { useChatState } from '@/hooks/use-chat-state';
import { cn } from '@/utils';

export function ToolbarDraggableBox() {
  const provider = useContext(DraggableContext) as DraggableContextType | null;
  const borderLocation = provider?.borderLocation;
  const isReady =
    !!borderLocation &&
    borderLocation.right - borderLocation.left > 0 &&
    borderLocation.bottom - borderLocation.top > 0;

  const draggable = useDraggable({
    startThreshold: 10,
    initialSnapArea: 'bottomRight',
  });
  if (!isReady) return null; // Wait until borderLocation is valid

  const plugins = usePlugins();

  const pluginsWithActions = plugins.plugins.filter(
    (plugin) => plugin.onActionClick,
  );
  const chatState = useChatState();

  return (
    <div
      ref={draggable.draggableRef}
      className="pointer-events-auto absolute p-0.5"
    >
      {/* This is the complete toolbar area where we can stack different stuff. The main toolbar content stands out. */}
      <div className="flex flex-row items-end justify-end">
        <div
          className={cn(
            'flex flex-col items-stretch justify-end gap-0',
            draggable.position.isTopHalf && 'flex-col-reverse',
          )}
        >
          {chatState.isPromptCreationActive && (
            <div className="p-2">
              <ToolbarChatArea />
            </div>
          )}
        </div>
        <div
          ref={draggable.handleRef}
          className={cn(
            'flex items-center justify-center divide-y divide-border/30 rounded-full border border-border/30 bg-white/80 px-1 shadow-md backdrop-blur',
            draggable.position.isTopHalf
              ? 'flex-col-reverse divide-y-reverse'
              : 'flex-col',
          )}
        >
          {pluginsWithActions.length > 0 && (
            <ToolbarSection>
              {pluginsWithActions.map((plugin) => (
                <ToolbarButton
                  key={plugin.pluginName}
                  onClick={plugin.onActionClick}
                >
                  {plugin.iconSvg ? (
                    <img src={plugin.iconSvg} alt={plugin.displayName} />
                  ) : (
                    <PuzzleIcon className="size-4" />
                  )}
                </ToolbarButton>
              ))}
            </ToolbarSection>
          )}
          <ToolbarSection>
            <ToolbarButton
              onClick={() => chatState.startPromptCreation()}
              className={cn(
                'rounded-full transition-all duration-150',
                chatState.isPromptCreationActive &&
                  'border border-border/30 bg-white shadow-md',
              )}
              badgeContent={<>2</>}
            >
              <MessageCircleIcon className="size-4 stroke-zinc-950" />
            </ToolbarButton>
          </ToolbarSection>
          <ToolbarSection>
            <ToolbarButton>
              {draggable.position.isTopHalf ? (
                <ChevronUpIcon className="size-4 text-zinc-500/80" />
              ) : (
                <ChevronDownIcon className="size-4 text-zinc-500/80" />
              )}
            </ToolbarButton>
          </ToolbarSection>
        </div>
      </div>
    </div>
  );
}

export function ToolbarDraggingGrip(props: object) {
  return (
    <Button
      {...props}
      className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center bg-transparent focus:cursor-grabbing"
    >
      <GripVertical className="size-5 text-border/60" />
    </Button>
  );
}
