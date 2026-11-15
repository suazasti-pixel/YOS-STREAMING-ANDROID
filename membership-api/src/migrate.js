import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL es obligatorio.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined });
try {
  const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");
  await pool.query(schema);
  console.log("YOS Membership schema is ready.");
} finally {
  await pool.end();
}
