import { pool } from "../../src/config/database";
import bcrypt from "bcrypt";

/**
 * Script unifié pour insérer toutes les données de test
 * Usage: npx ts-node scripts/db/seed-all.ts
 */

// ============================================
// INTERFACES
// ============================================

interface POIData {
  name: string;
  type: "col" | "route_panoramique" | "virage" | "spot_photo" | "monument" | "autre";
  description: string;
  latitude: number;
  longitude: number;
  rating: number;
  image_url?: string;
}

// ============================================
// DONNÉES DE TEST
// ============================================

const TEST_USER = {
  email: "test@roadquest.com",
  password: "test123",
  username: "TestUser",
};

const POIS_FRANCE: POIData[] = [
  // Cols mythiques
  { name: "Col du Galibier", type: "col", description: "Col mythique des Alpes françaises culminant à 2642m.", latitude: 45.0642, longitude: 6.4078, rating: 5.0 },
  { name: "Col du Stelvio", type: "col", description: "Le col routier le plus haut d'Italie (2757m) avec ses 48 épingles mythiques.", latitude: 46.5283, longitude: 10.4525, rating: 5.0 },
  { name: "Col de la Bonette", type: "col", description: "Le col routier le plus haut d'Europe (2802m).", latitude: 44.3269, longitude: 6.8075, rating: 5.0 },
  { name: "Col du Tourmalet", type: "col", description: "Col pyrénéen légendaire (2115m), rendu célèbre par le Tour de France.", latitude: 42.9089, longitude: 0.1456, rating: 4.5 },
  { name: "Col de l'Iseran", type: "col", description: "Le plus haut col routier des Alpes françaises (2770m).", latitude: 45.4169, longitude: 7.0306, rating: 5.0 },

  // Routes panoramiques
  { name: "Route des Grandes Alpes", type: "route_panoramique", description: "Itinéraire mythique de 700km traversant les Alpes françaises.", latitude: 45.9237, longitude: 6.8694, rating: 5.0 },
  { name: "Route Napoléon", type: "route_panoramique", description: "Route historique de 325km de Golfe-Juan à Grenoble.", latitude: 43.5528, longitude: 7.0278, rating: 4.5 },
  { name: "Gorges du Verdon", type: "route_panoramique", description: "Le plus grand canyon d'Europe avec une route panoramique spectaculaire.", latitude: 43.7697, longitude: 6.3661, rating: 5.0 },
  { name: "Transfăgărășan", type: "route_panoramique", description: "Route de montagne roumaine spectaculaire.", latitude: 45.6019, longitude: 24.6189, rating: 5.0 },

  // Virages
  { name: "Lacets de Montvernier", type: "virage", description: "17 épingles serrées sur 3,4km dans le massif de la Maurienne.", latitude: 45.3347, longitude: 6.2969, rating: 5.0 },
  { name: "Col de Turini", type: "virage", description: "Col légendaire du Rallye de Monte-Carlo.", latitude: 43.9797, longitude: 7.3986, rating: 4.5 },

  // Spots photo
  { name: "Aiguille du Midi", type: "spot_photo", description: "Vue panoramique exceptionnelle sur le Mont-Blanc.", latitude: 45.8794, longitude: 6.8875, rating: 5.0 },
  { name: "Mont Ventoux", type: "spot_photo", description: "Le Géant de Provence culminant à 1910m.", latitude: 44.1736, longitude: 5.2786, rating: 5.0 },

  // Monuments
  { name: "Pont du Gard", type: "monument", description: "Aqueduc romain antique spectaculaire, classé UNESCO.", latitude: 43.9675, longitude: 4.5356, rating: 4.5 },
];

const POIS_HAUTS_DE_FRANCE: POIData[] = [
  { name: "Cathédrale Notre-Dame d'Amiens", type: "monument", description: "Plus vaste cathédrale gothique de France, classée UNESCO.", latitude: 49.8947, longitude: 2.3017, rating: 5.0 },
  { name: "Beffroi de Lille", type: "monument", description: "Beffroi de 104 mètres dominant la ville.", latitude: 50.6372, longitude: 3.0689, rating: 4.5 },
  { name: "Château de Chantilly", type: "monument", description: "Somptueux château Renaissance abritant le Musée Condé.", latitude: 49.1936, longitude: 2.4856, rating: 5.0 },
  { name: "Cap Blanc-Nez", type: "spot_photo", description: "Falaises spectaculaires de 134m dominant la Manche.", latitude: 50.9236, longitude: 1.7128, rating: 5.0 },
  { name: "Cap Gris-Nez", type: "spot_photo", description: "Point le plus proche de l'Angleterre.", latitude: 50.8686, longitude: 1.5828, rating: 5.0 },
  { name: "Route des Deux Caps", type: "route_panoramique", description: "Route côtière spectaculaire de 20km.", latitude: 50.8961, longitude: 1.6478, rating: 5.0 },
  { name: "Route de la Baie de Somme", type: "route_panoramique", description: "Circuit côtier autour de la plus belle baie du monde.", latitude: 50.2236, longitude: 1.5850, rating: 4.5 },
  { name: "Montée du Mont Cassel", type: "virage", description: "Montée sinueuse vers le Mont Cassel (176m).", latitude: 50.7997, longitude: 2.4861, rating: 3.5 },
  { name: "Nausicaá", type: "autre", description: "Plus grand aquarium d'Europe à Boulogne-sur-Mer.", latitude: 50.7333, longitude: 1.5978, rating: 5.0 },
];

