import { pool } from './client.js';

async function run() {
  await pool.query('BEGIN');

  const insertedBrands = await pool.query(
    `INSERT INTO brands (name)
     VALUES
      ('Bridgestone'),
      ('Michelin'),
      ('Goodyear'),
      ('Pirelli'),
      ('Dunlop')
     ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
     RETURNING id, name`
  );

  const brandMap = new Map<string, number>(insertedBrands.rows.map((b) => [b.name, b.id]));

  const insertedProducts = await pool.query(
    `INSERT INTO products (brand_id, brand_name, type_name, name, size, pattern, qty)
     VALUES
      ($1, 'Bridgestone', 'Ecopia', 'Bridgestone Ecopia', '205/55 R16', 'Turanza T005', 320),
      ($2, 'Michelin', 'Primacy', 'Michelin Primacy', '215/60 R16', 'Primacy 4', 260),
      ($3, 'Goodyear', 'Assurance', 'Goodyear Assurance', '195/65 R15', 'Assurance TripleMax', 180),
      ($4, 'Pirelli', 'Scorpion', 'Pirelli Scorpion', '265/65 R17', 'Scorpion ATR', 95),
      ($5, 'Dunlop', 'SP Sport', 'Dunlop SP Sport', '225/45 R17', 'SP Sport LM705', 140)
     ON CONFLICT DO NOTHING
     RETURNING id, name`,
    [
      brandMap.get('Bridgestone') ?? 1,
      brandMap.get('Michelin') ?? 2,
      brandMap.get('Goodyear') ?? 3,
      brandMap.get('Pirelli') ?? 4,
      brandMap.get('Dunlop') ?? 5,
    ]
  );

  const products = insertedProducts.rows;

  if (products.length > 0) {
    const map = new Map<string, number>(products.map((p) => [p.name, p.id]));

    const shipmentResult = await pool.query(
      `INSERT INTO shipments (container_number, etd, eta, forwarder, supplier, status)
       VALUES
       ('CONT-998122', NOW() - INTERVAL '7 days', NOW() + INTERVAL '4 days', 'DHL Supply Chain', 'PT Ban Nusantara', 'on_delivery'),
       ('CONT-998123', NOW() - INTERVAL '2 days', NOW() + INTERVAL '12 days', 'Maersk', 'PT Karet Prima', 'ordered')
       RETURNING id, container_number`
    );

    for (const shipment of shipmentResult.rows) {
      if (shipment.container_number === 'CONT-998122') {
        await pool.query(
          `INSERT INTO shipment_items (shipment_id, product_id, qty)
           VALUES ($1, $2, $3), ($1, $4, $5)`,
          [
            shipment.id,
            map.get('Bridgestone Ecopia') ?? 1,
            80,
            map.get('Michelin Primacy') ?? 2,
            40,
          ]
        );
      }

      if (shipment.container_number === 'CONT-998123') {
        await pool.query(
          `INSERT INTO shipment_items (shipment_id, product_id, qty)
           VALUES ($1, $2, $3), ($1, $4, $5)`,
          [
            shipment.id,
            map.get('Goodyear Assurance') ?? 3,
            60,
            map.get('Pirelli Scorpion') ?? 4,
            25,
          ]
        );
      }
    }
  }

  await pool.query('COMMIT');
  console.log('Seed completed');
}

run()
  .catch(async (error) => {
    await pool.query('ROLLBACK');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
