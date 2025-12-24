---
name: Fix Score Calculation and AI Summary Generation
overview: Fix the score calculation formula mismatch between database trigger and sync function, run bulk recalculation, and ensure AI summaries only generate on user interaction (detail page), not automatically on map browsing.
todos:
  - id: update-trigger-formula
    content: Update database trigger calculate_cleanplate_score() to use v2.0 formula (35/25/15/15/10) matching sync function
    status: completed
  - id: add-trackrecord-component
    content: Add TrackRecord component calculation (15% weight) to database trigger function
    status: completed
    dependencies:
      - update-trigger-formula
  - id: fix-trigger-upsert
    content: Ensure trigger fires on UPDATE as well as INSERT (currently only fires on INSERT, but sync uses UPSERT)
    status: completed
    dependencies:
      - update-trigger-formula
  - id: remove-map-ai-generation
    content: Remove automatic AI summary generation from /api/nearby route, use template fallback instead
    status: completed
  - id: run-bulk-recalculation
    content: Run scripts/recalculate-all-scores.js to fix all stale scores across database
    status: completed
    dependencies:
      - update-trigger-formula
      - add-trackrecord-component
      - fix-trigger-upsert
---

# Fix Scor

e Calculation and AI Summary Generation

## Problem Summary

1. **Score Formula Mismatch**: Database trigger uses v1.0 formula (40/20/20/10/10), sync function uses v2.0 (35/25/15/15/10)
2. **Stale Scores**: Many restaurants may have incorrect scores due to formula mismatch or missed recalculations
3. **AI Summary Auto-Generation**: Summaries are generated automatically on map browsing, should only generate on detail page interaction

## Implementation Plan

### 1. Update Database Trigger to v2.0 Formula

**File**: `supabase/migrations/002_score_trigger.sql`

- Update `calculate_cleanplate_score()` function to use v2.0 formula:
- Change from: `(Result × 0.40) + (Trend × 0.20) + (Violations × 0.20) + (Recency × 0.10) + (Risk × 0.10)`
- Change to: `(Result × 0.35) + (Violations × 0.25) + (Trend × 0.15) + (TrackRecord × 0.15) + (Recency × 0.10)`
- Add TrackRecord component calculation (15% weight, 36-month lookback for failures/criticals)
- Update trigger function to match sync-inspections calculation logic
- Ensure trigger fires on both INSERT and UPDATE (currently only INSERT)

### 2. Map API: Remove Auto-Generation, Add Cache Validation

**File**: `app/api/nearby/route.ts`

- Remove automatic AI summary generation (lines 300-326)
- **Add cache invalidation logic**:
- Check if latest inspection date changed since cache was created
- Check if inspection result changed since cache was created
- Return cache validity status with restaurant data
- **Return template summary if no valid cache**:
- If cached summary exists AND cache is valid, return it
- If no cache OR cache is invalid, return `generateInspectionSummary()` template
- **Don't generate AI summaries here** - that happens when user clicks card

### 3. Map Card: Show Template Summary + Generate AI on Expand if Updated

**File**: `components/MapRestaurantCard.tsx`

- **Update map card to show template summary**:
- Currently shows "No detailed summary available" if no AI summary
- Change to show template summary (`generateInspectionSummary`) instead
- This gives users useful info immediately
- **When card is expanded (from card click OR marker click)**:
- Card expands when: (1) user clicks card directly, OR (2) user clicks map marker
- Show template summary immediately (from map data)
- In parallel, fetch from `/api/establishments/[slug]/summary`
- If endpoint returns new AI summary (cache was invalid), update card
- If endpoint returns cached summary (cache valid), keep showing it
- Use HeroUI `Skeleton` component for loading state if needed
- **Trigger logic**: Use `isSelected` prop to detect when card is expanded
- When `isSelected` becomes `true` (card expanded), trigger AI summary fetch
- This covers both card clicks and marker clicks
- **This ensures**:
- Users see useful info immediately (template summary)
- AI summaries only generate when: (1) user expands card (any method) AND (2) inspection updated
- Smooth UX: template → AI summary transition

### 4. Run Bulk Score Recalculation

**Script**: `scripts/recalculate-all-scores.js`

- Run script to recalculate all scores using correct v2.0 formula
- This will fix all stale scores across the database
- Script already exists and uses correct v2.0 formula

### 5. Detail Page: Generate Only When User Clicks AND Info Updated

**File**: `app/api/establishments/[slug]/summary/route.ts`

- **Current behavior** (already implemented):
- Checks if cache is valid (inspection hasn't changed)
- If cache is valid, returns cached summary (no AI generation)
- If cache is invalid (inspection changed), generates new AI summary
- **This is correct**: AI summaries only generate when:

1. User clicks/views detail page (user interaction)
2. AND inspection has been updated (cache invalid)

- No changes needed - this already works as intended

## Files to Modify

1. `supabase/migrations/002_score_trigger.sql` - Update to v2.0 formula
2. `app/api/nearby/route.ts` - Remove auto-generation, add cache validation, return template summary
3. `components/MapRestaurantCard.tsx` - Show template summary when no AI summary, fetch AI summary on card expand if updated
4. Run `scripts/recalculate-all-scores.js` - Bulk recalculation

## Testing