# Trovare Tour Uploader v1 — Design Spec

**Date:** 2026-03-23
**Goal:** Replace the field-recording tour creator with a file-based upload tool that lets tour creators drop their existing content (GPX, images, videos, audio, text) and have AI organize it into complete Sanity tour drafts.

## Motivation

The current tool requires creators to physically walk a route with the app open. This gates every tour behind a field session. Tour creators typically already have GPX files, photos, videos, and descriptions ready to go. A file uploader lets them publish tours from their desk immediately.

## Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Package manager:** pnpm
- **Deployment:** Vercel
- **Storage:** Digital Ocean Spaces (go-trovare.nyc3.digitaloceanspaces.com)
- **CMS:** Sanity (project 48sx65rc, dataset production)
- **AI:** Claude via Anthropic SDK
- **Compression:** Sharp (images), fluent-ffmpeg (audio/video)

## Page Flow

Single page with four states:

1. **Drop** — single drop zone accepts GPX, JPG/PNG, MP4, MP3, TXT/MD files
2. **Processing** — server parses GPX, extracts EXIF GPS, compresses media, AI generates descriptions
3. **Review** — organized tour with stops, media assignments, editable text and metadata
4. **Publish** — one button creates Sanity draft documents

## API Routes

### POST /api/upload
- Receives files individually (one per request) to stay within Vercel's 4.5MB body limit for serverless functions
- For files >4.5MB, use presigned S3 URLs: server generates a presigned PUT URL, client uploads directly to DO Spaces
- Compresses images via Sharp (max 1600px, 80% JPEG) server-side before uploading to DO Spaces
- Audio/video: uploaded as-is to DO Spaces (v1 accepts only pre-compressed MP3/MP4; see Compression section)
- Extracts EXIF GPS from images via exifr before compression
- Returns CDN URLs + metadata (filename, type, size, EXIF GPS if present)

### POST /api/process
- Receives list of uploaded file URLs + metadata
- Parses GPX: extracts track points + named waypoints as stops with coordinates
- Calculates distance from track points using Haversine formula (output in miles)
- Matches images to stops via EXIF GPS (within ~100m threshold) or filename similarity
- Matches audio/video by filename convention or leaves unmatched for manual assignment in review
- Calls Claude (with web search) to:
  - Research each stop and generate markdown descriptions
  - Pick POI kind from 16 Sanity types (optional — if AI is not confident, leave unset)
  - Generate tour title, description, tourType, categoryTag, challengeLevel, durationRange
- Returns organized tour structure

### POST /api/publish
- Generates map image server-side using a static map tile approach (fetch CARTO tiles, composite with node-canvas or sharp composite)
- Uploads GPX to Sanity as file asset → routeFile reference
- Uploads map image to Sanity as image asset → mapImage reference
- Uploads POI preview images to Sanity as image assets
- Creates all documents in a single Sanity transaction (atomic — all succeed or all fail)
- Creates POI draft documents with r2.asset-shaped objects for audio/video pointing to DO Spaces URLs
- Creates tour draft document with all references
- Returns success + Sanity Studio link

## File Size Limits

| File type | Max size | Handling |
|-----------|---------|----------|
| Images | 20MB per file | Compressed server-side via Sharp before storage |
| Audio (MP3) | 50MB per file | Uploaded as-is via presigned URL |
| Video (MP4) | 200MB per file | Uploaded as-is via presigned URL |
| GPX | 5MB | Processed server-side |
| Text (TXT/MD) | 1MB | Processed server-side |

## Compression Strategy

**v1: Accept pre-compressed formats only.** MP3 for audio, MP4 (H.264) for video. No server-side transcoding.

**Reason:** FFmpeg transcoding on Vercel serverless functions is infeasible — video transcoding easily exceeds the 60s (Hobby) / 300s (Pro) timeout. Image compression via Sharp is fast and runs fine on serverless.

**Future:** Add client-side compression (e.g. browser-based FFmpeg WASM) or an external transcoding service if creators upload raw/oversized files.

## Storage Model

| Content | Processing | Destination | Referenced in Sanity as |
|---------|-----------|-------------|------------------------|
| Images | Sharp → JPEG 1600px 80% | DO Spaces + Sanity CDN | Sanity image asset reference (for POI preview, tour mapImage) |
| Audio | Uploaded as-is (MP3) | DO Spaces | r2.asset object with DO Spaces CDN URL |
| Video | Uploaded as-is (MP4) | DO Spaces | r2.asset object with DO Spaces CDN URL |
| GPX | None | Sanity CDN | Sanity file asset reference |
| Map image | Server-generated PNG | Sanity CDN | Sanity image asset reference |

DO Spaces bucket structure:
```
go-trovare.nyc3.digitaloceanspaces.com/
  tours/{tourId}/
    images/{filename}.jpg
    audio/{filename}.mp3
    video/{filename}.mp4
  staging/
    {uploadId}/{original files}
```

**Staging cleanup:** Files in `staging/` are deleted after successful processing. A lifecycle rule on the DO Spaces bucket auto-deletes staging files older than 24h to handle abandoned uploads.

## Sanity Documents Created

### Tour (draft)
- title (string, required)
- description (markdown)
- mapImage (image asset, required)
- routeFile (file asset, required)
- distance (number in miles, required) — calculated from GPX track via Haversine
- tourType (walk/bike/drive/run, required)
- categoryTag (string)
- challengeLevel (1-3)
- durationRange ([min, max] in minutes)
- tourProvider (reference) — selected in review
- relatedRegions (references) — selected in review
- relatedResorts (references) — optional, selectable in review
- relatedEstablishments (references) — optional, selectable in review
- pointsOfInterest (references to created POIs)

### Point of Interest (drafts)
- title (string, required)
- kind (one of 16 types, optional — AI picks if confident)
- preview (image asset, required — review step must ensure every stop has an image assigned)
- details (markdown, required)
- location (geopoint, required)
- audioUpload — r2.asset object: `{_type: 'r2.asset', filename, filesize, fileType, assetKey, url}` pointing to DO Spaces CDN (no Studio preview)
- videoUpload — r2.asset object: same shape, pointing to DO Spaces CDN (no Studio preview)

## Edge Cases

- **Stop with no matched image:** Review step flags it. Creator must assign an image before publish. If no images available, publish is blocked for that stop.
- **GPX with no named waypoints:** AI infers stops from track geometry (significant pauses, direction changes) or creator manually adds stops in review.
- **No GPX uploaded:** Creator can still add stops manually with coordinates in the review step. Route file remains required — publish blocked without GPX.
- **Partial publish failure:** All Sanity documents created in a single transaction. Either all succeed or all fail. No orphaned documents.

## Auth

No user-facing auth. All credentials server-side:
- ANTHROPIC_API_KEY
- SANITY_API_TOKEN (write token, Editor role)
- DO_SPACES_KEY / DO_SPACES_SECRET
- DO_SPACES_ENDPOINT (nyc3.digitaloceanspaces.com)
- DO_SPACES_BUCKET (go-trovare)

## Dependencies

- @aws-sdk/client-s3 (DO Spaces is S3-compatible)
- @sanity/client
- exifr (EXIF GPS extraction)
- @anthropic-ai/sdk
- sharp

## Future

- v2: Chat-based interface where creators converse with AI to build tours
- v2: Tour field recorder (GPS + audio recording on-location)
- Later: Client-side or external video/audio transcoding
- Later: Studio preview for DO Spaces audio/video
