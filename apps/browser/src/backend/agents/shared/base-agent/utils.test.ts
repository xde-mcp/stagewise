import { describe, it, expect } from 'vitest';
import type { EnvironmentSnapshot } from '@shared/karton-contracts/ui/agent/metadata';
import type { UserMessageMetadata } from '@shared/karton-contracts/ui/agent/metadata';
import type { AgentMessage } from '@shared/karton-contracts/ui/agent';
import {
  buildSyntheticEnvironmentChangeMessage,
  convertAgentMessagesToModelMessages,
} from './utils';

function makeSnapshot(
  overrides: Partial<EnvironmentSnapshot> = {},
): EnvironmentSnapshot {
  return {
    browser: {
      tabs: [{ handle: 't_1', url: 'https://a.com', title: 'A' }],
      activeTabHandle: 't_1',
    },
    workspace: {
      mounts: [{ prefix: 'w1', path: '/project' }],
    },
    fileDiffs: { pending: [], summary: [] },
    ...overrides,
  };
}

function makeMetadata(snapshot?: EnvironmentSnapshot): UserMessageMetadata {
  return {
    createdAt: new Date(),
    mountedPaths: [{ prefix: 'w1', path: '/project' }],
    partsMetadata: [],
    environmentSnapshot: snapshot,
  };
}

function makeUserMsg(
  id: string,
  text: string,
  snapshot?: EnvironmentSnapshot,
): AgentMessage & { role: 'user' } {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
    metadata: makeMetadata(snapshot),
  } as AgentMessage & { role: 'user' };
}

function makeAssistantMsg(
  id: string,
  text: string,
  snapshot?: EnvironmentSnapshot,
): AgentMessage {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text, state: 'done' }],
    metadata: makeMetadata(snapshot),
  } as AgentMessage;
}

describe('buildSyntheticEnvironmentChangeMessage', () => {
  it('produces a user model message with XML env-changes tag', () => {
    const result = buildSyntheticEnvironmentChangeMessage([
      'tab closed: [t_2]',
      'workspace disconnected',
    ]);
    expect(result.role).toBe('user');
    expect(result.content).toHaveLength(1);
    const textPart = result.content[0];
    expect(textPart).toHaveProperty('type', 'text');
    expect((textPart as { text: string }).text).toContain('<env-changes>');
    expect((textPart as { text: string }).text).toContain('tab closed: [t_2]');
    expect((textPart as { text: string }).text).toContain(
      'workspace disconnected',
    );
  });

  it('joins multiple changes with dash-prefixed newlines', () => {
    const result = buildSyntheticEnvironmentChangeMessage([
      'change-a',
      'change-b',
    ]);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('- change-a\n- change-b');
  });
});

