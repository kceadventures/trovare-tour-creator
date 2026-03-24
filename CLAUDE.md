@AGENTS.md

# Trovare Tour Creator

File-based tour uploader for Go Trovare. Creators drop GPX, images, audio, video, and text — AI organizes into Sanity CMS tour drafts.

## Stack

- Next.js 16 (App Router) + TypeScript + pnpm
- Tailwind CSS 4 + shadcn/ui (base-nova style, `components/ui/`)
- Sanity CMS (project `48sx65rc`, dataset `production`)
- DigitalOcean Spaces (S3-compatible, `go-trovare.nyc3.digitaloceanspaces.com`)
- Claude API via `@anthropic-ai/sdk`
- Sharp for server-side image compression
- Deployed on Vercel

## Architecture

Single-page client app (`app/page.tsx`) with screen-based state machine:
`choose → drop → processing → review → publish`

All server logic lives in API routes under `app/api/`. No SSR — the page is `'use client'`.

### Key directories

- `app/` — page, API routes, app-specific components (`app/components/`)
- `lib/` — shared types, constants, utilities (gpx parser, media matcher, Sanity/Spaces clients)
- `components/ui/` — shadcn primitives (auto-generated, don't edit manually)
- `docs/superpowers/` — specs and plans

## Conventions

### Hydration
All localStorage access MUST happen in `useEffect`, never during render or `useState` initializers. Server renders `'choose'` screen with empty state; client restores from localStorage after hydration.

### Radix Select (shadcn)
Use a `'__none__'` sentinel value for "no selection" — never use empty string as value (causes controlled/uncontrolled switch). Render display text explicitly via `<SelectValue>` children, not placeholder — Radix won't resolve dynamic items reliably.

### Animations
shadcn components (`components/ui/`) have been customized with `motion/react` spring animations. Re-generating via shadcn CLI will overwrite these — re-apply motion integration manually after any regeneration. Shared spring configs live in `lib/motion.ts`.

### File uploads
- Files ≤4.5MB: POST to `/api/upload` (multipart FormData)
- Files >4.5MB: get presigned URL from `/api/presign`, PUT directly to DO Spaces
- Images compressed server-side via Sharp (1600px, 80% JPEG) before storage
- Audio/video accepted as-is (MP3/MP4 only, no server transcoding)

### Sanity publishing
- All documents created as drafts (`drafts.` prefix on IDs)
- Use `sanity.transaction()` for atomic multi-document creation
- Audio/video stored as `r2.asset` objects with DO Spaces CDN URLs
- Images uploaded as Sanity image assets with optional hotspot/alt/caption/credit
- New creators and regions created as drafts with `[pending]` label

### Environment variables
- `NEXT_PUBLIC_*` vars are baked in at build time — changes require redeploy
- `TESTING_MODE=true` enables dry-run publishing (no Sanity writes)
- `NEXT_PUBLIC_DISABLE_AI=true` disables AI-assisted path in UI

### State persistence
- `trovare_draft` — auto-saved current session (screen, files, tour)
- `trovare_history` — last 5 tours, resumable, deduped by title
- "Start over" saves current work to history before clearing

## Common gotchas

- `parseGPX()` is pure JS (no server deps) — safe to use client-side for route preview
- Stop coordinates `0,0` are falsy — use `!== 0` checks, not truthiness
- `history.pushState` must NOT be called inside a React state updater (causes Router render warning)
- The process API route streams responses (newline-delimited JSON) — consume with `getReader()`, not `res.json()`

## No tests yet

Test infrastructure has not been set up. When adding tests, consider the GPX parser and media matcher as first candidates — they're pure functions with clear inputs/outputs.
