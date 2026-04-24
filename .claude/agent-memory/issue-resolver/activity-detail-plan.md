---
name: Activity Detail Enhancement Plan
description: Implementation plan for adding missing metrics to ActivityDetailPage
type: project
---

## Plan for Activity Detail Page Enhancements

### Overview
Enhance ActivityDetailPage.jsx to display missing workout metrics currently available from Strava API but not displayed.

### Missing Metrics to Implement

1. **Effort Level (RPE / Perceived Exertion)**
   - Source: Strava API `perceived_exertion` field
   - Display: 1-10 scale with visual indicator
   - Placement: New row in 6-stat grid or separate card

2. **Calories (Enhanced Display)**
   - Source: Already fetched as `details?.calories`
   - Issue: Currently shows raw number
   - Fix: Format with thousands separator, add color coding by burn level

3. **Pace Graph (Pace Over Time)**
   - Source: `streams.velocity_smooth` data (convert to pace)
   - Display: Interactive line chart showing pace progression
   - Placement: New card below HR trace

4. **Max HR Display (Enhanced)**
   - Source: Already fetched as `details?.max_heartrate`
   - Current: Shows in HR card header
   - Enhancement: Add percentage of max HR with zone visualization

5. **Effort Zones (HR/Power Zones)**
   - Source: Strava API `zones` field (array of zone data)
   - Display: Zone distribution bar or zone summary table
   - Placement: New card in detail section

### Backend Data Already Available
- `zones`: Array of zone objects with `min`, `max`, `type`, and `distribution`
- `streams.heartrate`: Raw HR data
- `streams.velocity_smooth`: Speed data (convert to pace)
- `perceived_exertion`: Effort level 1-10
- `calories`: Total calories burned

### Implementation Strategy

1. **Create utility functions** for pace calculation and formatting
2. **Create reusable chart component** for pace visualization
3. **Create effort zone component** for zone visualization
4. **Update ActivityDetailPage** to integrate all new metrics
5. **Ensure responsive layout** for mobile and desktop
6. **Add proper color coding** using existing design tokens
7. **Test with real data** from backend API

### Data Flow
- ActivityDetailPage fetches details via `/api/activities/:id`
- Backend returns `zones`, `streams`, and `perceived_exertion`
- Frontend processes and displays metrics in new cards

### Color Coding Strategy
Use existing design tokens:
- `--color-mint`: Recovery / Easy zones
- `--color-gold`: Tempo / Threshold zones  
- `--color-crimson`: Hard / VO2Max zones
- `--color-sky`: Long / Endurance zones
- `--color-ignite`: Peak efforts

### Testing Approach
1. Verify all new metrics display correctly
2. Test with activities that have/don't have each data type
3. Verify responsive layout on mobile and desktop
4. Validate calculations (pace conversion, zone distribution)
5. Check performance with large datasets
