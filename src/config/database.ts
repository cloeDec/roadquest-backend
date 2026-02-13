import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL + PostGIS");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL error:", err);
  process.exit(-1);
});

export const testConnection = async () => {
  try {
    const result = await pool.query("SELECT NOW(), PostGIS_version()");
    console.log("🗄️  Database time:", result.rows[0].now);
    console.log("📍 PostGIS version:", result.rows[0].postgis_version);
    return true;
  } catch (error) {
    console.error("Failed to connect to database:", error);
    return false;
  }
};
