# Location Input with Address Search Design

Replace raw lat/lng number inputs with a tabbed `LocationInput` component that offers Nominatim address search alongside manual coordinate entry.

## Component: `LocationInput`

A shared component used in both **stop cards** (`app/components/stop-card.tsx`) and **new region creation** (`app/components/review-panel.tsx`).

### Props

```ts
interface LocationInputProps {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
  layoutIdPrefix?: string // scopes tab animation layoutId — defaults to "location"
}
```

### UI: Underline Tabs

Two tabs with a sliding underline indicator (uses the Emil Kowalski `layoutId` pattern from the animation spec):

- **Search** — Nominatim autocomplete input
- **Coordinates** — raw lat/lng number inputs (same as today)

The `layoutId` is scoped via `layoutIdPrefix` prop to avoid conflicts when multiple instances exist (e.g., `"location-stop-1"`, `"location-new-region"`).

### Default Tab Logic

- If `lat === 0 && lng === 0` (no coordinates): default to **Search** tab
- If coordinates are populated (e.g., from GPX parse): default to **Coordinates** tab
- Note: use `=== 0` checks, not truthiness — `0` is a valid coordinate component that is falsy in JS

### Search Tab

**Input:** Single text input with placeholder "Search for an address..."

**Autocomplete:**
- Debounce input by 300ms before querying
- Minimum 3 characters before searching
- Query the `/api/geocode` proxy route (see below)
- Show dropdown with results:
  - Each result shows `display_name` split into primary (first comma-segment) and secondary (remaining)
  - MapPin icon prefix on each result
- **Keyboard navigation:** Arrow keys move through results, Enter selects, Escape dismisses dropdown

**States:**
- **Loading:** Show a small spinner in the input while a search is in-flight
- **No results:** Show "No results found" in the dropdown
- **Error:** Show "Search unavailable — use Coordinates tab" in the dropdown. Do not block usage.

**On select:**
- Set `lat`/`lng` from result's `lat`/`lon` (note: Nominatim uses `lon`, not `lng`)
- Show resolved coordinates below the input as small monospace text: `41.8902° N, 12.4922° E`
- Call `onChange` with the new coordinates
- Clear the dropdown, keep the selected address name in the input

**On tab switch:** Search input text and selected address are preserved when switching to Coordinates and back. Clearing the search input resets the resolved coordinates.

**Rate limiting:** Module-level `let lastRequest = 0` timestamp shared across all instances. Before fetching, check `Date.now() - lastRequest >= 1000`. If too soon, delay the request. This ensures compliance with Nominatim's 1 req/sec policy even with multiple LocationInput instances on screen.

### Coordinates Tab

Two side-by-side number inputs for latitude and longitude. Values persist when switching between tabs — selecting an address fills the coordinate fields, and they remain editable.

Use `value={lat !== 0 ? lat : ''}` pattern (strict equality) to avoid the `0` truthiness gotcha documented in CLAUDE.md.

### File Location

`app/components/location-input.tsx` — new component.

### API Route

Nominatim requests proxied through a server-side API route to avoid CORS issues, set the required `User-Agent` header, and keep the Nominatim URL out of client bundles.

**Route:** `app/api/geocode/route.ts`

```ts
// GET /api/geocode?q=piazza+del+colosseo
// Proxies to Nominatim search endpoint
// Returns transformed results:

interface GeocodeSuggestion {
  display_name: string  // full display name from Nominatim
  lat: number           // parsed float
  lon: number           // parsed float (Nominatim naming)
}

// Response: GeocodeSuggestion[]
```

The route transforms Nominatim's verbose response into a slim shape, decoupling the client from Nominatim's full format and making it easier to swap providers later.

### Integration Points

**Stop card (`app/components/stop-card.tsx`):**
Replace the `{/* Coordinates */}` section with `<LocationInput lat={stop.lat} lng={stop.lng} onChange={(lat, lng) => onUpdate({ ...stop, lat, lng })} layoutIdPrefix={`location-stop-${stop._key}`} />`.

**Review panel (`app/components/review-panel.tsx`):**
Replace the lat/lng inputs in the "Create Region" dialog. The existing region dialog uses `string` state (`newRegionLat`, `newRegionLng`) parsed to `number | undefined` on submit. Refactor to use `number` state directly:
- Replace `newRegionLat`/`newRegionLng` string states with a single `newRegionCoords: { lat: number; lng: number }` state initialized to `{ lat: 0, lng: 0 }`
- On submit: pass `lat: newRegionCoords.lat || undefined`, `lng: newRegionCoords.lng || undefined` (preserving the optional semantics)
- Use `<LocationInput lat={newRegionCoords.lat} lng={newRegionCoords.lng} onChange={(lat, lng) => setNewRegionCoords({ lat, lng })} layoutIdPrefix="location-new-region" />`

### Animations (ties into animation spec)

Animations require `motion/react` to be installed (prerequisite from the animation spec). If implementing this before the animation spec, use CSS transitions as a fallback — the tab underline can use `transition: left/width 200ms ease` and the dropdown can use `transition: opacity/transform 150ms ease`.

When motion is available:
- Tab underline indicator: `motion.div` with `layoutId="{layoutIdPrefix}-tab"`
- Tab content: crossfade with `AnimatePresence mode="wait"`
- Autocomplete dropdown: `scale(0.96) → 1`, `opacity: 0 → 1`, smooth spring
- Dropdown items: staggered fade-in (20ms delay)
- Resolved coordinates text: fade in on appear
- Dropdown exit: fast fade, exit spring

### Constraints

- Nominatim usage policy: max 1 req/sec, must include User-Agent, no heavy bulk usage
- No API key required
- All geocoding is optional — users can always use the Coordinates tab for manual entry
- Coordinates tab is the fallback if Nominatim is unreachable
- `0` is falsy in JS — always use strict `=== 0` checks for coordinate values
