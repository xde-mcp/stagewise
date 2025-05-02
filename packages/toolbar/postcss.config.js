// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar postcss config
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

const prefixWhereOverrideList = ['html', 'body'];
const prefixElementOverrideList = [':root', ':host'];

export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
    'postcss-prefix-selector': {
      prefix: 'stagewise-companion-anchor',
      transform: (prefix, selector, prefixedSelector, filePath, rule) => {
        if (prefixWhereOverrideList.includes(selector)) {
          return `:where(${prefix})`;
        } else if (
          prefixElementOverrideList.some((sel) => selector.includes(sel))
        ) {
          const cleanedSelector = prefixElementOverrideList.reduce(
            (acc, sel) => {
              return acc.replace(sel, prefix);
            },
            selector,
          );
          return cleanedSelector;
        } else {
          return prefixedSelector;
        }
      },
    },
  },
};
