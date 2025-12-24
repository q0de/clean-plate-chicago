/**
 * Import Historical Inspection Data from Chicago Data Portal
 * 
 * This script fetches inspection data for multiple restaurants over a longer time period
 * to populate the score trend charts and inspection timelines.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CHICAGO_API_BASE = 'https://data.cityofchicago.org/resource/4ijn-s7e5.json';

// Parse violations string into structured data
function parseViolations(violationsString) {
  if (!violationsString) return [];
  
  const violations = [];
  const parts = violationsString.split('|').map(p => p.trim()).filter(Boolean);
  
  for (const part of parts) {
    const match = part.match(/^(\d+)\.\s*(.+?)(?:\s*-\s*Comments:\s*(.*))?$/s);
    if (match) {
      const code = match[1];
      const description = match[2].trim();
      const comment = match[3]?.trim() || null;
      
      // Codes 1-14, 15-29 are typically critical; 30-44 serious; 45+ minor
      const codeNum = parseInt(code);
      const isCritical = codeNum <= 29;
      
      violations.push({
        violation_code: code,
        violation_description: description,
        violation_comment: comment,
        is_critical: isCritical
      });
    }
  }
  
  return violations;
}

// Generate slug from name and address
function generateSlug(name, address) {
  const combined = `${name} ${address}`.toLowerCase();
  return combined
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

async function fetchInspections() {
  console.log('Fetching inspections from Chicago Data Portal...');
  
  // Fetch inspections from the last 3 years with failures and conditional passes
  const query = `$where=inspection_date > '2022-01-01' AND (results = 'Fail' OR results = 'Pass w/ Conditions' OR results = 'Pass')&$limit=500&$order=inspection_date DESC`;
  
  const response = await fetch(`${CHICAGO_API_BASE}?${query}`);
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const data = await response.json();
  console.log(`Fetched ${data.length} inspections`);
  
  return data;
}

async function importData() {
  try {
    const inspections = await fetchInspections();
    
    // Group by license number to find establishments
    const byLicense = new Map();
    
    for (const inspection of inspections) {
      const license = inspection.license_;
      if (!license) continue;
      
      if (!byLicense.has(license)) {
        byLicense.set(license, {
          info: inspection,
          inspections: []
        });
      }
      byLicense.get(license).inspections.push(inspection);
    }
    
    console.log(`Found ${byLicense.size} unique establishments`);
    
    // Take top 30 establishments with most inspections (for good history)
    const sorted = [...byLicense.entries()]
      .filter(([_, data]) => data.inspections.length >= 2)
      .sort((a, b) => b[1].inspections.length - a[1].inspections.length)
      .slice(0, 30);
    
    console.log(`Processing ${sorted.length} establishments with multiple inspections`);
    
    let imported = 0;
    let skipped = 0;
    
    for (const [license, data] of sorted) {
      const info = data.info;
      const slug = generateSlug(info.dba_name || info.aka_name || 'unknown', info.address || '');
      
      // Skip if no location
      if (!info.latitude || !info.longitude) {
        skipped++;
        continue;
      }
      
      // Calculate score based on latest result
      const latestInspection = data.inspections[0];
      const latestResult = latestInspection.results;
      let score = 75;
      if (latestResult === 'Pass') score = 85 + Math.floor(Math.random() * 10);
      else if (latestResult === 'Pass w/ Conditions') score = 60 + Math.floor(Math.random() * 15);
      else if (latestResult === 'Fail') score = 30 + Math.floor(Math.random() * 20);
      
      // Upsert establishment
      const { data: estData, error: estError } = await supabase
        .from('establishments')
        .upsert({
          license_number: license,
          dba_name: info.dba_name || 'Unknown',
          aka_name: info.aka_name,
          facility_type: info.facility_type || 'Restaurant',
          risk_level: parseInt(info.risk?.match(/\d/)?.[0] || '2'),
          address: info.address,
          city: info.city || 'CHICAGO',
          state: info.state || 'IL',
          zip: info.zip,
          latitude: parseFloat(info.latitude),
          longitude: parseFloat(info.longitude),
          slug: slug,
          cleanplate_score: score,
          latest_result: latestResult,
          latest_inspection_date: latestInspection.inspection_date,
          total_inspections: data.inspections.length,
        }, {
          onConflict: 'license_number',
          ignoreDuplicates: false
        })
        .select()
        .single();
      
      if (estError) {
        console.error(`Error upserting establishment ${info.dba_name}:`, estError.message);
        continue;
      }
      
      // Import inspections for this establishment
      for (const insp of data.inspections) {
        const violations = parseViolations(insp.violations);
        
        // Use a consistent inspection_id format: just the numeric ID
        const normalizedInspectionId = String(insp.inspection_id).split('-')[0].replace(/\D/g, '') || insp.inspection_id;
        
        const { data: inspData, error: inspError } = await supabase
          .from('inspections')
          .upsert({
            establishment_id: estData.id,
            inspection_id: normalizedInspectionId,
            inspection_date: insp.inspection_date,
            inspection_type: insp.inspection_type || 'Canvass',
            results: insp.results
          }, {
            onConflict: 'inspection_id',
            ignoreDuplicates: false
          })
          .select()
          .maybeSingle();
        
        if (inspError) {
          console.error(`Error upserting inspection:`, inspError.message);
          continue;
        }
        
        // Import violations
        if (violations.length > 0) {
          // Delete existing violations for this inspection
          await supabase
            .from('violations')
            .delete()
            .eq('inspection_id', inspData.id);
          
          // Insert new violations
          const violationRecords = violations.map(v => ({
            inspection_id: inspData.id,
            ...v
          }));
          
          const { error: violError } = await supabase
            .from('violations')
            .insert(violationRecords);
          
          if (violError) {
            console.error(`Error inserting violations:`, violError.message);
          }
        }
      }
      
      imported++;
      console.log(`✓ Imported: ${info.dba_name} (${data.inspections.length} inspections)`);
    }
    
    console.log(`\nDone! Imported ${imported} establishments, skipped ${skipped}`);
    
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

importData();

