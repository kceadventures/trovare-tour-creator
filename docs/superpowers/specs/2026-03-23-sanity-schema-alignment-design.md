# Sanity Schema Alignment — Design Spec

**Date:** 2026-03-23
**Goal:** Align the tour creator's data output with what the Sanity CMS schema expects, so published drafts are valid and complete.

## Fix 1: Tour Type + Category Tag Separation

**Problem:** Tour creator uses `tourType` for 6 values (`walk`, `bike`, `drive`, `food`, `culture`, `nature`), but Sanity only accepts 4 movement types (`walk`, `bike`, `drive`, `run`).

**Solution:**
- `tourType` dropdown: `walk`, `bike`, `drive`, `run` (movement mode only)
- New `categoryTag` field: free text, AI-suggested values like `food`, `culture`, `nature`, or custom
- AI prompt updated to generate both fields
- Review UI: two fields instead of one combo
- Publish: send both `tourType` and `categoryTag` on the tour document

## Fix 2: Challenge Level 1–3

**Problem:** Creator allows 1–5, Sanity schema max is 3.

**Solution:**
- Dropdown options: 1 (Easy), 2 (Moderate), 3 (Hard)
- AI prompt: output 1–3
- Clamp on publish: `Math.min(challengeLevel, 3)`
- Update `EMPTY` default from `2` to `2`

## Fix 3: POI Kind — Full 16 Values

**Problem:** Creator has 10 kinds, Sanity has 16.

**Solution:** Expand the kind selector to all 16 Sanity values:
`airport`, `beach`, `cafe`, `campground`, `cafeRestaurant`, `church`, `historic`, `hotel`, `museum`, `other`, `park`, `restaurant`, `shop`, `touristAttraction`, `viewpoint`, `winery`

AI prompt updated with full list so it picks the best match.

## Fix 4: Duration Range

**Problem:** Creator stores `duration` as a single string. Sanity expects `durationRange` as an array of 1–2 numbers.

**Solution:**
- AI generates `{"durationMin": N, "durationMax": N}` (in minutes)
- Stored as `durationRange: [min, max]` or `[single]` if equal
- Review UI: two number inputs (min/max minutes)
- Publish: send as `durationRange` array

## Fix 5: GPX Route File Upload

**Problem:** Sanity requires `routeFile` (GPX). Creator has the GPS data but doesn't upload it.

**Solution:**
- On publish, generate GPX XML from `routePoints`
- Upload as a Sanity file asset via `https://{project}.api.sanity.io/{ver}/assets/files/{dataset}`
- Reference in tour doc as `routeFile: { _type: 'file', asset: { _type: 'reference', _ref: assetId } }`

## Fix 6: Static Map Image Upload

**Problem:** Sanity requires `mapImage`. Creator doesn't generate one.

**Solution:**
- On publish, generate a static map image URL from route bounds using OpenStreetMap static tile approach
- Use a canvas-based approach: render the Leaflet map to a canvas screenshot, or use a tile-based static map service
- Simpler approach: use `leaflet-image` or capture the existing map div as an image blob
- Upload as Sanity image asset via `https://{project}.api.sanity.io/{ver}/assets/images/{dataset}`
- Reference as `mapImage: { _type: 'image', asset: { _type: 'reference', _ref: assetId } }`

## Fix 7: Tour Provider Selector

**Problem:** No `tourProvider` reference sent on publish.

**Solution:**
- On the publish screen, fetch tour providers: `*[_type == 'tourProvider']{_id, title}` via Sanity query API
- Show a dropdown selector
- Store selected provider ID in state
- Publish: include `tourProvider: { _type: 'reference', _ref: selectedProviderId }`

## Files Changed

- `src/App.jsx` — all fixes (state, AI prompts, publish logic, UI)
- No new files needed; all changes are in the main app component
