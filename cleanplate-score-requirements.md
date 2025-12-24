# CleanPlate Score — Algorithm Requirements Document

## Overview

The CleanPlate Score is a proprietary 0-100 rating that tells consumers how clean a restaurant is based on their inspection history. Unlike Chicago's simple Pass/Fail system, our score captures the full picture: recent performance, historical track record, violation severity, trend direction, and data freshness.

**Key principles:**
- Recent improvement should be rewarded, but one good inspection shouldn't erase a problematic history.
- Risk level determines expected inspection frequency, so time-based calculations should be fair across facility types.
- Users see ONE score plus the official latest inspection result (Pass/Fail/Conditions).

---

## TL;DR — Score Components

| Component | Weight | What it measures |
|-----------|--------|------------------|
| Recent Inspection Results | 35% | Pass/Fail/Conditional outcomes with risk-adjusted time decay |
| Violation Severity | 25% | Type and seriousness of violations |
| Trend Analysis | 15% | Getting better or worse over time? |
| Track Record Penalty | 15% | Historical pattern of problems |
| Recency | 10% | Is the latest inspection on schedule for this risk level? |

**Note:** Risk Category (High/Med/Low) is used *indirectly* to calibrate time decay and recency expectations, not as a raw score factor.

---

## Understanding Risk Levels

Chicago assigns risk levels based on what food operations a facility performs:

| Risk Level | Inspection Frequency | What it means |
|------------|---------------------|---------------|
| Risk 1 (High) | Every 6 months | Complex food prep — cooking raw meat, etc. |
| Risk 2 (Medium) | Every 12 months | Moderate food prep |
| Risk 3 (Low) | Every 24 months | Prepackaged foods only |

**Important:** Risk describes *what type of food handling occurs*, not *how clean the facility is*. A sushi restaurant (Risk 1) isn't inherently dirtier than a coffee shop (Risk 3) — they just handle more hazardous food.

---

## Component 1: Recent Inspection Results (35%)

### Risk-Adjusted Time Decay

Each inspection is weighted by how recent it is using **exponential decay with a risk-adjusted half-life**.

**Half-life by risk level:**
| Risk Level | Half-Life | Rationale |
|------------|-----------|-----------|
| Risk 1 (High) | 6 months | Inspected 2x/year |
| Risk 2 (Medium) | 12 months | Inspected 1x/year |
| Risk 3 (Low) | 24 months | Inspected every 2 years |

**Formula:**
```
λ = 0.693 / Half_Life_Months
weight = e^(-λ × months_since_inspection)
```

**What this means (weight at different ages):**

| Time Since Inspection | Risk 1 | Risk 2 | Risk 3 |
|----------------------|--------|--------|--------|
| 3 months ago | 0.71 | 0.84 | 0.92 |
| 6 months ago | 0.50 | 0.71 | 0.84 |
| 12 months ago | 0.25 | 0.50 | 0.71 |
| 24 months ago | 0.06 | 0.25 | 0.50 |

This ensures a Risk 3 facility isn't unfairly penalized for having older inspections — their inspection schedule is simply less frequent by design.

### Outcome Points

| Result | Points |
|--------|--------|
| Pass | 100 |
| Pass w/ Conditions | 70 |
| Fail | 30 |
| Out of Business | 0 (exclude from calculation) |
| No Entry | 0 (exclude from calculation) |

### Calculation

```
Result_Score = Σ(outcome_points × weight) / Σ(weight)
```

**Example (Risk 2 restaurant):**
- Inspection 1 (today): Pass = 100 × 1.00 = 100
- Inspection 2 (8 months ago): Fail = 30 × 0.63 = 18.9
- Inspection 3 (14 months ago): Pass = 100 × 0.45 = 45

Result_Score = (100 + 18.9 + 45) / (1.00 + 0.63 + 0.45) = 163.9 / 2.08 = **78.8**

---

## Component 2: Violation Severity (25%)

### Violation Category Weights

