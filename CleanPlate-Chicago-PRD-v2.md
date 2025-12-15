# CleanPlate Chicago
## Product Requirements Document v2.0

**Version:** 2.0  
**Date:** December 2025  
**Stack:** React + Vite, Supabase, HeroUI, Mapbox  
**Changes:** Yelp-inspired UX patterns, API endpoints, component states, improved specifications

---

## Executive Summary

CleanPlate Chicago transforms 200,000+ public restaurant health inspection records into a consumer-friendly mobile-first web app. Users search restaurants, view inspection scores on an interactive map, and access violation histories with a UX inspired by Yelp's proven patterns — but focused entirely on food safety.

**Mission:** Make restaurant health data accessible, understandable, and actionable for every Chicago diner.

**Differentiator:** Unlike Yelp (which buries inspection data in Amenities) or defunct competitors (HDScores), CleanPlate makes safety the primary lens for restaurant discovery.

---

## Problem Statement

### Current State
- Chicago maintains 200,000+ inspection records via open API (data.cityofchicago.org)
- Official portal designed for data analysts, not consumers
- Yelp has inspection data but buries it — safety is a feature, not a focus
- HDScores (previous market leader) is defunct
- No dedicated Chicago solution with modern mobile UX

### User Pain Points
1. Cannot quickly check restaurant cleanliness before dining
2. Government data is raw, tabular, no visual hierarchy
3. No mobile experience for checking scores on the go
4. Historical trends and violation patterns not surfaced
5. No way to compare restaurants by safety within a neighborhood

---

## Target Users

### Primary: Chicago Diners
| Persona | Need | Behavior |
|---------|------|----------|
| Health-conscious individual | Verify cleanliness before dining | Searches specific restaurant before reservation |
| Parent | Ensure food safety for children | Checks score while deciding where to eat |
| Food allergy sufferer | Assess cross-contamination risk | Reviews violation history for handling issues |
| Tourist | Find trusted dining options | Browses neighborhood, filters by score |

### Secondary: Research & Professional
| Persona | Need | Behavior |
|---------|------|----------|
| Apartment hunter | Evaluate neighborhood quality | Compares pass rates across areas |
| Real estate investor | Assess commercial corridor health | Reviews aggregate neighborhood data |
| Journalist | Cover food safety stories | Searches recent failures, exports data |

---

## Data Source

### Chicago Data Portal — Food Inspections Dataset

**API Endpoint:** `https://data.cityofchicago.org/resource/4ijn-s7e5.json`

**Format:** JSON via Socrata Open Data API (SODA)

**Update Frequency:** Weekly (Fridays)

**License:** Public domain (government data)

**Record Count:** ~200,000 inspections dating to 2010

### Key Fields to Ingest

| Field | Type | Description |
|-------|------|-------------|
| inspection_id | string | Unique identifier (primary key for sync) |
| dba_name | string | Business name (Doing Business As) |
| aka_name | string | Also Known As name |
| license_ | string | Business license number |
| facility_type | string | Restaurant, Grocery, School, Daycare, etc. |
| risk | string | "Risk 1 (High)", "Risk 2 (Medium)", "Risk 3 (Low)" |
| address | string | Street address |
| city | string | City name |
| state | string | State abbreviation |
| zip | string | ZIP code |
| latitude | number | GPS latitude |
| longitude | number | GPS longitude |
| inspection_date | date | Date of inspection (ISO 8601) |
| inspection_type | string | Canvass, Complaint, License, Re-inspection |
| results | string | Pass, Pass w/ Conditions, Fail, Out of Business, etc. |
| violations | string | Pipe-delimited violation codes and descriptions |

### Data Sync Strategy

```
Schedule: Daily at 2:00 AM CST via Supabase Edge Function
Method: 
  1. Fetch from Chicago API with pagination (limit=1000, offset=N)
  2. Parse violations string (pipe-delimited) into separate records
  3. Upsert by inspection_id to prevent duplicates
  4. Geocode any records missing lat/long (<1% of records)
  5. Calculate CleanPlate Score for affected establishments
  6. Update neighborhood aggregate stats
  7. Log sync results to monitoring table
```

---

## Database Schema (Supabase/PostgreSQL)

### Table: establishments

```sql
CREATE TABLE establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_number TEXT UNIQUE NOT NULL,
  dba_name TEXT NOT NULL,
  aka_name TEXT,
  facility_type TEXT NOT NULL,
  risk_level INTEGER CHECK (risk_level IN (1, 2, 3)),
  address TEXT NOT NULL,
  city TEXT DEFAULT 'Chicago',
  state TEXT DEFAULT 'IL',
  zip TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  location GEOGRAPHY(Point, 4326),
  neighborhood_id UUID REFERENCES neighborhoods(id),
  cleanplate_score INTEGER CHECK (cleanplate_score BETWEEN 0 AND 100),
  latest_result TEXT,
  latest_inspection_date DATE,
  total_inspections INTEGER DEFAULT 0,
  pass_streak INTEGER DEFAULT 0,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_establishments_search ON establishments 
  USING GIN (to_tsvector('english', dba_name || ' ' || COALESCE(aka_name, '') || ' ' || address));
CREATE INDEX idx_establishments_location ON establishments USING GIST (location);
CREATE INDEX idx_establishments_score ON establishments (cleanplate_score DESC);
CREATE INDEX idx_establishments_date ON establishments (latest_inspection_date DESC);
CREATE INDEX idx_establishments_zip ON establishments (zip);
CREATE INDEX idx_establishments_neighborhood ON establishments (neighborhood_id);
```

### Table: inspections

```sql
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  inspection_id TEXT UNIQUE NOT NULL,
  inspection_date DATE NOT NULL,
  inspection_type TEXT NOT NULL,
  results TEXT NOT NULL,
  raw_violations TEXT,
  violation_count INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inspections_establishment ON inspections (establishment_id);
CREATE INDEX idx_inspections_date ON inspections (inspection_date DESC);
CREATE INDEX idx_inspections_results ON inspections (results);
```

### Table: violations

```sql
CREATE TABLE violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  violation_code TEXT NOT NULL,
  violation_description TEXT NOT NULL,
  violation_comment TEXT,
  is_critical BOOLEAN DEFAULT FALSE,
  plain_english TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_violations_inspection ON violations (inspection_id);
CREATE INDEX idx_violations_critical ON violations (is_critical) WHERE is_critical = TRUE;
```

### Table: neighborhoods

```sql
CREATE TABLE neighborhoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  community_area_number INTEGER,
  boundary GEOGRAPHY(Polygon, 4326),
  total_establishments INTEGER DEFAULT 0,
  pass_rate DECIMAL(5, 2),
  avg_score DECIMAL(5, 2),
  recent_failures INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with 77 Chicago community areas
```

### Table: sync_logs

```sql
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  records_fetched INTEGER,
  records_inserted INTEGER,
  records_updated INTEGER,
  errors JSONB,
  status TEXT CHECK (status IN ('running', 'completed', 'failed'))
);
```

---

## API Endpoints (Supabase Edge Functions + PostgREST)

### Search & Discovery

