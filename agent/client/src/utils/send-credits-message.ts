import { CustomAgentMessageId } from '@stagewise/karton-contract';
import type { ChatMessage, KartonContract } from '@stagewise/karton-contract';
import type { KartonServer } from '@stagewise/karton/server';

const CONSOLE_URL = process.env.STAGEWISE_CONSOLE_URL;

const addExtraCreditsMessage: ChatMessage = {
  id: CustomAgentMessageId.INSUFFICIENT_CREDITS,
  role: 'assistant',
  metadata: {
    createdAt: new Date(),
  },
  parts: [
    {
      type: 'text',
      text: `Oh no, you ran out of credits! You can [buy extra credits here](${CONSOLE_URL}/billing/checkout-extra-credits) so we can continue our session.`,
    },
  ],
};

const addSubscriptionMessage: ChatMessage = {
  id: CustomAgentMessageId.INSUFFICIENT_CREDITS,
  role: 'assistant',
  metadata: {
    createdAt: new Date(),
  },
  parts: [
    {
      type: 'text',
      text: `Whoops! You ran out of credits. Let's upgrade your subscription so we can continue our session. You can [upgrade your subscription here](${CONSOLE_URL}/billing/checkout) 😁`,
    },
  ],
};

export function sendCreditsMessage(karton: KartonServer<KartonContract>) {
  const activeChat = karton.state.chats[karton.state.activeChatId!];
  const subscription = karton.state.subscription;
  if (!activeChat) return;

  let message: ChatMessage;

  switch (subscription?.subscription?.status) {
    case 'active':
      message = addExtraCreditsMessage;
      break;
    case 'unpaid':
    case 'incomplete':
    case 'canceled':
    case 'incomplete_expired':
    case 'past_due':
    case 'paused':
    case 'trialing':
    default:
      message = addSubscriptionMessage;
      break;
  }

  if (
    karton.state.chats[karton.state.activeChatId!]!.messages.find(
      (m) => m.id === CustomAgentMessageId.INSUFFICIENT_CREDITS,
    )
  )
    return;

  karton.setState((draft) => {
    draft.chats[karton.state.activeChatId!]!.messages.push(
      message as any, // TODO: find the cause of this type error - seems like an immer issue
    );
  });
}
