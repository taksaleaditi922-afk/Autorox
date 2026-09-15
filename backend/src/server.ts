import app from './app.js';
import env from './config/env.js';
import { connectDB } from './config/db.js';

const start = async () => {
  try {
    await connectDB();
    app.listen(env.port, env.host, () => {
      console.log(`AutoGarage API running on http://${env.host}:${env.port} (${env.nodeEnv})`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

start();