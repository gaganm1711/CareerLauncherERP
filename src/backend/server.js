require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const http = require('http');
const { sqlite } = require('./db');
const routes = require('./routes');
const { startSyncEngine } = require('./syncEngine');
const { initSockets } = require('./sockets');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '20mb' })); // support base64 image uploads

// Serve API routes
app.use('/api', routes);

// Serve static React files in production mode
const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath));

// Fallback for SPA routing in client
app.get('*', (req, res, next) => {
  // If it's an API route that fell through, return 404
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found.' });
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      // If index.html doesn't exist, we're likely in development mode
      res.status(200).send('Career Launcher ERP Server running on port 5000. Client running on port 3000 in development.');
    }
  });
});

// Seed default admin if SQLite is empty
async function seedDefaultAdmin() {
  try {
    const userCount = await sqlite.user.count();
    if (userCount === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await sqlite.user.create({
        data: {
          username: 'admin',
          email: 'admin@careerlauncher.com',
          name: 'Director Admin',
          passwordHash,
          role: 'ADMIN',
          permissions: 'students:view,students:manage,teachers:view,teachers:manage,batches:manage,fees:manage,settings:manage',
          mfaEnabled: false
        }
      });
      console.log('[SEED] Default admin user created successfully.');
      console.log('[SEED] Username: admin | Password: admin123');
    }
  } catch (err) {
    console.error('[SEED] Error seeding default admin:', err.message);
  }
}

// Start API Server
async function startServer() {
  await seedDefaultAdmin();
  
  const server = http.createServer(app);
  initSockets(server);
  
  server.listen(PORT, () => {
    console.log(`[SERVER] Express + Socket.IO backend running on port ${PORT}`);
    
    // Start background sync loop
    startSyncEngine();
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[SERVER] Port ${PORT} is already in use. Assuming backend is already running.`);
    } else {
      console.error('[SERVER] Server error:', err.message);
    }
  });
}

startServer().catch(err => {
  console.error('[SERVER] Failed to start backend server:', err.message);
});
