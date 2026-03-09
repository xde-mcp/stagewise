import type React from 'react';

const faviconOverrides: Record<string, string> = {
  'www.figma.com': 'https://static.figma.com/app/icon/2/favicon.svg',
};

export function getFaviconUrl(siteUrl: string): string {
  const { hostname } = new URL(siteUrl);
  return (
    faviconOverrides[hostname] ??
    `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
  );
}

const _suggestionUrlsLonglist = [
  'https://adaline.ai',
  'https://air.inc',
  'https://amplitude.com',
  'https://attio.com',
  'https://www.anthropic.com',
  'https://app.uniswap.org',
  'https://basecamp.com',
  'https://betterstack.com',
  'https://bolt.new',
  'https://braintrust.dev',
  'https://cal.com',
  'https://chatgpt.com',
  'https://claude.ai',
  'https://clerk.com',
  'https://coda.io',
  'https://cohere.com',
  'https://conversion.ai',
  'https://cursor.com',
  'https://databuddy.cc',
  'https://dub.co',
  'https://discord.com',
  'https://elevenlabs.io',
  'https://equals.com',
  'https://firecrawl.dev',
  'https://frame.io',
  'https://framer.com',
  'https://github.com',
  'https://gitlab.com',
  'https://gumroad.com',
  'https://hex.tech',
  'https://incident.io',
  'https://jitter.video',
  'https://linear.app',
  'https://lovable.dev',
  'https://loops.so',
  'https://lumalabs.ai',
  'https://mintlify.com',
  'https://mistral.ai',
  'https://n8n.io',
  'https://news.ycombinator.com',
  'https://openai.com',
  'https://pitch.com',
  'https://plane.so',
  'https://planetscale.com',
  'https://posthog.com',
  'https://producthunt.com',
  'https://proto.xyz',
  'https://react.email',
  'https://render.com',
  'https://replit.com',
  'https://retool.com',
  'https://rive.app',
  'https://runwayml.com',
  'https://sentry.io',
  'https://slack.com',
  'https://stripe.com',
  'https://supabase.com',
  'https://superhuman.com',
  'https://tailscale.com',
  'https://tailwindcss.com',
  'https://v0.dev',
  'https://vercel.com',
  'https://www.1password.com',
  'https://www.airbnb.com',
  'https://www.airtable.com',
  'https://www.apple.com',
  'https://www.asana.com',
  'https://www.behance.net',
  'https://www.canva.com',
  'https://www.cloudflare.com',
  'https://www.coinbase.com',
  'https://www.craft.do',
  'https://www.databricks.com',
  'https://www.descript.com',
  'https://www.dropbox.com',
  'https://www.figma.com',
  'https://www.framer.com',
  'https://www.gitbook.com',
  'https://www.grammarly.com',
  'https://www.hubspot.com',
  'https://www.intercom.com',
  'https://www.loom.com',
  'https://www.miro.com',
  'https://www.midjourney.com/home',
  'https://www.notion.so',
  'https://www.postman.com',
  'https://www.shopify.com',
  'https://www.sketch.com',
  'https://www.spline.design',
  'https://www.stripe.com',
  'https://www.substack.com',
  'https://www.typeform.com',
  'https://zapier.com',
];

export type SuggestionOrigin = {
  url: string;
  faviconUrl: string;
};

export type SuggestionItem = {
  id: string;
  prompt: string;
  suggestion: string | React.ReactNode;
  origin: SuggestionOrigin;
};

type SuggestionVariation = {
  display: string;
  prompt: string;
};

type SuggestionCategory = {
  id: string;
  variations: SuggestionVariation[];
  urls: string[];
};

const categories: SuggestionCategory[] = [
  {
    id: 'fonts',
    variations: [
      {
        display: 'Show the fonts of {origin}',
        prompt:
          'Show the fonts of {origin} in a mini-app with samples at different weights.',
      },
      {
        display: 'Visualize the fonts used by {origin}',
        prompt:
          'Visualize the fonts used by {origin} in a mini-app with font family details.',
      },
      {
        display: 'What fonts does {origin} use?',
        prompt:
          'What fonts does {origin} use? Show a few examples in a mini-app with previews.',
      },
    ],
    urls: [
      'https://www.apple.com',
      'https://www.airbnb.com',
      'https://stripe.com',
      'https://linear.app',
      'https://superhuman.com',
      'https://www.notion.so',
    ],
  },
  {
    id: 'color-palette',
    variations: [
      {
        display: 'Visualize the color palette of {origin}',
        prompt:
          'Visualize the color palette of {origin} in a mini-app with hex values and swatches.',
      },
      {
        display: 'Show the design tokens of {origin}',
        prompt:
          'Show the design tokens of {origin} in a mini-app with color, spacing, and type scales.',
      },
      {
        display: 'Map the brand colors of {origin}',
        prompt:
          'Map the brand colors of {origin} in a mini-app with primary, secondary, and accent colors.',
      },
    ],
    urls: [
      'https://stripe.com',
      'https://linear.app',
      'https://supabase.com',
      'https://vercel.com',
      'https://posthog.com',
      'https://www.figma.com',
      'https://adaline.ai',
      'https://air.inc',
      'https://app.uniswap.org',
      'https://claude.ai',
      'https://www.anthropic.com',
      'https://firecrawl.dev',
      'https://sentry.io',
      'https://n8n.io',
    ],
  },
  {
    id: 'buttons',
    variations: [
      {
        display: 'Extract the primary button from {origin}',
        prompt:
          'Extract the primary button from {origin} and show it as a reusable component in a mini-app.',
      },
      {
        display: 'Build a component for the buttons of {origin}',
        prompt:
          'Build a component for the buttons of {origin} and show all variants in a mini-app.',
      },
      {
        display: 'Rebuild the primary button of {origin}',
        prompt:
          'Rebuild the primary button of {origin} with matching styles in a mini-app.',
      },
    ],
    urls: [
      'https://posthog.com',
      'https://linear.app',
      'https://supabase.com',
      'https://github.com',
      'https://vercel.com',
      'https://www.shopify.com',
      'https://n8n.io',
      'https://air.inc',
      'https://adaline.ai',
      'https://app.uniswap.org',
      'https://attio.com',
      'https://claude.ai',
      'https://cal.com',
      'https://www.notion.so',
    ],
  },
  {
    id: 'social-previews',
    variations: [
      {
        display: 'Analyze the social previews of {origin}',
        prompt:
          'Analyze the social previews of {origin} and show the previews in a mini-app.',
      },
      {
        display: 'Show the social link previews of {origin}',
        prompt:
          'Show the social link previews of {origin} as they appear on Twitter, Slack, and iMessage in a mini-app.',
      },
      {
        display: 'Preview the OG tags of {origin}',
        prompt:
          'Preview the OG tags of {origin} and show how they render across platforms in a mini-app.',
      },
    ],
    urls: [
      'https://news.ycombinator.com',
      'https://producthunt.com',
      'https://github.com',
      'https://openai.com',
      'https://vercel.com',
      'https://attio.com',
      'https://cursor.com',
      'https://cal.com',
      'https://discord.com',
      'https://framer.com',
      'https://linear.app',
      'https://lovable.dev',
      'https://n8n.io',
      'https://planetscale.com',
      'https://posthog.com',
      'https://sentry.io',
      'https://slack.com',
      'https://www.substack.com',
    ],
  },
  {
    id: 'screenshot',
    variations: [
      {
        display: 'Create a demo-screenshot of {origin}',
        prompt:
          'Create a polished demo-screenshot of {origin} and show a preview in the chat.',
      },
      {
        display: 'Capture a screenshot of {origin}',
        prompt:
          'Capture a clean screenshot of {origin} and show a preview in the chat.',
      },
    ],
    urls: [
      'https://www.apple.com',
      'https://www.airbnb.com',
      'https://stripe.com',
      'https://framer.com',
      'https://www.midjourney.com/home',
      'https://n8n.io',
      'https://air.inc',
      'https://adaline.ai',
      'https://app.uniswap.org',
      'https://attio.com',
      'https://claude.ai',
      'https://cal.com',
      'https://posthog.com',
      'https://supabase.com',
      'https://www.notion.so',
    ],
  },
  {
    id: 'accessibility',
    variations: [
      {
        display: 'Run an accessibility check on {origin}',
        prompt:
          'Run an accessibility check on {origin} and overlay the violations on the tab.',
      },
      {
        display: 'Visualize accessibility violations on {origin}',
        prompt:
          'Visualize accessibility violations on {origin} as an overlay on the tab.',
      },
    ],
    urls: [
      'https://www.airbnb.com',
      'https://github.com',
      'https://www.notion.so',
      'https://www.shopify.com',
      'https://www.dropbox.com',
      'https://basecamp.com',
      'https://cal.com',
      'https://claude.ai',
      'https://chatgpt.com',
      'https://openai.com',
      'https://www.anthropic.com',
      'https://discord.com',
      'https://news.ycombinator.com',
      'https://posthog.com',
      'https://producthunt.com',
      'https://stripe.com',
      'https://supabase.com',
      'https://vercel.com',
      'https://v0.dev',
      'https://www.substack.com',
    ],
  },
  {
    id: 'dom-complexity',
    variations: [
      {
        display: 'Show the DOM complexity of {origin}',
        prompt:
          'Show the DOM complexity of {origin} in a mini-app with node counts and depth.',
      },
      {
        display: 'Visualize the DOM complexity of {origin}',
        prompt:
          'Visualize the DOM complexity of {origin} in a mini-app with node counts and depth.',
      },
    ],
    urls: [
      'https://www.apple.com',
      'https://www.notion.so',
      'https://www.figma.com',
      'https://www.airtable.com',
      'https://www.miro.com',
      'https://basecamp.com',
      'https://cal.com',
      'https://claude.ai',
      'https://chatgpt.com',
      'https://openai.com',
      'https://www.anthropic.com',
      'https://discord.com',
      'https://github.com',
      'https://news.ycombinator.com',
      'https://posthog.com',
      'https://producthunt.com',
      'https://stripe.com',
      'https://supabase.com',
      'https://vercel.com',
      'https://v0.dev',
      'https://www.shopify.com',
      'https://www.substack.com',
    ],
  },
  {
    id: 'icon-library',
    variations: [
      {
        display: 'Which icon library does {origin} use?',
        prompt:
          'Which icon library does {origin} use? Show a few examples in a mini-app.',
      },
      {
        display: 'Identify the icons used by {origin}',
        prompt:
          'Identify the icons used by {origin} and display a few examples in a mini-app.',
      },
    ],
    urls: [
      'https://cursor.com',
      'https://linear.app',
      'https://www.notion.so',
      'https://github.com',
      'https://www.figma.com',
      'https://slack.com',
      'https://n8n.io',
      'https://claude.ai',
      'https://openai.com',
      'https://chatgpt.com',
      'https://react.email',
      'https://cal.com',
      'https://stripe.com',
      'https://superhuman.com',
      'https://www.hubspot.com',
      'https://www.anthropic.com',
    ],
  },
];

function buildSuggestionJSX(
  before: string,
  hostname: string,
  after: string,
): React.ReactNode {
  return (
    <span className="font-normal">
      {before}
      <span className="font-medium text-primary-foreground group-hover/suggestion:text-hover-derived">
        {hostname}
      </span>
      {after}
    </span>
  );
}

function generateSuggestions(): SuggestionItem[] {
  const items: SuggestionItem[] = [];

  for (const category of categories) {
    for (const url of category.urls) {
      const { hostname } = new URL(url);
      const displayHost = hostname.replace(/^www\./, '');
      const variation =
        category.variations[
          Math.floor(Math.random() * category.variations.length)
        ];

      const prompt = variation.prompt.replace('{origin}', displayHost);
      const placeholderIdx = variation.display.indexOf('{origin}');
      const before = variation.display.slice(0, placeholderIdx);
      const after = variation.display.slice(placeholderIdx + '{origin}'.length);

      items.push({
        id: `${category.id}-${displayHost}`,
        prompt,
        suggestion: buildSuggestionJSX(before, displayHost, after),
        origin: {
          url,
          faviconUrl: getFaviconUrl(url),
        },
      });
    }
  }

  return items;
}

export const suggestions: SuggestionItem[] = generateSuggestions();
