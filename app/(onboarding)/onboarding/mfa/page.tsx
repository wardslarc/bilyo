import { Metadata } from 'next';
import MfaEnrolmentFlow from '@/components/onboarding/MfaEnrolmentFlow';

export const metadata: Metadata = {
  title: 'Set Up Two-Factor Authentication | Bilyo',
  description: 'Enable mandatory two-factor authentication for your account',
};

export default function MfaOnboardingPage() {
  return <MfaEnrolmentFlow />;
}
