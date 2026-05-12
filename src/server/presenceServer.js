/**
 * TrustDeals – Real-Time Presence & Session Server
 * Node.js + Express + Socket.io (ESM Version)
 *
 * Run:  node src/server/presenceServer.js
 */

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import admin from 'firebase-admin';

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin
// ─────────────────────────────────────────────────────────────────────────────
let firebaseReady = false;
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
  firebaseReady = true;
} catch (e) {
  console.warn('[Presence] Firebase Admin not initialized – JWT validation disabled.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Express + HTTP + Socket.io
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(express.json());

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', connections: io.engine.clientsCount }));

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Presence Store
// ─────────────────────────────────────────────────────────────────────────────
const onlineUsers = new Map();  // userId  → Set<socketId>
const sessionRooms = new Map(); // dealId  → Set<userId>
const userMeta = new Map();     // userId  → { displayName, role, isRegistered, lastSeen }

function isUserOnline(userId) {
  const sockets = onlineUsers.get(userId);
  return sockets && sockets.size > 0;
}

function getUsersInSession(dealId) {
  return sessionRooms.get(dealId) || new Set();
}

function isUserInSession(userId, dealId) {
  return getUsersInSession(dealId).has(userId);
}

function buildPresencePayload(targetUserId, dealId) {
  const meta = userMeta.get(targetUserId) || {};
  const online = isUserOnline(targetUserId);
  const inRoom = isUserInSession(targetUserId, dealId);

  let status;
  if (online && inRoom) status = 'online';
  else if (meta.lastSeen) status = 'joined_offline';
  else status = 'not_joined';

  return {
    userId: targetUserId,
    status,
    displayName: meta.displayName || 'Unknown',
    role: meta.role || 'buyer',
    isRegistered: meta.isRegistered ?? true,
    lastSeen: meta.lastSeen || null,
    online,
    inRoom,
  };
}

async function persistLastSeen(userId) {
  if (!firebaseReady) return;
  try {
    await admin.firestore().collection('users').doc(userId).set(
      { lastSeen: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    // Silently fail in dev
  }
}

// ── Socket Auth ──
async function verifySocketAuth(socket, next) {
  const { userId, displayName, role, isRegistered } = socket.handshake.auth;
  if (!userId) return next(new Error('UNAUTHORIZED: missing userId'));
  socket.userId = userId;
  socket.displayName = displayName || 'User';
  socket.role = role || 'buyer';
  socket.isRegistered = isRegistered ?? true;
  next();
}

io.use(verifySocketAuth);

io.on('connection', (socket) => {
  const { userId, displayName, role, isRegistered } = socket;
  console.log(`[+] Connected: ${displayName} (${userId})`);

  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socket.id);

  userMeta.set(userId, {
    displayName,
    role,
    isRegistered,
    lastSeen: new Date().toISOString(),
  });

  socket.on('join_deal_room', ({ dealId, counterpartId }) => {
    if (!dealId) return;
    if (!sessionRooms.has(dealId)) sessionRooms.set(dealId, new Set());
    sessionRooms.get(dealId).add(userId);
    socket.join(`deal:${dealId}`);
    socket.currentDealId = dealId;

    userMeta.set(userId, { ...userMeta.get(userId), lastSeen: new Date().toISOString() });
    persistLastSeen(userId);

    console.log(`[Room] ${displayName} joined deal:${dealId}`);

    io.to(`deal:${dealId}`).emit('user_joined_session', {
      userId,
      dealId,
      displayName,
      role,
      isRegistered,
      timestamp: new Date().toISOString(),
    });

    if (counterpartId) {
      socket.emit('presence_update', { ...buildPresencePayload(counterpartId, dealId), dealId });
      if (isUserOnline(counterpartId)) {
        io.to(`deal:${dealId}`).emit('presence_update', { ...buildPresencePayload(userId, dealId), dealId });
      }
    }
  });

  socket.on('leave_deal_room', ({ dealId }) => {
    const users = sessionRooms.get(dealId);
    if (users) users.delete(userId);
    socket.leave(`deal:${dealId}`);
    io.to(`deal:${dealId}`).emit('user_left_session', { userId, dealId });
  });

  socket.on('disconnect', () => {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        sessionRooms.forEach((users, dealId) => {
          if (users.has(userId)) {
            io.to(`deal:${dealId}`).emit('user_offline', { userId, dealId });
            io.to(`deal:${dealId}`).emit('presence_update', { ...buildPresencePayload(userId, dealId), dealId });
          }
        });
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => console.log(`[Presence Server] listening on :${PORT}`));
