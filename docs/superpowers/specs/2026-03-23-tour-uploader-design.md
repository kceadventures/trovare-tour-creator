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
- Receives multipart files from the drop zone
- Compresses: images via Sharp (max 1600px, 80% JPEG), audio via FFmpeg (MP3 128kbps), video via FFmpeg (H.264 720p crf 28)
- Uploads compressed files to DO Spaces
- Returns CDN URLs + metadata (filename, type, size, EXIF GPS if present)

### POST /api/process
- Receives list of uploaded file URLs + metadata
- Parses GPX: extracts track points + named waypoints as stops with coordinates
- Matches images to stops via EXIF GPS (within ~100m threshold) or filename
- Matches audio/video by filename convention or leaves unmatched
- Calls Claude (with web search) to:
  - Research each stop and generate markdown descriptions
  - Pick POI kind from 16 Sanity types
  - Generate tour title, description, tourType, categoryTag, challengeLevel, durationRange
- Returns organized tour structure

### POST /api/publish
- Generates map image server-side (canvas render of route + stops on CARTO tiles)
- Uploads GPX to Sanity as file asset → routeFile reference
- Uploads map image to Sanity as image asset → mapImage reference
- Uploads POI preview images to Sanity as image assets
- Creates POI draft documents with DO Spaces URLs for audio/video
- Creates tour draft document with all references
- Returns success + Sanity Studio link

## Storage Model

| Content | Compression | Destination | Referenced in Sanity as |
|---------|------------|-------------|------------------------|
| Images | Sharp → JPEG 1600px 80% | Sanity CDN | image asset reference |
| Audio | FFmpeg → MP3 128kbps | DO Spaces | URL string on POI |
| Video | FFmpeg → H.264 720p | DO Spaces | URL string on POI |
| GPX | None | Sanity CDN | file asset reference |
| Map image | Generated PNG | Sanity CDN | image asset reference |

DO Spaces bucket structure:
```
go-trovare.nyc3.digitaloceanspaces.com/
  tours/{tourId}/
    audio/{filename}.mp3
    video/{filename}.mp4
  staging/
    {uploadId}/{original files} → cleaned up after processing
```

## Sanity Documents Created

### Tour (draft)
- title (string, required)
- description (markdown)
- mapImage (image asset, required)
- routeFile (file asset, required)
- distance (number, required) — calculated from GPX track
- tourType (walk/bike/drive/run, required)
- categoryTag (string)
- challengeLevel (1-3)
- durationRange ([min, max] in minutes)
- tourProvider (reference) — selected in review
- relatedRegions (references) — selected in review
- pointsOfInterest (references to created POIs)

### Point of Interest (drafts)
- title (string, required)
- kind (one of 16 types)
- preview (image asset, required)
- details (markdown, required)
- location (geopoint, required)
- audioUpload — DO Spaces URL string (no Studio preview)
- videoUpload — DO Spaces URL string (no Studio preview)

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
- fluent-ffmpeg + @ffmpeg-installer/ffmpeg

## Future

- v2: Chat-based interface where creators converse with AI to build tours
- v2: Tour field recorder (GPS + audio recording on-location)
- Later: Mux for video transcoding if needed
- Later: Studio preview for DO Spaces audio/video
