import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { currentUser } from '@/lib/server';

export const metadata = { title: 'Enroll' };

export default async function SignUpPage() {
  if (await currentUser()) redirect('/projects/new');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Enroll your project</h1>
        <p className="text-ink-2 mt-1">
          Create an account, then register your project with its Stellar account or contract.
        </p>
      </div>
      <AuthForm mode="sign-up" />
    </div>
  );
}
