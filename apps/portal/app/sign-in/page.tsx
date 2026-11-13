import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { currentUser } from '@/lib/server';

export const metadata = { title: 'Sign in' };

export default async function SignInPage() {
  if (await currentUser()) redirect('/projects');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <AuthForm mode="sign-in" />
    </div>
  );
}
