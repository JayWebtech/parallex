'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignUp = mode === 'sign-up';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
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
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          {isSignUp ? 'Enroll your project' : 'Welcome back'}
        </CardTitle>
        <CardDescription>
          {isSignUp
            ? 'Create an account, then register your project with its Stellar ID.'
            : 'Sign in to your projects.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            {isSignUp && (
              <Field>
                <FieldLabel htmlFor="name">Your name</FieldLabel>
                <Input id="name" name="name" required maxLength={80} autoComplete="name" />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.org"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
              {isSignUp && <FieldDescription>At least 10 characters.</FieldDescription>}
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Field>
              <Button type="submit" disabled={pending} className="w-full">
                {pending && <Spinner data-icon="inline-start" />}
                {isSignUp ? 'Create account' : 'Sign in'}
              </Button>
              <FieldDescription className="text-center">
                {isSignUp ? (
                  <>
                    Already enrolled? <Link href="/sign-in">Sign in</Link>
                  </>
                ) : (
                  <>
                    New here? <Link href="/sign-up">Create an account</Link>
                  </>
                )}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
