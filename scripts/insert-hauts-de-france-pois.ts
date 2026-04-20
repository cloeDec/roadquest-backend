import { pool } from '../src/config/database';

/**
 * Script pour insérer des POIs dans les Hauts-de-France
 * Usage: npx ts-node scripts/insert-hauts-de-france-pois.ts
 */

interface POIData {
  name: string;
  type: 'col' | 'route_panoramique' | 'virage' | 'spot_photo' | 'monument' | 'autre';
  description: string;
  latitude: number;
  longitude: number;
  rating: number;
  image_url?: string;
}

async function insertPOI(poi: POIData) {
  const query = `
    INSERT INTO pois (
      name,
      type,
      description,
      location,
      rating,
      image_url,
      is_verified
    )
    VALUES (
      $1, $2, $3,
      ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
      $6, $7, true
    )
    RETURNING poi_id, name, type, rating
  `;

  try {
    const result = await pool.query(query, [
      poi.name,
      poi.type,
      poi.description,
      poi.longitude,
      poi.latitude,
      poi.rating,
      poi.image_url || null
    ]);

    const inserted = result.rows[0];
    console.log(`✅ ${inserted.name} (${inserted.type}) - ⭐ ${inserted.rating}`);
    return true;
  } catch (error: any) {
    if (error.code === '23505') {
      console.log(`⚠️  ${poi.name} - Déjà existant (ignoré)`);
      return false;
    } else {
      console.error(`❌ Erreur pour ${poi.name}:`, error.message);
      return false;
    }
  }
}

