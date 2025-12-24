---
name: Map Marker Color Toggle
overview: Add a toggle switch to the map sidebar that allows users to switch marker colors between "Inspection Result" (pass/fail/conditional) and "CleanPlate Score" (score-based thresholds).
todos:
  - id: add-color-mode-state
    content: Add colorMode state to map/page.tsx and pass to MapSidebar and Map
    status: completed
  - id: add-toggle-ui
    content: Add toggle switch UI to MapSidebar next to restaurant count
    status: completed
  - id: update-map-markers
    content: Update Map.tsx to use colorMode prop and refresh marker colors on change
    status: completed
---

# Map Marker Color Mode Toggle

## Overview
Add a toggle switch next to the restaurant count in the map sidebar to let users choose how marker colors are determined.

## Color Modes

### 1. Inspection Result (Default)
- Green: Pass
- Yellow: Conditional
- Red: Fail

### 2. CleanPlate Score
- Green: Score >= 80
- Yellow: Score 60-79
- Red: Score < 60

## Implementation

### 1. Update Map Page State
In [`app/map/page.tsx`](app/map/page.tsx):
- Add `colorMode` state: `"inspection" | "score"`
- Default to `"inspection"`
- Pass to both `MapSidebar` and `Map` components

### 2. Add Toggle to MapSidebar
In [`components/MapSidebar.tsx`](components/MapSidebar.tsx):
- Add `colorMode` and `onColorModeChange` props
- Add toggle switch next to the restaurant count pill
- Style: compact toggle with labels "Result" / "Score"

### 3. Update Map Marker Colors
In [`components/Map.tsx`](components/Map.tsx):
- Add `colorMode` prop
- Update `getStatus()` function to use the selected mode
- When `colorMode` changes, update all existing marker colors (not just new ones)

## UI Design
```
[120 restaurants] [Result | Score]
                   ^^^^^^ toggle switch
```

The toggle will be a segmented control or simple switch showing which mode is active.