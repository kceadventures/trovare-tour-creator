export type FileCategory = 'gpx' | 'image' | 'audio' | 'video' | 'text'

export interface UploadedFile {
  id: string
  originalName: string
  category: FileCategory
  url: string
  size: number
  mimeType: string
  exifGps?: { lat: number; lng: number }
}

export interface ImageMeta {
  alt?: string
  caption?: string
  credit?: string
  hotspotX?: number
  hotspotY?: number
}

export interface Stop {
  id: string
  title: string
  kind: string
  details: string
  lat: number
  lng: number
  imageId?: string
  imageMeta?: ImageMeta
  audioId?: string
  videoId?: string
  duplicateWarning?: DuplicateWarning
}

export interface Tour {
  title: string
  description: string
  tourType: string
  categoryTag: string
  challengeLevel: number
  durationRange: number[]
  distance: number
  regionId: string
  tourProviderId: string
  stops: Stop[]
  routePoints: { lat: number; lng: number; ts?: number }[]
  gpxFileId?: string
  collectionId?: string
  previewImageId?: string
  duplicateWarning?: DuplicateWarning
}

export interface DuplicateWarning {
  type: 'title' | 'location'
  existingId: string
  existingTitle: string
  message: string
}

export interface ProcessResult {
  tour: Tour
  files: UploadedFile[]
  unmatchedFiles: UploadedFile[]
}

export interface DryRunDocument {
  _id: string
  _type: string
  [key: string]: unknown
}

export interface DryRunOutput {
  documents: DryRunDocument[]
  assets: { filename: string; type: string; size: number; destination: string }[]
  references: { from: string; to: string; field: string }[]
  warnings: string[]
}

export interface PublishResult {
  success: boolean
  studioUrl?: string
  dryRun?: DryRunOutput
  error?: string
}
