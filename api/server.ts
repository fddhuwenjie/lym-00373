import app from './app.js';
import { initDatabase } from './db/init.js';
import { CollaborationServer } from './ws/collaborationServer.js';
import http from 'http';

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized');
    
    const server = http.createServer(app);
    
    new CollaborationServer(server);
    console.log('Collaboration WebSocket server initialized');
    
    server.listen(PORT, () => {
      console.log(`Server ready on port ${PORT}`);
      console.log(`WebSocket: ws://localhost:${PORT}/ws/workbooks/:id`);
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
