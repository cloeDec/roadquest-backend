import { pool } from '../src/config/database';

async function checkTables() {
  const client = await pool.connect();
  try {
    // Vérifier si les tables existent
    const tablesCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('achievements', 'user_achievements', 'user_equipment', 'xp_history')
    `);

    console.log('Tables RPG existantes:', tablesCheck.rows.map(r => r.table_name));

    // Vérifier les colonnes de la table users
    const usersColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('level', 'current_xp', 'total_xp', 'rider_class')
    `);

    console.log('Colonnes RPG dans users:', usersColumns.rows.map(r => r.column_name));

    // Si achievements existe, vérifier sa structure
    if (tablesCheck.rows.some(r => r.table_name === 'achievements')) {
      const achievementsColumns = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'achievements'
      `);
      console.log('Colonnes de achievements:', achievementsColumns.rows.map(r => r.column_name));
    }

  } finally {
    client.release();
    await pool.end();
  }
}

checkTables().catch(console.error);
