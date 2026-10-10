import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const backendRoot = fileURLToPath(new URL('../', import.meta.url));
dotenv.config({ path: path.join(backendRoot, '.env') });
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/autogarage';
const install = process.argv.includes('--install');
const local = /^mongodb:\/\/(localhost|127\.0\.0\.1)(:27017)?(?:\/|$)/.test(uri);
const { MongoClient } = mongoose.mongo;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function inspect() {
  const client = new MongoClient(local ? 'mongodb://127.0.0.1:27017/?directConnection=true' : uri, { serverSelectionTimeoutMS: 1500, connectTimeoutMS: 1500 });
  try {
    await client.connect();
    const hello = await client.db('admin').command({ hello: 1 });
    return { client, hello };
  } catch (error) {
    await client.close();
    throw error;
  }
}

async function main() {
  let existing;
  try { existing = await inspect(); } catch { /* Start an absent local database below. */ }
  if (existing) {
    try {
      if (local && !existing.hello.setName) throw new Error('MongoDB is running as a standalone server. Stock writes require a replica set; see src/routes/README.md. The running database was left unchanged.');
      if (!existing.hello.isWritablePrimary && existing.hello.msg !== 'isdbgrid') throw new Error('MongoDB is reachable but has no writable primary yet. Try again shortly.');
      console.log('MongoDB is ready.');
      return;
    } finally { await existing.client.close(); }
  }
  if (!local) throw new Error('Cannot reach the configured MongoDB server. Check MONGODB_URI and start that database.');
  if (process.platform !== 'win32') throw new Error('Start MongoDB as a replica set, or configure MONGODB_URI for a running database.');

  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(backendRoot, 'scripts/setup-mongo.ps1')];
  if (install) args.push('-Download');
  const setup = spawnSync('powershell.exe', args, { cwd: backendRoot, stdio: 'inherit', windowsHide: true });
  if (setup.error) throw setup.error;
  if (setup.status !== 0) throw new Error('MongoDB startup failed. See the message above.');

  const deadline = Date.now() + 60000;
  let initialized = false;
  while (Date.now() < deadline) {
    let current;
    try { current = await inspect(); } catch { await pause(1000); continue; }
    try {
      if (!current.hello.setName && !initialized) {
        try {
          await current.client.db('admin').command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] } });
        } catch (error) { if (error.codeName !== 'AlreadyInitialized') throw error; }
        initialized = true;
      }
      if (current.hello.isWritablePrimary && current.hello.setName) {
        console.log(`MongoDB ready at 127.0.0.1:27017 (replica set ${current.hello.setName}). Existing data retained.`);
        return;
      }
    } finally { await current.client.close(); }
    await pause(1000);
  }
  throw new Error('MongoDB did not become ready within 60 seconds. Check logs/mongodb.log.');
}

main().catch(error => { console.error(`Database startup failed: ${error.message}`); process.exitCode = 1; });
