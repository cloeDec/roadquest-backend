import { pool } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Démarrage de la migration Profile & Motorcycle...');

    const migrationPath = path.join(__dirname, '..', 'migrations', '005_add_user_motorcycle_profile.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    await client.query(migrationSQL);

    console.log('✅ Migration Profile & Motorcycle terminée avec succès !');
    console.log('');
    console.log('Modifications apportées :');
    console.log('- Colonnes ajoutées à users : motorcycle_brand, motorcycle_model, motorcycle_year, motorcycle_photo_url');
    console.log('- Vue créée : user_statistics (stats complètes pour le profil)');
    console.log('- Fonction créée : update_user_motorcycle()');
    console.log('');
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
