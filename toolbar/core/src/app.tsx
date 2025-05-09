// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar app
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

import './app.css';

import { ContextProviders } from './components/context-providers';
import { HotkeyListener } from './components/hotkey-listener';
import { DesktopLayout } from './components/layouts/desktop';
import { ClickBlocker } from './components/click-blocker';
import { FocusLock } from './components/focus-lock';
import { VisibilityManager } from './components/visibility-manager';
import { useAppState } from './hooks/use-app-state';
import type { ToolbarConfig } from './config';

export function App(config?: ToolbarConfig) {
  const isMainAppBlocked = useAppState((state) => state.isMainAppBlocked);

  return (
    <>
      <FocusLock />
      <ClickBlocker
        className="fixed inset-0 h-screen w-screen"
        enable={isMainAppBlocked}
      />

      <ContextProviders config={config}>
        <HotkeyListener />
        <VisibilityManager>
          {/* Depending on the screen size, load either the mobile or the desktop companion layout */}
          {/* Until the mobile layout is ready, we will always load the desktop layout */}
          <DesktopLayout />
        </VisibilityManager>
      </ContextProviders>
    </>
  );
}
