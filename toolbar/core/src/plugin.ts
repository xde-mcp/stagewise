// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar plugin
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

export type MCPPrompt = {
  name: string;
  description: string;
  arguments: {
    name: string;
    description: string;
    required: boolean;
  }[];
  generator: () => MCPPromptMessage | Promise<MCPPromptMessage>;
};

export type MCPPromptList = {
  prompts: MCPPrompt[];
  nextCursor?: string;
};

export type MCPPromptMessage = {
  role: 'user' | 'assistant';
  content:
    | {
        type: 'text';
        text: string;
      }
    | {
        type: 'image' | 'audio';
        data: string;
        mimeType: string;
      }
    | {
        type: 'resource';
        resource: {
          uri: string;
          mimeType: string;
          text: string;
        };
      };
};

export type MCPResource = {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  size: number;
};

export type MCPResourceList = {
  resources: MCPResource[];
  nextCursor?: string;
};

export type MCPResourceContent = {
  uri: string;
  mimeType: string;
} & (
  | {
      text: string;
    }
  | {
      data: string;
    }
);

export type MCPTool = {
  name: string; // Unique identifier for the tool
  description?: string; // Human-readable description
  inputSchema: object; // JSON Schema for the tool's parameters
  annotations?: {
    // Optional hints about tool behavior
    title?: string; // Human-readable title for the tool
    readOnlyHint?: boolean; // If true, the tool does not modify its environment
    destructiveHint?: boolean; // If true, the tool may perform destructive updates
    idempotentHint?: boolean; // If true, repeated calls with same args have no additional effect
    openWorldHint?: boolean; // If true, tool interacts with external entities
  };
};

export type MCPToolList = {
  tools: MCPTool[];
  nextCursor?: string;
};

export type MCPToolResponse = {
  content: (
    | {
        type: 'text';
        text: string;
      }
    | {
        type: 'image' | 'audio';
        data: string;
        mimeType: string;
      }
    | {
        type: 'resource';
        resource: {
          uri: string;
          mimeType: string;
          text: string;
        };
      }
  )[];
  isError: boolean;
};

export interface MCP {
  prompts: {
    list: (cursor?: string) => MCPPromptList | Promise<MCPPromptList>;
    get: (name: string) => MCPPromptMessage | Promise<MCPPromptMessage>;
  };
  resources: {
    list: (cursor?: string) => MCPResourceList | Promise<MCPResourceList>;
    read: (uri: string) => MCPResourceContent | Promise<MCPResourceContent>;
  };
  tools: {
    list: (cursor?: string) => MCPToolList | Promise<MCPToolList>;
    call: (name: string) => MCPToolResponse | Promise<MCPToolResponse>;
  };
}

export interface UserMessage {
  id: string;
  text: string;
  contextElements: HTMLElement[];
}

export interface ToolbarAction {
  name: string;
  description: string;
  execute: () => void;
}

export interface ToolbarPlugin {
  name: string;
  description: string;
  mcp: MCP | null;
  shortInfoForPrompt: (prompt: UserMessage) => string | null; // Up to 200 characters of information that's gets passed in on a user prompt.
  actions: ToolbarAction[];
}
