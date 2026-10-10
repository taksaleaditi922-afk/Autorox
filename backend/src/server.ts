import app from './app.js';
import env from './config/env.js';
import { connectDB } from './config/db.js';

const start = async () => {
  try {
    await connectDB();
      const server = app.listen(env.port, env.host, () => {
      console.log(`AutoGarage API running on http://${env.host}:${env.port} (${env.nodeEnv})`);
    });
      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${env.port} is already in use. Stop the other server or configure a different PORT.`);
        } else {
          console.error('Failed to start HTTP server:', err.message);
        }
        process.exit(1);
      });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

start();