import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { UserProfile } from '../types';

const PRESENCE_SERVER_URL = import.meta.env.VITE_PRESENCE_URL || 'http://localhost:4000';

export type PresenceStatus = 'online' | 'joined_offline' | 'not_joined';

export interface PresenceState {
  userId: string;
  status: PresenceStatus;
  displayName: string;
  role: string;
  isRegistered: boolean;
  lastSeen: string | null;
  online: boolean;
  inRoom: boolean;
}

interface PresenceContextType {
  isConnected: boolean;
  getPresence: (dealId: string, userId: string | null) => PresenceState | null;
  joinRoom: (dealId: string, counterpartId: string | null) => void;
  leaveRoom: (dealId: string) => void;
}

const PresenceContext = createContext<PresenceContextType | null>(null);

export function PresenceProvider({ children, profile }: { children: React.ReactNode; profile: UserProfile | null }) {
  const [isConnected, setIsConnected] = useState(false);
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceState>>({}); // key: dealId:userId
  const socketRef = useRef<Socket | null>(null);

  const getPresence = useCallback((dealId: string, userId: string | null) => {
    if (!userId) return null;
    return presenceMap[`${dealId}:${userId}`] || null;
  }, [presenceMap]);

  useEffect(() => {
    if (!profile?.uid) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const socket = io(PRESENCE_SERVER_URL, {
      auth: {
        userId: profile.uid,
        displayName: profile.displayName || profile.email,
        role: profile.role,
        isRegistered: true,
      },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('presence_update', (payload: PresenceState & { dealId: string }) => {
      setPresenceMap(prev => ({
        ...prev,
        [`${payload.dealId}:${payload.userId}`]: payload
      }));
    });

    socket.on('user_joined_session', (payload: any) => {
      setPresenceMap(prev => ({
        ...prev,
        [`${payload.dealId}:${payload.userId}`]: {
          userId: payload.userId,
          status: 'online',
          displayName: payload.displayName,
          role: payload.role,
          isRegistered: payload.isRegistered,
          lastSeen: payload.timestamp,
          online: true,
          inRoom: true,
        }
      }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [profile?.uid]);

  const joinRoom = useCallback((dealId: string, counterpartId: string | null) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join_deal_room', { dealId, counterpartId });
    }
  }, []);

  const leaveRoom = useCallback((dealId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave_deal_room', { dealId });
    }
  }, []);

  return (
    <PresenceContext.Provider value={{ isConnected, getPresence, joinRoom, leaveRoom }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function useGlobalPresence() {
  const context = useContext(PresenceContext);
  if (!context) throw new Error('useGlobalPresence must be used within PresenceProvider');
  return context;
}
