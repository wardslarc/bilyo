'use client';

import React, { useSyncExternalStore } from 'react';
import type { AccessStatus } from '@/types';
import { TrialWall } from './TrialWall';

import { useSearchParams } from 'next/navigation';

export interface TrialWallOverlayProps {
  status: AccessStatus;
  quotationsSent: number;
  quotationsAccepted: number;
  acceptedValueCentavos: number;
}

function subscribe(callback: () => void) {
  const handler = () => callback();
  window.addEventListener('storage', handler);
  window.addEventListener('bilyo:show-trial-wall', handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('bilyo:show-trial-wall', handler);
  };
}

function getSnapshot() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('bilyo_trial_wall_dismissed') === '1';
}

function getServerSnapshot() {
  return false;
}

export function TrialWallOverlay({
  status,
  quotationsSent,
  quotationsAccepted,
  acceptedValueCentavos,
}: TrialWallOverlayProps) {
  const searchParams = useSearchParams();
  const isDismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // If a blocked action redirected with ?blocked=1 or ?wall=1, clear the dismissal (§3.4, A6)
  React.useEffect(() => {
    if (searchParams.get('blocked') === '1' || searchParams.get('wall') === '1') {
      sessionStorage.removeItem('bilyo_trial_wall_dismissed');
      window.dispatchEvent(new Event('storage'));
    }
  }, [searchParams]);

  if (status !== 'EXPIRED_TRIAL' || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem('bilyo_trial_wall_dismissed', '1');
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <TrialWall
      quotationsSent={quotationsSent}
      quotationsAccepted={quotationsAccepted}
      acceptedValueCentavos={acceptedValueCentavos}
      onDismiss={handleDismiss}
    />
  );
}

export default TrialWallOverlay;
