import { pool } from '../db/client.js';
import type { Shipment, ShipmentStatus } from '../types/models.js';

export async function getShipments(): Promise<Shipment[]> {
  const query = `
    SELECT
      s.id,
      s.container_number,
      s.etd,
      s.eta,
      s.forwarder,
      s.supplier,
      s.status,
      s.created_at,
      s.updated_at,
      COALESCE(
        json_agg(
          json_build_object(
            'productId', p.id,
            'productName', p.name,
            'qty', si.qty
          )
        ) FILTER (WHERE si.id IS NOT NULL),
        '[]'::json
      ) AS items
    FROM shipments s
    LEFT JOIN shipment_items si ON si.shipment_id = s.id
    LEFT JOIN products p ON p.id = si.product_id
    GROUP BY s.id
    ORDER BY s.eta ASC
  `;

  const { rows } = await pool.query(query);

  return rows.map((row) => ({
    id: row.id,
    containerNumber: row.container_number,
    etd: row.etd.toISOString(),
    eta: row.eta.toISOString(),
    forwarder: row.forwarder,
    supplier: row.supplier,
    status: row.status as ShipmentStatus,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    items: row.items,
  }));
}

export async function getRealtimeSummary() {
  const { rows } = await pool.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE status = 'ordered') AS ordered_count,
        COUNT(*) FILTER (WHERE status = 'on_delivery') AS on_delivery_count,
        COUNT(*) FILTER (WHERE status = 'arrived') AS arrived_count,
        COUNT(*) FILTER (WHERE status = 'done') AS done_count,
        COALESCE(SUM(si.qty) FILTER (WHERE s.status = 'ordered'), 0) AS ordered_qty,
        COALESCE(SUM(si.qty) FILTER (WHERE s.status = 'on_delivery'), 0) AS on_delivery_qty,
        COALESCE(SUM(si.qty) FILTER (WHERE s.status = 'arrived'), 0) AS arrived_qty,
        COALESCE(SUM(si.qty) FILTER (WHERE s.status = 'done'), 0) AS done_qty
      FROM shipments s
      LEFT JOIN shipment_items si ON si.shipment_id = s.id
    `
  );

  return rows[0];
}
