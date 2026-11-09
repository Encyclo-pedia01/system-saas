import { redirect } from 'next/navigation';

// Authenticator-app sign-in is turned off. Nothing to verify here.
export default function MfaVerifyPage() {
  redirect('/dashboard');
}
