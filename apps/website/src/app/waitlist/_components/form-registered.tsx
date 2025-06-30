'use client';

import { useEffect, useState } from 'react';
import { type Subscriber, getSubscriber } from '../api/waitlister-api-utils';

interface FormRegisteredProps {
  email: string;
  subscriberEmail: string;
}

export function FormRegistered({
  email,
  subscriberEmail,
}: FormRegisteredProps) {
  const [data, setData] = useState<Subscriber | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        const subscriber = await getSubscriber(subscriberEmail);
        console.log('SUUBSCRIBER IS', subscriber);

        if (subscriber.data) {
          setData(subscriber.data.subscriber);
        } else {
          setError('Subscriber not found in waitlist');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [subscriberEmail]);

  // Calculate batch number based on position (assuming 50 people per batch)
  const getBatchNumber = (position: number) => Math.ceil(position / 50);

  const getMedal = (position: number) => {
    switch (position) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return '';
    }
  };

  const getMedalColor = (position: number) => {
    switch (position) {
      case 1:
        return 'text-amber-500';
      case 2:
        return 'text-zinc-400';
      case 3:
        return 'text-orange-600';
      default:
        return 'text-zinc-600 dark:text-zinc-400';
    }
  };

  const shareOnTwitter = () => {
    if (!data?.referral_code) return;
    const text = encodeURIComponent(
      '🚀 Join me on the waitlist for @stagewise_io - the AI coding agent that lives in your browser! Get early access here:',
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=https://stagewise.io/waitlist?referral_code=${data.referral_code}`,
      '_blank',
    );
  };

  const shareOnLinkedIn = () => {
    if (!data?.referral_code) return;
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=https://stagewise.io/waitlist?referral_code=${data.referral_code}`,
      '_blank',
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="mb-4 font-bold text-3xl">You're on the List! 🎉</h2>
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-indigo-600 border-b-2" />
          <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">
            Loading your position...
          </span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h2 className="mb-4 font-bold text-3xl">You're on the List! 🎉</h2>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/20">
          <p className="text-red-800 text-sm dark:text-red-300">
            Error loading your waitlist data: {error || 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="mb-4 font-bold text-3xl">You're on the List! 🎉</h2>
      {/* Invitation Link Section */}
      <div className="mt-6 space-y-4">
        <h3 className="font-medium">Share Your Invitation Link</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Each friend who joins using your link moves you up 5 positions!
        </p>

        {/* Copyable Link */}
        <div className="flex gap-2">
          <input
            type="text"
            value={`https://stagewise.io/waitlist?referral_code=${data.referral_code}`}
            readOnly
            className="flex-1 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          />
          <button
            type="button"
            onClick={() => {
              setIsCopied(true);
              setTimeout(() => setIsCopied(false), 2000);
              navigator.clipboard.writeText(
                `https://stagewise.io/waitlist?referral_code=${data.referral_code}`,
              );
            }}
            className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2.5 text-zinc-600 transition-colors hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            aria-label="Copy link"
          >
            {isCopied ? (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Social Share Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={shareOnTwitter}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 font-medium text-sm text-white transition-opacity hover:opacity-90"
          >
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X
          </button>
          <button
            type="button"
            onClick={shareOnLinkedIn}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-4 py-2 font-medium text-sm text-white transition-opacity hover:opacity-90"
          >
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Share on LinkedIn
          </button>
        </div>

        {/* Leaderboard */}
        <div className="mt-8 space-y-2">
          <div className="space-y-1">
            <h3 className="mb-2 font-medium text-sm text-zinc-500">
              Your Position in the Waitlist
            </h3>

            <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-indigo-50/50 px-3 py-2 dark:border-zinc-800 dark:bg-indigo-950/20">
              <div>
                <span
                  className={`flex items-center gap-1 ${getMedalColor(data.position)}`}
                >
                  {getMedal(data.position)} #{data.position}
                  <span className="text-sm text-zinc-500">
                    {' '}
                    (Batch {getBatchNumber(data.position)})
                  </span>
                </span>
                <div className="text-xs text-zinc-500">{email}</div>
              </div>
              <div className="font-medium text-sm text-zinc-600 dark:text-zinc-400">
                {data.points || 0} pts
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
