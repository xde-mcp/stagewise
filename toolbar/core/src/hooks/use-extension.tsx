// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar extension hook
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

import { createContext, useContext } from 'preact/compat';

interface ExtensionContextType {
  isExtensionInstalled: boolean;
  extensionVersion: string | null;
}

const ExtensionContext = createContext<ExtensionContextType>({
  isExtensionInstalled: false,
  extensionVersion: null,
});

export function ExtensionInteropProvider({ children }: { children: any }) {
  return (
    <ExtensionContext.Provider
      value={{ isExtensionInstalled: false, extensionVersion: null }}
    >
      {children}
    </ExtensionContext.Provider>
  );
}

export function useExtension() {
  return useContext(ExtensionContext);
}
