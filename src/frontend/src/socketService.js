import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.protocol === 'file:'
    ? 'http://127.0.0.1:5000/api'
    : 'https://careerlauncher-erp.onrender.com/api'
);

const SOCKET_URL = API_URL.replace('/api', '');

let socket = null;
const listeners = {};

export const socketService = {
  connect() {
    if (socket) return socket;
    
    console.log(`[SOCKET] Connecting to ${SOCKET_URL}...`);
    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000
    });

    socket.on('connect', () => {
      console.log(`[SOCKET] Connected successfully! ID: ${socket.id}`);
    });

    socket.on('disconnect', (reason) => {
      console.warn(`[SOCKET] Disconnected! Reason: ${reason}`);
    });

    // Re-register listeners on socket instance
    Object.keys(listeners).forEach(event => {
      listeners[event].forEach(cb => {
        socket.on(event, cb);
      });
    });

    return socket;
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  on(event, callback) {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(callback);

    if (socket) {
      socket.on(event, callback);
    }
  },

  off(event, callback) {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter(cb => cb !== callback);
    }
    if (socket) {
      socket.off(event, callback);
    }
  }
};
