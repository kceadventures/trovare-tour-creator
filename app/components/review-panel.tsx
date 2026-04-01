'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { spring, staggerContainer, staggerChild } from '@/lib/motion'
import { FileUp, Download, X } from 'lucide-react'
import { Tour, UploadedFile, Stop } from '@/lib/types'
import {
  TOUR_TYPES,
  CATEGORY_TAGS,
} from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StopCard } from './stop-card'
import { MediaAssignment } from './media-assignment'
import { RoutePreview } from './route-preview'
import { LocationInput } from './location-input'

interface TourProvider {
  _id: string
  title: string
}

interface Props {
  tour: Tour
  files: UploadedFile[]
  unmatchedFiles: UploadedFile[]
  tourProviders: TourProvider[]
  onTourUpdate: (tour: Tour) => void
  onAssignMedia: (fileId: string, stopId: string) => void
  onRemoveMedia: (stopId: string, category: 'image' | 'audio' | 'video') => void
  onReplaceImage: (stopId: string, file: File) => void
  replacingImageStopId?: string
  onCreateProvider: (data: { name: string; email: string; description: string; website: string }) => Promise<TourProvider | null>
  regions: { _id: string; title: string }[]
  onCreateRegion: (data: { title: string; description: string; lat?: number; lng?: number }) => Promise<{ _id: string; title: string } | null>
  collections: { _id: string; title: string }[]
  onCreateCollection: (data: { title: string; description: string }) => Promise<{ _id: string; title: string } | null>
  onUploadGpx: (file: File) => Promise<void>
  uploadingGpx?: boolean
}

const CHALLENGE_LEVELS = [
  { value: 1, label: '1 – Easy' },
  { value: 2, label: '2 – Moderate' },
  { value: 3, label: '3 – Hard' },
]

