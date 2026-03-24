import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/client.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken, requireRole('superadmin', 'admin', 'staff'));

const productSchema = z.object({
  brandId: z.number().int().positive(),
  typeName: z.string().min(1),
  size: z.string().min(1),
  pattern: z.string().min(1),
  qty: z.number().int().nonnegative(),
});

const productUpdateSchema = z.object({
  brandId: z.number().int().positive().optional(),
  typeName: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  pattern: z.string().min(1).optional(),
  qty: z.number().int().nonnegative().optional(),
});

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.brand_id, b.name AS brand_name, p.type_name, p.name, p.size, p.pattern, p.qty, p.created_at, p.updated_at
       FROM products p
       INNER JOIN brands b ON b.id = p.brand_id
       ORDER BY p.updated_at DESC`
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        brandId: row.brand_id,
        brandName: row.brand_name,
        typeName: row.type_name,
        name: row.name,
        size: row.size,
        pattern: row.pattern,
        qty: row.qty,
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
    const data = productSchema.parse(req.body);

    const brandResult = await pool.query('SELECT id, name FROM brands WHERE id = $1', [data.brandId]);
    if (!brandResult.rowCount) {
      return res.status(400).json({ message: 'Brand tidak ditemukan' });
    }

    const brandName = brandResult.rows[0].name as string;
    const name = `${brandName} ${data.typeName}`.trim();

    const { rows } = await pool.query(
      `INSERT INTO products (brand_id, brand_name, type_name, name, size, pattern, qty)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, brand_id, brand_name, type_name, name, size, pattern, qty, created_at, updated_at`,
      [data.brandId, brandName, data.typeName, name, data.size, data.pattern, data.qty]
    );

    const row = rows[0];
    res.status(201).json({
      id: row.id,
      brandId: row.brand_id,
      brandName: row.brand_name,
      typeName: row.type_name,
      name: row.name,
      size: row.size,
      pattern: row.pattern,
      qty: row.qty,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireRole('superadmin', 'admin'), async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    if (Number.isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    const data = productUpdateSchema.parse(req.body);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const current = await pool.query(
      'SELECT id, brand_id, brand_name, type_name, size, pattern, qty FROM products WHERE id = $1',
      [productId]
    );

    if (!current.rowCount) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const existing = current.rows[0];
    const brandId = data.brandId ?? existing.brand_id;

    const brandResult = await pool.query('SELECT id, name FROM brands WHERE id = $1', [brandId]);
    if (!brandResult.rowCount) {
      return res.status(400).json({ message: 'Brand tidak ditemukan' });
    }

    const brandName = brandResult.rows[0].name as string;
    const typeName = data.typeName ?? existing.type_name;
    const size = data.size ?? existing.size;
    const pattern = data.pattern ?? existing.pattern;
    const qty = data.qty ?? existing.qty;
    const name = `${brandName} ${typeName}`.trim();

    const { rows } = await pool.query(
      `UPDATE products
       SET brand_id = $1,
           brand_name = $2,
           type_name = $3,
           name = $4,
           size = $5,
           pattern = $6,
           qty = $7,
           updated_at = NOW()
       WHERE id = $8
       RETURNING id, brand_id, brand_name, type_name, name, size, pattern, qty, created_at, updated_at`,
      [brandId, brandName, typeName, name, size, pattern, qty, productId]
    );

    const row = rows[0];
    return res.json({
      id: row.id,
      brandId: row.brand_id,
      brandName: row.brand_name,
      typeName: row.type_name,
      name: row.name,
      size: row.size,
      pattern: row.pattern,
      qty: row.qty,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requireRole('superadmin', 'admin'), async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    if (Number.isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [productId]);
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
