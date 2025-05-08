// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar media query hook
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

import { useCallback, useEffect, useState } from 'preact/hooks';
import { useEventListener } from './use-event-listener';

export const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);

  const queryBrowser = useCallback(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
  }, [matches, query]);

  useEventListener('resize', queryBrowser);

  useEffect(() => {
    queryBrowser();
  }, [queryBrowser]);

  return matches;
};
