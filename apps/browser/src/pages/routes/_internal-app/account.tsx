import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@stagewise/stage-ui/components/button';
import { Input } from '@stagewise/stage-ui/components/input';
import { InputOtp } from '@stagewise/stage-ui/components/input-otp';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import { useState, useCallback, useRef, useEffect } from 'react';

export const Route = createFileRoute('/_internal-app/account')({
  component: Page,
  head: () => ({
    meta: [
      {
        title: 'Account',
      },
    ],
  }),
});

type AuthPhase = 'form-input' | 'waiting-for-otp';

function Page() {
  const userAccount = useKartonState((s) => s.userAccount);
  const sendOtp = useKartonProcedure((p) => p.sendOtp);
  const verifyOtp = useKartonProcedure((p) => p.verifyOtp);
  const logout = useKartonProcedure((p) => p.logout);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex flex-col items-center border-border-subtle border-b px-6 py-4">
        <div className="w-full max-w-3xl">
          <h1 className="font-semibold text-foreground text-xl">Account</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex w-full flex-1 flex-col items-center overflow-y-auto p-6">
        <div className="flex w-full max-w-3xl shrink-0 flex-col gap-8">
          {userAccount?.status === 'authenticated' ? (
            <AuthenticatedView
              email={userAccount.user?.email}
              subscription={userAccount.subscription}
              machineId={userAccount.machineId}
              onLogout={() => void logout()}
            />
          ) : (
            <LoginView sendOtp={sendOtp} verifyOtp={verifyOtp} />
          )}
        </div>
      </div>
    </div>
  );
}

function AuthenticatedView({
  email,
  subscription,
  machineId,
  onLogout,
}: {
  email?: string;
  subscription?: {
    active: boolean;
    plan?: string;
    expiresAt?: string;
  };
  machineId?: string;
  onLogout: () => void;
}) {
  return (
    <>
      {/* User info */}
      <div className="flex flex-col gap-2">
        <h2 className="font-medium text-foreground text-lg">
          {email ?? 'Unknown user'}
        </h2>
        <p className="text-muted-foreground text-sm">Signed in</p>
      </div>

      <hr className="border-border-subtle" />

      {/* Account details */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-y-3">
          <div className="grid grid-cols-[140px_1fr] gap-x-4">
            <span className="font-medium text-muted-foreground text-sm">
              Email
            </span>
            <span className="break-all text-foreground text-sm">{email}</span>
          </div>

          {subscription && (
            <>
              <div className="grid grid-cols-[140px_1fr] gap-x-4">
                <span className="font-medium text-muted-foreground text-sm">
                  Plan
                </span>
                <span className="text-foreground text-sm capitalize">
                  {subscription.plan ?? 'Free'}
                </span>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-x-4">
                <span className="font-medium text-muted-foreground text-sm">
                  Status
                </span>
                <span className="text-foreground text-sm">
                  {subscription.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {subscription.expiresAt && (
                <div className="grid grid-cols-[140px_1fr] gap-x-4">
                  <span className="font-medium text-muted-foreground text-sm">
                    Expires
                  </span>
                  <span className="text-foreground text-sm">
                    {new Date(subscription.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </>
          )}

          {machineId && (
            <div className="grid grid-cols-[140px_1fr] gap-x-4">
              <span className="font-medium text-muted-foreground text-sm">
                Machine ID
              </span>
              <span className="break-all font-mono text-foreground text-sm">
                {machineId}
              </span>
            </div>
          )}
        </div>
      </div>

      <hr className="border-border-subtle" />

      {/* Sign out */}
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={onLogout}>
          Sign out
        </Button>
      </div>
    </>
  );
}

function LoginView({
  sendOtp,
  verifyOtp,
}: {
  sendOtp: (email: string) => Promise<{ error?: string }>;
  verifyOtp: (email: string, code: string) => Promise<{ error?: string }>;
}) {
  const [phase, setPhase] = useState<AuthPhase>('form-input');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === 'form-input') emailRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (phase === 'waiting-for-otp') otpRef.current?.focus();
  }, [phase]);

  const handleSendOtp = useCallback(async () => {
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const result = await sendOtp(email.trim());
      if (result?.error) setError(result.error);
      else setPhase('waiting-for-otp');
    } catch {
      setError('Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  }, [email, sendOtp]);

  const handleVerifyOtp = useCallback(async () => {
    if (!code.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const result = await verifyOtp(email.trim(), code.trim());
      if (result?.error) setError(result.error);
      // On success, the auth state change callback will update userAccount
      // and the parent component will switch to AuthenticatedView
    } catch {
      setError('Failed to verify code.');
    } finally {
      setLoading(false);
    }
  }, [email, code, verifyOtp]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="font-medium text-foreground text-lg">Authenticate</h2>
        {phase === 'form-input' && (
          <p className="text-muted-foreground text-sm">
            Get access to the latest models with stagewise.
          </p>
        )}
        {phase === 'waiting-for-otp' && (
          <p className="text-muted-foreground text-sm">
            We sent a code to{' '}
            <span className="font-medium text-foreground">{email}</span>.
          </p>
        )}
      </div>

      <hr className="border-border-subtle" />

      {phase === 'form-input' && (
        <div className="flex max-w-sm flex-col gap-4">
          <div className="flex gap-2">
            <Input
              ref={emailRef}
              placeholder="you@example.com"
              size="sm"
              type="email"
              value={email}
              onValueChange={(v) => setEmail(v)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSendOtp();
              }}
              disabled={loading}
            />
            <Button
              variant="primary"
              size="sm"
              className="shrink-0"
              onClick={() => void handleSendOtp()}
              disabled={loading || !email.trim()}
            >
              Sign in
            </Button>
          </div>
        </div>
      )}

      {phase === 'waiting-for-otp' && (
        <div className="flex flex-col items-start gap-4">
          <div className="flex items-center gap-2">
            <InputOtp
              ref={otpRef}
              length={6}
              size="sm"
              value={code}
              onChange={(val) => setCode(val)}
              onComplete={() => void handleVerifyOtp()}
              disabled={loading}
            />
            <Button
              variant="primary"
              size="sm"
              className="shrink-0"
              onClick={() => void handleVerifyOtp()}
              disabled={loading || code.length < 6}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setPhase('form-input');
              setCode('');
              setError(null);
            }}
          >
            Use a different email
          </Button>
        </div>
      )}

      {error && <p className="text-error-foreground text-sm">{error}</p>}
    </>
  );
}
