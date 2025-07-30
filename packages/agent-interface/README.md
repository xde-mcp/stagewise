# Agent Interface

The agent-interface package provides a flexible way to create stagewise agents that can either run as standalone servers or hook into existing Express applications.

## Features

- **Standalone Server**: Create a complete HTTP/WebSocket server with stagewise agent endpoints
- **Express Integration**: Hook stagewise agent endpoints into existing Express applications
- **Customizable Configuration**: Configure agent name, description, endpoints, CORS, and more
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions

## Quick Start

### Standalone Server

Create a standalone server that handles both HTTP and WebSocket connections:

```typescript
import { createAgentServer } from '@stagewise/agent-interface';

const agentServer = await createAgentServer({
  name: 'My Custom Agent',
  description: 'A powerful AI agent for code generation',
  port: 3000, // Optional: custom port (default: 5746)
  infoPath: '/my-agent/info', // Optional: custom info endpoint
  wsPath: '/my-agent/ws', // Optional: custom WebSocket endpoint
});

console.log(`Agent server running on port ${agentServer.port}`);

// Access the agent interface
const agent = agentServer.interface;

// Set agent availability
agent.availability.set(true);

// Send a message
agent.messaging.addPart({
  type: 'text',
  text: 'Hello from my agent!'
});
```

### Hook into Existing Express Server

Integrate stagewise agent endpoints into your existing Express application:

```typescript
import express from 'express';
import { createServer } from 'http';
import { createAgentHook } from '@stagewise/agent-interface';

const app = express();
const server = createServer(app);

// Your existing Express routes
app.get('/', (req, res) => {
  res.send('My Application');
});

// Hook stagewise agent endpoints
const agentHook = await createAgentHook({
  app,
  server,
  name: 'My Integrated Agent',
  description: 'Agent integrated into my app',
  infoPath: '/api/agent/info',
  wsPath: '/api/agent/ws',
});

// Access the agent interface
const agent = agentHook.interface;

// Start your server
server.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Configuration Options

### AgentServerConfig (Base Configuration)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | `'Stagewise Agent'` | Custom agent name |
| `description` | `string` | `'A stagewise agent'` | Custom agent description |
| `port` | `number` | `5746` | Starting port for standalone server |
| `infoPath` | `string` | `'/stagewise/info'` | Custom info endpoint path |
| `wsPath` | `string` | `'/stagewise/ws'` | Custom WebSocket endpoint path |
| `cors` | `CorsOptions` | `{ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }` | Custom CORS configuration |

### AgentServerStandaloneConfig

Extends `AgentServerConfig` with:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `startServer` | `boolean` | `true` | Whether to start the HTTP server |

### AgentServerHookConfig

Extends `AgentServerConfig` with:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `app` | `Application` | **Required** | Existing Express application |
| `server` | `HttpServer` | **Required** | Existing HTTP server |
| `startServer` | `boolean` | `false` | Whether to start the server |

## Agent Interface

Both `createAgentServer` and `createAgentHook` return an agent interface that provides:

### Availability Management

```typescript
// Set agent as available
agent.availability.set(true);

// Set agent as unavailable with error
agent.availability.set(false, AgentAvailabilityError.NO_CONNECTION, 'Connection lost');
```

### State Management

```typescript
// Set agent state
agent.state.set(AgentStateType.BUSY, 'Processing request');
agent.state.set(AgentStateType.IDLE);
```

### Messaging

```typescript
// Clear current message
agent.messaging.clear();

// Set complete message
agent.messaging.set([
  { type: 'text', text: 'Hello world!' }
]);

// Add message parts
agent.messaging.addPart({ type: 'text', text: 'Hello' });
agent.messaging.addPart({ type: 'text', text: ' world!' });

// Update specific part
agent.messaging.updatePart({ type: 'text', text: 'Updated' }, 0, 'replace');
```

### Tool Calling (if supported)

```typescript
// Enable tool calling
agent.toolCalling.setToolCallSupport(true);

// Request a tool call
const result = await agent.toolCalling.requestToolCall('search', { query: 'test' });
```

## Error Handling

The agent interface includes comprehensive error handling:

```typescript
try {
  await agent.toolCalling.requestToolCall('unknown-tool', {});
} catch (error) {
  console.error('Tool call failed:', error.message);
}
```

## TypeScript Support

All functions and interfaces are fully typed:

```typescript
import type { 
  AgentServer, 
  AgentServerConfig, 
  AgentServerHookConfig,
  AgentServerStandaloneConfig 
} from '@stagewise/agent-interface';
```
