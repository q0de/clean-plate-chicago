// Import real inspection data from Chicago Data Portal into Supabase
// Run with: node scripts/import-real-inspections.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Parse violations string into individual violations
function parseViolations(violationsText) {
  if (!violationsText) return [];
  
  const violations = [];
  // Format: "CODE. DESCRIPTION - Comments: COMMENT | CODE. DESCRIPTION..."
  const parts = violationsText.split(' | ');
  
  for (const part of parts) {
    const match = part.match(/^(\d+)\.\s*([^-]+)\s*-\s*Comments:\s*(.*)$/i);
    if (match) {
      const code = match[1];
      const description = match[2].trim();
      const comment = match[3].trim();
      
      // Critical violations are typically codes 1-14, 16-29 in Chicago's system
      const criticalCodes = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','16','17','18','19','20','21','22','23','24','25','26','27','28','29'];
      const isCritical = criticalCodes.includes(code);
      
      violations.push({
        violation_code: code,
        violation_description: description,
        violation_comment: comment,
        is_critical: isCritical,
        plain_english: generatePlainEnglish(code, description)
      });
    }
  }
  
  return violations;
}

// Generate plain English explanation for common violations
function generatePlainEnglish(code, description) {
  const explanations = {
    '1': 'Staff member in charge must be present and knowledgeable about food safety.',
    '2': 'All food handlers must have valid Chicago food sanitation certificates.',
    '3': 'Employees must report illnesses that could affect food safety.',
    '4': 'No bare hand contact with ready-to-eat foods without proper utensils.',
    '5': 'Procedures to prevent contamination from unclean hands must be followed.',
    '6': 'Food must come from approved and inspected sources only.',
    '7': 'Food must be at proper temperatures to prevent bacterial growth.',
    '8': 'Time and temperature controls must be followed for food safety.',
    '10': 'Handwashing sinks must be accessible and properly stocked.',
    '11': 'Food received at the restaurant was not at safe temperatures.',
    '18': 'Proper procedures for cooling hot foods were not followed.',
    '32': 'Packaging and containers must be food-grade and clean.',
    '33': 'Food must be stored properly to prevent contamination.',
    '34': 'Proper thermometers must be used to monitor food temperatures.',
    '35': 'Food must be properly protected from potential contamination.',
    '36': 'Labels must include required allergen information.',
    '37': 'All food containers must be properly labeled with contents.',
    '38': 'Insects, rodents, or animals were found in the establishment.',
    '41': 'Chemicals and toxic substances must be stored safely away from food.',
    '43': 'Equipment must be in good repair to allow proper cleaning.',
    '44': 'Utensils must be stored properly to prevent contamination.',
    '45': 'Single-use items must not be reused.',
    '47': 'Equipment surfaces must be smooth, cleanable, and in good repair.',
    '49': 'Non-food contact surfaces must be kept clean.',
    '51': 'Plumbing must be properly installed without leaks.',
    '55': 'Facilities must be cleaned and maintained properly.',
    '56': 'Ventilation systems must be adequate and clean.',
    '57': 'Bathroom facilities must have self-closing doors.',
    '60': 'Previous violations from prior inspection were not corrected.'
  };
  
  return explanations[code] || `Violation related to: ${description.toLowerCase()}`;
}

// Generate slug from name and address
function generateSlug(name, address) {
  const combined = `${name} ${address.split(' ').slice(0, 3).join(' ')}`;
  return combined
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

// Parse risk level
function parseRiskLevel(riskStr) {
  if (!riskStr) return 2;
  if (riskStr.includes('1') || riskStr.toLowerCase().includes('high')) return 1;
  if (riskStr.includes('2') || riskStr.toLowerCase().includes('medium')) return 2;
  if (riskStr.includes('3') || riskStr.toLowerCase().includes('low')) return 3;
  return 2;
}

async function importData() {
  console.log('Fetching inspection data from Chicago Data Portal...');
  
  // Fetch recent inspections with violations
  const url = 'https://data.cityofchicago.org/resource/4ijn-s7e5.json?$limit=100&$order=inspection_date DESC&$where=inspection_date > \'2025-11-01\'';
  
  const res = await fetch(url);
  const data = await res.json();
  
  console.log(`Fetched ${data.length} inspection records`);
  
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
        slug: generateSlug(record.dba_name, record.address || ''),
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
  
  // Clear existing sample data
  console.log('Clearing existing data...');
  await supabase.from('violations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('inspections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('establishments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  let establishmentCount = 0;
  let inspectionCount = 0;
  let violationCount = 0;
  
  for (const [licenseNum, est] of establishmentMap) {
    // Skip if no coordinates (needed for map)
    if (!est.latitude || !est.longitude) {
      console.log(`Skipping ${est.dba_name} - no coordinates`);
      continue;
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
    
    // Insert establishment
    const { data: estData, error: estError } = await supabase
      .from('establishments')
      .insert({
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
      })
      .select()
      .single();
    
    if (estError) {
      console.error(`Error inserting ${est.dba_name}:`, estError.message);
      continue;
    }
    
    establishmentCount++;
    
    // Insert inspections
    for (const insp of sortedInspections) {
      const violationCountNum = insp.violations.length;
      const criticalCountNum = insp.violations.filter(v => v.is_critical).length;
      
      const { data: inspData, error: inspError } = await supabase
        .from('inspections')
        .insert({
          establishment_id: estData.id,
          inspection_id: insp.inspection_id,
          inspection_date: insp.inspection_date,
          inspection_type: insp.inspection_type,
          results: insp.results,
          raw_violations: insp.raw_violations,
          violation_count: violationCountNum,
          critical_count: criticalCountNum
        })
        .select()
        .single();
      
      if (inspError) {
        console.error(`Error inserting inspection:`, inspError.message);
        continue;
      }
      
      inspectionCount++;
      
      // Insert violations
      for (const viol of insp.violations) {
        const { error: violError } = await supabase
          .from('violations')
          .insert({
            inspection_id: inspData.id,
            violation_code: viol.violation_code,
            violation_description: viol.violation_description,
            violation_comment: viol.violation_comment,
            is_critical: viol.is_critical,
            plain_english: viol.plain_english
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