| Category | Icon | Severity Multiplier | CDPH Codes |
|----------|------|---------------------|------------|
| Toxic | ☠️ | 1.5x | 28 |
| Pest | 🪲 | 1.3x | 38 |
| Temperature | 🌡️ | 1.2x | 32, 33, 34 |
| Food Handling | 🍖 | 1.1x | 35, 36, 37 |
| Sanitation | 🧹 | 1.0x | 40, 41, 43, 44 |
| Water/Sewage | 💧 | 1.0x | 31, 39 |
| Hygiene | 🧼 | 0.9x | 3, 4, 10 |
| Certification | 📋 | 0.5x | 1, 2, 5 |

### CDPH Severity Levels

| Level | Code | Base Points |
|-------|------|-------------|
| Priority (P) | Immediate hazard | 10 points |
| Priority Foundation (Pf) | Potential hazard | 5 points |
| Core (C) | General sanitation | 2 points |

### Violation Score Calculation

```
Violation_Points = Σ(base_points × category_multiplier × time_weight)
Max_Possible_Points = theoretical_max_for_inspection_count
Violation_Score = 100 - (Violation_Points / Max_Possible_Points × 100)
```

**Capped at 0 minimum** — score can't go negative.

---

## Component 3: Trend Analysis (15%)

### What We're Measuring

Is this restaurant getting better or worse over time?

### Calculation

Compare the average of the **last 2 inspections** vs. the **previous 2 inspections**.

```
Recent_Avg = average(inspection_1, inspection_2)
Previous_Avg = average(inspection_3, inspection_4)
Trend_Delta = Recent_Avg - Previous_Avg
```

### Trend Score

| Trend Delta | Trend Score | Interpretation |
|-------------|-------------|----------------|
| +30 or more | 100 | Strong improvement |
| +15 to +29 | 85 | Moderate improvement |
| +1 to +14 | 70 | Slight improvement |
| 0 | 60 | Stable |
| -1 to -14 | 45 | Slight decline |
| -15 to -29 | 30 | Moderate decline |
| -30 or worse | 15 | Strong decline |

### Minimum Data Requirement

If fewer than 3 inspections exist, Trend_Score defaults to **60** (neutral).

---

## Component 4: Track Record Penalty (15%)

### Purpose

Prevent a single good inspection from erasing a problematic history. This penalty persists even when recent inspections are clean.

### Penalty Points Accumulation

| Event | Penalty Points | Lookback Period |
|-------|---------------|-----------------|
| Each inspection with critical (P) violations | +3 | 36 months |
| Each inspection requiring re-inspection | +2 | 24 months |
| Each closure/license suspension | +5 | 60 months |
| Each "Fail" result | +2 | 36 months |

### Track Record Score

```
Track_Record_Penalty = min(total_penalty_points, 20)
Track_Record_Score = 100 - (Track_Record_Penalty × 5)
```

**Floor:** Track_Record_Score cannot go below 0.

**Example:**
- 2 failures in past 36 months: +4
- 1 closure 2 years ago: +5
- 3 critical violations: +9
- Total penalty: 18 points
- Track_Record_Score = 100 - (18 × 5) = **10**

---

## Component 5: Recency (10%)

### Purpose

Reward establishments that have been recently inspected and penalize stale data, while being fair to facilities with different expected inspection frequencies.

### Risk-Adjusted Recency Calculation

```
Days_Since_Last = today - last_inspection_date
Expected_Interval = risk_to_days(risk_level)
  - Risk 1 → 180 days (6 months)
  - Risk 2 → 365 days (12 months)
  - Risk 3 → 730 days (24 months)

Recency_Ratio = Days_Since_Last / Expected_Interval
```

### Recency Score

| Recency Ratio | Recency Score | Interpretation |
|---------------|---------------|----------------|
| < 0.5 | 100 | Very recent (well ahead of schedule) |
| 0.5 - 1.0 | 85 | On schedule |
| 1.0 - 1.25 | 60 | Slightly overdue |
| > 1.25 | 40 | Overdue |

**Examples:**

