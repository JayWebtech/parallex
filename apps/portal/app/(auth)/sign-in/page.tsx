import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { currentUser } from '@/lib/server';

export const metadata = { title: 'Sign in' };

export default async function SignInPage() {
  if (await currentUser()) redirect('/projects');
  return <AuthForm mode="sign-in" />;
}
