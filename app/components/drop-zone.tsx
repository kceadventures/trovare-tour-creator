'use client'

import { useRef, useState, DragEvent, ChangeEvent } from 'react'
import { motion } from 'motion/react'
import { spring, staggerContainer, staggerChild } from '@/lib/motion'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ACCEPTED_TYPES, FILE_LIMITS } from '@/lib/constants'
import { UploadedFile, FileCategory } from '@/lib/types'

const CATEGORY_EMOJI: Record<FileCategory, string> = {
  gpx: '🗺️',
  image: '🖼️',
  audio: '🎵',
  video: '🎬',
  text: '📝',
}

function detectCategory(file: File): FileCategory | null {
  const name = file.name.toLowerCase()
  for (const [cat, exts] of Object.entries(ACCEPTED_TYPES)) {
    if (exts.some((ext) => name.endsWith(ext))) {
      return cat as FileCategory
    }
  }
  return null
}

function acceptString(): string {
  return Object.values(ACCEPTED_TYPES).flat().join(',')
}

interface Props {
  onFilesUploaded: (files: UploadedFile[]) => void
  uploading: boolean
  setUploading: (v: boolean) => void
}

const LARGE_FILE_THRESHOLD = 4.5 * 1024 * 1024 // 4.5 MB

export function DropZone({ onFilesUploaded, uploading, setUploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    processFiles(files)
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    processFiles(files)
    // Reset so same file can be re-selected
    e.target.value = ''
  }

  async function uploadSmallFile(file: File): Promise<UploadedFile> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Upload failed: ${res.statusText}`)
    }
    return res.json()
  }

  async function uploadLargeFile(file: File): Promise<UploadedFile> {
    const presignRes = await fetch('/api/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    })
    if (!presignRes.ok) {
      const body = await presignRes.json().catch(() => ({}))
      throw new Error(body.error ?? `Presign failed: ${presignRes.statusText}`)
    }
    const { uploadUrl, key, category, id } = await presignRes.json()

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
    if (!putRes.ok) {
      throw new Error(`Direct upload failed: ${putRes.statusText}`)
    }

    const cdnBase = process.env.NEXT_PUBLIC_DO_SPACES_CDN
    const url = `${cdnBase}/${key}`

    const uploaded: UploadedFile = {
      id,
      originalName: file.name,
      category: category as FileCategory,
      url,
      size: file.size,
      mimeType: file.type,
    }
    return uploaded
  }

  async function processFiles(files: File[]) {
    const newErrors: string[] = []
    const validFiles: File[] = []

    for (const file of files) {
      const category = detectCategory(file)
      if (!category) {
        newErrors.push(`${file.name}: unsupported file type`)
        continue
      }
      const limit = FILE_LIMITS[category]
      if (file.size > limit) {
        newErrors.push(
          `${file.name}: exceeds ${Math.round(limit / 1024 / 1024)}MB limit`
        )
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length === 0) {
      setErrors(newErrors)
      return
    }

    setErrors(newErrors)
    setUploading(true)
    setProgress(0)

    const results: UploadedFile[] = []
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      try {
        let uploaded: UploadedFile
        if (file.size > LARGE_FILE_THRESHOLD) {
          uploaded = await uploadLargeFile(file)
        } else {
          uploaded = await uploadSmallFile(file)
        }
        results.push(uploaded)
      } catch (err) {
        newErrors.push(
          `${file.name}: ${err instanceof Error ? err.message : 'upload error'}`
        )
      }
      setProgress(Math.round(((i + 1) / validFiles.length) * 100))
    }

    setErrors((prev) => [...prev, ...newErrors.slice(prev.length)])
    const all = [...uploadedFiles, ...results]
    setUploadedFiles(all)
    onFilesUploaded(all)
    setUploading(false)
  }

  return (
    <div className="space-y-3">
      <Card
        className={[
          'cursor-pointer border-2 border-dashed transition-colors',
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/30 hover:border-primary/50',
        ].join(' ')}
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 text-4xl">📁</div>
          <p className="text-sm font-medium text-foreground">
            Drop files here or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            GPX · JPG/PNG · MP3 · MP4 · TXT/MD
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={acceptString()}
            className="hidden"
            onChange={handleInputChange}
          />
        </CardContent>
      </Card>

      {uploading && (
        <Progress value={progress} className="h-2 w-full" />
      )}

      {errors.length > 0 && (
        <ul className="space-y-1">
          {errors.map((err, i) => (
            <li key={i} className="text-xs text-destructive">
              {err}
            </li>
          ))}
        </ul>
      )}

      {uploadedFiles.length > 0 && (
        <motion.div
          className="flex flex-wrap gap-2"
          variants={staggerContainer(0.05)}
          initial="hidden"
          animate="show"
        >
          {uploadedFiles.map((f) => (
            <motion.div key={f.id} variants={staggerChild} transition={spring.gentle}>
              <Badge variant="secondary" className="gap-1">
                <span>{CATEGORY_EMOJI[f.category]}</span>
                <span className="max-w-[160px] truncate">{f.originalName}</span>
              </Badge>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