| Facility | Risk | Days Since | Expected | Ratio | Score |
|----------|------|------------|----------|-------|-------|
| Sushi restaurant | 1 | 90 days | 180 | 0.50 | 85 |
| Sushi restaurant | 1 | 270 days | 180 | 1.50 | 40 |
| Coffee shop | 3 | 400 days | 730 | 0.55 | 85 |
| Coffee shop | 3 | 400 days | 180 (if using fixed) | 2.22 | 40 (unfair!) |

The risk-adjusted approach ensures a Risk 3 coffee shop with a 14-month-old inspection isn't penalized — they're still on schedule.

---

## Final Score Calculation

```
CleanPlate_Score = (Result_Score × 0.35) +
                   (Violation_Score × 0.25) +
                   (Trend_Score × 0.15) +
                   (Track_Record_Score × 0.15) +
                   (Recency_Score × 0.10)
```

### Score Ranges

| Range | Label | Ring Color | Interpretation |
|-------|-------|------------|----------------|
| 90-100 | Excellent | Green `#16a34a` | Consistently clean, minimal violations |
| 70-89 | Good | Light Green `#65a30d` | Generally clean, minor issues |
| 50-69 | Fair | Amber `#d97706` | Some concerns, room for improvement |
| 0-49 | Poor | Red `#dc2626` | Significant issues, caution advised |

---

## Display: Score + Latest Inspection Badge

Users see TWO pieces of information:

1. **CleanPlate Score (0-100)** — Our proprietary algorithmic score
2. **Latest Inspection Badge** — The official city result from the most recent inspection

### Latest Inspection Badge Values

Use the exact values from Chicago's inspection system:

| Result | Badge Display | Color |
|--------|---------------|-------|
| Pass | ✓ Pass | Green |
| Pass w/ Conditions | ⚠ Conditional | Amber |
| Fail | ✗ Fail | Red |
| No Entry | — No Entry | Gray |
| Out of Business | Closed | Gray |
| Not Ready | — Not Ready | Gray |

If no inspection in 24+ months, show: **"Not Recently Inspected"** (Gray)

### Visual Layout

```
┌─────────────────────────────┐
│  ┌─────┐                    │
│  │ 78  │  ✓ Pass            │
│  └─────┘  Dec 5, 2024       │
│  CleanPlate Score           │
└─────────────────────────────┘
```

This gives users:
- **Score**: "Should I trust this place over time?" (algorithmic answer)
- **Badge**: "What happened most recently?" (official city data)

---

## Handling Sparse Data

### Problem

Some restaurants (especially low-risk facilities) may only be inspected every 2 years. We need to handle cases with limited data.

### Solution: Bayesian Blending

```
α = min(inspection_count / 4, 1)
Final_Score = (α × Calculated_Score) + ((1 - α) × Category_Baseline)
```

| Inspections | α | Blend |
|-------------|---|-------|
| 1 | 0.25 | 25% individual, 75% category average |
| 2 | 0.50 | 50% individual, 50% category average |
| 3 | 0.75 | 75% individual, 25% category average |
| 4+ | 1.00 | 100% individual score |

### Category Baselines

Calculate rolling averages by facility type:
- Restaurants: ~72
- Grocery Stores: ~75
- Daycares/Schools: ~80
- Bakeries: ~74

Update baselines monthly based on all inspections in category.

---

## Edge Cases

### No Inspections in 24+ Months

- Display score as greyed out with "—"
- Show label: "Not Recently Inspected"
- Do not include in rankings or comparisons

### Brand New Establishment

- If only 1 inspection exists and it's within 90 days:
  - Use 100% category baseline
  - Show label: "New — Limited Data"

### Out of Business

- Exclude from all calculations and listings
- Mark as "Permanently Closed" if confirmed

### Re-opened After Closure

- Reset track record clock for closure penalty (60 months)
- Keep other penalty points active
- Note: "Re-opened [date]" on detail page

---

## Anti-Gaming Measures

### 1. Track Record Persistence

