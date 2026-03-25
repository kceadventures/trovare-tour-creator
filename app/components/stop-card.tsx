'use client'

import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Stop, UploadedFile, ImageMeta } from '@/lib/types'
import { POI_KINDS } from '@/lib/constants'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { LocationInput } from './location-input'

function camelToReadable(s: string): string {
  return s
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

interface Props {
  stop: Stop
  index: number
  files: UploadedFile[]
  onUpdate: (updated: Stop) => void
  onRemove: (stopId: string) => void
  onRemoveMedia: (stopId: string, category: 'image' | 'audio' | 'video') => void
  onReplaceImage: (stopId: string, file: File) => void
  replacingImage?: boolean
}

export function StopCard({ stop, index, files, onUpdate, onRemove, onRemoveMedia, onReplaceImage, replacingImage }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showImageMeta, setShowImageMeta] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestion, setSuggestion] = useState('')
  const [suggestSent, setSuggestSent] = useState(false)
  const matchedImage = files.find((f) => f.id === stop.imageId)
  const matchedAudio = files.find((f) => f.id === stop.audioId)
  const matchedVideo = files.find((f) => f.id === stop.videoId)
  const meta: ImageMeta = stop.imageMeta || {}
  const updateMeta = (patch: Partial<ImageMeta>) => {
    onUpdate({ ...stop, imageMeta: { ...meta, ...patch } })
  }

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {index + 1}
          </span>
          <Input
            value={stop.title}
            placeholder="Stop title"
            onChange={(e) => onUpdate({ ...stop, title: e.target.value })}
            className="h-8 flex-1 text-sm font-medium"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRemove(stop.id)}
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Image preview */}
        {matchedImage ? (
          <div className="relative group">
            <img
              src={matchedImage.url}
              alt={stop.title || `Stop ${index + 1}`}
              className="w-full h-40 object-cover rounded-md border border-border"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={replacingImage}
              >
                {replacingImage ? 'Uploading...' : 'Replace'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onRemoveMedia(stop.id, 'image')}
              >
                Remove
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">{matchedImage.originalName}</p>
            {/* Image metadata */}
            <button
              type="button"
              className="mt-1 text-xs text-primary hover:underline"
              onClick={() => setShowImageMeta((v) => !v)}
            >
              {showImageMeta ? 'Hide image details' : 'Edit image details'}
            </button>
            {showImageMeta && (
              <div className="mt-2 space-y-2 rounded-md border border-border p-3 bg-muted/30">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Alt text</label>
                  <Input
                    value={meta.alt || ''}
                    placeholder="Describe the image for accessibility..."
                    onChange={(e) => updateMeta({ alt: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Caption</label>
                  <Input
                    value={meta.caption || ''}
                    placeholder="Caption displayed with the image..."
                    onChange={(e) => updateMeta({ caption: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Credit / attribution</label>
                  <Input
                    value={meta.credit || ''}
                    placeholder="Photo by..."
                    onChange={(e) => updateMeta({ credit: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">
                    Hotspot (focal point for cropping)
                  </label>
                  <div className="relative w-full h-24 rounded overflow-hidden border border-border cursor-crosshair"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = Math.round(((e.clientX - rect.left) / rect.width) * 100) / 100
                      const y = Math.round(((e.clientY - rect.top) / rect.height) * 100) / 100
                      updateMeta({ hotspotX: x, hotspotY: y })
                    }}
                  >
                    <img
                      src={matchedImage.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {(meta.hotspotX !== undefined && meta.hotspotY !== undefined) && (
                      <div
                        className="absolute w-4 h-4 border-2 border-white rounded-full shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={{
                          left: `${meta.hotspotX * 100}%`,
                          top: `${meta.hotspotY * 100}%`,
                          background: 'rgba(29, 158, 117, 0.8)',
                        }}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click the image to set the focal point
                    {meta.hotspotX !== undefined && ` (${meta.hotspotX}, ${meta.hotspotY})`}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-md flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="text-2xl text-muted-foreground/50">🖼️</span>
            <span className="text-xs text-muted-foreground">
              {replacingImage ? 'Uploading...' : 'Click to add image'}
            </span>
          </div>
        )}

        {/* Hidden file input for image upload/replace */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onReplaceImage(stop.id, file)
            e.target.value = ''
          }}
        />

        {/* Kind select */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Type</label>
          <Select
            value={stop.kind}
            onValueChange={(val) => {
              if (val === '__suggest__') {
                setSuggestOpen(true)
                setSuggestSent(false)
                setSuggestion('')
              } else if (val) {
                onUpdate({ ...stop, kind: val })
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {POI_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {camelToReadable(k)}
                </SelectItem>
              ))}
              <SelectItem value="__suggest__" className="text-primary">
                Suggest a type...
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Suggest a type dialog */}
        <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Suggest a new type</DialogTitle>
              <DialogDescription>
                Don&apos;t see the right type for this stop? Let us know what you&apos;d like added.
              </DialogDescription>
            </DialogHeader>
            {suggestSent ? (
              <p className="text-sm text-muted-foreground py-2">
                Thanks for your suggestion! We&apos;ll review it.
              </p>
            ) : (
              <div className="space-y-3">
                <Input
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  placeholder="e.g. Vineyard, Street Art, Market..."
                  autoFocus
                />
                <Button
                  className="w-full"
                  disabled={!suggestion.trim()}
                  onClick={() => {
                    fetch('/api/suggest', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'poi_kind',
                        suggestion: suggestion.trim(),
                        stopTitle: stop.title,
                      }),
                    }).catch(() => {})
                    setSuggestSent(true)
                  }}
                >
                  Submit suggestion
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Location */}
        <LocationInput
          lat={stop.lat}
          lng={stop.lng}
          onChange={(lat, lng) => onUpdate({ ...stop, lat, lng })}
          layoutIdPrefix={`location-stop-${stop.id}`}
        />

        {/* Details */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            Details (markdown)
          </label>
          <Textarea
            value={stop.details}
            placeholder="Stop details…"
            rows={3}
            onChange={(e) => onUpdate({ ...stop, details: e.target.value })}
            className="resize-y text-xs"
          />
        </div>

        {/* Audio/Video badges with remove */}
        <div className="flex flex-wrap gap-2">
          {matchedAudio && (
            <Badge variant="secondary" className="gap-1">
              🎵 {matchedAudio.originalName}
              <button
                className="ml-1 text-muted-foreground hover:text-foreground"
                onClick={() => onRemoveMedia(stop.id, 'audio')}
              >
                ×
              </button>
            </Badge>
          )}
          {matchedVideo && (
            <Badge variant="secondary" className="gap-1">
              🎬 {matchedVideo.originalName}
              <button
                className="ml-1 text-muted-foreground hover:text-foreground"
                onClick={() => onRemoveMedia(stop.id, 'video')}
              >
                ×
              </button>
            </Badge>
          )}
        </div>

        {/* Duplicate warning */}
        {stop.duplicateWarning && (
          <p className="rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400">
            ⚠️ {stop.duplicateWarning.message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
