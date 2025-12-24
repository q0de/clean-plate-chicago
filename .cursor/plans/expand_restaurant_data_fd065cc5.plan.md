---
name: Expand Restaurant Data
overview: Geocode missing addresses and re-import data to capture more restaurants, especially in the West Loop area.
todos:
  - id: add-geocoding
    content: Add geocoding function using Mapbox to import script
    status: completed
  - id: update-import-script
    content: Modify import to include establishments without coords and geocode them
    status: completed
  - id: run-fresh-import
    content: Run fresh import with geocoding to capture all restaurants
    status: in_progress
---

# Expand Restaurant Data Coverage

Currently we skip restaurants without coordinates, which excludes many establishments. The West Loop has 200+ restaurants but we only show ~22.

## Root Cause

In [`scripts/import-real-inspections.js`](scripts/import-real-inspections.js), line 171-175:

```javascript
if (!est.latitude || !est.longitude) {
  console.log(`Skipping ${est.dba_name} - no coordinates`);
  continue;
}
```



## Solution

### 1. Add Geocoding for Missing Coordinates

Use a geocoding service (Google Maps, Mapbox, or OpenStreetMap Nominatim) to geocode addresses that don't have coordinates.

### 2. Update Import Script

Modify the import to:

- Import establishments without coordinates
- Geocode addresses in batches
- Update the database with coordinates

### 3. Re-run Import

Run a fresh import with 3 years of data to capture all restaurants.

## Implementation Options

**Option A: Use Mapbox Geocoding** (you already have Mapbox token)

- Free tier: 100,000 requests/month
- Reliable for US addresses

**Option B: Use OpenStreetMap Nominatim**

- Free, no API key needed
- Rate limited (1 request/second)

## Estimated Impact

- Current: ~1,100 establishments
- Expected after geocoding: 3,000-5,000 establishments