| Method | Endpoint | Description | Parameters |
|--------|----------|-------------|------------|
| GET | /api/search | Full-text search | q, limit (default 20), offset |
| GET | /api/nearby | Geo search | lat, lng, radius_miles (default 1), limit |
| GET | /api/establishments | List with filters | result, risk, facility_type, zip, neighborhood, sort, limit, offset |
| GET | /api/establishments/:slug | Single establishment | - |
| GET | /api/establishments/:slug/inspections | Inspection history | limit (default 10) |

### Neighborhoods

| Method | Endpoint | Description | Parameters |
|--------|----------|-------------|------------|
| GET | /api/neighborhoods | List all 77 | sort (name, pass_rate, avg_score) |
| GET | /api/neighborhoods/:slug | Single neighborhood | - |
| GET | /api/neighborhoods/:slug/establishments | Restaurants in area | sort, limit, offset |
| GET | /api/neighborhoods/:slug/stats | Aggregate stats | - |

### Discovery

| Method | Endpoint | Description | Parameters |
|--------|----------|-------------|------------|
| GET | /api/recent-failures | Failed last 30 days | limit (default 20) |
| GET | /api/top-rated | Highest scores | neighborhood, limit |
| GET | /api/stats | Global stats | - |

### Response Format

```json
{
  "data": [...],
  "meta": {
    "total": 1234,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

---

## Core Features — MVP

### 1. Homepage (Yelp-Inspired)

**Layout Structure:**
```
┌─────────────────────────────────────────┐
│ [Logo]                    [About]       │
├─────────────────────────────────────────┤
│                                         │
│   "Is your restaurant clean?"           │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │ 🔍 Search restaurants...    [📍] │   │
│   └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  [🍽️ Dine-in] [🥡 Takeout] [🛒 Grocery] │
│  [🎂 Bakery]  [☕ Cafe]    [🍺 Bar]     │
├─────────────────────────────────────────┤
│                                         │
│  ⚠️ Recently Failed                     │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │Card1│ │Card2│ │Card3│ │Card4│ →     │
│  └─────┘ └─────┘ └─────┘ └─────┘       │
│                                         │
├─────────────────────────────────────────┤
│  📍 Explore Neighborhoods               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Lincoln  │ │Wicker   │ │Logan    │   │
│  │Park 94% │ │Park 91% │ │Square88%│   │
│  └─────────┘ └─────────┘ └─────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  [Search] [Map] [Saved*] [About]        │
└─────────────────────────────────────────┘
* Phase 2
```

**Components:**
- HeroUI `Input` with search icon (left) and location button (right)
- Category grid: 6 icons with labels, tap to filter search
- Horizontal scroll carousel for "Recently Failed" (HeroUI `Card`)
- Neighborhood grid: 3x3 cards with name + pass rate
- Bottom nav: HeroUI `Tabs` with icons

**Interactions:**
| Action | Result |
|--------|--------|
| Tap search bar | Focus input, show recent searches (localStorage) |
| Tap location button | Request geolocation, redirect to /map?near=me |
| Tap category icon | Navigate to /search?facility_type=[type] |
| Swipe carousel | Scroll horizontally, momentum physics |
| Tap "Recently Failed" card | Navigate to /restaurant/[slug] |
| Tap neighborhood | Navigate to /neighborhood/[slug] |

### 2. Search Results (List View)

**URL:** `/search?q=[query]&result=[pass|conditional|fail]&risk=[1|2|3]&sort=[date|score|distance]`

**Layout Structure:**
```
┌─────────────────────────────────────────┐
│ ← Search results for "pizza"            │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 🔍 pizza                        [✕] │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [Pass ✓] [Conditional] [Fail] [Filters] │
├─────────────────────────────────────────┤
│ 127 results • Sorted by score      [🗺️] │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ ✓ PASSED              Score: 94    │ │
│ │                                     │ │
│ │ Lou Malnati's Pizzeria              │ │
│ │ 439 N Wells St, River North         │ │
│ │                                     │ │
│ │ Inspected 2 weeks ago               │ │
│ │ ─────────────────────────────────── │ │
│ │ 0 violations • Low risk             │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ⚠ CONDITIONAL          Score: 71   │ │
│ │ ...                                 │ │
└─────────────────────────────────────────┘
```

**Filter Modal (HeroUI `Modal`):**
```
┌─────────────────────────────────────────┐
│ Filters                           [✕]   │
├─────────────────────────────────────────┤
│ Result                                  │
│ ○ All  ● Pass  ○ Conditional  ○ Fail   │
├─────────────────────────────────────────┤
│ Risk Level                              │
│ ☑ High  ☑ Medium  ☑ Low                │
├─────────────────────────────────────────┤
│ Facility Type                           │
│ [Restaurant     ▾]                      │
├─────────────────────────────────────────┤
│ Last Inspected                          │
│ ○ Any time  ● Last 90 days  ○ Last year │
├─────────────────────────────────────────┤
│ Sort By                                 │
│ ○ Most recent  ● Highest score  ○ A-Z  │
├─────────────────────────────────────────┤
│        [Reset]          [Apply]         │
└─────────────────────────────────────────┘
```

**Interactions:**
| Action | Result |
|--------|--------|
| Type in search | Debounce 300ms, then fetch results |
| Tap filter pill | Toggle filter, re-fetch |
| Tap "Filters" | Open modal |
| Tap map icon | Navigate to /map with same filters |
| Tap card | Navigate to /restaurant/[slug] |
| Scroll to bottom | Load next 20 results (infinite scroll) |
| Pull down | Refresh results |

### 3. Map View (Yelp-Style)

**URL:** `/map?lat=[lat]&lng=[lng]&zoom=[zoom]&result=[filter]`

**Layout Structure:**
```
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │ 🔍 Search this area...              │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [Pass ✓] [Conditional] [Fail] [Filters] │
├─────────────────────────────────────────┤
│                                         │
│        🟢  🟢      🟡                    │
│                        🟢               │
│    🔴         🟢                        │
│                   [23]  ← cluster       │
│        🟢    🟢         🟡              │
│                                         │
│   [ 🔍 Search this area ]  ← appears   │
│                              on pan     │
│                                         │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ ✓ PASSED              Score: 94    │ │  ← Preview card
│ │ Lou Malnati's Pizzeria              │ │    (bottom sheet)
│ │ 439 N Wells St • 0.2 mi             │ │
│ │           [View Details →]          │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│  [Search] [Map●] [Saved] [About]        │
└─────────────────────────────────────────┘
```

**Map Configuration (Mapbox GL JS):**
```javascript
{
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-87.6298, 41.8781], // Chicago
  zoom: 12,
  minZoom: 10,
  maxZoom: 18,
  maxBounds: [
    [-88.5, 41.5], // SW
    [-87.0, 42.2]  // NE (Chicago metro)
  ]
}
```

**Marker Colors:**
| Status | Color | Hex | Border |
|--------|-------|-----|--------|
| Pass | Green | #16a34a | #15803d |
| Conditional | Amber | #d97706 | #b45309 |
| Fail | Red | #dc2626 | #b91c1c |
| No recent data | Gray | #6b7280 | #4b5563 |

**Clustering:**
- Cluster when >50 markers in viewport
- Cluster radius: 50px
- Show count in cluster circle
- Decluster on zoom level 15+

**Interactions:**
| Action | Result |
|--------|--------|
| Pan map | Show "Search this area" button after 500ms idle |
| Tap "Search this area" | Fetch restaurants in new bounds |
| Tap pin | Show preview card (bottom sheet, 30% height) |
| Tap preview card | Navigate to /restaurant/[slug] |
| Tap cluster | Zoom in to decluster |
| Pinch zoom | Standard map zoom |
| Tap list icon | Navigate to /search with same filters |

### 4. Restaurant Detail Page

**URL:** `/restaurant/[slug]`

**Layout Structure:**
```
┌─────────────────────────────────────────┐
│ ←                              [Share]  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │      ✓ PASSED                   │    │
│  │                                 │    │
│  │           87                    │    │
│  │      ━━━━━━━━━░░░               │    │
│  │     CleanPlate Score            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Lou Malnati's Pizzeria                 │
│  439 N Wells St, River North            │
│  [Get Directions]                       │
│                                         │
│  Last inspected: Dec 1, 2025 (2 wks)    │
│  Risk level: Low (Risk 3)               │
│  Facility: Restaurant                   │
│                                         │
├─────────────────────────────────────────┤
│  📊 Inspection History                  │
├─────────────────────────────────────────┤
│                                         │
│  ● Dec 1, 2025 — Canvass                │
│  │ ✓ PASSED • 0 violations              │
│  │                                      │
│  ● Sep 15, 2025 — Canvass               │
│  │ ✓ PASSED • 1 violation          [+]  │
│  │                                      │
│  ● Jun 3, 2025 — Complaint              │
│  │ ⚠ CONDITIONAL • 3 violations    [+]  │
│  │                                      │
│  ○ ─ ─ ─ Show all 12 inspections ─ ─ ─  │
│                                         │
├─────────────────────────────────────────┤
│  📍 Location                            │
│  ┌─────────────────────────────────┐    │
│  │         [Mini Map]              │    │
│  │            📍                   │    │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│  [Search] [Map] [Saved] [About]         │
└─────────────────────────────────────────┘
```

**Expanded Violation View (HeroUI `Accordion`):**
```
┌─────────────────────────────────────────┐
│  ● Jun 3, 2025 — Complaint              │
│  │ ⚠ CONDITIONAL • 3 violations    [-]  │
│  │                                      │
│  │  ┌─────────────────────────────────┐ │
│  │  │ ⚠ CRITICAL                      │ │
│  │  │ Code 7: Improper hot holding    │ │
│  │  │                                 │ │
│  │  │ Food must be kept at 140°F or   │ │
│  │  │ above. Inspector found items at │ │
│  │  │ 125°F in warming station.       │ │
│  │  └─────────────────────────────────┘ │
│  │                                      │
│  │  ┌─────────────────────────────────┐ │
│  │  │ Code 34: Floors not clean       │ │
│  │  │ Grease buildup near fryer.      │ │
│  │  └─────────────────────────────────┘ │
│  │                                      │
└─────────────────────────────────────────┘
```

**Score Gauge Component:**
```jsx
// Circular progress with color gradient
<ScoreGauge 
  score={87}
  size={160}
  strokeWidth={12}
  colors={{
    0: '#dc2626',   // 0-49: red
    50: '#d97706',  // 50-69: amber
    70: '#16a34a'   // 70-100: green
  }}
