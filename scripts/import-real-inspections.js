// Import real inspection data from Chicago Data Portal into Supabase
// Run with: node scripts/import-real-inspections.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Catch unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

if (!mapboxToken) {
  console.warn('Warning: NEXT_PUBLIC_MAPBOX_TOKEN not set. Geocoding will be skipped for addresses without coordinates.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Geocoding cache to avoid duplicate API calls
const geocodeCache = new Map();
let geocodeCount = 0;
let geocodeErrors = 0;

// Geocode an address using Mapbox
async function geocodeAddress(address, city, state, zip) {
  if (!mapboxToken) return null;
  
  // Build full address
  const fullAddress = `${address}, ${city || 'Chicago'}, ${state || 'IL'} ${zip || ''}`.trim();
  
  // Check cache first
  if (geocodeCache.has(fullAddress)) {
    return geocodeCache.get(fullAddress);
  }
  
  try {
    const encodedAddress = encodeURIComponent(fullAddress);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1&country=US`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      const result = { latitude: lat, longitude: lng };
      geocodeCache.set(fullAddress, result);
      geocodeCount++;
      return result;
    }
    
    geocodeCache.set(fullAddress, null);
    return null;
  } catch (error) {
    geocodeErrors++;
    if (geocodeErrors <= 5) {
      console.error(`Geocoding error for "${fullAddress}":`, error.message);
    }
    return null;
  }
}

// Rate limiter for geocoding (Mapbox allows 600 requests/minute)
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse violations string into individual violations
function parseViolations(violationsText) {
  if (!violationsText) return [];
  
  const violations = [];
  // Format: "CODE. DESCRIPTION - Comments: COMMENT | CODE. DESCRIPTION..."
  const parts = violationsText.split(' | ');
  
  for (const part of parts) {
    // More flexible regex that handles dashes in description
    // Match: "CODE. DESCRIPTION - Comments: COMMENT"
    const match = part.match(/^(\d+)\.\s*(.+?)\s*-\s*Comments:\s*(.*)$/i);
    if (match) {
      const code = match[1];
      const description = match[2].trim();
      const comment = match[3].trim();
      
      // Critical violations are typically codes 1-29 (excluding 15) in Chicago's system
      const codeNum = parseInt(code);
      const isCritical = codeNum >= 1 && codeNum <= 29 && codeNum !== 15;
      
      violations.push({
        violation_code: code,
        violation_description: description,
        violation_comment: comment,
        is_critical: isCritical,
      });
    }
  }
  
  return violations;
}

// Generate slug from name and license number (license guarantees uniqueness)
function generateSlug(name, address, licenseNumber) {
  // Use name + license number only - simpler and guaranteed unique
  const namePart = (name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);
  
  // License number is always unique, append it directly
  return `${namePart}-${licenseNumber}`;
}

// Parse risk level
function parseRiskLevel(riskStr) {
  if (!riskStr) return 2;
  if (riskStr.includes('1') || riskStr.toLowerCase().includes('high')) return 1;
  if (riskStr.includes('2') || riskStr.toLowerCase().includes('medium')) return 2;
  if (riskStr.includes('3') || riskStr.toLowerCase().includes('low')) return 3;
  return 2;
}

// Configuration - adjust these to control how much history to import
const MONTHS_OF_HISTORY = 36; // 3 years of history for good trend/track record data
const RECORDS_PER_PAGE = 1000;
const MAX_PAGES = 100; // Allow up to 100,000 records (Chicago has ~50k in 3 years)

async function importData() {
  console.log('Fetching inspection data from Chicago Data Portal...');
  
  const CLEAR_EXISTING = process.env.CLEAR_DATA === 'true';
  let startDateStr;
  
  // For incremental syncs, only fetch records newer than our latest inspection
  if (!CLEAR_EXISTING) {
    const { data: latestInspection } = await supabase
      .from('inspections')
      .select('inspection_date')
      .order('inspection_date', { ascending: false })
      .limit(1)
      .single();
    
    if (latestInspection?.inspection_date) {
      // Go back 7 days from latest to catch any delayed records
      const latestDate = new Date(latestInspection.inspection_date);
      latestDate.setDate(latestDate.getDate() - 7);
      startDateStr = latestDate.toISOString().split('T')[0];
      console.log(`Incremental sync: fetching records since ${startDateStr}`);
    }
  }
  
  // Fall back to full history if clearing or no existing data
  if (!startDateStr) {
    console.log(`Importing ${MONTHS_OF_HISTORY} months of history...`);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - MONTHS_OF_HISTORY);
    startDateStr = startDate.toISOString().split('T')[0];
  }
  
  console.log(`Date range: ${startDateStr} to present`);
  
  // Fetch inspections with pagination
  let allData = [];
  let offset = 0;
  let page = 0;
  
  while (page < MAX_PAGES) {
    const url = `https://data.cityofchicago.org/resource/4ijn-s7e5.json?$limit=${RECORDS_PER_PAGE}&$offset=${offset}&$order=inspection_date DESC&$where=inspection_date >= '${startDateStr}'`;
    
    console.log(`Fetching page ${page + 1}...`);
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.length === 0) break;
    
    allData = allData.concat(data);
    console.log(`  Got ${data.length} records (total: ${allData.length})`);
    
    if (data.length < RECORDS_PER_PAGE) break; // Last page
    
    offset += RECORDS_PER_PAGE;
    page++;
    
    // Small delay to be nice to the API
    await new Promise(r => setTimeout(r, 500));
  }
  
  const data = allData;
  console.log(`Fetched ${data.length} total inspection records`);
  
  // Group by license number to get unique establishments
  const establishmentMap = new Map();
  
  for (const record of data) {
    if (!record.license_ || !record.dba_name) continue;
    
    const key = record.license_;
    if (!establishmentMap.has(key)) {
      establishmentMap.set(key, {
        license_number: record.license_,
        dba_name: record.dba_name,
        aka_name: record.aka_name || null,
        facility_type: record.facility_type || 'Restaurant',
        risk_level: parseRiskLevel(record.risk),
        address: record.address || '',
        city: record.city || 'Chicago',
        state: record.state || 'IL',
        zip: record.zip || null,
        latitude: record.latitude ? parseFloat(record.latitude) : null,
        longitude: record.longitude ? parseFloat(record.longitude) : null,
        slug: generateSlug(record.dba_name, record.address || '', record.license_),
        inspections: []
      });
    }
    
    // Add inspection
    establishmentMap.get(key).inspections.push({
      inspection_id: `${record.inspection_id || record.license_}-${record.inspection_date}`,
      inspection_date: record.inspection_date ? record.inspection_date.split('T')[0] : null,
      inspection_type: record.inspection_type || 'Canvass',
      results: record.results || 'Pass',
      raw_violations: record.violations || null,
      violations: parseViolations(record.violations)
    });
  }
  
  console.log(`Found ${establishmentMap.size} unique establishments`);
  
  // Clear existing data if requested
  if (CLEAR_EXISTING) {
    console.log('Clearing existing data...');
    await supabase.from('violations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('inspections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('establishments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  } else {
    console.log('Incremental import mode (set CLEAR_DATA=true to clear first)');
  }
  
  let establishmentCount = 0;
  let inspectionCount = 0;
  let violationCount = 0;
  
  let geocodedCount = 0;
  let skippedNoCoords = 0;
  const totalEstablishments = establishmentMap.size;
  let processed = 0;
  
  for (const [licenseNum, est] of establishmentMap) {
    processed++;
    // Log progress every 100 establishments
    if (processed % 100 === 0) {
      console.log(`Progress: ${processed}/${totalEstablishments} (${Math.round(processed/totalEstablishments*100)}%) - Imported: ${establishmentCount} establishments, ${inspectionCount} inspections`);
    }
    // Geocode if no coordinates
    if (!est.latitude || !est.longitude) {
      const geocoded = await geocodeAddress(est.address, est.city, est.state, est.zip);
      if (geocoded) {
        est.latitude = geocoded.latitude;
        est.longitude = geocoded.longitude;
        geocodedCount++;
        // Rate limit: small delay every 10 geocodes to stay under Mapbox limits
        if (geocodedCount % 10 === 0) {
          await sleep(100);
        }
      } else {
        skippedNoCoords++;
        if (skippedNoCoords <= 10) {
          console.log(`Skipping ${est.dba_name} - could not geocode address: ${est.address}`);
        }
        continue;
      }
    }
    
    // Get latest inspection info
    const sortedInspections = est.inspections.sort((a, b) => 
      new Date(b.inspection_date) - new Date(a.inspection_date)
    );
    const latest = sortedInspections[0];
    
    // Calculate simple score
    const passCount = sortedInspections.filter(i => i.results === 'Pass').length;
    const totalViolations = sortedInspections.reduce((sum, i) => sum + i.violations.length, 0);
    const criticalViolations = sortedInspections.reduce((sum, i) => 
      sum + i.violations.filter(v => v.is_critical).length, 0
    );
    
    let score = 80; // Base score
    score += (passCount / sortedInspections.length) * 15; // Up to +15 for pass rate
    score -= totalViolations * 1; // -1 per violation
    score -= criticalViolations * 3; // Extra -3 per critical
    score = Math.max(0, Math.min(100, Math.round(score)));
    
    // Upsert establishment (insert or update if exists)
    const { data: estData, error: estError } = await supabase
      .from('establishments')
      .upsert({
        license_number: est.license_number,
        dba_name: est.dba_name,
        aka_name: est.aka_name,
        facility_type: est.facility_type,
        risk_level: est.risk_level,
        address: est.address,
        city: est.city,
        state: est.state,
        zip: est.zip,
        latitude: est.latitude,
        longitude: est.longitude,
        location: `POINT(${est.longitude} ${est.latitude})`,
        slug: est.slug,
        cleanplate_score: score,
        latest_result: latest.results,
        latest_inspection_date: latest.inspection_date,
        total_inspections: sortedInspections.length,
        pass_streak: countPassStreak(sortedInspections)
      }, { 
        onConflict: 'license_number',
        ignoreDuplicates: false 
      })
      .select()
      .single();
    
    if (estError) {
      console.error(`Error upserting ${est.dba_name}:`, estError.message);
      continue;
    }
    
    establishmentCount++;
    
    // Insert inspections (skip if already exists)
    for (const insp of sortedInspections) {
      const violationCountNum = insp.violations.length;
      const criticalCountNum = insp.violations.filter(v => v.is_critical).length;
      
      // Use a consistent inspection_id format: just the numeric ID from Chicago API
      // This prevents duplicates from different ID formats (e.g., "2627108" vs "2627108-2024-11-14T00:00:00.000")
      const normalizedInspectionId = String(insp.inspection_id).split('-')[0].replace(/\D/g, '') || insp.inspection_id;
      
      // Try to upsert the inspection
      const { data: inspData, error: inspError } = await supabase
        .from('inspections')
        .upsert({
          establishment_id: estData.id,
          inspection_id: normalizedInspectionId,
          inspection_date: insp.inspection_date,
          inspection_type: insp.inspection_type,
          results: insp.results,
          raw_violations: insp.raw_violations,
          violation_count: violationCountNum,
          critical_count: criticalCountNum
        }, {
          onConflict: 'inspection_id',
          ignoreDuplicates: false // Update if exists (to ensure we have the ID)
        })
        .select()
        .maybeSingle();
      
      // If upsert failed or returned no data, try to fetch existing inspection
      let inspectionId = inspData?.id;
      if (!inspectionId) {
        const { data: existingInsp } = await supabase
          .from('inspections')
          .select('id')
          .eq('inspection_id', normalizedInspectionId)
          .single();
        inspectionId = existingInsp?.id;
      }
      
      if (!inspectionId) {
        if (inspError && !inspError.message.includes('duplicate')) {
          console.error(`Error inserting inspection:`, inspError.message);
        }
        continue;
      }
      
      inspectionCount++;
      
      // Insert violations (use upsert to prevent duplicates)
      for (const viol of insp.violations) {
        const { error: violError } = await supabase
          .from('violations')
          .upsert({
            inspection_id: inspectionId,
            violation_code: viol.violation_code,
            violation_description: viol.violation_description,
            violation_comment: viol.violation_comment,
            is_critical: viol.is_critical,
          }, {
            onConflict: 'inspection_id,violation_code',
            ignoreDuplicates: true
          });
        
        if (!violError) {
          violationCount++;
        }
      }
    }
  }
  
  console.log('\n=== Import Complete ===');
  console.log(`Establishments: ${establishmentCount}`);
  console.log(`Inspections: ${inspectionCount}`);
  console.log(`Violations: ${violationCount}`);
  console.log(`Geocoded addresses: ${geocodedCount}`);
  console.log(`Skipped (no coordinates): ${skippedNoCoords}`);
  
  // Assign neighborhoods to new establishments
  console.log('\nAssigning neighborhoods to establishments...');
  const { error: neighError } = await supabase.rpc('assign_neighborhoods_by_distance');
  if (neighError) {
    console.log('Note: Run assign-neighborhoods.js separately to assign neighborhoods');
  } else {
    console.log('Neighborhoods assigned!');
  }
  
  // Update neighborhood statistics
  console.log('Updating neighborhood stats...');
  await supabase.rpc('update_neighborhood_stats').catch(() => {
    console.log('Note: Neighborhood stats update skipped (run manually if needed)');
  });
}

function countPassStreak(inspections) {
  let streak = 0;
  for (const insp of inspections) {
    if (insp.results === 'Pass') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

importData().catch(console.error);


