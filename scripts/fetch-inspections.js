// Fetch real inspection data from Chicago Data Portal
async function fetchInspections() {
  const url = 'https://data.cityofchicago.org/resource/4ijn-s7e5.json?$limit=20&$order=inspection_date DESC';
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    console.log('=== Sample Inspection Data from Chicago Portal ===');
    console.log('Total records:', data.length);
    
    // Show first 5 with details
    data.slice(0, 5).forEach((r, i) => {
      console.log('\n--- Record', i+1, '---');
      console.log('DBA Name:', r.dba_name);
      console.log('Address:', r.address);
      console.log('Inspection Date:', r.inspection_date);
      console.log('Inspection Type:', r.inspection_type);
      console.log('Results:', r.results);
      console.log('Risk:', r.risk);
      console.log('License #:', r.license_);
      console.log('Facility Type:', r.facility_type);
      console.log('Latitude:', r.latitude);
      console.log('Longitude:', r.longitude);
      console.log('Violations (first 800 chars):');
      console.log((r.violations || 'No violations recorded').substring(0, 800));
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

fetchInspections();


