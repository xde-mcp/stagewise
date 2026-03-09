import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { PostHogProvider as PostHogProviderOriginal } from 'posthog-js/react';
import posthog from 'posthog-js';
import { useKartonState } from './use-karton';

interface PostHogProviderProps {
  children: ReactNode;
}

/**
 * Custom PostHog provider wrapper that integrates with karton state.
 * This must be used inside KartonProvider to have access to karton state.
 */
export function PostHogProvider({ children }: PostHogProviderProps) {
  const internalData = useKartonState((s) => s.internalData);
  const userAccount = useKartonState((s) => s.userAccount);
  const globalConfig = useKartonState((s) => s.globalConfig);

  // Add custom logic based on karton state
  useEffect(() => {
    if (!posthog) return;
    const telemetryLevel = globalConfig.telemetryLevel;
    if (
      telemetryLevel === 'off' ||
      (import.meta.env.NODE_ENV === 'development' &&
        import.meta.env.VITE_DISABLE_TELEMETRY === 'true')
    ) {
      try {
        posthog.stopSessionRecording();
        posthog.consent.optInOut(false);
        posthog.opt_out_capturing();
      } catch (_e) {}
      return;
    }

    // Set user properties based on karton state
    if (userAccount?.user && internalData.posthog?.apiKey) {
      posthog.init(internalData.posthog?.apiKey, {
        before_send: (event) => {
          // Filter out user app errors - only capture toolbar errors
          if (!event) return null; // Reject the event
          return event;
        },
        disable_session_recording: telemetryLevel !== 'full',
        autocapture: true,
        api_host: internalData.posthog?.host,
        ui_host: 'https://eu.posthog.com',
        capture_pageview: false, // We capture pageviews manually
        capture_pageleave: true, // Enable pageleave capture
        debug: import.meta.env.NODE_ENV === 'development',
        session_recording: {
          compress_events: true,
          recordCrossOriginIframes: false,
          recordHeaders: false,
        },
      });
      posthog.consent.optInOut(true);
      posthog.opt_in_capturing();
    }
  }, [userAccount, globalConfig]);

  useEffect(() => {
    const telemetryLevel = globalConfig.telemetryLevel;

    if (
      telemetryLevel === 'full' &&
      userAccount?.user?.id &&
      (!posthog._isIdentified() ||
        posthog.get_distinct_id() !== userAccount.user.id)
    ) {
      if (posthog._isIdentified()) posthog.reset();

      posthog.identify(userAccount.user.id, {
        telemetryLevel: globalConfig.telemetryLevel,
        email: userAccount.user.email,
        machineId: userAccount.machineId,
      });
      if (userAccount?.user?.id && userAccount?.machineId)
        posthog.alias(userAccount.user.id, userAccount.machineId);
    }
  }, [globalConfig, userAccount]);

  return (
    <PostHogProviderOriginal client={posthog}>
      {children}
    </PostHogProviderOriginal>
  );
}
