import * as fs from "fs";
import * as path from "path";
import { pool } from "../../src/config/database";

/**
 * Applique uniquement la migration 007 (trigger d'XP serveur pour les POI).
 * Usage: npx ts-node scripts/db/run-poi-xp-migration.ts
 */

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log("Démarrage de la migration 007 (XP des POI)...\n");

    const migrationPath = path.join(__dirname, "..", "..", "migrations", "007_add_poi_xp_trigger.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

    await client.query(migrationSQL);

    console.log("Migration 007 appliquée avec succès.");
  } catch (error) {
    console.error("Erreur lors de la migration 007:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(() => process.exit(1));
