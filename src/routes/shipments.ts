import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/client.js';
import { getShipments } from '../services/shipmentService.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken, requireRole('superadmin', 'admin', 'staff'));

const shipmentStatuses = ['ordered', 'on_delivery', 'arrived', 'done'] as const;

const shipmentCreateSchema = z.object({
  containerNumber: z.string().min(1),
  etd: z.string().datetime(),
  eta: z.string().datetime(),
  forwarder: z.string().min(1),
  supplier: z.string().min(1),
  status: z.enum(shipmentStatuses).default('ordered'),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        qty: z.number().int().positive(),
      })
    )
    .min(1),
});

const shipmentUpdateStatusSchema = z.object({
  status: z.enum(shipmentStatuses),
});

router.get('/', async (_req, res, next) => {
  try {
    const shipments = await getShipments();
    res.json(shipments);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('superadmin', 'admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const data = shipmentCreateSchema.parse(req.body);

    await client.query('BEGIN');

    const shipmentResult = await client.query(
      `INSERT INTO shipments (container_number, etd, eta, forwarder, supplier, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [data.containerNumber, data.etd, data.eta, data.forwarder, data.supplier, data.status]
    );

    const shipmentId = shipmentResult.rows[0].id as number;

    for (const item of data.items) {
      await client.query(
        `INSERT INTO shipment_items (shipment_id, product_id, qty)
         VALUES ($1, $2, $3)`,
        [shipmentId, item.productId, item.qty]
      );
    }

    await client.query('COMMIT');

    const [shipment] = (await getShipments()).filter((s) => s.id === shipmentId);
    res.status(201).json(shipment);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

router.patch('/:id/status', requireRole('superadmin', 'admin'), async (req, res, next) => {
  try {
    const shipmentId = Number(req.params.id);
    if (Number.isNaN(shipmentId)) {
      return res.status(400).json({ message: 'Invalid shipment id' });
    }

    const data = shipmentUpdateStatusSchema.parse(req.body);

    const previousStatusQuery = await pool.query('SELECT status FROM shipments WHERE id = $1', [shipmentId]);
    if (previousStatusQuery.rowCount === 0) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    const previousStatus = previousStatusQuery.rows[0].status as string;

    const shipmentUpdate = await pool.query(
      `UPDATE shipments
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [data.status, shipmentId]
    );

    if (shipmentUpdate.rowCount === 0) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    if (previousStatus !== 'done' && data.status === 'done') {
      await pool.query(
        `UPDATE products p
         SET qty = p.qty + si.qty,
             updated_at = NOW()
         FROM shipment_items si
         WHERE si.product_id = p.id
           AND si.shipment_id = $1`,
        [shipmentId]
      );
    }

    const [shipment] = (await getShipments()).filter((s) => s.id === shipmentId);
    return res.json(shipment);
  } catch (error) {
    return next(error);
  }
});

export default router;
