import type React from 'react';

export type SuggestionItem = {
  prompt: string;
  suggestion: string | React.ReactNode;
  faviconUrl: string;
  url: string;
};

export const suggestions: SuggestionItem[] = [
  {
    prompt:
      'You are looking at airbnb.com. Please inspect the page to find out how their icons work, and provide a simple explanation. If possible, find and focus on a specific, interesting icon that you could clone and use in my own application.',
    suggestion: (
      <span className="font-normal">
        How do{' '}
        <span className="font-medium text-primary-foreground group-hover/suggestion:text-hover-derived">
          airbnb.com
        </span>{' '}
        icons work?
      </span>
    ),
    faviconUrl: 'https://airbnb.com/favicon.ico',
    url: 'https://airbnb.com',
  },
  {
    prompt:
      'You are looking at reflect.app. Please inspect the page to find out how their glow effect works, and extract all the necessary styles you need to replicate it 1:1 in my own application.',
    suggestion: (
      <span className="font-normal">
        Take the glow effect from{' '}
        <span className="font-medium text-primary-foreground group-hover/suggestion:text-hover-derived">
          reflect.app
        </span>
      </span>
    ),
    faviconUrl: 'https://reflect.app/favicon.ico',
    url: 'https://reflect.app',
  },
  {
    prompt:
      'You are looking at react.email. Please inspect the page to find out how their frosted glass effect works, and extract all the necessary styles you need to replicate it 1:1 in my own application.',
    suggestion: (
      <span className="font-normal">
        Copy the glass effect from{' '}
        <span className="font-medium text-primary-foreground group-hover/suggestion:text-hover-derived">
          react.email
        </span>{' '}
      </span>
    ),
    faviconUrl: 'https://react.email/meta/favicon.ico',
    url: 'https://react.email',
  },
  {
    prompt:
      'You are looking at posthog.com. Please inspect the page to find out exactly what their button looks like, and extract all the necessary styles and animations you need to make the button in our application look and behave exactly like it.',
    suggestion: (
      <span className="font-normal">
        Make our button look like{' '}
        <span className="font-medium text-primary-foreground group-hover/suggestion:text-hover-derived">
          posthog.com
        </span>
      </span>
    ),
    faviconUrl: 'https://posthog.com/favicon-32x32.png',
    url: 'https://posthog.com',
  },
  {
    prompt:
      'You are looking at cursor.com. Please inspect the page to find out what their color theme is, and provide a concise summary of the colors and their usage, so I can learn something from it for my own application.',
    suggestion: (
      <span className="font-normal">
        What's the theme of{' '}
        <span className="font-medium text-primary-foreground group-hover/suggestion:text-hover-derived">
          cursor.com
        </span>
        ?
      </span>
    ),
    faviconUrl: 'https://cursor.com/favicon.ico',
    url: 'https://cursor.com',
  },
];
