import { useEffect } from 'react';
import { useGlobalPresence, PresenceState } from '../contexts/PresenceContext';
import { UserProfile } from '../types';

interface UsePresenceOptions {
  profile: UserProfile | null;
  dealId: string | null;
  counterpartId: string | null;
}

interface UsePresenceReturn {
  counterpartPresence: PresenceState | null;
  isConnected: boolean;
}

export function usePresence({
  profile,
  dealId,
  counterpartId,
}: UsePresenceOptions): UsePresenceReturn {
  const { isConnected, getPresence, joinRoom, leaveRoom } = useGlobalPresence();

  useEffect(() => {
    if (!profile?.uid || !dealId) return;

    joinRoom(dealId, counterpartId);

    return () => {
      leaveRoom(dealId);
    };
  }, [profile?.uid, dealId, counterpartId, joinRoom, leaveRoom]);

  const counterpartPresence = getPresence(dealId || '', counterpartId);

  return { counterpartPresence, isConnected };
}
