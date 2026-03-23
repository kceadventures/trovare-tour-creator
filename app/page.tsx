'use client'

import { useState } from 'react'
import { UploadedFile, Tour, PublishResult } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { DropZone } from './components/drop-zone'
import { ProcessingLog } from './components/processing-log'
import { ReviewPanel } from './components/review-panel'
import { PublishPanel } from './components/publish-panel'

type Screen = 'drop' | 'processing' | 'review' | 'publish'

interface TourProvider {
  _id: string
  name: string
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>('drop')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [unmatchedFiles, setUnmatchedFiles] = useState<UploadedFile[]>([])
  const [tour, setTour] = useState<Tour | null>(null)
  const [tourProviders, setTourProviders] = useState<TourProvider[]>([])
  const [logMessages, setLogMessages] = useState<string[]>([])
  const [processing, setProcessing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)

  function addLog(msg: string) {
    setLogMessages((prev) => [...prev, msg])
  }

  async function handleProcess() {
    if (!files.length) return
    setScreen('processing')
    setProcessing(true)
    setLogMessages([])
    addLog('Sending files to AI for processing…')

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Process failed: ${res.statusText}`)
      }

      const data = await res.json()
      addLog('AI processing complete.')

      setTour(data.tour)
      setFiles(data.files ?? files)
      setUnmatchedFiles(data.unmatchedFiles ?? [])
      setTourProviders(data.tourProviders ?? [])

      addLog(`Tour "${data.tour.title}" ready for review.`)
      addLog(`${data.tour.stops.length} stops found.`)
      if (data.unmatchedFiles?.length) {
        addLog(`${data.unmatchedFiles.length} unmatched media file(s).`)
      }

      setScreen('review')
    } catch (err) {
      addLog(`Error: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setProcessing(false)
    }
  }

  async function handlePublish(dryRun: boolean) {
    if (!tour) return
    setPublishing(true)
    setPublishResult(null)

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tour, files, dryRun }),
      })

      const data: PublishResult = await res.json()
      setPublishResult(data)

      if (data.success && !dryRun) {
        setScreen('publish')
      }
    } catch (err) {
      setPublishResult({
        success: false,
        error: err instanceof Error ? err.message : 'Publish failed',
      })
    } finally {
      setPublishing(false)
    }
  }

  function handleAssignMedia(fileId: string, stopId: string) {
    const file = unmatchedFiles.find((f) => f.id === fileId)
    if (!file || !tour) return

    // Remove from unmatched
    setUnmatchedFiles((prev) => prev.filter((f) => f.id !== fileId))

    // Assign to stop based on file category
    setTour((prev) => {
      if (!prev) return prev
      const stops = prev.stops.map((stop) => {
        if (stop.id !== stopId) return stop
        if (file.category === 'image' && !stop.imageId) {
          return { ...stop, imageId: fileId }
        }
        if (file.category === 'audio' && !stop.audioId) {
          return { ...stop, audioId: fileId }
        }
        if (file.category === 'video' && !stop.videoId) {
          return { ...stop, videoId: fileId }
        }
        return stop
      })
      return { ...prev, stops }
    })
  }

  function handleReset() {
    setScreen('drop')
    setFiles([])
    setUnmatchedFiles([])
    setTour(null)
    setTourProviders([])
    setLogMessages([])
    setProcessing(false)
    setUploading(false)
    setPublishing(false)
    setPublishResult(null)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <span className="font-heading text-base font-semibold tracking-tight">
            GoTrovare
          </span>
          {screen !== 'drop' && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Start over
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Drop screen */}
        {screen === 'drop' && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Upload a Tour</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Drop your GPX, photos, audio, and notes below.
              </p>
            </div>
            <DropZone
              onFilesUploaded={setFiles}
              uploading={uploading}
              setUploading={setUploading}
            />
            {files.length > 0 && !uploading && (
              <Button
                className="w-full"
                onClick={handleProcess}
                disabled={processing}
              >
                Build tour with AI
              </Button>
            )}
          </section>
        )}

        {/* Processing screen */}
        {screen === 'processing' && (
          <section className="space-y-4">
            <ProcessingLog messages={logMessages} processing={processing} />
          </section>
        )}

        {/* Review screen */}
        {(screen === 'review' || screen === 'publish') && tour && (
          <section className="space-y-6">
            {screen === 'review' && (
              <>
                <div>
                  <h1 className="text-2xl font-bold">Review Tour</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Check and edit the generated tour before publishing.
                  </p>
                </div>
                <ReviewPanel
                  tour={tour}
                  files={files}
                  unmatchedFiles={unmatchedFiles}
                  tourProviders={tourProviders}
                  onTourUpdate={setTour}
                  onAssignMedia={handleAssignMedia}
                />
              </>
            )}
            <PublishPanel
              tour={tour}
              publishResult={publishResult}
              publishing={publishing}
              onPublish={handlePublish}
              onReset={handleReset}
            />
          </section>
        )}

        {/* Publish success screen (handled inside PublishPanel) */}
        {screen === 'publish' && !tour && (
          <section>
            <PublishPanel
              tour={null}
              publishResult={publishResult}
              publishing={false}
              onPublish={handlePublish}
              onReset={handleReset}
            />
          </section>
        )}
      </div>
    </main>
  )
}
