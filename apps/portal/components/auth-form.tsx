'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignUp = mode === 'sign-up';

  async function onSubmit(form: FormData) {
    setPending(true);
    setError(null);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const result = isSignUp
      ? await authClient.signUp.email({ email, password, name: String(form.get('name') ?? '') })
      : await authClient.signIn.email({ email, password });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? 'Something went wrong.');
      return;
    }
    router.push(isSignUp ? '/projects/new' : '/projects');
    router.refresh();
  }

  return (
    <form action={onSubmit} className="card p-6 space-y-4 max-w-sm">
      {isSignUp && (
        <label className="block space-y-1">
          <span className="text-sm font-medium">Your name</span>
          <input name="name" required maxLength={80} autoComplete="name" className="field" />
        </label>
      )}
      <label className="block space-y-1">
        <span className="text-sm font-medium">Email</span>
        <input name="email" type="email" required autoComplete="email" className="field" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          className="field"
        />
        {isSignUp && <span className="text-xs text-muted">At least 10 characters.</span>}
      </label>
      {error && (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center">
        {pending ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
      </button>
      <p className="text-sm text-ink-2">
        {isSignUp ? (
          <>
            Already enrolled? <Link href="/sign-in" className="underline">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/sign-up" className="underline">Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
