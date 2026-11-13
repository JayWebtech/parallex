import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { currentUser } from '@/lib/server';

export const metadata = { title: 'Enroll' };

export default async function SignUpPage() {
  if (await currentUser()) redirect('/projects/new');
  return <AuthForm mode="sign-up" />;
}
