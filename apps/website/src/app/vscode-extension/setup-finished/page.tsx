'use client';

import LogoWhite from '@/app/logo-white.svg';
import Image from 'next/image';
import { useCallback, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@stagewise/ui/components/dialog';

export default function SetupFinishedPage() {
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackType, setFeedbackType] = useState<
    'positive' | 'negative' | null
  >(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false);

  const _handleShowRepo = useCallback(() => {
    window.parent.postMessage({ command: 'showRepo' }, '*');
  }, []);

  const handleFeedback = useCallback((type: 'positive' | 'negative') => {
    setFeedbackType(type);
    setShowFeedbackDialog(true);
  }, []);

  const handleSubmitFeedback = useCallback(() => {
    if (feedbackType) {
      window.parent.postMessage(
        {
          command: 'captureFeedback',
          data: {
            type: feedbackType,
            text: feedbackText,
            email: feedbackEmail,
          },
        },
        '*',
      );
      setShowFeedbackDialog(false);
      setFeedbackText('');
      setFeedbackEmail('');
      setFeedbackType(null);
      setHasSubmittedFeedback(true);
    }
  }, [feedbackType, feedbackText, feedbackEmail]);

  const handleDismissPanel = useCallback(() => {
    window.parent.postMessage({ command: 'dismissPanel' }, '*');
  }, []);

  return (
    <main className="flex min-h-screen w-screen flex-col items-center justify-center gap-8 bg-neutral-900 p-8">
      <Image src={LogoWhite} alt="stagewise" className="w-48" />

      <div className="text-center">
        <h1 className="mb-4 font-bold text-4xl text-white">
          Setup Complete! 🎉
        </h1>
        <p className="mb-8 max-w-2xl text-zinc-400">
          Congratulations! Your stagewise toolbar has been successfully set up.
          You can now start using it to enhance your development workflow.
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <div className="flex flex-col gap-6 rounded-lg border border-neutral-700 bg-neutral-800/50 p-8">
          <div className="text-center">
            <h2 className="mb-2 font-bold text-2xl text-white">
              Share your feedback
            </h2>
            <p className="text-zinc-400">
              If you find stagewise helpful, consider sharing your feedback to
              help us improve.
            </p>
          </div>

          {hasSubmittedFeedback ? (
            <div className="py-4 text-center">
              <p className="font-medium text-emerald-400">
                Thank you for your feedback!
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex gap-4">
                <button
                  type="button"
                  className="flex-1 cursor-pointer rounded-lg bg-emerald-700/50 px-6 py-3 font-medium text-emerald-300 transition-colors hover:bg-emerald-700/70"
                  onClick={() => handleFeedback('positive')}
                >
                  👍 Good Experience
                </button>
                <button
                  type="button"
                  className="flex-1 cursor-pointer rounded-lg bg-rose-700/50 px-6 py-3 font-medium text-rose-300 transition-colors hover:bg-rose-700/70"
                  onClick={() => handleFeedback('negative')}
                >
                  👎 Needs Improvement
                </button>
              </div>
              <p className="p-4 text-zinc-400">
                <span className="p-2 font-medium">Didn&apos;t work?</span>
                <a
                  href="https://discord.gg/gkdGsDYaKA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-blue-300 transition-colors hover:text-blue-200 hover:underline"
                >
                  💬 Get help on Discord
                </a>
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="border-neutral-700 bg-neutral-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              {feedbackType === 'positive'
                ? 'What do you want to tell us?'
                : 'What could we improve?'}
            </DialogTitle>
          </DialogHeader>
          <textarea
            className="h-32 w-full resize-none rounded-lg bg-neutral-700 p-4 text-white"
            placeholder="I wish there was a way to... (optional)"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
          />
          <input
            type="email"
            className="w-full rounded-lg bg-neutral-700 p-4 text-white"
            placeholder="Your email (optional)"
            value={feedbackEmail}
            onChange={(e) => setFeedbackEmail(e.target.value)}
          />
          <DialogFooter>
            <button
              type="button"
              className="px-4 py-2 text-zinc-400 hover:text-white"
              onClick={() => setShowFeedbackDialog(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
              onClick={handleSubmitFeedback}
            >
              Submit Feedback
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <button
        type="button"
        className="text-sm text-zinc-500 transition-colors hover:text-zinc-400"
        onClick={handleDismissPanel}
      >
        Close this window
      </button>
    </main>
  );
}
