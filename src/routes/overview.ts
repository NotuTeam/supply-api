import { Router } from 'express';
import { pool } from '../db/client.js';
import { getRealtimeSummary } from '../services/shipmentService.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken, requireRole('superadmin', 'admin', 'staff'));

router.get('/', async (_req, res, next) => {
  try {
    const [summary, productStats, shipmentsToday] = await Promise.all([
      getRealtimeSummary(),
      pool.query(
        `SELECT
          COUNT(*)::int AS total_skus,
          COALESCE(SUM(qty), 0)::int AS total_units,
          COUNT(*) FILTER (WHERE qty <= 40)::int AS low_stock
         FROM products`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS incoming_today
         FROM shipments
         WHERE DATE(eta) = CURRENT_DATE`
      ),
    ]);

    const timeline = [
      { step: 'Ordered', status: summary.ordered_count > 0 ? 'active' : 'idle', count: Number(summary.ordered_count) },
      { step: 'On Delivery', status: summary.on_delivery_count > 0 ? 'active' : 'idle', count: Number(summary.on_delivery_count) },
      { step: 'Arrived', status: summary.arrived_count > 0 ? 'active' : 'idle', count: Number(summary.arrived_count) },
      { step: 'Done', status: summary.done_count > 0 ? 'active' : 'idle', count: Number(summary.done_count) },
    ];

    res.json({
      kpi: {
        totalSkus: productStats.rows[0].total_skus,
        totalUnits: productStats.rows[0].total_units,
        lowStockAlerts: productStats.rows[0].low_stock,
        incomingShipmentsToday: shipmentsToday.rows[0].incoming_today,
      },
      flow: {
        orderedQty: Number(summary.ordered_qty),
        onDeliveryQty: Number(summary.on_delivery_qty),
        arrivedQty: Number(summary.arrived_qty),
        doneQty: Number(summary.done_qty),
      },
      timeline,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
