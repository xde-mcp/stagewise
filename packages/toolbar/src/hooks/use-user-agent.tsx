// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar user agent hook
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

import { useMemo } from 'preact/hooks';
import { UAParser } from 'ua-parser-js';

const useBrowserInfo = () => {
  const browserInfo = useMemo(() => {
    {
      const parser = new (UAParser as any)();
      const result = parser.getResult();
      return {
        browser: result.browser,
        engine: result.engine,
        os: result.os,
        device: result.device,
        cpu: result.cpu,
      };
    }
  }, []);

  return browserInfo;
};

export default useBrowserInfo;
