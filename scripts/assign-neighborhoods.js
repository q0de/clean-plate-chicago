// Assign neighborhood_id to establishments based on their coordinates
// Run with: node scripts/assign-neighborhoods.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Chicago neighborhood boundaries GeoJSON
const BOUNDARIES_URL = 'https://data.cityofchicago.org/resource/igwz-8jzy.geojson';

// Point-in-polygon using ray casting algorithm
function isPointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

// Check if point is in any polygon of a geometry
function isPointInGeometry(point, geometry) {
  if (geometry.type === 'Polygon') {
    return isPointInPolygon(point, geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      if (isPointInPolygon(point, polygon[0])) {
        return true;
      }
    }
  }
  return false;
}

// Normalize name for matching
function normalizeSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

async function assignNeighborhoods() {
  console.log('Fetching Chicago neighborhood boundaries...');
  
  const res = await fetch(BOUNDARIES_URL);
  const geojson = await res.json();
  
  console.log(`Loaded ${geojson.features.length} neighborhood boundaries`);
  
  // Build lookup from geometry
  const neighborhoods = geojson.features.map(feature => ({
    name: feature.properties.pri_neigh || feature.properties.community || 'Unknown',
    geometry: feature.geometry,
  }));
  
  // Fetch all neighborhoods from our database
  const { data: dbNeighborhoods, error: neighError } = await supabase
    .from('neighborhoods')
    .select('id, name, slug');
  
  if (neighError) {
    console.error('Failed to fetch neighborhoods:', neighError);
    return;
  }
  
  console.log(`Found ${dbNeighborhoods.length} neighborhoods in database`);
  
  // Create slug -> id mapping
  const neighborhoodMap = {};
  for (const n of dbNeighborhoods) {
    neighborhoodMap[n.slug] = n.id;
    // Also add normalized name
    neighborhoodMap[normalizeSlug(n.name)] = n.id;
  }
  
  // Fetch all establishments
  const { data: establishments, error: estError } = await supabase
    .from('establishments')
    .select('id, dba_name, latitude, longitude, neighborhood_id')
    .is('neighborhood_id', null);
  
  if (estError) {
    console.error('Failed to fetch establishments:', estError);
    return;
  }
  
  console.log(`Found ${establishments.length} establishments without neighborhoods`);
  
  let assigned = 0;
  let notFound = 0;
  
  for (const est of establishments) {
    if (!est.latitude || !est.longitude) {
      notFound++;
      continue;
    }
    
    const point = [parseFloat(est.longitude), parseFloat(est.latitude)];
    
    // Find which neighborhood this point is in
    let matchedNeighborhood = null;
    
    for (const neigh of neighborhoods) {
      if (isPointInGeometry(point, neigh.geometry)) {
        matchedNeighborhood = neigh.name;
        break;
      }
    }
    
    if (matchedNeighborhood) {
      // Find the neighborhood ID
      const slug = normalizeSlug(matchedNeighborhood);
      const neighborhoodId = neighborhoodMap[slug];
      
      if (neighborhoodId) {
        const { error: updateError } = await supabase
          .from('establishments')
          .update({ neighborhood_id: neighborhoodId })
          .eq('id', est.id);
        
        if (!updateError) {
          assigned++;
        } else {
          console.error(`Failed to update ${est.dba_name}:`, updateError.message);
        }
      } else {
        // Try finding by partial match
        const matchingKey = Object.keys(neighborhoodMap).find(key => 
          key.includes(slug) || slug.includes(key)
        );
        if (matchingKey) {
          const { error: updateError } = await supabase
            .from('establishments')
            .update({ neighborhood_id: neighborhoodMap[matchingKey] })
            .eq('id', est.id);
          
          if (!updateError) {
            assigned++;
          }
        } else {
          console.log(`No matching neighborhood in DB for: ${matchedNeighborhood} (${est.dba_name})`);
          notFound++;
        }
      }
    } else {
      notFound++;
    }
    
    // Progress indicator
    if ((assigned + notFound) % 50 === 0) {
      console.log(`Progress: ${assigned} assigned, ${notFound} not found`);
    }
  }
  
  console.log('\n=== Assignment Complete ===');
  console.log(`Assigned: ${assigned}`);
  console.log(`Not found: ${notFound}`);
  
  // Update neighborhood stats
  console.log('\nUpdating neighborhood statistics...');
  
  const { data: stats } = await supabase
    .from('establishments')
    .select('neighborhood_id, cleanplate_score, latest_result')
    .not('neighborhood_id', 'is', null);
  
  if (stats) {
    // Group by neighborhood
    const neighborhoodStats = {};
    for (const est of stats) {
      if (!neighborhoodStats[est.neighborhood_id]) {
        neighborhoodStats[est.neighborhood_id] = {
          total: 0,
          passes: 0,
          totalScore: 0,
          failures: 0,
        };
      }
      const s = neighborhoodStats[est.neighborhood_id];
      s.total++;
      s.totalScore += est.cleanplate_score || 0;
      if (est.latest_result?.toLowerCase().includes('pass') && !est.latest_result?.toLowerCase().includes('fail')) {
        s.passes++;
      }
      if (est.latest_result?.toLowerCase().includes('fail')) {
        s.failures++;
      }
    }
    
    // Update each neighborhood
    for (const [neighId, s] of Object.entries(neighborhoodStats)) {
      await supabase
        .from('neighborhoods')
        .update({
          total_establishments: s.total,
          pass_rate: s.total > 0 ? (s.passes / s.total) * 100 : null,
          avg_score: s.total > 0 ? s.totalScore / s.total : null,
          recent_failures: s.failures,
        })
        .eq('id', neighId);
    }
    
    console.log('Neighborhood stats updated!');
  }
}

assignNeighborhoods().catch(console.error);

