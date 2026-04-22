import { pool } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Démarrage de la migration RPG System...');

    const migrationPath = path.join(__dirname, '..', 'migrations', '004_add_rpg_system_v2.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    await client.query(migrationSQL);

    console.log('✅ Migration RPG System terminée avec succès !');
    console.log('');
    console.log('Tables créées :');
    console.log('- user_equipment (équipements virtuels)');
    console.log('- xp_history (historique XP)');
    console.log('- achievements (définitions des achievements)');
    console.log('- user_achievements (achievements débloqués)');
    console.log('');
    console.log('Colonnes ajoutées à users :');
    console.log('- level, current_xp, total_xp, rider_class, class_selected_at');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
