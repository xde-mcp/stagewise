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
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false);

  const handleShowRepo = useCallback(() => {
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
          },
        },
        '*',
      );
      setShowFeedbackDialog(false);
      setFeedbackText('');
      setFeedbackType(null);
      setHasSubmittedFeedback(true);
    }
  }, [feedbackType, feedbackText]);

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
        <div className="mx-auto max-w-2xl rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
          <p className="text-blue-300 text-sm">
            To start using stagewise, launch your application in development
            mode. The toolbar will automatically appear in your browser.
          </p>
        </div>
      </div>

      <div className="w-full max-w-2xl">
        <div className="flex flex-col gap-6 rounded-lg border border-neutral-700 bg-neutral-800/50 p-8">
          <div className="text-center">
            <h2 className="mb-2 font-bold text-2xl text-white">Support Us</h2>
            <p className="text-zinc-400">
              If you find stagewise helpful, consider giving us a star on GitHub
              or sharing your feedback to help us improve.
            </p>
          </div>

          <button
            type="button"
            className="relative cursor-pointer rounded-lg bg-zinc-700 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-600"
            onClick={handleShowRepo}
          >
            ⭐ Star on GitHub
          </button>

          {hasSubmittedFeedback ? (
            <div className="py-4 text-center">
              <p className="font-medium text-emerald-400">
                Thank you for your feedback!
              </p>
            </div>
          ) : (
            <div className="text-center">
              <h3 className="mb-4 font-medium text-lg text-white">
                How was your setup experience?
              </h3>
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
            </div>
          )}
        </div>
      </div>

      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="border-neutral-700 bg-neutral-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              {feedbackType === 'positive'
                ? 'What went well?'
                : 'What could be improved?'}
            </DialogTitle>
          </DialogHeader>
          <textarea
            className="h-32 w-full resize-none rounded-lg bg-neutral-700 p-4 text-white"
            placeholder="Share your thoughts (optional)"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
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
