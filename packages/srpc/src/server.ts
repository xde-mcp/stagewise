// SPDX-License-Identifier: AGPL-3.0-only
// WebSocket-based RPC server implementation for type-safe remote procedure calls
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

import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { WebSocketRpcBridge } from './core';

/**
 * Server implementation of the WebSocket RPC Bridge
 */
export class WebSocketRpcServer extends WebSocketRpcBridge {
  private wss: WebSocketServer;

  /**
   * Creates a new WebSocketRpcServer
   * @param server HTTP server to attach to
   */
  constructor(server: Server) {
    super();
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket) => {
      // If there's an existing connection, close it first
      if (this.ws) {
        console.warn(
          'New WebSocket connection attempted while one is already active. Closing existing connection first.',
        );
        const oldWs = this.ws;
        this.ws = null;
        oldWs.close();
      }

      this.ws = ws;
      this.setupWebSocketHandlers(ws);

      // Add cleanup handler when connection closes
      ws.on('close', () => {
        if (this.ws === ws) {
          this.ws = null;
        }
      });
    });
  }

  /**
   * Method to call a remote procedure on the client
   * @param method Method name
   * @param payload Request payload
   * @param onUpdate Optional callback for updates
   * @returns Promise resolving with the response
   */
  public call<TRequest, TResponse, TUpdate>(
    method: string,
    payload: TRequest,
    onUpdate?: (update: TUpdate) => void,
  ): Promise<TResponse> {
    return this.callMethod<TRequest, TResponse, TUpdate>(
      method,
      payload,
      onUpdate,
    );
  }

  /**
   * Server doesn't need to reconnect
   */
  protected reconnect(): void {}

  /**
   * Close the WebSocket server
   */
  public async close(): Promise<void> {
    await super.close();
    this.wss.close();
  }
}
