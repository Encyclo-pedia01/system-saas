import { redirect } from 'next/navigation';

// Authenticator-app sign-in is turned off. Nothing to set up here.
export default function MfaSetupPage() {
  redirect('/dashboard');
}
