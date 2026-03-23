'use client'

import { useRef, useState } from 'react'
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
  onUploadGpx,
  uploadingGpx,
}: Props) {
  const gpxInputRef = useRef<HTMLInputElement>(null)
  const [newRegionOpen, setNewRegionOpen] = useState(false)
  const [newRegionTitle, setNewRegionTitle] = useState('')
  const [newRegionDesc, setNewRegionDesc] = useState('')
  const [newRegionLat, setNewRegionLat] = useState('')
  const [newRegionLng, setNewRegionLng] = useState('')
  const [creatingRegion, setCreatingRegion] = useState(false)

  const [newProviderOpen, setNewProviderOpen] = useState(false)
  const [newProviderName, setNewProviderName] = useState('')
  const [newProviderEmail, setNewProviderEmail] = useState('')
  const [newProviderDesc, setNewProviderDesc] = useState('')
  const [newProviderWebsite, setNewProviderWebsite] = useState('')
  const [creatingProvider, setCreatingProvider] = useState(false)
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
              onValueChange={(v) => v && onTourUpdate({ ...tour, categoryTag: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_TAGS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                  setNewRegionLat('')
                  setNewRegionLng('')
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
                <SelectItem value="__none__" className="text-muted-foreground">
                  No region
                </SelectItem>
                {regions.map((r) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.title}{r._id.startsWith('drafts.') ? ' [pending]' : ''}
                  </SelectItem>
                ))}
                <SelectItem value="__new__" className="text-primary">
                  + New region...
                </SelectItem>
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
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Latitude</label>
                    <Input
                      type="number"
                      step="any"
                      value={newRegionLat}
                      onChange={(e) => setNewRegionLat(e.target.value)}
                      placeholder="41.14961"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Longitude</label>
                    <Input
                      type="number"
                      step="any"
                      value={newRegionLng}
                      onChange={(e) => setNewRegionLng(e.target.value)}
                      placeholder="-8.61099"
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={!newRegionTitle.trim() || creatingRegion}
                  onClick={async () => {
                    setCreatingRegion(true)
                    const created = await onCreateRegion({
                      title: newRegionTitle.trim(),
                      description: newRegionDesc.trim(),
                      lat: newRegionLat ? parseFloat(newRegionLat) : undefined,
                      lng: newRegionLng ? parseFloat(newRegionLng) : undefined,
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
                <SelectItem value="__none__" className="text-muted-foreground">
                  No provider
                </SelectItem>
                {tourProviders.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.title}{p._id.startsWith('drafts.') ? ' [pending]' : ''}
                  </SelectItem>
                ))}
                <SelectItem value="__new__" className="text-primary">
                  + New creator...
                </SelectItem>
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
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">Route file (GPX)</label>
            {(() => {
              const gpxFile = tour.gpxFileId ? files.find((f) => f.id === tour.gpxFileId) : null
              return gpxFile ? (
                <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                  <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{gpxFile.originalName}</span>
                  <a
                    href={gpxFile.url}
                    download={gpxFile.originalName}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onTourUpdate({ ...tour, gpxFileId: undefined })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => gpxInputRef.current?.click()}
                    disabled={uploadingGpx}
                  >
                    {uploadingGpx ? 'Uploading...' : 'Replace'}
                  </Button>
                </div>
              ) : (
                <div
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/25 px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/50"
                  onClick={() => gpxInputRef.current?.click()}
                >
                  <FileUp className="h-4 w-4" />
                  {uploadingGpx ? 'Uploading...' : 'Click to upload GPX route file'}
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

          {/* Route Preview */}
          {(tour.routePoints.length > 0 || tour.stops.some((s) => s.lat && s.lng)) && (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Route preview</label>
              <RoutePreview
                routePoints={tour.routePoints}
                stops={tour.stops
                  .filter((s) => s.lat && s.lng)
                  .map((s, i) => ({ lat: s.lat, lng: s.lng, index: i, title: s.title }))}
              />
            </div>
          )}
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
        {tour.stops.map((stop, i) => (
          <StopCard
            key={stop.id}
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
        ))}
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
