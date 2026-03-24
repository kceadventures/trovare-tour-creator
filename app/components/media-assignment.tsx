'use client'

import { motion } from 'motion/react'
import { spring, staggerContainer, staggerChild } from '@/lib/motion'
import { UploadedFile, Stop, FileCategory } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const FILE_EMOJI: Record<FileCategory, string> = {
  gpx: '🗺️',
  image: '🖼️',
  audio: '🎵',
  video: '🎬',
  text: '📝',
}

interface Props {
  unmatchedFiles: UploadedFile[]
  stops: Stop[]
  onAssign: (fileId: string, stopId: string) => void
}

export function MediaAssignment({ unmatchedFiles, stops, onAssign }: Props) {
  if (unmatchedFiles.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Unmatched Media</CardTitle>
      </CardHeader>
      <CardContent>
        <motion.div
          className="space-y-4"
          variants={staggerContainer(0.05)}
          initial="hidden"
          animate="show"
        >
          {unmatchedFiles.map((file) => (
            <motion.div key={file.id} variants={staggerChild} transition={spring.gentle} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {FILE_EMOJI[file.category]} {file.originalName}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {stops.map((stop, i) => (
                  <Button
                    key={stop.id}
                    variant="outline"
                    size="sm"
                    onClick={() => onAssign(file.id, stop.id)}
                  >
                    Assign to #{i + 1} {stop.title || 'Unnamed'}
                  </Button>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </CardContent>
    </Card>
  )
}
