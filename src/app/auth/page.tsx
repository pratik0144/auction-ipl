'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';

type AuthMode = 'signin' | 'signup';

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
const DEV_PASSWORD = '123789';
const DEV_ACCOUNTS = [
  'test@test.com',
  'test@test1.com',
  'test@test2.com',
  'test@test3.com',
];

export default function AuthPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If user is already signed in, redirect to /rooms
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/rooms');
    }
  }, [authLoading, user, router]);

  if (!authLoading && user) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
    }

    // Auth state change listener in AuthProvider will update context.
    // Redirect to rooms.
    router.replace('/rooms');
  }

  /** Dev-only: sign up (if needed) then sign in with test credentials */
  async function handleDevLogin(devEmail: string) {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // Try sign in first
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: devEmail,
      password: DEV_PASSWORD,
    });

    if (signInErr) {
      // Account doesn't exist yet — create it
      const { error: signUpErr } = await supabase.auth.signUp({
        email: devEmail,
        password: DEV_PASSWORD,
      });
      if (signUpErr) {
        setError(signUpErr.message);
        setLoading(false);
        return;
      }
    }

    router.replace('/rooms');
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-16 h-16 rounded-full skeleton" />
          <div className="w-48 h-4 skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted hover:text-chalk transition-colors mb-6"
        >
          ← Back
        </Link>

        <div className="card">
          {/* Header */}
          <div className="text-center mb-6">
            <span className="text-2xl">🏏</span>
            <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] mt-2">
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-muted text-sm mt-1">
              {mode === 'signin'
                ? 'Sign in to your auction account'
                : 'Sign up to start bidding'}
            </p>
          </div>

          {/* Dev quick login */}
          {IS_DEV && (
            <div className="flex flex-col gap-2 mb-4">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Dev Quick Login (pw: 123789)</p>
              <div className="grid grid-cols-2 gap-2">
                {DEV_ACCOUNTS.map((devEmail) => (
                  <button
                    key={devEmail}
                    type="button"
                    onClick={() => handleDevLogin(devEmail)}
                    disabled={loading}
                    className="px-2 py-2 rounded-md bg-amber/10 border border-amber/25 text-amber text-xs font-mono hover:bg-amber/20 transition-colors truncate"
                  >
                    {devEmail.split('@')[0]}@{devEmail.split('@')[1]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-surface-raised rounded-lg mb-6">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); }}
              className={`py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'signin'
                  ? 'bg-chalk text-void'
                  : 'text-muted hover:text-chalk'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
              className={`py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'signup'
                  ? 'bg-chalk text-void'
                  : 'text-muted hover:text-chalk'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-body">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-3 py-2.5 bg-surface border border-hairline rounded-md text-chalk placeholder:text-muted focus:outline-none focus:border-link focus:ring-1 focus:ring-link/40 transition-colors"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-body">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                minLength={6}
                className="w-full px-3 py-2.5 bg-surface border border-hairline rounded-md text-chalk placeholder:text-muted focus:outline-none focus:border-link focus:ring-1 focus:ring-link/40 transition-colors"
                required
              />
            </label>

            {error && (
              <p className="text-danger text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-1"
            >
              {loading
                ? mode === 'signin' ? 'Signing in…' : 'Creating account…'
                : mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          {mode === 'signin'
            ? "Don't have an account? "
            : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
            className="text-link hover:text-link-deep transition-colors"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
