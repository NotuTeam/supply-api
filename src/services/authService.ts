import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/client.js';
import { config } from '../config.js';
import type { JwtPayload as AuthJwtPayload, UserRole } from '../types/auth.js';

export async function findUserByUsername(username: string) {
  const { rows } = await pool.query(
    `SELECT id, username, password_hash, role, created_at, updated_at
     FROM users
     WHERE username = $1`,
    [username]
  );

  return rows[0] as
    | {
        id: number;
        username: string;
        password_hash: string;
        role: UserRole;
        created_at: Date;
        updated_at: Date;
      }
    | undefined;
}

export async function createUser(params: { username: string; password: string; role: UserRole }) {
  const passwordHash = await bcrypt.hash(params.password, 10);

  const { rows } = await pool.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES ($1, $2, $3)
     RETURNING id, username, role, created_at, updated_at`,
    [params.username, passwordHash, params.role]
  );

  return rows[0];
}

export async function upsertGenesisSuperadmin() {
  if (!config.genesisUsername || !config.genesisPassword) {
    throw new Error('GENESIS_SUPERADMIN_USERNAME and GENESIS_SUPERADMIN_PASSWORD are required');
  }

  const passwordHash = await bcrypt.hash(config.genesisPassword, 10);

  const { rows } = await pool.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES ($1, $2, 'superadmin')
     ON CONFLICT (username)
     DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'superadmin', updated_at = NOW()
     RETURNING id, username, role, created_at, updated_at`,
    [config.genesisUsername, passwordHash]
  );

  return rows[0];
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signAccessToken(payload: AuthJwtPayload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '12h' });
}

export function verifyAccessToken(token: string): AuthJwtPayload {
  const decoded = jwt.verify(token, config.jwtSecret);

  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload');
  }

  if (typeof decoded.sub !== 'number' || typeof decoded.username !== 'string' || typeof decoded.role !== 'string') {
    throw new Error('Invalid token claims');
  }

  return {
    sub: decoded.sub,
    username: decoded.username,
    role: decoded.role as UserRole,
  };
}
