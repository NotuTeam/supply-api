import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/client.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  createUser,
  findUserByUsername,
  signAccessToken,
  upsertGenesisSuperadmin,
  verifyPassword,
} from '../services/authService.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  username: z.string().min(3).max(80),
  password: z.string().min(8).max(128),
  role: z.enum(['superadmin', 'admin', 'staff']),
});

const updateUserSchema = z.object({
  username: z.string().min(3).max(80).optional(),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(['superadmin', 'admin', 'staff']).optional(),
});

router.get('/genesis-superadmin', async (_req, res, next) => {
  try {
    const user = await upsertGenesisSuperadmin();
    return res.status(201).json({
      message: 'Genesis superadmin is ready',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await findUserByUsername(data.username);

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const isValid = await verifyPassword(data.password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const accessToken = signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    return res.json({
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authenticateToken, (req, res) => {
  return res.json({ user: req.user });
});

router.get('/users', authenticateToken, requireRole('superadmin'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, username, role, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    );

    return res.json(
      rows.map((row) => ({
        id: row.id,
        username: row.username,
        role: row.role,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      }))
    );
  } catch (error) {
    return next(error);
  }
});

router.post('/users', authenticateToken, requireRole('superadmin'), async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const created = await createUser(data);

    return res.status(201).json({
      id: created.id,
      username: created.username,
      role: created.role,
      createdAt: created.created_at.toISOString(),
      updatedAt: created.updated_at.toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/users/:id', authenticateToken, requireRole('superadmin'), async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const data = updateUserSchema.parse(req.body);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const fields: string[] = [];
    const values: Array<string | number> = [];

    if (data.username !== undefined) {
      values.push(data.username);
      fields.push(`username = $${values.length}`);
    }

    if (data.password !== undefined) {
      const hashed = await import('bcryptjs').then((mod) => mod.default.hash(data.password!, 10));
      values.push(hashed);
      fields.push(`password_hash = $${values.length}`);
    }

    if (data.role !== undefined) {
      values.push(data.role);
      fields.push(`role = $${values.length}`);
    }

    values.push(userId);

    const { rows, rowCount } = await pool.query(
      `UPDATE users
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id, username, role, created_at, updated_at`,
      values
    );

    if (!rowCount) {
      return res.status(404).json({ message: 'User not found' });
    }

    const row = rows[0];
    return res.json({
      id: row.id,
      username: row.username,
      role: row.role,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/users/:id', authenticateToken, requireRole('superadmin'), async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (req.user?.sub === userId) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    if (!result.rowCount) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
