const { Server } = require('socket.io');

let io = null;

function initSockets(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function notifyClients(event, data = {}) {
  if (io) {
    console.log(`[SOCKET] Broadcasting event: "${event}"`, data);
    io.emit(event, data);
  }
}

module.exports = {
  initSockets,
  notifyClients
};