Penalty points don't disappear immediately after a good inspection. They decay based on their own lookback periods (24-60 months).

### 2. Trend Requires Multiple Inspections

A single good inspection doesn't flip the trend. Need sustained improvement across at least 2 inspections.

### 3. Exponential Decay (Not Cliff)

Old violations fade gradually — they don't suddenly disappear after a threshold date.

### 4. Category Multipliers

Serious violations (Pest, Toxic, Temp) impact score more than administrative issues (Certification).

### 5. Risk-Adjusted Fairness

Different facility types have different expected inspection frequencies. A Risk 3 facility with a year-old inspection isn't penalized the same as a Risk 1 facility with the same age inspection.

---

## Implementation Notes

### Data Required from Chicago API

```javascript
const requiredFields = {
  inspection_id: 'string',      // Unique ID
  dba_name: 'string',           // Business name
  license_: 'string',           // License number
  facility_type: 'string',      // Restaurant, Grocery, etc.
  risk: 'string',               // Risk 1/2/3 (for time decay and recency calibration)
  inspection_date: 'date',      // ISO 8601
  inspection_type: 'string',    // Canvass, Complaint, etc.
  results: 'string',            // Pass, Fail, Pass w/ Conditions
  violations: 'string',         // Pipe-delimited violation codes
  latitude: 'number',
  longitude: 'number'
};
```

### Score Calculation Trigger

Recalculate CleanPlate Score when:
1. New inspection data is synced (daily at 2 AM)
2. User requests a specific restaurant (on-demand)
3. Category baselines are updated (monthly)

### Key Functions

```typescript
// Risk-adjusted half-life for time decay
function getRiskAdjustedHalfLife(riskLevel: number): number {
  switch (riskLevel) {
    case 1: return 6;   // 6 months
    case 2: return 12;  // 12 months
    case 3: return 24;  // 24 months
    default: return 12; // Default to medium
  }
}

// Risk-adjusted recency score
function calculateRecencyScore(daysSince: number, riskLevel: number): number {
  const expectedInterval = riskLevel === 1 ? 180 : riskLevel === 3 ? 730 : 365;
  const ratio = daysSince / expectedInterval;
  
  if (ratio < 0.5) return 100;  // Very recent
  if (ratio <= 1.0) return 85;  // On schedule
  if (ratio <= 1.25) return 60; // Slightly overdue
  return 40;                     // Overdue
}
```

### Caching Strategy

- Cache scores for 24 hours
- Invalidate on new inspection data
- Pre-compute top restaurants per neighborhood

---

## User-Facing Explanation Page

### Page: `/about` (CleanPlate Score section)

**Content to include:**

#### Score Explanation

> Our proprietary CleanPlate Score (0-100) combines multiple factors to give you a comprehensive view of a restaurant's food safety:
>
> - **Recent Inspections (35%):** Pass, Conditional, or Fail status, weighted by recency
> - **Violation Severity (25%):** Number and seriousness of violations found
> - **Trend (15%):** Is the restaurant improving or declining?
> - **Track Record (15%):** History of problems over the past 2-5 years
> - **Data Freshness (10%):** How recently was this place inspected?

#### Latest Inspection Badge

> In addition to the CleanPlate Score, we show the official result from the most recent inspection (Pass, Fail, or Conditional). This comes directly from Chicago's health department data.

#### What the Scores Mean

| Score | What it means |
|-------|---------------|
| 90-100 🟢 | Excellent — Consistently clean, safe choice |
| 70-89 🟢 | Good — Generally clean, minor issues |
| 50-69 🟡 | Fair — Some concerns, check details |
| 0-49 🔴 | Poor — Significant issues, proceed with caution |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2024 | Initial algorithm design |
| 2.0 | Dec 2024 | Added risk-adjusted time decay and recency; updated weights to 35/25/15/15/10; added display simplification (score + badge) |

---

## File Information

| Property | Value |
|----------|-------|
| Document | CleanPlate Score Algorithm Requirements |
| Status | Ready for Implementation |
| Author | CleanPlate Chicago Team |
