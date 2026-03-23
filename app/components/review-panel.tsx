'use client'

import { Tour, UploadedFile, Stop } from '@/lib/types'
import {
  TOUR_TYPES,
  CATEGORY_TAGS,
  REGIONS,
} from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StopCard } from './stop-card'
import { MediaAssignment } from './media-assignment'

interface TourProvider {
  _id: string
  name: string
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
}: Props) {
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
              value={tour.regionId}
              onValueChange={(v) => v && onTourUpdate({ ...tour, regionId: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tour Provider */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              Tour Provider
            </label>
            <Select
              value={tour.tourProviderId}
              onValueChange={(v) =>
                v && onTourUpdate({ ...tour, tourProviderId: v })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {tourProviders.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            onRemoveMedia={onRemoveMedia}
            onReplaceImage={onReplaceImage}
            replacingImage={replacingImageStopId === stop.id}
          />
        ))}
      </div>
    </div>
  )
}
