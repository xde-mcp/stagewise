// SPDX-License-Identifier: AGPL-3.0-only
// Type helpers for strongly-typed RPC communication over WebSockets
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

import { WebSocketRpcServer } from './server';
import { WebSocketRpcClient } from './client';
import type { Server } from 'node:http';
import type { WebSocketBridgeOptions } from './core';

/**
 * Type definitions for creating strongly-typed bridges
 */

// Define a bridge method contract
export interface RpcMethodContract<TRequest, TResponse, TUpdate = never> {
  request: TRequest;
  response: TResponse;
  update: TUpdate;
}

// Define a bridge contract with multiple methods
export type EndpointMethodMap = Record<
  string,
  RpcMethodContract<any, any, any>
>;

export type BridgeContract = {
  client?: EndpointMethodMap;
  server?: EndpointMethodMap;
};

export type CreateBridgeContract<
  T extends {
    server?: Record<string, RpcMethodContract<any, any, any>>;
    client?: Record<string, RpcMethodContract<any, any, any>>;
  },
> = T;

export type MethodImplementations<T> = {
  [K in keyof T]: T[K] extends RpcMethodContract<
    infer Req,
    infer Res,
    infer Upd
  >
    ? (request: Req, sendUpdate: (update: Upd) => void) => Promise<Res>
    : never;
};

// Type for method calls
export type MethodCalls<T> = [T] extends [EmptyEndpointMap]
  ? Record<never, never>
  : {
      [K in keyof T]: T[K] extends RpcMethodContract<
        infer Req,
        infer Res,
        infer Upd
      >
        ? (request: Req, onUpdate?: (update: Upd) => void) => Promise<Res>
        : never;
    };

// TypedBridge wraps WebSocketRpcClient or WebSocketRpcServer with type safety
export class TypedBridge<
  Serves extends EndpointMethodMap,
  Consumes extends EndpointMethodMap,
  B extends WebSocketRpcClient | WebSocketRpcServer,
> {
  protected bridge: B;
  public call: MethodCalls<Consumes>;

  constructor(bridge: B) {
    this.bridge = bridge;

    // Create a proxy for method calling
    this.call = new Proxy({} as MethodCalls<Consumes>, {
      get: (target, prop) => {
        return (request: any, onUpdate?: (update: any) => void) => {
          return this.callMethod(prop as keyof Consumes, request, onUpdate);
        };
      },
    });
  }

  // Private method to handle actual method calls
  private callMethod<K extends keyof Consumes>(
    method: K,
    request: Consumes[K]['request'],
    onUpdate?: (update: Consumes[K]['update']) => void,
  ): Promise<Consumes[K]['response']> {
    return this.bridge.call(
      method as string,
      request,
      onUpdate as (update: any) => void,
    );
  }

  // Register methods with type safety
  public register(implementations: MethodImplementations<Serves>): void {
    this.bridge.register(implementations);
  }
}

export class TypedServer<
  Serves extends EndpointMethodMap,
  Consumes extends EndpointMethodMap,
> extends TypedBridge<Serves, Consumes, WebSocketRpcServer> {
  constructor(server: Server) {
    super(new WebSocketRpcServer(server));
  }
}

export class TypedClient<
  Serves extends EndpointMethodMap,
  Consumes extends EndpointMethodMap,
> extends TypedBridge<Serves, Consumes, WebSocketRpcClient> {
  constructor(url: string, options?: WebSocketBridgeOptions) {
    super(new WebSocketRpcClient(url, options));
  }
  public connect(): Promise<void> {
    return this.bridge.connect();
  }

  public async close(): Promise<void> {
    await this.bridge.close();
  }
}

// Empty endpoint map type for when server/client is undefined
type EmptyEndpointMap = null;

// Helper functions to create typed bridges
export function createSRPCServerBridge<C extends BridgeContract>(
  server: Server,
): TypedServer<NonNullable<C['server']>, NonNullable<C['client']>> {
  return new TypedServer<NonNullable<C['server']>, NonNullable<C['client']>>(
    server,
  );
}

export function createSRPCClientBridge<C extends BridgeContract>(
  url: string,
  options?: WebSocketBridgeOptions,
): TypedClient<NonNullable<C['client']>, NonNullable<C['server']>> {
  return new TypedClient<NonNullable<C['client']>, NonNullable<C['server']>>(
    url,
    options,
  );
}
