// SPDX-License-Identifier: AGPL-3.0-only
// Example demonstrating SRPC with Zod schema validation for type-safe RPC communication
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

import { z } from 'zod';
import http from 'node:http';
import {
  createSRPCClientBridge,
  createSRPCServerBridge,
} from '../src/zod-bridge';
import { createBridgeContract } from '../src/zod-contract';

// Define the contract using Zod schemas
const contract = createBridgeContract({
  server: {
    triggerAgentPrompt: {
      request: z.object({
        prompt: z.string(),
        options: z
          .object({
            temperature: z.number().min(0).max(1).optional(),
            maxTokens: z.number().positive().optional(),
          })
          .optional(),
      }),
      response: z.object({
        result: z.object({
          success: z.boolean(),
          error: z.string().optional(),
          output: z.string().optional(),
        }),
      }),
      update: z.object({
        updateText: z.string(),
        progress: z.number().min(0).max(100).optional(),
      }),
    },
    getSelectedModel: {
      request: z.object({}).optional(),
      response: z.object({
        model: z.string(),
        provider: z.string(),
        capabilities: z.array(z.string()),
      }),
    },
  },
  client: {
    getCurrentUrl: {
      request: z.object({}).optional(),
      response: z.object({
        url: z.string().url(),
        title: z.string().optional(),
      }),
    },
    getConsoleLogs: {
      request: z.object({
        amount: z.number().positive(),
        filter: z.enum(['error', 'warn', 'info', 'debug', 'all']).optional(),
      }),
      response: z.object({
        logs: z.array(
          z.object({
            level: z.enum(['error', 'warn', 'info', 'debug']),
            message: z.string(),
            timestamp: z.number(),
          }),
        ),
      }),
    },
  },
});

// Create and start the server
const httpServer = http.createServer();
const server = createSRPCServerBridge(httpServer, contract);

// Implement server-side methods
server.register({
  triggerAgentPrompt: async (request, { sendUpdate }) => {
    console.log('Received prompt:', request.prompt);
    console.log('With options:', request.options);

    // Send progress updates
    await sendUpdate({
      updateText: 'Initializing agent...',
      progress: 0,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await sendUpdate({
      updateText: 'Processing prompt...',
      progress: 50,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Return final result
    return {
      result: {
        success: true,
        output: 'Example response from the agent',
      },
    };
  },

  getSelectedModel: async () => {
    return {
      model: 'gpt-4',
      provider: 'openai',
      capabilities: ['chat', 'completion', 'embedding'],
    };
  },
});

// Start the server
httpServer.listen(3000, () => {
  console.log('Server running on port 3000');
});

// Create and connect a client
async function runClient() {
  const client = createSRPCClientBridge('ws://localhost:3000', contract);

  // Implement client-side methods
  client.register({
    getCurrentUrl: async () => {
      return {
        url: 'https://www.google.com',
        title: 'Google',
      };
    },

    getConsoleLogs: async (request) => {
      console.log('Fetching logs:', request.amount, request.filter);
      return {
        logs: [
          {
            level: 'info',
            message: 'Application started',
            timestamp: Date.now(),
          },
          {
            level: 'warn',
            message: 'Cache miss for key: user-preferences',
            timestamp: Date.now(),
          },
        ],
      };
    },
  });

  try {
    // Connect to the server
    await client.connect();
    console.log('Connected to server');

    // Call server methods
    const modelInfo = await client.call.getSelectedModel({});
    console.log('Current model:', modelInfo);

    const promptResult = await client.call.triggerAgentPrompt(
      {
        prompt: 'Analyze this data',
        options: {
          temperature: 0.7,
          maxTokens: 1000,
        },
      },
      {
        onUpdate: (update) => {
          console.log('Progress:', update.updateText, update.progress);
        },
      },
    );
    console.log('Agent result:', promptResult);

    // Server calling client methods
    const urlInfo = await server.call.getCurrentUrl({});
    console.log('Current URL:', urlInfo);

    const logs = await server.call.getConsoleLogs({
      amount: 10,
      filter: 'warn',
    });
    console.log('Console logs:', logs);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    httpServer.close();
  }
}

// Run the client after a short delay to ensure server is ready
setTimeout(runClient, 1000);
