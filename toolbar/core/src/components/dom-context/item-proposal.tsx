// SPDX-License-Identifier: AGPL-3.0-only
// Item proposal component for the toolbar
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

import { useWindowSize } from '@/hooks/use-window-size';
import { useCyclicUpdate } from '@/hooks/use-cyclic-update';
import { useCallback, useRef } from 'preact/hooks';
import type { HTMLAttributes } from 'preact/compat';
import { PlusIcon } from 'lucide-react';

export interface ItemProposalProps extends HTMLAttributes<HTMLDivElement> {
  refElement: HTMLElement;
}

export function ContextItemProposal({
  refElement,
  ...props
}: ItemProposalProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  const windowSize = useWindowSize();

  const updateBoxPosition = useCallback(() => {
    if (boxRef.current) {
      if (refElement) {
        const referenceRect = refElement.getBoundingClientRect();

        boxRef.current.style.top = `${referenceRect.top - 2}px`;
        boxRef.current.style.left = `${referenceRect.left - 2}px`;
        boxRef.current.style.width = `${referenceRect.width + 4}px`;
        boxRef.current.style.height = `${referenceRect.height + 4}px`;
        boxRef.current.style.display = undefined;
      } else {
        boxRef.current.style.height = '0px';
        boxRef.current.style.width = '0px';
        boxRef.current.style.top = `${windowSize.height / 2}px`;
        boxRef.current.style.left = `${windowSize.width / 2}px`;
        boxRef.current.style.display = 'none';
      }
    }
  }, [refElement, windowSize.height, windowSize.width]);

  useCyclicUpdate(updateBoxPosition, 30);

  return (
    <div
      {...props}
      className={
        'fixed flex items-center justify-center rounded-lg border-2 border-blue-600/80 bg-blue-600/20 text-white transition-all duration-100'
      }
      style={{ zIndex: 1000 }}
      ref={boxRef}
    >
      <div
        style={{
          position: 'absolute',
          top: '2px',
          left: '2px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '1px 2px',
          fontSize: '12px',
          borderRadius: '3px',
          zIndex: 1001,
        }}
      >
        {refElement.tagName.toLowerCase()}
      </div>
      <PlusIcon className="size-6 drop-shadow-black drop-shadow-md" />
    </div>
  );
}