export function ReviewPanel({
  tour,
  files,
  unmatchedFiles,
  tourProviders,
  onTourUpdate,
  onAssignMedia,
  onRemoveMedia,
  onReplaceImage,
  replacingImageStopId,
  onCreateProvider,
  regions,
  onCreateRegion,
  collections,
  onCreateCollection,
  onUploadGpx,
  uploadingGpx,
}: Props) {
  const gpxInputRef = useRef<HTMLInputElement>(null)
  const [newRegionOpen, setNewRegionOpen] = useState(false)
  const [newRegionTitle, setNewRegionTitle] = useState('')
  const [newRegionDesc, setNewRegionDesc] = useState('')
  const [newRegionCoords, setNewRegionCoords] = useState({ lat: 0, lng: 0 })
  const [creatingRegion, setCreatingRegion] = useState(false)

  const [newProviderOpen, setNewProviderOpen] = useState(false)
  const [newProviderName, setNewProviderName] = useState('')
  const [newProviderEmail, setNewProviderEmail] = useState('')
  const [newProviderDesc, setNewProviderDesc] = useState('')
  const [newProviderWebsite, setNewProviderWebsite] = useState('')
  const [creatingProvider, setCreatingProvider] = useState(false)

  const [suggestCategoryOpen, setSuggestCategoryOpen] = useState(false)
  const [categorySuggestion, setCategorySuggestion] = useState('')
  const [categorySuggestSent, setCategorySuggestSent] = useState(false)

  const [newCollectionOpen, setNewCollectionOpen] = useState(false)
  const [newCollectionTitle, setNewCollectionTitle] = useState('')
  const [newCollectionDesc, setNewCollectionDesc] = useState('')
  const [creatingCollection, setCreatingCollection] = useState(false)

  const previewInputRef = useRef<HTMLInputElement>(null)
  const [uploadingPreview, setUploadingPreview] = useState(false)

  async function handlePreviewUpload(file: File) {
    setUploadingPreview(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const uploaded: UploadedFile = await res.json()
      onTourUpdate({ ...tour, previewImageId: uploaded.id })
    } catch (e) {
      console.error('Preview upload failed:', e)
    } finally {
      setUploadingPreview(false)
    }
  }

  function updateStop(index: number, updated: Stop) {
    const stops = [...tour.stops]
    stops[index] = updated
    onTourUpdate({ ...tour, stops })
  }

  const distanceKm = tour.distance
    ? (tour.distance / 1000).toFixed(1)
    : '—'

  return (
    <div className="space-y-6">
      {/* Tour metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Tour Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {/* Title */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">Title</label>
            <Input
              value={tour.title}
              placeholder="Tour title"
              onChange={(e) => onTourUpdate({ ...tour, title: e.target.value })}
            />
          </div>

          {/* Main Tour Image */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">Main Tour Image</label>
            {(() => {
              const previewFile = tour.previewImageId ? files.find((f) => f.id === tour.previewImageId) : null
              return previewFile ? (
                <div className="relative group">
                  <img
                    src={previewFile.url}
                    alt={tour.title || 'Tour preview'}
                    className="w-full h-40 object-cover rounded-md border border-border"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => previewInputRef.current?.click()}
                      disabled={uploadingPreview}
                    >
                      {uploadingPreview ? 'Uploading...' : 'Replace'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onTourUpdate({ ...tour, previewImageId: undefined })}
                    >
                      Remove
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{previewFile.originalName}</p>
                </div>
              ) : (
                <div
                  className="w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-md flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => previewInputRef.current?.click()}
                >
                  <span className="text-2xl text-muted-foreground/50">🖼️</span>
                  <span className="text-xs text-muted-foreground">
                    {uploadingPreview ? 'Uploading...' : 'Click to add main tour image'}
                  </span>
                </div>
              )
            })()}
            <input
              ref={previewInputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handlePreviewUpload(file)
                e.target.value = ''
              }}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">Description</label>
            <Textarea
              value={tour.description}
              placeholder="Tour description…"
              rows={3}
              onChange={(e) =>
                onTourUpdate({ ...tour, description: e.target.value })
              }
            />
          </div>

          {/* Tour Type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Tour Type</label>
            <Select
              value={tour.tourType}
              onValueChange={(v) => v && onTourUpdate({ ...tour, tourType: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {TOUR_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Tag */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Category</label>
            <Select
              value={tour.categoryTag}
              onValueChange={(v) => {
                if (v === '__suggest__') {
                  setSuggestCategoryOpen(true)
                  setCategorySuggestSent(false)
                  setCategorySuggestion('')
                } else if (v) {
                  onTourUpdate({ ...tour, categoryTag: v })
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const idx = CATEGORY_TAGS.indexOf(tour.categoryTag as typeof CATEGORY_TAGS[number])
                  const nearTop = idx >= 0 && idx < CATEGORY_TAGS.length / 2
                  const action = (
                    <SelectItem key="__suggest__" value="__suggest__" className="text-primary">
                      Suggest a category...
                    </SelectItem>
                  )
                  return (
                    <>
                      {nearTop && action}
                      {CATEGORY_TAGS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                      {!nearTop && action}
                    </>
                  )
                })()}
              </SelectContent>
            </Select>
          </div>

          {/* Suggest category dialog */}
          <Dialog open={suggestCategoryOpen} onOpenChange={setSuggestCategoryOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Suggest a new category</DialogTitle>
                <DialogDescription>
                  Don&apos;t see the right category? Let us know what you&apos;d like added.
                </DialogDescription>
              </DialogHeader>
              {categorySuggestSent ? (
                <p className="text-sm text-muted-foreground py-2">
                  Thanks for your suggestion! We&apos;ll review it.
                </p>
              ) : (
                <div className="space-y-3">
                  <Input
                    value={categorySuggestion}
                    onChange={(e) => setCategorySuggestion(e.target.value)}
                    placeholder="e.g. Architecture, Wildlife, Gastronomy..."
                    autoFocus
                  />
                  <Button
                    className="w-full"
                    disabled={!categorySuggestion.trim()}
                    onClick={() => {
                      fetch('/api/suggest', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          type: 'category_tag',
                          suggestion: categorySuggestion.trim(),
                          tourTitle: tour.title,
                        }),
                      }).catch(() => {})
                      setCategorySuggestSent(true)
                    }}
                  >
                    Submit suggestion
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Challenge Level */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              Challenge Level
            </label>
            <Select
              value={String(tour.challengeLevel)}
              onValueChange={(v) =>
                v && onTourUpdate({ ...tour, challengeLevel: Number(v) })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {CHALLENGE_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={String(l.value)}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Region */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Region</label>
            <Select
              value={tour.regionId || '__none__'}
              onValueChange={(v) => {
                if (v === '__new__') {
                  setNewRegionOpen(true)
                  setNewRegionTitle('')
                  setNewRegionDesc('')
                  setNewRegionCoords({ lat: 0, lng: 0 })
                } else if (v === '__none__') {
                  onTourUpdate({ ...tour, regionId: '' })
                } else if (v) {
                  onTourUpdate({ ...tour, regionId: v })
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {tour.regionId
                    ? (regions.find((r) => r._id === tour.regionId)?.title ?? 'Loading...')
                      + (tour.regionId.startsWith('drafts.') ? ' [pending]' : '')
                    : 'Select region'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const idx = regions.findIndex((r) => r._id === tour.regionId)
                  const nearTop = idx >= 0 && idx < regions.length / 2
                  const action = (
                    <SelectItem key="__new__" value="__new__" className="text-primary">
                      + New region...
                    </SelectItem>
                  )
                  return (
                    <>
                      {nearTop && action}
                      <SelectItem value="__none__" className="text-muted-foreground">
                        No region
                      </SelectItem>
                      {regions.map((r) => (
                        <SelectItem key={r._id} value={r._id}>
                          {r.title}{r._id.startsWith('drafts.') ? ' [pending]' : ''}
                        </SelectItem>
                      ))}
                      {!nearTop && action}
                    </>
                  )
                })()}
              </SelectContent>
            </Select>
          </div>

          {/* New region dialog */}
          <Dialog open={newRegionOpen} onOpenChange={setNewRegionOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New region</DialogTitle>
                <DialogDescription>
                  This will create a draft region for review by our team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Region name *</label>
                  <Input
                    value={newRegionTitle}
                    onChange={(e) => setNewRegionTitle(e.target.value)}
                    placeholder="e.g. Porto, Amalfi Coast, Kyoto..."
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Description</label>
                  <Textarea
                    value={newRegionDesc}
                    onChange={(e) => setNewRegionDesc(e.target.value)}
                    placeholder="Brief description of the region..."
                    rows={2}
                  />
                </div>
                <LocationInput
                  lat={newRegionCoords.lat}
                  lng={newRegionCoords.lng}
                  onChange={(lat, lng) => setNewRegionCoords({ lat, lng })}
                  layoutIdPrefix="location-new-region"
                />
                <Button
                  className="w-full"
                  disabled={!newRegionTitle.trim() || creatingRegion}
                  onClick={async () => {
                    setCreatingRegion(true)
                    const created = await onCreateRegion({
                      title: newRegionTitle.trim(),
                      description: newRegionDesc.trim(),
                      lat: newRegionCoords.lat !== 0 ? newRegionCoords.lat : undefined,
                      lng: newRegionCoords.lng !== 0 ? newRegionCoords.lng : undefined,
                    })
                    setCreatingRegion(false)
                    if (created) {
                      onTourUpdate({ ...tour, regionId: created._id })
                      setNewRegionOpen(false)
                    }
                  }}
                >
                  {creatingRegion ? 'Creating...' : 'Create draft region'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Tour Provider */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              Tour Provider
            </label>
            <Select
              value={tour.tourProviderId || '__none__'}
              onValueChange={(v) => {
                if (v === '__new__') {
                  setNewProviderOpen(true)
                  setNewProviderName('')
                  setNewProviderEmail('')
                  setNewProviderDesc('')
                  setNewProviderWebsite('')
                } else if (v === '__none__') {
                  onTourUpdate({ ...tour, tourProviderId: '' })
                } else if (v) {
                  onTourUpdate({ ...tour, tourProviderId: v })
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {tour.tourProviderId
                    ? (tourProviders.find((p) => p._id === tour.tourProviderId)?.title ?? 'Loading...')
                      + (tour.tourProviderId.startsWith('drafts.') ? ' [pending]' : '')
                    : 'Select provider'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const idx = tourProviders.findIndex((p) => p._id === tour.tourProviderId)
                  const nearTop = idx >= 0 && idx < tourProviders.length / 2
                  const action = (
                    <SelectItem key="__new__" value="__new__" className="text-primary">
                      + New creator...
                    </SelectItem>
                  )
                  return (
                    <>
                      {nearTop && action}
                      <SelectItem value="__none__" className="text-muted-foreground">
                        No provider
                      </SelectItem>
                      {tourProviders.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.title}{p._id.startsWith('drafts.') ? ' [pending]' : ''}
                        </SelectItem>
                      ))}
                      {!nearTop && action}
                    </>
                  )
                })()}
              </SelectContent>
            </Select>
          </div>

          {/* New provider dialog */}
          <Dialog open={newProviderOpen} onOpenChange={setNewProviderOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New tour creator</DialogTitle>
                <DialogDescription>
                  This will create a draft creator profile for review by our team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Name *</label>
                  <Input
                    value={newProviderName}
                    onChange={(e) => setNewProviderName(e.target.value)}
                    placeholder="Creator or company name"
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Email *</label>
                  <Input
                    type="email"
                    value={newProviderEmail}
                    onChange={(e) => setNewProviderEmail(e.target.value)}
                    placeholder="contact@example.com"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Website or social link</label>
                  <Input
                    type="url"
                    value={newProviderWebsite}
                    onChange={(e) => setNewProviderWebsite(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Short bio</label>
                  <Textarea
                    value={newProviderDesc}
                    onChange={(e) => setNewProviderDesc(e.target.value)}
                    placeholder="Tell us a bit about this creator..."
                    rows={3}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!newProviderName.trim() || !newProviderEmail.trim() || creatingProvider}
                  onClick={async () => {
                    setCreatingProvider(true)
                    const created = await onCreateProvider({
                      name: newProviderName.trim(),
                      email: newProviderEmail.trim(),
                      description: newProviderDesc.trim(),
                      website: newProviderWebsite.trim(),
                    })
                    setCreatingProvider(false)
                    if (created) {
                      onTourUpdate({ ...tour, tourProviderId: created._id })
                      setNewProviderOpen(false)
                    }
                  }}
                >
                  {creatingProvider ? 'Creating...' : 'Create draft creator'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Tour Collection */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">Tour Collection (optional)</label>
            <Select
              value={tour.collectionId || '__none__'}
              onValueChange={(v) => {
                if (v === '__new__') {
                  setNewCollectionOpen(true)
                  setNewCollectionTitle('')
                  setNewCollectionDesc('')
                } else if (v === '__none__') {
                  onTourUpdate({ ...tour, collectionId: '' })
                } else if (v) {
                  onTourUpdate({ ...tour, collectionId: v })
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {tour.collectionId
                    ? (collections.find((c) => c._id === tour.collectionId)?.title ?? 'Loading...')
                      + (tour.collectionId.startsWith('drafts.') ? ' [pending]' : '')
                    : 'No tour collection'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const idx = collections.findIndex((c) => c._id === tour.collectionId)
                  const nearTop = idx >= 0 && idx < collections.length / 2
                  const action = (
                    <SelectItem key="__new__" value="__new__" className="text-primary">
                      + New tour collection...
                    </SelectItem>
                  )
                  return (
                    <>
                      {nearTop && action}
                      <SelectItem value="__none__" className="text-muted-foreground">
                        No tour collection
                      </SelectItem>
                      {collections.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.title}{c._id.startsWith('drafts.') ? ' [pending]' : ''}
                        </SelectItem>
                      ))}
                      {!nearTop && action}
                    </>
                  )
                })()}
              </SelectContent>
            </Select>
          </div>

          {/* New collection dialog */}
          <Dialog open={newCollectionOpen} onOpenChange={setNewCollectionOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New tour collection</DialogTitle>
                <DialogDescription>
                  Group related tours together. This will create a draft tour collection for review.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Collection name *</label>
                  <Input
                    value={newCollectionTitle}
                    onChange={(e) => setNewCollectionTitle(e.target.value)}
                    placeholder="e.g. Kyoto Immersions, Coastal Adventures..."
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Description</label>
                  <Textarea
                    value={newCollectionDesc}
                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                    placeholder="Brief description of this collection..."
                    rows={2}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!newCollectionTitle.trim() || creatingCollection}
                  onClick={async () => {
                    setCreatingCollection(true)
                    const created = await onCreateCollection({
                      title: newCollectionTitle.trim(),
                      description: newCollectionDesc.trim(),
                    })
                    setCreatingCollection(false)
                    if (created) {
                      onTourUpdate({ ...tour, collectionId: created._id })
                      setNewCollectionOpen(false)
                    }
                  }}
                >
                  {creatingCollection ? 'Creating...' : 'Create draft tour collection'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Duration range */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              Duration (min)
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={tour.durationRange?.[0] ?? ''}
                placeholder="Min"
                onChange={(e) =>
                  onTourUpdate({
                    ...tour,
                    durationRange: [
                      Number(e.target.value),
                      tour.durationRange?.[1] ?? 0,
                    ],
                  })
                }
                className="h-8 w-full"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="number"
                min={0}
                value={tour.durationRange?.[1] ?? ''}
                placeholder="Max"
                onChange={(e) =>
                  onTourUpdate({
                    ...tour,
                    durationRange: [
                      tour.durationRange?.[0] ?? 0,
                      Number(e.target.value),
                    ],
                  })
                }
                className="h-8 w-full"
              />
            </div>
          </div>

          {/* Distance + stop count */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Stats</label>
            <p className="text-sm text-muted-foreground">
              {distanceKm} km &middot; {tour.stops.length} stops
            </p>
          </div>

          {/* GPX Route File */}
          {/* Route file + preview */}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label className="text-xs text-muted-foreground">Route (GPX)</label>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Left: upload / file info */}
              <div className="flex flex-col gap-2">
                {(() => {
                  const gpxFile = tour.gpxFileId ? files.find((f) => f.id === tour.gpxFileId) : null
                  return gpxFile ? (
                    <div className="space-y-2 rounded-md border border-border p-3">
                      <div className="flex items-center gap-2">
                        <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate text-sm">{gpxFile.originalName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={gpxFile.url}
                          download={gpxFile.originalName}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </a>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => gpxInputRef.current?.click()}
                          disabled={uploadingGpx}
                        >
                          {uploadingGpx ? 'Uploading...' : 'Replace'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => onTourUpdate({ ...tour, gpxFileId: undefined })}
                        >
                          <X className="h-3 w-3" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex h-full cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/25 px-3 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/50"
                      onClick={() => gpxInputRef.current?.click()}
                    >
                      <FileUp className="h-4 w-4" />
                      {uploadingGpx ? 'Uploading...' : 'Upload GPX file'}
                    </div>
                  )
                })()}
                <input
                  ref={gpxInputRef}
                  type="file"
                  accept=".gpx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) onUploadGpx(file)
                    e.target.value = ''
                  }}
                />
              </div>

              {/* Right: route preview */}
              <RoutePreview
                routePoints={tour.routePoints}
                stops={tour.stops
                  .filter((s) => s.lat !== 0 || s.lng !== 0)
                  .map((s, i) => ({ lat: s.lat, lng: s.lng, index: i, title: s.title }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unmatched media assignment */}
      <MediaAssignment
        unmatchedFiles={unmatchedFiles}
        stops={tour.stops}
        onAssign={onAssignMedia}
      />

      {/* Stop list */}
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {tour.stops.map((stop, i) => (
            <motion.div
              key={stop.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={spring.smooth}
              className="overflow-hidden"
            >
              <StopCard
                stop={stop}
                index={i}
                files={files}
                onUpdate={(updated) => updateStop(i, updated)}
                onRemove={(stopId) => {
                  onTourUpdate({ ...tour, stops: tour.stops.filter((s) => s.id !== stopId) })
                }}
                onRemoveMedia={onRemoveMedia}
                onReplaceImage={onReplaceImage}
                replacingImage={replacingImageStopId === stop.id}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            const newStop: Stop = {
              id: crypto.randomUUID(),
              title: '',
              kind: 'touristAttraction',
              details: '',
              lat: 0,
              lng: 0,
            }
            onTourUpdate({ ...tour, stops: [...tour.stops, newStop] })
          }}
        >
          + Add stop
        </Button>
      </div>
    </div>
  )
}
