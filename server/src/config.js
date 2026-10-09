import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(SERVER_ROOT, '.env') });

const isTest = process.env.NODE_ENV === 'test';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production. Copy server/.env.example to server/.env.');
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbFile: path.resolve(SERVER_ROOT, process.env.DB_FILE || 'data/lostfound.db'),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  isTest,
  isProduction: process.env.NODE_ENV === 'production',
  clientDist: path.resolve(SERVER_ROOT, '..', 'client', 'dist'),
  schemaFile: path.join(SERVER_ROOT, 'db', 'schema.sql'),
};
