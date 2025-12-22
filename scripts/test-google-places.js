const https = require('https');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
console.log('API Key exists:', !!apiKey);
console.log('API Key prefix:', apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING');

// Test with a simple search
const query = encodeURIComponent('Starbucks Chicago');
const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('\n=== Google Places API Test ===');
    console.log('Status:', json.status);
    if (json.error_message) {
      console.log('Error:', json.error_message);
    }
    if (json.status === 'OK') {
      console.log('Results found:', json.results?.length);
      console.log('First result:', json.results?.[0]?.name);
      console.log('\n✅ Google Places API is WORKING!');
    } else {
      console.log('\n❌ Google Places API NOT working');
      console.log('\nTo fix:');
      console.log('1. Go to https://console.cloud.google.com/apis/library/places-backend.googleapis.com');
      console.log('2. Click ENABLE');
      console.log('3. Make sure billing is linked at https://console.cloud.google.com/billing');
    }
  });
}).on('error', (e) => console.error('Request error:', e));