/>
```

### 5. Neighborhood Page

**URL:** `/neighborhood/[slug]`

**Layout Structure:**
```
┌─────────────────────────────────────────┐
│ ← Lincoln Park                          │
├─────────────────────────────────────────┤
│  Restaurant Health Scores in            │
│  Lincoln Park                           │
├─────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  94%    │ │   87    │ │    3    │   │
│  │Pass Rate│ │Avg Score│ │ Failed  │   │
│  │         │ │         │ │(30 days)│   │
│  └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────┤
│  📈 12-Month Trend                      │
│  ┌─────────────────────────────────┐    │
│  │    ___/‾‾‾\___/‾‾‾              │    │
│  │   /                              │    │
│  │  Jan  Mar  May  Jul  Sep  Nov    │    │
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│  🗺️ Map                           [↗]   │
│  ┌─────────────────────────────────┐    │
│  │  🟢 🟢    🟡   🟢               │    │
│  │      🟢      🔴    🟢            │    │
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│  ⚠️ Recent Failures                     │
│  ┌─────────────────────────────────┐    │
│  │ ✗ FAILED                Dec 10  │    │
│  │ Joe's Crab Shack                 │    │
│  │ 4 critical violations            │    │
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│  🍽️ All Restaurants (234)               │
│  Sort: [Score ▾]                        │
│                                         │
│  [Restaurant cards...]                  │
│                                         │
└─────────────────────────────────────────┘
```

---

## CleanPlate Score Algorithm

### Formula

```
Score = (Result × 0.40) + (Trend × 0.20) + (Violations × 0.20) + (Recency × 0.10) + (Risk × 0.10)
```

### Component Calculations

| Component | Weight | Calculation |
|-----------|--------|-------------|
| Result | 40% | Pass=100, Conditional=70, Fail=30 |
| Trend | 20% | +10 if improving, 0 if stable, -10 if declining (last 3) |
| Violations | 20% | 100 - (critical_count × 15) - (non_critical × 5), min 0 |
| Recency | 10% | 100 if <6mo, 80 if 6-12mo, 50 if 12-18mo, 20 if >18mo |
| Risk | 10% | Risk 3 (Low)=100, Risk 2=80, Risk 1 (High)=60 |

### Modifiers

| Condition | Modifier |
|-----------|----------|
| 3+ consecutive passes | +5 bonus |
| No inspection >18 months | -20 penalty |
| Recent failure (90 days) | -10 penalty |

### Score Ranges

| Score | Status | Badge Color |
|-------|--------|-------------|
| 85-100 | Excellent | Green #16a34a |
| 70-84 | Good | Green #16a34a |
| 50-69 | Fair | Amber #d97706 |
| 0-49 | Poor | Red #dc2626 |

---

## UI/UX Requirements

### Design System: HeroUI

**Version:** HeroUI v3+ (previously NextUI)
**Requirements:** React 18+, Tailwind CSS v4, Framer Motion 11.9+

---

### HeroUI Installation & Setup

**1. Install packages:**
```bash
npm install @heroui/react framer-motion
# or individual packages for smaller bundle:
npm install @heroui/card @heroui/chip @heroui/input @heroui/modal @heroui/accordion @heroui/skeleton @heroui/tabs @heroui/button @heroui/progress
```

**2. Configure Tailwind (tailwind.config.js):**
```javascript
import { heroui } from "@heroui/react";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: {
              50: "#f0fdf4",
              100: "#dcfce7",
              200: "#bbf7d0",
              300: "#86efac",
              400: "#4ade80",
              500: "#22c55e",
              600: "#16a34a",
              700: "#15803d",
              800: "#166534",
              900: "#14532d",
              DEFAULT: "#1a5f2a",
              foreground: "#ffffff",
            },
            success: {
              DEFAULT: "#16a34a",
              foreground: "#ffffff",
            },
            warning: {
              DEFAULT: "#d97706",
              foreground: "#1f2937",
            },
            danger: {
              DEFAULT: "#dc2626",
              foreground: "#ffffff",
            },
          },
          layout: {
            radius: {
              small: "6px",
              medium: "8px",
              large: "12px",
            },
          },
        },
      },
    }),
  ],
};
```

**3. Add HeroUIProvider (app/providers.tsx):**
```tsx
"use client";
import { HeroUIProvider } from "@heroui/react";
import { useRouter } from "next/navigation";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <HeroUIProvider navigate={router.push}>
      {children}
    </HeroUIProvider>
  );
}
```

**4. Tailwind CSS v4 setup (globals.css):**
```css
@import "tailwindcss";
@layer theme, base, components, utilities;
@plugin './hero.ts';
@source '../../node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}';

