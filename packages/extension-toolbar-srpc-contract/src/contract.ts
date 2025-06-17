import { createBridgeContract } from '@stagewise/srpc';
import { z } from 'zod';

// The toolbar needs to implement a discovery-mechanism to check if the extension is running and find the correct port
// The extension also needs to implement a discovery-mechanism to find the correct toolbar.
export const DEFAULT_PORT = 5746; // This is the default port for the extension's RPC and MCP servers; if occupied, the extension will take the next available port (5747, 5748, etc., up to 5756
export const PING_ENDPOINT = '/ping/stagewise'; // Will be used by the toolbar to check if the extension is running and find the correct port
export const PING_RESPONSE = 'stagewise'; // The response to the ping request

// Serializable representation of HTMLElement data for RPC transmission
const SerializableElement = z.object({
  tagName: z.string(),
  id: z.string().optional(),
  classes: z.array(z.string()).optional(),
  attributes: z.record(z.string()).optional(),
  text: z.string().optional(),
  parent: z
    .object({
      tagName: z.string(),
      id: z.string().optional(),
      classes: z.array(z.string()).optional(),
    })
    .optional(),
  styles: z
    .object({
      color: z.string().optional(),
      backgroundColor: z.string().optional(),
      fontSize: z.string().optional(),
      fontWeight: z.string().optional(),
      display: z.string().optional(),
    })
    .optional(),
  bounds: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  xpath: z.string().optional(),
});

export const contract = createBridgeContract({
  server: {
    getSessionInfo: {
      request: z.object({}),
      response: z.object({
        sessionId: z.string().optional(),
        appName: z
          .string()
          .describe('The name of the application, e.g. "VS Code" or "Cursor"'),
        displayName: z
          .string()
          .describe('Human-readable window identifier for UI display'),
        port: z
          .number()
          .describe('Port number this VS Code instance is running on'),
      }),
      update: z.object({}),
    },
    triggerAgentPrompt: {
      request: z.object({
        sessionId: z.string().optional(),
        prompt: z.string(),
        user_request: z.string(),
        url: z.string().optional(),
        selected_elements: z.array(SerializableElement).optional(),
        model: z
          .string()
          .optional()
          .describe('The model to use for the agent prompt'),
        files: z
          .array(z.string())
          .optional()
          .describe('Link project files to the agent prompt'),
        mode: z
          .enum(['agent', 'ask', 'manual'])
          .optional()
          .describe('The mode to use for the agent prompt'),
        images: z
          .array(z.string())
          .optional()
          .describe('Upload files like images, videos, etc.'),
      }),
      response: z.object({
        sessionId: z.string().optional(),
        result: z.object({
          success: z.boolean(),
          error: z.string().optional(),
          errorCode: z.enum(['session_mismatch']).optional(),
          output: z.string().optional(),
        }),
      }),
      update: z.object({
        sessionId: z.string().optional(),
        updateText: z.string(),
      }),
    },
  },
});

export type PromptRequest = z.infer<
  typeof contract.server.triggerAgentPrompt.request
>;

export type VSCodeContext = z.infer<
  typeof contract.server.getSessionInfo.response
>;

export type SerializableElementType = z.infer<typeof SerializableElement>;
