import { query } from '../src/db.js';

async function main() {
  try {
    const tables = await query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%payment%'");
    console.log('PAYMENT TABLES:', JSON.stringify(tables, null, 2));

    const ps = await query('SELECT * FROM payment_settings');
    console.log('payment_settings:', JSON.stringify(ps, null, 2));

    const po = await query('SELECT * FROM payment_options');
    console.log('payment_options:', JSON.stringify(po, null, 2));
  } catch (e) {
    console.error(e);
  }
}

main();