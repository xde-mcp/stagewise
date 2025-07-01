'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import {
  signUpSubscriber,
  listSubscribers,
  type Subscriber,
  getSubscriber,
} from '../api/waitlister-api-utils';
import { getMedal, getMedalColor } from '../_utils/leaderboard-helpers';

// Define the validation schema
const waitlistSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

interface WaitlistFormData {
  email: string;
}

interface FormUnregisteredProps {
  formData: WaitlistFormData;
  setFormData: React.Dispatch<React.SetStateAction<WaitlistFormData>>;
  onRegistrationSuccess: (email: string) => void;
}

export function FormUnregistered({
  formData,
  setFormData,
  onRegistrationSuccess,
}: FormUnregisteredProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useSearchParams();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [totalSubscribers, setTotalSubscribers] = useState(0);

  useEffect(() => {
    const fetchSubscriber = async () => {
      const email = localStorage.getItem('stagewise_waitlist_email');
      if (email) {
        const subscriber = await getSubscriber(email);
        if (!subscriber.data) return;
        setFormData({
          email,
        });
        onRegistrationSuccess(email);
      }
    };
    fetchSubscriber();
  }, []);

  useEffect(() => {
    const fetchSubscribers = async () => {
      const subscribers = await listSubscribers({
        sort_by: 'position',
        sort_dir: 'asc',
        limit: 10,
      });
      if (subscribers.success) {
        setSubscribers(subscribers.data?.subscribers || []);
        setTotalSubscribers(subscribers.data?.total || 0);
      }
    };
    fetchSubscribers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      // Client-side validation
      const validatedData = waitlistSchema.parse(formData);

      // Extract referral code from URL if present
      const referralCode = searchParams.get('referral_code');
      const metadata = referralCode ? { referred_by: referralCode } : {};

      const result = await signUpSubscriber({
        email: validatedData.email,
        metadata,
      });

      if (!result.success) {
        setErrors({
          general: result.error.message,
        });
        return;
      }

      // Save email to localStorage for future reference
      localStorage.setItem('stagewise_waitlist_email', validatedData.email);

      // Add waitlist signup logic here
      onRegistrationSuccess(validatedData.email);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        setErrors({ general: 'An unexpected error occurred' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-8">
        <h2 className="mb-4 font-bold text-3xl">Reserve Your Spot</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Limited spots available for our beta launch.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="flex-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Email Address"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              className={`w-full rounded-lg border ${
                errors.email
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-zinc-200 focus:border-indigo-500 focus:ring-indigo-500/20'
              } bg-white/50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white dark:placeholder:text-zinc-400`}
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            <div className={`mt-1 min-h-[0px] ${errors.email ? 'mb-1' : ''}`}>
              {errors.email && (
                <p
                  id="email-error"
                  className="text-red-500 text-sm dark:text-red-400"
                >
                  {errors.email}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start">
          <button
            type="submit"
            disabled={isSubmitting}
            className="whitespace-nowrap rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 font-medium text-sm text-white transition-all hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:from-blue-500 dark:to-indigo-500 dark:hover:from-blue-600 dark:hover:to-indigo-600"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Joining...
              </div>
            ) : (
              'Join the Waitlist'
            )}
          </button>
        </div>
      </form>

      {errors.general && (
        <p className="text-red-500 text-sm dark:text-red-400">
          {errors.general}
        </p>
      )}

      <div className="mt-4 flex items-center justify-center">
        <div className="-space-x-2 flex">
          <div className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-indigo-400 to-purple-400 dark:border-zinc-900" />
          <div className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-blue-400 to-cyan-400 dark:border-zinc-900" />
          <div className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-emerald-400 to-teal-400 dark:border-zinc-900" />
          <div className="flex h-8 w-auto items-center justify-center rounded-full border-2 border-white bg-zinc-100 px-2 font-medium text-xs text-zinc-600 dark:border-zinc-900 dark:bg-zinc-800 dark:text-zinc-400">
            +{Math.max(0, totalSubscribers - 3)}
          </div>
        </div>
        <span className="ml-3 text-sm text-zinc-500">
          {totalSubscribers} people on the waitlist
        </span>
      </div>

      {/* Leaderboard */}
      {subscribers.length > 0 && (
        <div className="mt-8 space-y-2">
          <h3 className="font-medium text-sm text-zinc-500">
            Top Waitlist Members
          </h3>
          <div className="space-y-1">
            {subscribers.slice(0, 3).map((subscriber, _index) => {
              return (
                <div
                  key={subscriber.id}
                  className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <div>
                    <span className={getMedalColor(subscriber.position)}>
                      {getMedal(subscriber.position)} #{subscriber.position}
                    </span>
                    <div className="text-xs text-zinc-500">
                      {subscriber.email}
                    </div>
                  </div>
                  <div className="font-medium text-sm text-zinc-600 dark:text-zinc-400">
                    {subscriber.points} pts
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