describe('convertAgentMessagesToModelMessages – env-change injection', () => {
  const agentId = 'agent-1';

  it('does not inject env-change when snapshots are identical', async () => {
    const snap = makeSnapshot();
    const messages: AgentMessage[] = [
      makeUserMsg('u1', 'hello', snap),
      makeAssistantMsg('a1', 'hi there', snap),
    ];

    const result = await convertAgentMessagesToModelMessages(
      messages,
      'system prompt',
      {},
      0,
      agentId,
    );

    const envChangeMessages = result.filter(
      (m) =>
        m.role === 'user' &&
        typeof m.content !== 'string' &&
        Array.isArray(m.content) &&
        m.content.some(
          (p) =>
            'text' in p &&
            typeof p.text === 'string' &&
            p.text.includes('<env-changes>'),
        ),
    );
    expect(envChangeMessages).toHaveLength(0);
  });

  it('injects env-change between user and assistant when snapshot changed', async () => {
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot({
      browser: {
        tabs: [],
        activeTabHandle: null,
      },
    });
    const messages: AgentMessage[] = [
      makeUserMsg('u1', 'hello', snap1),
      makeAssistantMsg('a1', 'hi', snap2),
    ];

    const result = await convertAgentMessagesToModelMessages(
      messages,
      'system prompt',
      {},
      0,
      agentId,
    );

    const envChangeMessages = result.filter(
      (m) =>
        m.role === 'user' &&
        typeof m.content !== 'string' &&
        Array.isArray(m.content) &&
        m.content.some(
          (p) =>
            'text' in p &&
            typeof p.text === 'string' &&
            p.text.includes('<env-changes>'),
        ),
    );
    expect(envChangeMessages).toHaveLength(1);
    const text = (
      (envChangeMessages[0] as any).content[0] as {
        text: string;
      }
    ).text;
    expect(text).toContain('tab closed');
  });

  it('injects env-change between assistant and user when snapshot changed', async () => {
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot({
      workspace: {
        mounts: [],
      },
    });
    const messages: AgentMessage[] = [
      makeUserMsg('u1', 'hello', snap1),
      makeAssistantMsg('a1', 'response', snap1),
      makeUserMsg('u2', 'next question', snap2),
    ];

    const result = await convertAgentMessagesToModelMessages(
      messages,
      'system prompt',
      {},
      0,
      agentId,
    );

    const envChangeMessages = result.filter(
      (m) =>
        m.role === 'user' &&
        typeof m.content !== 'string' &&
        Array.isArray(m.content) &&
        m.content.some(
          (p) =>
            'text' in p &&
            typeof p.text === 'string' &&
            p.text.includes('<env-changes>'),
        ),
    );
    expect(envChangeMessages).toHaveLength(1);
    const text = (
      (envChangeMessages[0] as any).content[0] as {
        text: string;
      }
    ).text;
    expect(text).toContain('workspace unmounted: w1');
  });

  it('injects env-change between consecutive assistant messages', async () => {
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot({
      browser: {
        tabs: [
          { handle: 't_1', url: 'https://a.com', title: 'A' },
          {
            handle: 't_2',
            url: 'https://new.com',
            title: 'New',
          },
        ],
        activeTabHandle: 't_1',
      },
    });
    const messages: AgentMessage[] = [
      makeUserMsg('u1', 'hello', snap1),
      makeAssistantMsg('a1', 'first response', snap1),
      makeAssistantMsg('a2', 'second response', snap2),
    ];

    const result = await convertAgentMessagesToModelMessages(
      messages,
      'system prompt',
      {},
      0,
      agentId,
    );

    const envChangeMessages = result.filter(
      (m) =>
        m.role === 'user' &&
        typeof m.content !== 'string' &&
        Array.isArray(m.content) &&
        m.content.some(
          (p) =>
            'text' in p &&
            typeof p.text === 'string' &&
            p.text.includes('<env-changes>'),
        ),
    );
    expect(envChangeMessages).toHaveLength(1);
    const text = (
      (envChangeMessages[0] as any).content[0] as {
        text: string;
      }
    ).text;
    expect(text).toContain('tab opened');
  });

  it('does not inject when snapshots are missing', async () => {
    const messages: AgentMessage[] = [
      makeUserMsg('u1', 'hello'),
      makeAssistantMsg('a1', 'hi'),
    ];

    const result = await convertAgentMessagesToModelMessages(
      messages,
      'system prompt',
      {},
      0,
      agentId,
    );

    const envChangeMessages = result.filter(
      (m) =>
        m.role === 'user' &&
        typeof m.content !== 'string' &&
        Array.isArray(m.content) &&
        m.content.some(
          (p) =>
            'text' in p &&
            typeof p.text === 'string' &&
            p.text.includes('<env-changes>'),
        ),
    );
    expect(envChangeMessages).toHaveLength(0);
  });

  it('env-change appears before the message it annotates', async () => {
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot({
      workspace: {
        mounts: [],
      },
    });
    const messages: AgentMessage[] = [
      makeUserMsg('u1', 'hello', snap1),
      makeAssistantMsg('a1', 'hi', snap2),
    ];

    const result = await convertAgentMessagesToModelMessages(
      messages,
      'system prompt',
      {},
      0,
      agentId,
    );

    const envChangeIdx = result.findIndex(
      (m) =>
        m.role === 'user' &&
        typeof m.content !== 'string' &&
        Array.isArray(m.content) &&
        m.content.some(
          (p) =>
            'text' in p &&
            typeof p.text === 'string' &&
            p.text.includes('<env-changes>'),
        ),
    );
    const assistantIdx = result.findIndex((m) => m.role === 'assistant');

    expect(envChangeIdx).toBeGreaterThan(-1);
    expect(assistantIdx).toBeGreaterThan(-1);
    expect(envChangeIdx).toBeLessThan(assistantIdx);
  });

  it('injects multiple env-changes for multiple snapshot transitions', async () => {
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot({
      browser: {
        tabs: [],
        activeTabHandle: null,
      },
    });
    const snap3 = makeSnapshot({
      browser: {
        tabs: [
          {
            handle: 't_5',
            url: 'https://new.com',
            title: 'New',
          },
        ],
        activeTabHandle: 't_5',
      },
    });
    const messages: AgentMessage[] = [
      makeUserMsg('u1', 'hello', snap1),
      makeAssistantMsg('a1', 'first', snap2),
      makeUserMsg('u2', 'next', snap3),
    ];

    const result = await convertAgentMessagesToModelMessages(
      messages,
      'system prompt',
      {},
      0,
      agentId,
    );

    const envChangeMessages = result.filter(
      (m) =>
        m.role === 'user' &&
        typeof m.content !== 'string' &&
        Array.isArray(m.content) &&
        m.content.some(
          (p) =>
            'text' in p &&
            typeof p.text === 'string' &&
            p.text.includes('<env-changes>'),
        ),
    );
    expect(envChangeMessages).toHaveLength(2);
  });

  it('injects live env-change at the tail when liveSnapshot differs from last message', async () => {
    const snap = makeSnapshot();
    const liveSnap = makeSnapshot({
      workspace: {
        mounts: [],
      },
    });
    const messages: AgentMessage[] = [
      makeUserMsg('u1', 'hello', snap),
      makeAssistantMsg('a1', 'response', snap),
    ];

    const result = await convertAgentMessagesToModelMessages(
      messages,
      'system prompt',
      {},
      0,
      agentId,
      liveSnap,
    );

    const envChangeMessages = result.filter(
      (m) =>
        m.role === 'user' &&
        typeof m.content !== 'string' &&
        Array.isArray(m.content) &&
        m.content.some(
          (p) =>
            'text' in p &&
            typeof p.text === 'string' &&
            p.text.includes('<env-changes>'),
        ),
    );
    expect(envChangeMessages).toHaveLength(1);

    // Verify it's the LAST non-system message
    const lastNonSystem = [...result]
      .reverse()
      .find((m) => m.role !== 'system');
    expect(lastNonSystem).toBeDefined();
    const text = ((lastNonSystem as any).content[0] as { text: string }).text;
    expect(text).toContain('workspace unmounted: w1');
  });

  it('does not inject live env-change when liveSnapshot matches last message', async () => {
    const snap = makeSnapshot();
    const messages: AgentMessage[] = [
      makeUserMsg('u1', 'hello', snap),
      makeAssistantMsg('a1', 'response', snap),
    ];

    const result = await convertAgentMessagesToModelMessages(
      messages,
      'system prompt',
      {},
      0,
      agentId,
      snap,
    );

    const envChangeMessages = result.filter(
      (m) =>
        m.role === 'user' &&
        typeof m.content !== 'string' &&
        Array.isArray(m.content) &&
        m.content.some(
          (p) =>
            'text' in p &&
            typeof p.text === 'string' &&
            p.text.includes('<env-changes>'),
        ),
    );
    expect(envChangeMessages).toHaveLength(0);
  });
});