@theme {
  --color-brand: #1a5f2a;
  --color-brand-light: #dcfce7;
  --color-pass: #16a34a;
  --color-conditional: #d97706;
  --color-fail: #dc2626;
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
}
```

---

### Component Mapping

| UI Element | HeroUI Component | Variant/Props |
|------------|------------------|---------------|
| Search input | `Input` | startContent, endContent, size="lg" |
| Filter pills | `Chip` | variant="flat" / "solid", isCloseable |
| Restaurant card | `Card` | isPressable, shadow="sm" |
| Status badge | `Chip` | size="lg", startContent={Icon}, color |
| Violations | `Accordion` | variant="splitted", selectionMode="multiple" |
| Map preview | `Card` | isFooterBlurred |
| Bottom nav | `Tabs` | placement="bottom", color="primary" |
| Filter modal | `Modal` | size="full", scrollBehavior="inside" |
| Loading | `Skeleton` | Match content shape |
| Toast | `Toast` | color, variant |
| Score gauge | Custom | (see below) |
| Timeline | Custom | (see below) |
| Empty state | Custom | (see below) |

---

### Component Code Snippets

#### Search Input with Location Button

```tsx
// components/SearchInput.tsx
import { Input, Button } from "@heroui/react";
import { SearchIcon, MapPinIcon } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onLocationClick: () => void;
  isLoadingLocation?: boolean;
}

export function SearchInput({ 
  value, 
  onChange, 
  onLocationClick,
  isLoadingLocation 
}: SearchInputProps) {
  return (
    <Input
      value={value}
      onValueChange={onChange}
      placeholder="Search restaurants..."
      size="lg"
      radius="lg"
      classNames={{
        base: "max-w-full",
        inputWrapper: [
          "bg-white",
          "shadow-sm",
          "border",
          "border-default-200",
          "hover:border-primary",
          "group-data-[focus=true]:border-primary",
        ],
        input: "text-base",
      }}
      startContent={
        <SearchIcon className="text-default-400 w-5 h-5" />
      }
      endContent={
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={onLocationClick}
          isLoading={isLoadingLocation}
          aria-label="Use my location"
        >
          <MapPinIcon className="w-5 h-5 text-primary" />
        </Button>
      }
    />
  );
}
```

#### Status Badge (Pass/Conditional/Fail)

```tsx
// components/StatusBadge.tsx
import { Chip } from "@heroui/react";
import { CheckIcon, AlertTriangleIcon, XIcon } from "lucide-react";

type Status = "pass" | "conditional" | "fail";

interface StatusBadgeProps {
  status: Status;
  size?: "sm" | "md" | "lg";
}

const statusConfig = {
  pass: {
    color: "success" as const,
    icon: CheckIcon,
    label: "PASSED",
    ariaLabel: "Passed inspection",
  },
  conditional: {
    color: "warning" as const,
    icon: AlertTriangleIcon,
    label: "CONDITIONAL",
    ariaLabel: "Passed with conditions",
  },
  fail: {
    color: "danger" as const,
    icon: XIcon,
    label: "FAILED",
    ariaLabel: "Failed inspection",
  },
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <Chip
      color={config.color}
      variant="solid"
      size={size}
      startContent={<Icon className="w-4 h-4" />}
      aria-label={config.ariaLabel}
      classNames={{
        base: "gap-1 px-3",
        content: "font-semibold text-xs tracking-wide",
      }}
    >
      {config.label}
    </Chip>
  );
}
```

#### Restaurant Card

```tsx
// components/RestaurantCard.tsx
import { Card, CardBody } from "@heroui/react";
import { StatusBadge } from "./StatusBadge";
import { ScoreDisplay } from "./ScoreDisplay";
import { formatDistanceToNow } from "date-fns";

interface Restaurant {
  slug: string;
  dba_name: string;
  address: string;
  neighborhood?: string;
  cleanplate_score: number;
  latest_result: string;
  latest_inspection_date: string;
  violation_count?: number;
  risk_level?: number;
}

interface RestaurantCardProps {
  restaurant: Restaurant;
  onPress?: () => void;
}

export function RestaurantCard({ restaurant, onPress }: RestaurantCardProps) {
  const status = restaurant.latest_result.toLowerCase().includes("fail") 
    ? "fail" 
    : restaurant.latest_result.toLowerCase().includes("condition") 
      ? "conditional" 
      : "pass";
  
  const riskLabels = { 1: "High", 2: "Medium", 3: "Low" };
  
  return (
    <Card 
      isPressable 
      onPress={onPress}
      shadow="sm"
      classNames={{
        base: "w-full",
        body: "p-4",
      }}
    >
      <CardBody>
        {/* Header: Status + Score */}
        <div className="flex justify-between items-start mb-3">
          <StatusBadge status={status} size="sm" />
          <ScoreDisplay score={restaurant.cleanplate_score} size="sm" />
        </div>
        
        {/* Name + Address */}
        <h3 className="text-lg font-semibold text-default-900 mb-1 line-clamp-1">
          {restaurant.dba_name}
        </h3>
        <p className="text-sm text-default-500 mb-3 line-clamp-1">
          {restaurant.address}
          {restaurant.neighborhood && `, ${restaurant.neighborhood}`}
        </p>
        
        {/* Inspection Date */}
        <p className="text-xs text-default-400 mb-3">
          Inspected {formatDistanceToNow(new Date(restaurant.latest_inspection_date), { addSuffix: true })}
        </p>
        
        {/* Footer: Violations + Risk */}
        <div className="flex items-center gap-4 pt-3 border-t border-default-100">
          {restaurant.violation_count !== undefined && (
            <span className="text-xs text-default-500">
              {restaurant.violation_count} violation{restaurant.violation_count !== 1 ? "s" : ""}
            </span>
          )}
          {restaurant.risk_level && (
            <span className="text-xs text-default-500">
              {riskLabels[restaurant.risk_level as 1 | 2 | 3]} risk
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
```

#### Filter Chips (Toggle Pills)

```tsx
// components/FilterChips.tsx
import { Chip } from "@heroui/react";
import { CheckIcon, AlertTriangleIcon, XIcon, SlidersHorizontalIcon } from "lucide-react";

type FilterValue = "pass" | "conditional" | "fail";

interface FilterChipsProps {
  selected: FilterValue[];
  onChange: (selected: FilterValue[]) => void;
  onFiltersClick: () => void;
}

const filters = [
  { value: "pass", label: "Pass", icon: CheckIcon, color: "success" },
  { value: "conditional", label: "Conditional", icon: AlertTriangleIcon, color: "warning" },
  { value: "fail", label: "Fail", icon: XIcon, color: "danger" },
] as const;

export function FilterChips({ selected, onChange, onFiltersClick }: FilterChipsProps) {
  const toggleFilter = (value: FilterValue) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };
  
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isSelected = selected.includes(filter.value);
        
        return (
          <Chip
            key={filter.value}
            variant={isSelected ? "solid" : "flat"}
            color={isSelected ? filter.color : "default"}
            startContent={<Icon className="w-3.5 h-3.5" />}
            classNames={{
              base: "cursor-pointer min-w-fit",
              content: "font-medium",
            }}
            onClick={() => toggleFilter(filter.value)}
          >
            {filter.label}
          </Chip>
        );
      })}
      
      <Chip
        variant="bordered"
        startContent={<SlidersHorizontalIcon className="w-3.5 h-3.5" />}
        classNames={{
          base: "cursor-pointer min-w-fit",
          content: "font-medium",
        }}
        onClick={onFiltersClick}
      >
        Filters
      </Chip>
    </div>
  );
}
```

#### Filter Modal

```tsx
// components/FilterModal.tsx
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  RadioGroup,
  Radio,
  CheckboxGroup,
  Checkbox,
  Select,
  SelectItem,
} from "@heroui/react";