async function main() {
  console.log('🚀 Insertion des POIs des Hauts-de-France...\n');
  console.log('📝 Entrez vos POIs (format JSON) :');
  console.log('   Exemple :');
  console.log('   {');
  console.log('     "name": "Mont des Cats",');
  console.log('     "type": "spot_photo",');
  console.log('     "description": "Point culminant de la Flandre française offrant une vue panoramique",');
  console.log('     "latitude": 50.7739,');
  console.log('     "longitude": 2.6528,');
  console.log('     "rating": 4.0');
  console.log('   }\n');
  console.log('Types disponibles: col, route_panoramique, virage, spot_photo, monument, autre\n');
  console.log('-------------------------------------------\n');

  // Exemples de POIs pour les Hauts-de-France
  const hautsDeFrancePOIs: POIData[] = [
    // Monuments historiques
    {
      name: "Cathédrale Notre-Dame d'Amiens",
      type: 'monument',
      description: "Plus vaste cathédrale gothique de France, classée au patrimoine mondial de l'UNESCO. Un chef-d'œuvre d'architecture médiévale.",
      latitude: 49.8947,
      longitude: 2.3017,
      rating: 5.0
    },
    {
      name: "Beffroi de Lille",
      type: 'monument',
      description: "Beffroi de 104 mètres dominant la ville, symbole de Lille et classé UNESCO. Vue panoramique exceptionnelle sur la métropole.",
      latitude: 50.6372,
      longitude: 3.0689,
      rating: 4.5
    },
    {
      name: "Château de Chantilly",
      type: 'monument',
      description: "Somptueux château Renaissance abritant le Musée Condé et ses collections exceptionnelles. Jardins à la française magnifiques.",
      latitude: 49.1936,
      longitude: 2.4856,
      rating: 5.0
    },
    {
      name: "Château de Pierrefonds",
      type: 'monument',
      description: "Impressionnant château médiéval restauré par Viollet-le-Duc. Architecture néo-gothique spectaculaire.",
      latitude: 49.3481,
      longitude: 2.9794,
      rating: 4.5
    },

    // Spots photo et panoramas
    {
      name: "Cap Blanc-Nez",
      type: 'spot_photo',
      description: "Falaises spectaculaires de 134m dominant la Manche. Vue imprenable sur les côtes anglaises par temps clair.",
      latitude: 50.9236,
      longitude: 1.7128,
      rating: 5.0
    },
    {
      name: "Cap Gris-Nez",
      type: 'spot_photo',
      description: "Point le plus proche de l'Angleterre, falaises sauvages et phare emblématique. Panorama exceptionnel sur les Deux Caps.",
      latitude: 50.8686,
      longitude: 1.5828,
      rating: 5.0
    },
    {
      name: "Mont des Cats",
      type: 'spot_photo',
      description: "Point culminant de la Flandre française (164m) offrant une vue panoramique à 360° sur la plaine flamande.",
      latitude: 50.7739,
      longitude: 2.6528,
      rating: 4.0
    },
    {
      name: "Dune du Pilat du Nord - Dune Dewulf",
      type: 'spot_photo',
      description: "Plus haute dune de la Côte d'Opale, paysages dunaires préservés et vues sur la mer du Nord.",
      latitude: 51.0894,
      longitude: 2.5631,
      rating: 4.0
    },

    // Routes panoramiques
    {
      name: "Route des Deux Caps",
      type: 'route_panoramique',
      description: "Route côtière spectaculaire reliant le Cap Gris-Nez au Cap Blanc-Nez. 20km de paysages marins exceptionnels.",
      latitude: 50.8961,
      longitude: 1.6478,
      rating: 5.0
    },
    {
      name: "Route de la Baie de Somme",
      type: 'route_panoramique',
      description: "Circuit côtier autour de la plus belle baie du monde. Villages authentiques, phares et panoramas marins.",
      latitude: 50.2236,
      longitude: 1.5850,
      rating: 4.5
    },
    {
      name: "Route des Crêtes - Forêt de Compiègne",
      type: 'route_panoramique',
      description: "Parcours forestier vallonné dans la plus grande forêt domaniale de France (14 500 ha). Points de vue sur la forêt.",
      latitude: 49.4178,
      longitude: 2.8269,
      rating: 4.0
    },

    // Virages et routes sinueuses
    {
      name: "Montée du Mont Cassel",
      type: 'virage',
      description: "Montée sinueuse vers le Mont Cassel (176m), point culminant des Flandres. Route en lacets avec panorama final.",
      latitude: 50.7997,
      longitude: 2.4861,
      rating: 3.5
    },
    {
      name: "Côte de Monchy",
      type: 'virage',
      description: "Montée historique vers Monchy-Lagache, tracé vallonné typique du Santerre. Paysages de bocage.",
      latitude: 49.9167,
      longitude: 3.0667,
      rating: 3.0
    },

    // Autres lieux d'intérêt
    {
      name: "Parc Astérix",
      type: 'autre',
      description: "Parc d'attractions thématique basé sur l'univers d'Astérix. Attractions et spectacles pour toute la famille.",
      latitude: 49.1361,
      longitude: 2.5722,
      rating: 4.5
    },
    {
      name: "Nausicaá - Centre National de la Mer",
      type: 'autre',
      description: "Plus grand aquarium d'Europe à Boulogne-sur-Mer. 58 000 animaux marins, expérience immersive exceptionnelle.",
      latitude: 50.7333,
      longitude: 1.5978,
      rating: 5.0
    },
    {
      name: "Mémorial de Thiepval",
      type: 'monument',
      description: "Monument commémoratif de la Bataille de la Somme. 72m de hauteur, hommage aux 72 000 disparus britanniques.",
      latitude: 50.0508,
      longitude: 2.6850,
      rating: 4.5
    },
    {
      name: "Vieille Ville de Lille",
      type: 'autre',
      description: "Centre historique de Lille avec architecture flamande. Grand'Place, Vieille Bourse, ruelles pavées authentiques.",
      latitude: 50.6367,
      longitude: 3.0633,
      rating: 4.5
    }
  ];

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  console.log(`📍 ${hautsDeFrancePOIs.length} POIs à insérer\n`);

  for (const poi of hautsDeFrancePOIs) {
    const result = await insertPOI(poi);
    if (result === true) {
      successCount++;
    } else if (result === false) {
      skipCount++;
    } else {
      errorCount++;
    }
  }

  console.log('\n📊 Résumé:');
  console.log(`✅ POIs insérés: ${successCount}`);
  console.log(`⚠️  POIs ignorés (déjà existants): ${skipCount}`);
  console.log(`❌ Erreurs: ${errorCount}`);

  // Afficher le nombre total de POIs dans la BDD
  const countResult = await pool.query('SELECT COUNT(*) as total FROM pois');
  console.log(`\n📍 Total de POIs dans la base: ${countResult.rows[0].total}`);

  // Afficher la répartition par type
  const typeResult = await pool.query(`
    SELECT type, COUNT(*) as count
    FROM pois
    GROUP BY type
    ORDER BY count DESC
  `);

  console.log('\n📈 Répartition par type:');
  typeResult.rows.forEach(row => {
    console.log(`   ${row.type}: ${row.count}`);
  });

  await pool.end();
}

main().catch(error => {
  console.error('❌ Erreur:', error);
  process.exit(1);
});
