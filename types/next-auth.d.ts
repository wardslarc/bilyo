import type { UserRole } from './index';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    id?: string;
    role?: UserRole;
    mfaVerifiedAt?: string | null;
    mfaEnabled?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
      mfaVerifiedAt?: string | null;
      mfaEnabled?: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
    mfaVerifiedAt?: string | null;
    mfaEnabled?: boolean;
  }
}
