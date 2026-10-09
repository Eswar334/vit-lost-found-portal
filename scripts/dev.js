// Starts the API and the React dev server together, on Windows, macOS or Linux.
//   node scripts/dev.js          (same as: npm run dev)
//   node scripts/dev.js --open   also opens the app in your browser when ready
//
// Written in plain Node instead of using a package like `concurrently`
// because npm's Windows .cmd launchers break when the project folder name
// contains "&" (as in "VIT Campus Lost & Found Recovery Portal").

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const APP_URL = 'http://localhost:5173';
const API_HEALTH = 'http://localhost:4000/api/health';
const shouldOpen = process.argv.includes('--open');

const colors = { api: '\x1b[34m', web: '\x1b[32m', reset: '\x1b[0m' };
const children = [];
let shuttingDown = false;

function start(name, dir) {
  // shell: true lets Windows find npm.cmd. The folder is passed as `cwd`,
  // never inside the command string, so special characters in it are safe.
  // On macOS/Linux the child gets its own process group so it can be stopped as a whole.
  const child = spawn('npm run dev', { cwd: path.join(root, dir), shell: true, env: process.env, detached: !isWin });
  const prefix = `${colors[name]}[${name}]${colors.reset} `;
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) out.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`${prefix}stopped (exit code ${code}). Shutting down the other process.`);
      stopAll(code || 1);
    }
  });
  children.push(child);
}

function kill(child) {
  if (child.exitCode !== null) return;
  if (isWin) {
    // Kill the whole process tree (cmd.exe -> npm -> node).
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

function stopAll(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach(kill);
  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

async function waitFor(url, timeoutMs = 60000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function openBrowser(url) {
  const cmd = isWin ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  spawn(cmd, { shell: true, stdio: 'ignore', detached: true }).unref();
}

start('api', 'server');
start('web', 'client');

const ready = await Promise.all([waitFor(API_HEALTH), waitFor(APP_URL)]);
if (ready.every(Boolean)) {
  console.log(`\n  App ready: ${APP_URL}   (press Ctrl+C to stop)\n`);
  if (shouldOpen) openBrowser(APP_URL);
} else if (!shuttingDown) {
  console.error('\n  The app did not start within 60 seconds. Check the messages above.\n');
}
