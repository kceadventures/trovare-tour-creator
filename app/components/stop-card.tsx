'use client'

import { useRef } from 'react'
import { Stop, UploadedFile } from '@/lib/types'
import { POI_KINDS } from '@/lib/constants'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  onRemoveMedia: (stopId: string, category: 'image' | 'audio' | 'video') => void
  onReplaceImage: (stopId: string, file: File) => void
  replacingImage?: boolean
}

export function StopCard({ stop, index, files, onUpdate, onRemoveMedia, onReplaceImage, replacingImage }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const matchedImage = files.find((f) => f.id === stop.imageId)
  const matchedAudio = files.find((f) => f.id === stop.audioId)
  const matchedVideo = files.find((f) => f.id === stop.videoId)

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
            onValueChange={(val) => val && onUpdate({ ...stop, kind: val })}
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
            </SelectContent>
          </Select>
        </div>

        {/* Coordinates */}
        <p className="font-mono text-xs text-muted-foreground">
          {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
        </p>

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
