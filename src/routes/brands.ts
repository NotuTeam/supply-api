import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/client.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken, requireRole('superadmin', 'admin', 'staff'));

const brandSchema = z.object({
  name: z.string().min(1),
});

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, created_at, updated_at
       FROM brands
       ORDER BY name ASC`
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('superadmin', 'admin'), async (req, res, next) => {
  try {
    const data = brandSchema.parse(req.body);

    const { rows } = await pool.query(
      `INSERT INTO brands (name)
       VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
       RETURNING id, name, created_at, updated_at`,
      [data.name]
    );

    const row = rows[0];
    res.status(201).json({
      id: row.id,
      name: row.name,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireRole('superadmin', 'admin'), async (req, res, next) => {
  try {
    const brandId = Number(req.params.id);
    if (Number.isNaN(brandId)) {
      return res.status(400).json({ message: 'Invalid brand id' });
    }

    const data = brandSchema.parse(req.body);

    const { rows, rowCount } = await pool.query(
      `UPDATE brands
       SET name = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, created_at, updated_at`,
      [data.name, brandId]
    );

    if (!rowCount) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    const row = rows[0];
    return res.json({
      id: row.id,
      name: row.name,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    });
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      return res.status(409).json({ message: 'Nama brand sudah dipakai' });
    }
    return next(error);
  }
});

router.delete('/:id', requireRole('superadmin', 'admin'), async (req, res, next) => {
  try {
    const brandId = Number(req.params.id);
    if (Number.isNaN(brandId)) {
      return res.status(400).json({ message: 'Invalid brand id' });
    }

    const { rowCount } = await pool.query('DELETE FROM brands WHERE id = $1', [brandId]);
    if (!rowCount) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    return res.status(204).send();
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23503'
    ) {
      return res.status(409).json({ message: 'Brand masih dipakai produk, tidak bisa dihapus' });
    }
    return next(error);
  }
});

export default router;
