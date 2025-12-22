// Test what the Summary API returns for Cubanito
async function testAPI() {
  // First, find the correct slug
  const res = await fetch('http://localhost:3000/api/establishments/cubanito-expres-2053/summary');
  const data = await res.json();
  
  console.log("🔍 API Response for Cubanito Express:\n");
  console.log(JSON.stringify(data, null, 2));
}

testAPI().catch(console.error);

