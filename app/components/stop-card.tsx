'use client'

import { Stop, UploadedFile } from '@/lib/types'
import { POI_KINDS } from '@/lib/constants'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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

const FILE_EMOJI: Record<string, string> = {
  image: '🖼️',
  audio: '🎵',
  video: '🎬',
}

interface Props {
  stop: Stop
  index: number
  files: UploadedFile[]
  onUpdate: (updated: Stop) => void
}

export function StopCard({ stop, index, files, onUpdate }: Props) {
  const matchedImage = files.find((f) => f.id === stop.imageId)
  const matchedAudio = files.find((f) => f.id === stop.audioId)
  const matchedVideo = files.find((f) => f.id === stop.videoId)

  const hasImage = !!matchedImage

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

        {/* Media badges */}
        <div className="flex flex-wrap gap-2">
          {matchedImage && (
            <Badge variant="secondary">
              {FILE_EMOJI.image} {matchedImage.originalName}
            </Badge>
          )}
          {matchedAudio && (
            <Badge variant="secondary">
              {FILE_EMOJI.audio} {matchedAudio.originalName}
            </Badge>
          )}
          {matchedVideo && (
            <Badge variant="secondary">
              {FILE_EMOJI.video} {matchedVideo.originalName}
            </Badge>
          )}
          {!hasImage && (
            <Badge variant="destructive">No image</Badge>
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