// ============================================
// FONCTIONS
// ============================================

async function createTestUser(client: any) {
  console.log("\n📝 Création de l'utilisateur de test...");

  const hashedPassword = await bcrypt.hash(TEST_USER.password, 10);
  await client.query("DELETE FROM users WHERE email = $1", [TEST_USER.email]);

  const result = await client.query(
    `INSERT INTO users (email, password, username, level, xp)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING user_id, email, username`,
    [TEST_USER.email, hashedPassword, TEST_USER.username, 1, 0]
  );

  console.log(`✅ Utilisateur créé: ${TEST_USER.email} / ${TEST_USER.password}`);
  return result.rows[0].user_id;
}

async function insertPOI(poi: POIData) {
  const query = `
    INSERT INTO pois (name, type, description, location, rating, image_url, is_verified)
    VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, true)
    ON CONFLICT (name) DO NOTHING
    RETURNING poi_id, name
  `;

  try {
    const result = await pool.query(query, [
      poi.name, poi.type, poi.description, poi.longitude, poi.latitude, poi.rating, poi.image_url || null
    ]);
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

async function insertPOIs() {
  console.log("\n📍 Insertion des POIs...");

  const allPOIs = [...POIS_FRANCE, ...POIS_HAUTS_DE_FRANCE];
  let inserted = 0;

  for (const poi of allPOIs) {
    if (await insertPOI(poi)) {
      inserted++;
      console.log(`  ✅ ${poi.name}`);
    }
  }

  console.log(`✅ ${inserted}/${allPOIs.length} POIs insérés`);
}

async function insertTestRide(client: any, userId: string) {
  console.log("\n🏍️  Insertion d'un ride de test...");

  const startLat = 48.8566;
  const startLng = 2.3522;
  const endLat = 48.8584;
  const endLng = 2.2945;

  const routePoints = [
    [startLng, startLat], [2.3400, 48.8570], [2.3250, 48.8575], [2.3100, 48.8580], [endLng, endLat]
  ];
  const lineString = `LINESTRING(${routePoints.map(p => `${p[0]} ${p[1]}`).join(", ")})`;

  await client.query(
    `INSERT INTO rides (user_id, start_location, end_location, route, distance, duration, avg_speed, max_speed, is_public)
     VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
             ST_GeomFromText($6, 4326)::geography, $7, $8, $9, $10, $11)`,
    [userId, startLng, startLat, endLng, endLat, lineString, 5.2, 900, 20.8, 45.0, true]
  );

  console.log("✅ Ride de test créé (Paris -> Tour Eiffel)");
}

async function insertSocialTestData(client: any, testUserId: string) {
  console.log("\n👥 Insertion des données sociales...");

  // Créer des utilisateurs supplémentaires
  const users = [
    { email: "rider1@roadquest.com", username: "MaxRider", level: 15 },
    { email: "rider2@roadquest.com", username: "BikerGirl", level: 22 },
    { email: "rider3@roadquest.com", username: "SpeedDemon", level: 8 },
  ];

  const userIds: string[] = [];
  for (const user of users) {
    const result = await client.query(
      `INSERT INTO users (email, password, username, level, xp)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
       RETURNING user_id`,
      [user.email, "$2b$10$dummyhashedpassword", user.username, user.level, user.level * 100]
    );
    userIds.push(result.rows[0].user_id);
    console.log(`  ✅ Utilisateur: ${user.username}`);
  }

  // Créer des follows
  for (const userId of userIds) {
    await client.query(
      `INSERT INTO user_follows (follower_id, following_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [testUserId, userId]
    );
  }
  console.log("✅ Relations de follow créées");
}

// ============================================
// MAIN
// ============================================

async function seedAll() {
  const client = await pool.connect();
  try {
    console.log("🚀 Démarrage du seeding complet...\n");
    console.log("=".repeat(50));

    // 1. Créer l'utilisateur de test
    const testUserId = await createTestUser(client);

    // 2. Insérer les POIs
    await insertPOIs();

    // 3. Insérer un ride de test
    await insertTestRide(client, testUserId);

    // 4. Insérer les données sociales
    await insertSocialTestData(client, testUserId);

    console.log("\n" + "=".repeat(50));
    console.log("✅ Seeding terminé avec succès !");
    console.log("\n📋 Informations de connexion:");
    console.log(`   Email: ${TEST_USER.email}`);
    console.log(`   Password: ${TEST_USER.password}`);

  } catch (error) {
    console.error("❌ Erreur lors du seeding:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedAll().catch(console.error);
