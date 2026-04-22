import { pool } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Démarrage de la migration Social System...');

    const migrationPath = path.join(__dirname, '..', 'migrations', '006_add_social_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    await client.query(migrationSQL);

    console.log('✅ Migration Social System terminée avec succès !');
    console.log('');
    console.log('Tables créées :');
    console.log('- ride_posts (posts de rides partagés)');
    console.log('- post_likes (likes sur les posts)');
    console.log('- post_comments (commentaires)');
    console.log('- user_follows (follows entre utilisateurs)');
    console.log('- shared_routes (routes partagées)');
    console.log('');
    console.log('Vues créées :');
    console.log('- social_feed (fil social complet)');
    console.log('- public_profile_stats (stats profil public)');
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
