import { Metadata } from 'next';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Forgot Password | Bilyo',
  description: 'Reset your Bilyo account password',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
