import { query } from "./src/db.js";

const tables = await query(
  "SELECT name FROM sqlite_master WHERE type = ? ORDER BY name",
  ["table"]
);

console.log(tables);
process.exit();
