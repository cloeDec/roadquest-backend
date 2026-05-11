import * as fs from "fs";
import * as path from "path";
import { pool } from "../../src/config/database";

/**
 * Script unifié pour exécuter toutes les migrations
 * Usage: npx ts-node scripts/db/run-all-migrations.ts
 */

const MIGRATIONS = [
  { name: "RPG System", file: "004_add_rpg_system_v2.sql" },
  { name: "Profile & Motorcycle", file: "005_add_user_motorcycle_profile.sql" },
  { name: "Social System", file: "006_add_social_system.sql" },
];

async function runAllMigrations() {
  const client = await pool.connect();
  try {
    console.log("🚀 Démarrage des migrations...\n");

    for (const migration of MIGRATIONS) {
      const migrationPath = path.join(__dirname, "..", "..", "migrations", migration.file);

      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  ${migration.name} - Fichier non trouvé: ${migration.file}`);
        continue;
      }

      console.log(`📦 Migration: ${migration.name}...`);
      const migrationSQL = fs.readFileSync(migrationPath, "utf-8");
      await client.query(migrationSQL);
      console.log(`✅ ${migration.name} terminée`);
    }

    console.log("\n✅ Toutes les migrations ont été exécutées avec succès !");
  } catch (error) {
    console.error("❌ Erreur lors des migrations:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runAllMigrations().catch(console.error);
