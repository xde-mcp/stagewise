import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  afterEach,
} from 'vitest';
import http from 'node:http';
import {
  createBridgeContract,
  createSRPCClientBridge,
  createSRPCServerBridge,
  type ZodClient,
} from '../src';
import { z } from 'zod';

// Define test contracts similar to the example
const contract = createBridgeContract({
  server: {
    greet: {
      request: z.object({ name: z.string() }),
      response: z.object({ message: z.string() }),
      update: z.object({ progress: z.number() }),
    },
    getData: {
      request: z.object({ id: z.number() }),
      response: z.object({ data: z.string() }),
    },
  },
  client: {
    sayHello: {
      request: z.object({ name: z.string() }),
      response: z.object({ message: z.string() }),
      update: z.object({ progress: z.number() }),
    },
  },
});

describe('sRPC Package', () => {
  // Server setup
  const httpServer = http.createServer();
  const server = createSRPCServerBridge(httpServer, contract);
  const TEST_PORT = 3001;

  // Original server method implementations to restore after tests
  let greetHandler: any;
  let getDataHandler: any;

  // Set up test server
  beforeAll(() => {
    return new Promise<void>((resolve) => {
      // Register server methods

      server.register({
        greet: async (request, { sendUpdate }) => {
          sendUpdate({ progress: 0 });
          sendUpdate({ progress: 50 });
          sendUpdate({ progress: 100 });
          return { message: `Hello, ${request.name}!` };
        },
        getData: async (request) => {
          return { data: `Data for ID ${request.id}` };
        },
      });

      // Start the server
      httpServer.listen(TEST_PORT, () => {
        resolve();
      });
    });
  });

  // Tear down test server
  afterAll(() => {
    return new Promise<void>((resolve) => {
      httpServer.close(() => {
        resolve();
      });
    });
  });

  // Client setup and tests
  describe('Client-Server Communication', () => {
    let client: ZodClient<typeof contract>;

    beforeAll(async () => {
      client = createSRPCClientBridge(`ws://localhost:${TEST_PORT}`, contract);
      await client.connect();
      // Register client methods
      client.register({
        sayHello: async (request, { sendUpdate }) => {
          sendUpdate({ progress: 0 });
          sendUpdate({ progress: 50 });
          return { message: `Hello from client, ${request.name}!` };
        },
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    afterAll(() => {
      client.close();
    });

    it('should connect to the server successfully', () => {
      // Connection is already established in beforeAll
      expect(client).toBeDefined();
    });

    it('should call server methods and receive responses', async () => {
      const response = await client.call.greet(
        { name: 'Test User' },
        { onUpdate: () => {} },
      );
      expect(response).toEqual({ message: 'Hello, Test User!' });
    });

    it('should call getData method and receive correct data', async () => {
      const testId = 42;
      const response = await client.call.getData({ id: testId });
      expect(response).toEqual({ data: `Data for ID ${testId}` });
    });

    it('should receive progress updates during method calls', async () => {
      const updateSpy = vi.fn();

      await client.call.greet({ name: 'Update Test' }, { onUpdate: updateSpy });

      expect(updateSpy).toHaveBeenCalledTimes(3);
      expect(updateSpy).toHaveBeenCalledWith({ progress: 0 });
      expect(updateSpy).toHaveBeenCalledWith({ progress: 50 });
      expect(updateSpy).toHaveBeenCalledWith({ progress: 100 });
    });

    it('should be able to call client methods from server', async () => {
      const updateSpy = vi.fn();

      // Instead of trying to spy on the call method directly, verify with the update spy
      // that the method was called and had the correct behavior
      await server.call.sayHello({ name: 'Server' }, { onUpdate: updateSpy });

      expect(updateSpy).toHaveBeenCalledTimes(2);
      expect(updateSpy).toHaveBeenCalledWith({ progress: 0 });
      expect(updateSpy).toHaveBeenCalledWith({ progress: 50 });
    });
  });

  describe('Error Handling', () => {
    let client: ZodClient<typeof contract>;

    beforeAll(async () => {
      client = createSRPCClientBridge(`ws://localhost:${TEST_PORT}`, contract);
      await client.connect();
    });

    afterAll(() => {
      client.close();
    });

    it('should handle non-existent methods properly', async () => {
      // Create a type-safe way to test a non-existent method
      // by using a dynamic property with any cast
      const anyClient = client as any;
      const callNonExistent = () => anyClient.call.nonExistentMethod({});

      // Verify it throws an error
      await expect(callNonExistent).rejects.toThrow();
    });

    it('should handle server-side errors', async () => {
      // Save current implementation to restore later
      const originalImplementations = {
        greet: greetHandler,
        getData: getDataHandler,
      };

      // Register error-throwing implementation
      server.register({
        greet: async (request, { sendUpdate }) => {
          sendUpdate({ progress: 0 });
          sendUpdate({ progress: 50 });
          sendUpdate({ progress: 100 });
          return { message: `Hello, ${request.name}!` };
        },
        getData: async () => {
          throw new Error('Test error');
        },
      });

      await expect(client.call.getData({ id: 1 })).rejects.toThrow(
        'Test error',
      );

      // Restore original methods by re-registering them
      server.register({
        greet: originalImplementations.greet,
        getData: originalImplementations.getData,
      });
    });
  });

  describe('Reconnection', () => {
    let client: ZodClient<typeof contract>;

    beforeAll(async () => {
      client = createSRPCClientBridge(`ws://localhost:${TEST_PORT}`, contract, {
        maxReconnectAttempts: 3,
        reconnectDelay: 100,
      });
      await client.connect();
    });

    afterAll(() => {
      client.close();
    });

    it('should handle WebSocket reconnection properly', async () => {
      // Register initial methods
      server.register({
        greet: async (request, { sendUpdate }) => {
          sendUpdate({ progress: 0 });
          sendUpdate({ progress: 50 });
          sendUpdate({ progress: 100 });
          return { message: `Hello, ${request.name}!` };
        },
        getData: async (request) => {
          return { data: `Data for ID ${request.id}` };
        },
      });

      client.register({
        sayHello: async (request, { sendUpdate }) => {
          sendUpdate({ progress: 0 });
          sendUpdate({ progress: 50 });
          return { message: `Hello from client, ${request.name}!` };
        },
      });

      // Check that we can make a call
      const response1 = await client.call.greet(
        { name: 'Before Reconnect' },
        { onUpdate: () => {} },
      );
      expect(response1).toEqual({ message: 'Hello, Before Reconnect!' });

      // Force close the existing connection (simulating a network issue)
      const serverImpl = server as any;
      if (serverImpl.bridge?.ws) {
        serverImpl.bridge.ws.close();
      }

      // Wait for reconnection to happen
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Re-register methods after reconnection
      server.register({
        greet: async (request, { sendUpdate }) => {
          sendUpdate({ progress: 0 });
          sendUpdate({ progress: 50 });
          sendUpdate({ progress: 100 });
          return { message: `Hello, ${request.name}!` };
        },
        getData: async (request) => {
          return { data: `Data for ID ${request.id}` };
        },
      });

      client.register({
        sayHello: async (request, { sendUpdate }) => {
          sendUpdate({ progress: 0 });
          sendUpdate({ progress: 50 });
          return { message: `Hello from client, ${request.name}!` };
        },
      });

      // Try another call after reconnection
      const response2 = await client.call.greet(
        { name: 'After Reconnect' },
        { onUpdate: () => {} },
      );
      expect(response2).toEqual({ message: 'Hello, After Reconnect!' });
    });
  });
});
