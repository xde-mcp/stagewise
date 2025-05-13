// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar index
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

import { render, createElement } from 'preact';
import appStyle from './app.css?inline';
import { App } from './app.tsx';

import { companionAnchorTagName } from './utils.tsx';

import type { ToolbarConfig } from './config.ts';

export * from './plugin.ts';
export type { ToolbarConfig } from './config.ts';

export function initToolbar(config?: ToolbarConfig) {
  if (!document.body)
    throw new Error('stagewise companion cannot find document.body');

  // If a stagewise companion anchor already exists, we abort this instance.
  if (document.body.querySelector(companionAnchorTagName)) {
    console.warn(
      'A stagewise companion anchor already exists. Aborting this instance.',
    );
    throw new Error('A stagewise companion anchor already exists.');
  }

  const shadowDomAnchor = document.createElement(companionAnchorTagName);
  shadowDomAnchor.style.position = 'fixed';
  shadowDomAnchor.style.top = '0px';
  shadowDomAnchor.style.left = '0px';
  shadowDomAnchor.style.right = '0px';
  shadowDomAnchor.style.bottom = '0px';
  shadowDomAnchor.style.pointerEvents = 'none';
  shadowDomAnchor.style.zIndex = '2147483647';

  const eventBlocker = (ev: Event) => {
    ev.stopPropagation();
  };

  // We block all kinds of events to prevent the anchor from interfering with the website as much as possible.
  // We want the website to basically freeze upon interacting with the companion.
  shadowDomAnchor.onclick = eventBlocker;
  shadowDomAnchor.onmousedown = eventBlocker;
  shadowDomAnchor.onmouseup = eventBlocker;
  shadowDomAnchor.onmousemove = eventBlocker;
  shadowDomAnchor.ondblclick = eventBlocker;
  shadowDomAnchor.oncontextmenu = eventBlocker;
  shadowDomAnchor.onwheel = eventBlocker;
  shadowDomAnchor.onfocus = eventBlocker;
  shadowDomAnchor.onblur = eventBlocker;

  document.body.appendChild(shadowDomAnchor);

  const fontLinkNode = document.createElement('link');
  fontLinkNode.rel = 'stylesheet';
  fontLinkNode.href = `https://rsms.me/inter/inter.css`;
  document.head.appendChild(fontLinkNode);

  /** Insert generated css into shadow dom */
  const styleNode = document.createElement('style');
  styleNode.append(document.createTextNode(appStyle));
  document.head.appendChild(styleNode);
  render(createElement(App, config), shadowDomAnchor);
}
