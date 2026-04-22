import { pool } from '../src/config/database';

async function insertTestData() {
  const client = await pool.connect();
  try {
    console.log('📝 Insertion des données de test pour le système social...');

    // Récupérer l'utilisateur de test existant
    const userResult = await client.query(
      'SELECT user_id FROM users WHERE email = $1',
      ['test@roadquest.com']
    );

    if (userResult.rows.length === 0) {
      console.log('⚠️  Aucun utilisateur de test trouvé. Créez d\'abord un utilisateur avec email test@roadquest.com');
      return;
    }

    const testUserId = userResult.rows[0].user_id;
    console.log(`✅ Utilisateur de test trouvé: ${testUserId}`);

    // Créer quelques utilisateurs supplémentaires pour les posts
    const users = [];
    for (let i = 1; i <= 3; i++) {
      const email = `rider${i}@roadquest.com`;
      const username = i === 1 ? 'MaxRider' : i === 2 ? 'BikerGirl' : 'SpeedDemon';
      const level = i === 1 ? 15 : i === 2 ? 22 : 8;

      const result = await client.query(
        `INSERT INTO users (email, password, username, level, xp)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
         RETURNING user_id`,
        [email, '$2b$10$dummyhashedpassword', username, level, level * 100]
      );
      users.push({ user_id: result.rows[0].user_id, username, level });
      console.log(`✅ Utilisateur créé/mis à jour: ${username}`);
    }

    // Récupérer ou créer des rides pour chaque utilisateur
    const rides = [];
    for (const user of users) {
      const rideData = user.username === 'MaxRider'
        ? { distance: 145.8, duration: 180, title: 'Balade dans les Vosges' }
        : user.username === 'BikerGirl'
        ? { distance: 89.3, duration: 120, title: 'Tour de la Côte d\'Opale' }
        : { distance: 52.7, duration: 75, title: 'Première sortie de l\'année' };

      // Chercher un ride existant de cet utilisateur
      let result = await client.query(
        `SELECT ride_id FROM rides WHERE user_id = $1 LIMIT 1`,
        [user.user_id]
      );

      let ride_id;
      if (result.rows.length > 0) {
        ride_id = result.rows[0].ride_id;
        console.log(`✅ Ride existant trouvé pour ${user.username}`);
      } else {
        // Créer un ride minimal avec start_location
        const point = `POINT(2.3522 48.8566)`;
        result = await client.query(
          `INSERT INTO rides (user_id, distance, duration, start_location)
           VALUES ($1, $2, $3, ST_GeomFromText($4, 4326))
           RETURNING ride_id`,
          [user.user_id, rideData.distance, rideData.duration, point]
        );
        ride_id = result.rows[0].ride_id;
        console.log(`✅ Ride créé pour ${user.username}`);
      }

      rides.push({ ride_id, user_id: user.user_id, ...rideData });
    }

    // Créer des posts pour chaque ride
    const posts = [];
    for (let i = 0; i < rides.length; i++) {
      const ride = rides[i];
      const descriptions = [
        'Superbe journée sur les routes des Vosges ! Les virages du Col de la Schlucht sont incroyables. Météo parfaite et vue magnifique sur les sapins.',
        'Magnifique balade le long de la côte. Le Cap Blanc-Nez et le Cap Gris-Nez offrent des points de vue spectaculaires !',
        'Enfin de retour sur la route ! Petit tour dans la campagne pour reprendre en main ma MT-07. Hâte de faire de plus longues balades.'
      ];

      const result = await client.query(
        `INSERT INTO ride_posts (user_id, ride_id, title, description, created_at)
         VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${i * 3} hours')
         RETURNING post_id`,
        [ride.user_id, ride.ride_id, ride.title, descriptions[i]]
      );
      posts.push({ post_id: result.rows[0].post_id, user_id: ride.user_id });
      console.log(`✅ Post créé: ${ride.title}`);
    }

    // Ajouter des likes
    for (const post of posts) {
      const likesCount = Math.floor(Math.random() * 30) + 10;
      for (let i = 0; i < Math.min(likesCount, 3); i++) {
        const likerUserId = i === 0 ? testUserId : users[i % users.length].user_id;
        await client.query(
          `INSERT INTO post_likes (post_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (post_id, user_id) DO NOTHING`,
          [post.post_id, likerUserId]
        );
      }
      console.log(`✅ Likes ajoutés au post`);
    }

    // Ajouter des commentaires
    const comments = [
      'Magnifique ! J\'ai fait cette route l\'année dernière, c\'est vraiment top !',
      'Superbes photos ! Ça donne envie d\'y aller',
      'Belle balade, j\'adore cette région 🏍️',
    ];

    for (let i = 0; i < Math.min(posts.length, comments.length); i++) {
      await client.query(
        `INSERT INTO post_comments (post_id, user_id, content)
         VALUES ($1, $2, $3)`,
        [posts[i].post_id, testUserId, comments[i]]
      );
      console.log(`✅ Commentaire ajouté`);
    }

    // Créer des relations de follow
    for (const user of users) {
      if (user.user_id !== testUserId) {
        await client.query(
          `INSERT INTO user_follows (follower_id, following_id)
           VALUES ($1, $2)
           ON CONFLICT (follower_id, following_id) DO NOTHING`,
          [testUserId, user.user_id]
        );
        console.log(`✅ Follow ajouté: test user -> ${user.username}`);
      }
    }

    console.log('');
    console.log('✅ Données de test insérées avec succès !');
    console.log(`📊 Résumé:`);
    console.log(`   - ${users.length} utilisateurs`);
    console.log(`   - ${rides.length} rides`);
    console.log(`   - ${posts.length} posts`);
    console.log(`   - Likes et commentaires ajoutés`);
    console.log(`   - Relations de follow créées`);

  } catch (error) {
    console.error('❌ Erreur lors de l\'insertion des données:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

insertTestData().catch(console.error);