interface Filters {
  result: string;
  riskLevels: string[];
  facilityType: string;
  lastInspected: string;
  sortBy: string;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: (filters: Filters) => void;
  onReset: () => void;
  onApply: () => void;
}

const facilityTypes = [
  "Restaurant",
  "Bakery",
  "Grocery Store",
  "Coffee Shop",
  "Bar",
  "Food Truck",
];

export function FilterModal({
  isOpen,
  onClose,
  filters,
  onChange,
  onReset,
  onApply,
}: FilterModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      scrollBehavior="inside"
      classNames={{
        base: "sm:max-w-md sm:my-auto",
      }}
    >
      <ModalContent>
        <ModalHeader className="border-b">Filters</ModalHeader>
        
        <ModalBody className="py-6 gap-6">
          {/* Result */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Result</h4>
            <RadioGroup
              value={filters.result}
              onValueChange={(v) => onChange({ ...filters, result: v })}
              orientation="horizontal"
            >
              <Radio value="all">All</Radio>
              <Radio value="pass">Pass</Radio>
              <Radio value="conditional">Conditional</Radio>
              <Radio value="fail">Fail</Radio>
            </RadioGroup>
          </div>
          
          {/* Risk Level */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Risk Level</h4>
            <CheckboxGroup
              value={filters.riskLevels}
              onValueChange={(v) => onChange({ ...filters, riskLevels: v })}
              orientation="horizontal"
            >
              <Checkbox value="1">High</Checkbox>
              <Checkbox value="2">Medium</Checkbox>
              <Checkbox value="3">Low</Checkbox>
            </CheckboxGroup>
          </div>
          
          {/* Facility Type */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Facility Type</h4>
            <Select
              selectedKeys={filters.facilityType ? [filters.facilityType] : []}
              onSelectionChange={(keys) => 
                onChange({ ...filters, facilityType: Array.from(keys)[0] as string })
              }
              placeholder="All types"
            >
              {facilityTypes.map((type) => (
                <SelectItem key={type}>{type}</SelectItem>
              ))}
            </Select>
          </div>
          
          {/* Last Inspected */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Last Inspected</h4>
            <RadioGroup
              value={filters.lastInspected}
              onValueChange={(v) => onChange({ ...filters, lastInspected: v })}
            >
              <Radio value="any">Any time</Radio>
              <Radio value="90">Last 90 days</Radio>
              <Radio value="365">Last year</Radio>
            </RadioGroup>
          </div>
          
          {/* Sort By */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Sort By</h4>
            <RadioGroup
              value={filters.sortBy}
              onValueChange={(v) => onChange({ ...filters, sortBy: v })}
            >
              <Radio value="date">Most recent</Radio>
              <Radio value="score">Highest score</Radio>
              <Radio value="name">A-Z</Radio>
            </RadioGroup>
          </div>
        </ModalBody>
        
        <ModalFooter className="border-t">
          <Button variant="light" onPress={onReset}>
            Reset
          </Button>
          <Button color="primary" onPress={onApply}>
            Apply
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
```

#### Violations Accordion

```tsx
// components/ViolationsAccordion.tsx
import { Accordion, AccordionItem, Chip } from "@heroui/react";
import { AlertTriangleIcon } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

interface Violation {
  id: string;
  violation_code: string;
  violation_description: string;
  violation_comment?: string;
  is_critical: boolean;
  plain_english?: string;
}

interface Inspection {
  id: string;
  inspection_date: string;
  inspection_type: string;
  results: string;
  violations: Violation[];
}

interface ViolationsAccordionProps {
  inspections: Inspection[];
}

export function ViolationsAccordion({ inspections }: ViolationsAccordionProps) {
  const getStatus = (result: string) => {
    if (result.toLowerCase().includes("fail")) return "fail";
    if (result.toLowerCase().includes("condition")) return "conditional";
    return "pass";
  };
  
  return (
    <Accordion
      variant="splitted"
      selectionMode="multiple"
      classNames={{
        base: "gap-3",
      }}
    >
      {inspections.map((inspection) => (
        <AccordionItem
          key={inspection.id}
          aria-label={`Inspection on ${inspection.inspection_date}`}
          title={
            <div className="flex items-center gap-3">
              <span className="font-medium">
                {new Date(inspection.inspection_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="text-default-400">—</span>
              <span className="text-default-500">{inspection.inspection_type}</span>
            </div>
          }
          subtitle={
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={getStatus(inspection.results)} size="sm" />
              <span className="text-xs text-default-400">
                {inspection.violations.length} violation{inspection.violations.length !== 1 ? "s" : ""}
              </span>
            </div>
          }
        >
          <div className="space-y-3 pb-2">
            {inspection.violations.map((violation) => (
              <div
                key={violation.id}
                className={`p-3 rounded-lg border ${
                  violation.is_critical 
                    ? "border-danger-200 bg-danger-50" 
                    : "border-default-200 bg-default-50"
                }`}
              >
                {violation.is_critical && (
                  <Chip
                    size="sm"
                    color="danger"
                    variant="flat"
                    startContent={<AlertTriangleIcon className="w-3 h-3" />}
                    classNames={{ base: "mb-2" }}
                  >
                    CRITICAL
                  </Chip>
                )}
                <p className="font-medium text-sm mb-1">
                  Code {violation.violation_code}: {violation.plain_english || violation.violation_description}
                </p>
                {violation.violation_comment && (
                  <p className="text-xs text-default-500">
                    {violation.violation_comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
```

#### Bottom Navigation

```tsx
// components/BottomNav.tsx
import { Tabs, Tab } from "@heroui/react";
import { SearchIcon, MapIcon, BookmarkIcon, InfoIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { key: "search", label: "Search", icon: SearchIcon, href: "/search" },
  { key: "map", label: "Map", icon: MapIcon, href: "/map" },
  { key: "saved", label: "Saved", icon: BookmarkIcon, href: "/saved" },
  { key: "about", label: "About", icon: InfoIcon, href: "/about" },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  
  const activeKey = navItems.find((item) => pathname.startsWith(item.href))?.key || "search";
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-default-200 pb-safe z-50">
      <Tabs
        selectedKey={activeKey}
        onSelectionChange={(key) => {
          const item = navItems.find((i) => i.key === key);
          if (item) router.push(item.href);
        }}
        color="primary"
        variant="light"
        classNames={{
          base: "w-full",
          tabList: "w-full justify-around p-0",
          tab: "flex-col gap-1 h-14 min-w-0",
          tabContent: "text-xs",
        }}
      >
        {navItems.map((item) => (
          <Tab
            key={item.key}
            title={
              <div className="flex flex-col items-center gap-1">
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            }
          />
        ))}
      </Tabs>
    </div>
  );
}
```

#### Skeleton Loading States

```tsx
// components/RestaurantCardSkeleton.tsx
import { Card, CardBody, Skeleton } from "@heroui/react";

export function RestaurantCardSkeleton() {
  return (
    <Card shadow="sm" classNames={{ body: "p-4" }}>
      <CardBody>
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <Skeleton className="w-24 h-6 rounded-full" />
          <Skeleton className="w-12 h-12 rounded-full" />
        </div>
        
        {/* Name */}
        <Skeleton className="w-3/4 h-6 rounded-lg mb-2" />
        
        {/* Address */}
        <Skeleton className="w-full h-4 rounded-lg mb-3" />
        
        {/* Date */}
        <Skeleton className="w-1/3 h-3 rounded-lg mb-3" />
        
        {/* Footer */}
        <div className="flex gap-4 pt-3 border-t border-default-100">
          <Skeleton className="w-20 h-4 rounded-lg" />
          <Skeleton className="w-16 h-4 rounded-lg" />
        </div>
      </CardBody>
    </Card>
  );
}

// Usage: Show 3 skeletons while loading
export function RestaurantListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <RestaurantCardSkeleton key={i} />
      ))}
    </div>
  );
}
```

---

### Custom Components (Not in HeroUI)

#### Score Display / Gauge

```tsx
// components/ScoreDisplay.tsx
"use client";

interface ScoreDisplayProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const sizeConfig = {
  sm: { width: 48, fontSize: 18, strokeWidth: 4 },
  md: { width: 80, fontSize: 28, strokeWidth: 6 },
  lg: { width: 160, fontSize: 48, strokeWidth: 12 },
};

function getScoreColor(score: number): string {
  if (score >= 70) return "#16a34a"; // green
  if (score >= 50) return "#d97706"; // amber
  return "#dc2626"; // red
}

export function ScoreDisplay({ score, size = "md", showLabel = false }: ScoreDisplayProps) {
  const config = sizeConfig[size];
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: config.width, height: config.width }}>
        <svg
          width={config.width}
          height={config.width}
          viewBox={`0 0 ${config.width} ${config.width}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            stroke="#e5e5e5"
            strokeWidth={config.strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        
        {/* Score number */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ 
            fontFamily: "var(--font-sans)",
            fontFeatureSettings: "'tnum' 1",
            fontSize: config.fontSize,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color,
          }}
        >
          {score}
        </div>
      </div>
      
      {showLabel && (
        <span className="text-xs text-default-500 mt-1">CleanPlate Score</span>
      )}
    </div>
  );
}
```

#### Inspection Timeline

```tsx
// components/InspectionTimeline.tsx
import { StatusBadge } from "./StatusBadge";
import { ChevronRightIcon } from "lucide-react";

interface Inspection {
  id: string;
  inspection_date: string;
  inspection_type: string;
  results: string;
  violation_count: number;
}

interface InspectionTimelineProps {
  inspections: Inspection[];
  maxItems?: number;
  onInspectionClick?: (id: string) => void;
  onShowAll?: () => void;
}

export function InspectionTimeline({
  inspections,
  maxItems = 5,
  onInspectionClick,
  onShowAll,
}: InspectionTimelineProps) {
  const displayedInspections = inspections.slice(0, maxItems);
  const hasMore = inspections.length > maxItems;
  
  const getStatus = (result: string) => {
    if (result.toLowerCase().includes("fail")) return "fail";
    if (result.toLowerCase().includes("condition")) return "conditional";
    return "pass";
  };
  
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-default-200" />
      
      {/* Timeline items */}
      <div className="space-y-4">
        {displayedInspections.map((inspection, index) => (
          <div
            key={inspection.id}
            className="relative flex items-start gap-4 cursor-pointer group"
            onClick={() => onInspectionClick?.(inspection.id)}
          >
            {/* Dot */}
            <div 
              className={`relative z-10 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center ${
                index === 0 ? "border-primary" : "border-default-300"
              }`}
            >
              <div 
                className={`w-2 h-2 rounded-full ${
                  index === 0 ? "bg-primary" : "bg-default-300"
                }`}
              />
            </div>
            
            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">
                  {new Date(inspection.inspection_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="text-default-400">—</span>
                <span className="text-sm text-default-500">
                  {inspection.inspection_type}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <StatusBadge status={getStatus(inspection.results)} size="sm" />
                <span className="text-xs text-default-400">
                  {inspection.violation_count} violation{inspection.violation_count !== 1 ? "s" : ""}
                </span>
                <ChevronRightIcon className="w-4 h-4 text-default-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Show all button */}
      {hasMore && (
        <button
          onClick={onShowAll}
          className="w-full py-3 text-sm text-primary font-medium border-t border-dashed border-default-200 hover:bg-default-50 transition-colors"
        >
          Show all {inspections.length} inspections
        </button>
      )}
    </div>
  );
}
```

#### Empty State

```tsx
// components/EmptyState.tsx
import { Button } from "@heroui/react";
import { 
  SearchIcon, 
  MapPinIcon, 
  MapPinOffIcon, 
  WifiOffIcon,
  BuildingIcon 
} from "lucide-react";

type EmptyStateType = "no-results" | "no-area" | "location-denied" | "network-error" | "empty-neighborhood";

interface EmptyStateProps {
  type: EmptyStateType;
  query?: string;
  onAction?: () => void;
}

const config = {
  "no-results": {
    icon: SearchIcon,
    title: "No restaurants found",
    getMessage: (query?: string) => query 
      ? `No results for "${query}"` 
      : "Try a different search",
    action: "Clear search",
  },
  "no-area": {
    icon: MapPinIcon,
    title: "No restaurants in this area",
    getMessage: () => "Try zooming out or searching another location",
    action: "Zoom out",
  },
  "location-denied": {
    icon: MapPinOffIcon,
    title: "Location access needed",
    getMessage: () => "Enable location to use 'Near Me' or search manually",
    action: "Search manually",
  },
  "network-error": {
    icon: WifiOffIcon,
    title: "Couldn't load restaurants",
    getMessage: () => "Check your connection and try again",
    action: "Retry",
  },
  "empty-neighborhood": {
    icon: BuildingIcon,
    title: "No data for this neighborhood",
    getMessage: () => "We don't have inspection data for this area yet",
    action: "Explore nearby",
  },
};

export function EmptyState({ type, query, onAction }: EmptyStateProps) {
  const { icon: Icon, title, getMessage, action } = config[type];
  
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-default-400" />
      </div>
      
      <h3 className="text-lg font-semibold text-default-900 mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-default-500 mb-6 max-w-xs">
        {getMessage(query)}
      </p>
      
      {onAction && (
        <Button
          color="primary"
          variant="flat"
          onPress={onAction}
        >
          {action}
        </Button>
      )}
    </div>
  );
}
```

---

### Color Palette (WCAG AA Compliant)

| Token | Name | Hex | RGB | Usage |
|-------|------|-----|-----|-------|
| --color-brand | Forest Green | #1a5f2a | 26, 95, 42 | Logo, primary buttons |
| --color-brand-light | Light Green | #dcfce7 | 220, 252, 231 | Success backgrounds |
| --color-pass | Green 600 | #16a34a | 22, 163, 74 | Pass badges (white text) |
| --color-conditional | Amber 600 | #d97706 | 217, 119, 6 | Conditional badges (dark text #1f2937) |
| --color-fail | Red 600 | #dc2626 | 220, 38, 38 | Fail badges (white text) |
| --color-text | Near Black | #171717 | 23, 23, 23 | Body text |
| --color-text-muted | Gray 600 | #525252 | 82, 82, 82 | Secondary text |
| --color-bg | White | #ffffff | 255, 255, 255 | Page background |
| --color-surface | Gray 50 | #fafafa | 250, 250, 250 | Cards, inputs |
| --color-border | Gray 200 | #e5e5e5 | 229, 229, 229 | Dividers |

**Badge Requirements:**
- ALL status badges must include: Icon + Text + Background color
- Pass: ✓ PASSED (white on green)
- Conditional: ⚠ CONDITIONAL (dark on amber)
- Fail: ✗ FAILED (white on red)
- Never communicate status by color alone (WCAG 1.4.1)

### Typography

**Font Stack:**
```css
:root {
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', 'Fira Code', monospace;
}
```

**Type Scale:**

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| --text-display | 32px | 700 | 1.2 | -0.02em | Hero headline |
| --text-h1 | 24px | 700 | 1.3 | -0.01em | Page titles |
| --text-h2 | 20px | 600 | 1.35 | 0 | Section headers |
| --text-h3 | 18px | 600 | 1.4 | 0 | Card titles |
| --text-body-lg | 16px | 400 | 1.5 | 0 | Primary content |
| --text-body | 14px | 400 | 1.5 | 0 | Default text |
| --text-sm | 12px | 400 | 1.4 | 0.01em | Captions |
| --text-xs | 11px | 500 | 1.3 | 0.02em | Badge labels |

**Score Number:**
```css
.score-display {
  font-family: var(--font-sans);
  font-feature-settings: 'tnum' 1;
  font-size: 48px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
```

### Spacing System

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
}
```

### Responsive Breakpoints

| Token | Width | Target |
|-------|-------|--------|
| --bp-sm | 640px | Large phones |
| --bp-md | 768px | Tablets |
| --bp-lg | 1024px | Laptops |
| --bp-xl | 1280px | Desktops |

**Mobile-first:** All styles default to mobile, use min-width media queries.

### Touch Targets

| Element | Minimum Size | Spacing |
|---------|--------------|---------|
| Buttons | 44×44px | 8px between |
| Cards | Full width tap | 12px between |
| Filter pills | 36×36px | 8px between |
| Map pins | 48×48px hit area | N/A |
| Bottom nav items | 48×48px | Equal distribution |

### Animation & Motion

```css
:root {
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Loading States

| State | Component | Behavior |
|-------|-----------|----------|
| Initial load | `Skeleton` | Match card/content shape |
| Search typing | Spinner (input) | Show after 300ms debounce starts |
| Fetching more | `Skeleton` cards | Append to list |
| Map loading | Blur + spinner | Center of map area |
| Error | Toast + retry | "Something went wrong. Tap to retry." |

### Empty States

| Scenario | Illustration | Message | Action |
|----------|--------------|---------|--------|
| No search results | Magnifying glass | "No restaurants found for '[query]'" | "Try a different search" |
| No restaurants in area | Map pin | "No restaurants in this area" | "Zoom out or search another area" |
| Location denied | Location pin | "Location access needed for 'Near Me'" | "Enable in Settings" or "Search manually" |
| Network error | Cloud with X | "Couldn't load restaurants" | "Tap to retry" |
| Empty neighborhood | Building | "No data for this neighborhood yet" | "Explore nearby areas" |

---

## Page Routes

| Route | Page | SSR | Cache |
|-------|------|-----|-------|
| / | Homepage | Yes | 1 hour |
| /search | Search results | No | None |
| /map | Map view | No | None |
| /restaurant/[slug] | Restaurant detail | Yes | 1 hour |
| /neighborhood/[slug] | Neighborhood | Yes | 1 hour |
| /neighborhoods | All neighborhoods | Yes | 24 hours |
| /recent-failures | Recent failures | Yes | 15 min |
| /about | About page | Yes | 24 hours |
| /methodology | Score methodology | Yes | 24 hours |
| /privacy | Privacy policy | Yes | 24 hours |

---

## Non-Functional Requirements

### Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | < 1.5s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse |
| Time to Interactive | < 3.0s | Lighthouse |
| Cumulative Layout Shift | < 0.1 | Lighthouse |
| Search response | < 300ms | API timing |
| Map initial load | < 2s | Custom timing |
| Map interaction | 60fps | DevTools |

### SEO

- Server-side render: All restaurant and neighborhood pages
- Meta tags: Title, description, Open Graph, Twitter cards
- Structured data: Schema.org LocalBusiness, AggregateRating
- Sitemap: Auto-generate, submit to Google Search Console
- Robots.txt: Allow all public pages
- Canonical URLs: Prevent duplicate content
- Internal linking: Neighborhood ↔ Restaurant cross-links

**Target:** 15,000+ restaurant pages indexed within 3 months

### Accessibility (WCAG 2.1 AA)

**Required:**
- Color contrast: 4.5:1 body text, 3:1 large text
- Focus indicators: Visible on all interactive elements
- Keyboard navigation: Full site usable without mouse
- Screen reader: All content accessible, ARIA labels on icons
- Alt text: All images, map has text alternative
- Form labels: All inputs have associated labels
- Error messages: Clear, associated with field
- Reduced motion: Respect prefers-reduced-motion
- Zoom: Content readable at 200% zoom
- Touch targets: Minimum 44×44px

**Testing:**
- axe DevTools: 0 critical/serious issues
- VoiceOver (iOS): Full navigation test
- Keyboard only: Complete all tasks
- Color blindness simulator: All statuses distinguishable

### Security

- HTTPS: Required for all traffic
- CSP: Strict Content Security Policy
- CORS: Restrict to known origins
- Rate limiting: 100 requests/minute per IP
- Input sanitization: All user inputs
- No PII storage: No user accounts in MVP

### Analytics

- Tool: Plausible or PostHog (privacy-focused)
- No cookies: Avoid cookie banner
- Track: Page views, searches, map interactions, outbound clicks
- Goals: Search → Detail page conversion, Time on site

---

## Future Features (Phase 2+)

| Feature | Priority | Complexity | Dependencies |
|---------|----------|------------|--------------|
| User accounts | High | Medium | Auth system |
| Save favorites | High | Low | User accounts |
| Push notifications | High | Medium | User accounts, service worker |
| Email alerts | Medium | Medium | User accounts, email service |
| Business claiming | Medium | High | Verification system |
| API access (paid) | Medium | Medium | Stripe, rate limiting |
| Suburb expansion | Medium | Low | Additional data sources |
| City expansion | Low | High | Per-city data ingestion |
| Chrome extension | Low | Medium | Browser extension APIs |
| Weekly digest email | Low | Low | Email service |

---

## Success Metrics

| Metric | Target (3 months) | Target (6 months) |
|--------|-------------------|-------------------|
| Monthly Active Users | 3,000 | 10,000 |
| Organic search traffic | 1,500/mo | 5,000/mo |
| Restaurant pages indexed | 10,000 | 15,000+ |
| Neighborhood pages indexed | 77 | 77 |
| Avg session duration | 1:30 | 2:00+ |
| Bounce rate | < 60% | < 50% |
| Search → Detail conversion | 40% | 50% |
| Core Web Vitals pass | Yes | Yes |

---

## Technical Notes for Builder

### Supabase Setup

```sql
-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Create tables (see Database Schema section)

-- 3. Create RLS policies
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON establishments FOR SELECT USING (true);

-- 4. Create functions
CREATE OR REPLACE FUNCTION search_establishments(query TEXT, lim INT DEFAULT 20)
RETURNS SETOF establishments AS $$
  SELECT * FROM establishments
  WHERE to_tsvector('english', dba_name || ' ' || COALESCE(aka_name, '') || ' ' || address) 
        @@ plainto_tsquery('english', query)
  ORDER BY cleanplate_score DESC
  LIMIT lim;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION nearby_establishments(lat FLOAT, lng FLOAT, radius_miles FLOAT DEFAULT 1)
RETURNS SETOF establishments AS $$
  SELECT * FROM establishments
  WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_miles * 1609.34
  )
  ORDER BY location <-> ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;
$$ LANGUAGE SQL;
```

### Data Ingestion (Edge Function)

```typescript
// supabase/functions/sync-inspections/index.ts
import { createClient } from '@supabase/supabase-js'

const CHICAGO_API = 'https://data.cityofchicago.org/resource/4ijn-s7e5.json'
const BATCH_SIZE = 1000

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  let offset = 0
  let hasMore = true
  
  while (hasMore) {
    const res = await fetch(`${CHICAGO_API}?$limit=${BATCH_SIZE}&$offset=${offset}`)
    const data = await res.json()
    
    if (data.length < BATCH_SIZE) hasMore = false
    
    // Process and upsert...
    offset += BATCH_SIZE
  }
  
  return new Response(JSON.stringify({ success: true }))
})
```

### Mapbox Setup

```typescript
// components/Map.tsx
import mapboxgl from 'mapbox-gl'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-87.6298, 41.8781],
  zoom: 12
})

// Add markers with clustering
map.on('load', () => {
  map.addSource('restaurants', {
    type: 'geojson',
    data: '/api/establishments/geojson',
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50
  })
  
  // Cluster circles
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'restaurants',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#1a5f2a',
      'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40]
    }
  })
  
  // Individual markers
  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'restaurants',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': [
        'match', ['get', 'status'],
        'Pass', '#16a34a',
        'Pass w/ Conditions', '#d97706',
        'Fail', '#dc2626',
        '#6b7280'
      ],
      'circle-radius': 8
    }
  })
})
```

### SEO Implementation

```typescript
// app/restaurant/[slug]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const restaurant = await getRestaurant(params.slug)
  
  return {
    title: `${restaurant.dba_name} Health Inspection | CleanPlate Chicago`,
    description: `${restaurant.dba_name} at ${restaurant.address} has a CleanPlate Score of ${restaurant.cleanplate_score}. Last inspected ${formatDate(restaurant.latest_inspection_date)}.`,
    openGraph: {
      title: `${restaurant.dba_name} - Score: ${restaurant.cleanplate_score}`,
      description: `Health inspection results for ${restaurant.dba_name}`,
      type: 'website',
    },
  }
}

// Generate static params for all restaurants
export async function generateStaticParams() {
  const restaurants = await getAllRestaurantSlugs()
  return restaurants.map((slug) => ({ slug }))
}
```

---

## Content Needed

| Content | Owner | Status | Notes |
|---------|-------|--------|-------|
| Homepage headline/subhead | — | Not started | A/B test options |
| About page copy | — | Not started | Mission, data source attribution |
| Methodology page | — | Not started | Score explanation with examples |
| Violation translations | — | Not started | Plain English for top 50 codes |
| Neighborhood descriptions | — | Not started | AI-generate for 77 areas |
| FAQ content | — | Not started | 10-15 common questions |
| Privacy policy | — | Not started | Template available |
| Error messages | — | Not started | Friendly, actionable |

---

## Launch Checklist

### Infrastructure
- [ ] Supabase project created
- [ ] PostGIS extension enabled
- [ ] Database tables created
- [ ] RLS policies configured
- [ ] Edge Function deployed (data sync)
- [ ] Mapbox account + token
- [ ] Vercel project created
- [ ] Domain configured + SSL
- [ ] Environment variables set

### Data
- [ ] Initial data import complete
- [ ] Score algorithm implemented
- [ ] Neighborhood boundaries loaded
- [ ] Slug generation working
- [ ] Daily sync scheduled + tested

### Features
- [ ] Homepage rendering
- [ ] Search functional (autocomplete, filters)
- [ ] Map functional (markers, clustering, preview)
- [ ] Restaurant detail pages
- [ ] Neighborhood pages
- [ ] Recent failures page
- [ ] About/Methodology pages

### Quality
- [ ] Mobile responsive (test on real devices)
- [ ] Lighthouse score > 90 (all categories)
- [ ] axe accessibility: 0 critical issues
- [ ] Cross-browser tested (Chrome, Safari, Firefox)
- [ ] Error states implemented
- [ ] Loading states implemented
- [ ] Empty states implemented

### SEO
- [ ] Meta tags on all pages
- [ ] Open Graph tags
- [ ] Schema.org markup
- [ ] Sitemap generated
- [ ] robots.txt configured
- [ ] Google Search Console submitted

### Launch
- [ ] Analytics installed
- [ ] Error tracking (Sentry)
- [ ] Privacy policy page
- [ ] Favicon + OG images
- [ ] 404 page
- [ ] Soft launch to friends
- [ ] Fix reported issues
- [ ] Public launch

---

*Document version 2.0 — December 2025*
*Prepared for AI development platforms (Lovable.ai, Cursor)*
*Stack: React + Vite (or Next.js), Supabase, HeroUI, Mapbox*
