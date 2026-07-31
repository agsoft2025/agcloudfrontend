/**
 * socket.ts
 *
 * Manages the single Socket.IO connection used for real-time call
 * signaling (incoming calls, accept/reject/cancel/end notifications)
 * and presence updates.
 */
import { browser } from '$app/environment';
import { io, type Socket } from 'socket.io-client';
import { authStore } from '$lib/stores/auth.store';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

let socket: Socket | null = null;

/** Connect (or return the existing connection) using the session cookie. */
export function connectSocket(): Socket | null {
  if (!browser) return null;

  // Only connect when a verified session exists
  if (!authStore.getUser()) return null;

  if (socket) {
    if (socket.connected) return socket;
    socket.disconnect();
    socket = null;
  }

  // withCredentials sends the HttpOnly session cookie on the handshake request.
  // The server authenticates the connection from the cookie — no auth token needed.
  socket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
  });
  socket.on('connect_error', (err) => {
    console.error('[socket] connect_error:', err.message);
  });
  socket.on('disconnect', (reason) => {
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
