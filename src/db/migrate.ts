import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = await readFile(schemaPath, 'utf8');
  await pool.query(sql);
  await pool.end();
  console.log('Migration completed');
}

run().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
