'use client'

import { useState, useEffect, useCallback } from 'react'
import { UploadedFile, Tour, Stop, PublishResult } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropZone } from './components/drop-zone'
import { ProcessingLog } from './components/processing-log'
import { ReviewPanel } from './components/review-panel'
import { PublishPanel } from './components/publish-panel'

type Screen = 'choose' | 'drop' | 'processing' | 'review' | 'publish'

interface TourProvider {
  _id: string
  title: string
}

export default function Home() {
  const [screen, setScreenRaw] = useState<Screen>('choose')

  // Push screen changes to browser history
  const setScreen = useCallback((next: Screen) => {
    window.history.pushState({ screen: next }, '', `#${next}`)
    setScreenRaw(next)
  }, [])

  // Handle browser back/forward
  useEffect(() => {
    // Set initial history entry
    window.history.replaceState({ screen: 'choose' }, '', '#choose')

    function onPopState(e: PopStateEvent) {
      const s = e.state?.screen as Screen | undefined
      if (s) setScreenRaw(s)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [unmatchedFiles, setUnmatchedFiles] = useState<UploadedFile[]>([])
  const [tour, setTour] = useState<Tour | null>(null)
  const [tourProviders, setTourProviders] = useState<TourProvider[]>([])
  const [logMessages, setLogMessages] = useState<string[]>([])
  const [processProgress, setProcessProgress] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)

  // Fetch tour providers when entering review screen
  useEffect(() => {
    if (screen !== 'review' || tourProviders.length > 0) return
    fetch('/api/providers')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTourProviders(data) })
      .catch(() => {})
  }, [screen, tourProviders.length])

  function addLog(msg: string) {
    setLogMessages((prev) => [...prev, msg])
  }

  async function handleProcess() {
    if (!files.length) return
    setScreen('processing')
    setProcessing(true)
    setProcessProgress(0)
    setLogMessages([])

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

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            if (event.message) addLog(event.message)
            if (event.progress !== undefined) setProcessProgress(event.progress)

            if (event.type === 'done' && event.result) {
              setTour(event.result.tour)
              setFiles(event.result.files ?? files)
              setUnmatchedFiles(event.result.unmatchedFiles ?? [])
              setScreen('review')
            }

            if (event.type === 'error') {
              addLog(`Error: ${event.message}`)
            }
          } catch {
            // skip malformed lines
          }
        }
      }
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

  const [replacingImageStopId, setReplacingImageStopId] = useState<string | undefined>()

  function handleRemoveMedia(stopId: string, category: 'image' | 'audio' | 'video') {
    setTour((prev) => {
      if (!prev) return prev
      const stops = prev.stops.map((stop) => {
        if (stop.id !== stopId) return stop
        if (category === 'image') return { ...stop, imageId: undefined }
        if (category === 'audio') return { ...stop, audioId: undefined }
        if (category === 'video') return { ...stop, videoId: undefined }
        return stop
      })
      return { ...prev, stops }
    })
  }

  async function handleReplaceImage(stopId: string, file: File) {
    setReplacingImageStopId(stopId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const uploaded: UploadedFile = await res.json()

      setFiles((prev) => [...prev, uploaded])
      setTour((prev) => {
        if (!prev) return prev
        const stops = prev.stops.map((stop) => {
          if (stop.id !== stopId) return stop
          return { ...stop, imageId: uploaded.id }
        })
        return { ...prev, stops }
      })
    } catch (e) {
      console.error('Image replace failed:', e)
    } finally {
      setReplacingImageStopId(undefined)
    }
  }

  async function handleCreateProvider(data: { name: string; email: string; description: string; website: string }) {
    try {
      const res = await fetch('/api/providers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) return null
      const created = await res.json()
      // Add to local list with [pending] indicator (draft ID)
      setTourProviders((prev) => [...prev, { _id: created._id, title: created.title }])
      return created as { _id: string; title: string }
    } catch {
      return null
    }
  }

  function handleStartManual() {
    const emptyStop: Stop = {
      id: crypto.randomUUID(),
      title: '',
      kind: 'touristAttraction',
      details: '',
      lat: 0,
      lng: 0,
    }
    setTour({
      title: '',
      description: '',
      tourType: 'walk',
      categoryTag: '',
      challengeLevel: 1,
      durationRange: [60],
      distance: 0,
      regionId: '',
      tourProviderId: '',
      stops: [emptyStop],
      routePoints: [],
    })
    setScreen('review')
  }

  function handleReset() {
    // Replace rather than push so back doesn't cycle through resets
    window.history.pushState({ screen: 'choose' }, '', '#choose')
    setScreenRaw('choose')
    setFiles([])
    setUnmatchedFiles([])
    setTour(null)
    setTourProviders([])
    setLogMessages([])
    setProcessProgress(0)
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
          {screen !== 'choose' && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Start over
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Choose path screen */}
        {screen === 'choose' && (
          <section className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Create a Tour</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose how you want to build your tour.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card
                className="cursor-pointer transition-colors hover:border-primary"
                onClick={() => setScreen('drop')}
              >
                <CardContent className="pt-6 text-center space-y-3">
                  <div className="text-4xl">✦</div>
                  <h2 className="text-lg font-semibold">AI-Assisted</h2>
                  <p className="text-sm text-muted-foreground text-balance text-left">
                    Drop your GPX, photos, audio, and notes. AI will organize everything into a complete tour.
                  </p>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer transition-colors hover:border-primary"
                onClick={handleStartManual}
              >
                <CardContent className="pt-6 text-center space-y-3">
                  <div className="text-4xl">✎</div>
                  <h2 className="text-lg font-semibold">Manual</h2>
                  <p className="text-sm text-muted-foreground text-balance text-left">
                    Build your tour from scratch. Add stops, upload images, and write descriptions yourself.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

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
            <ProcessingLog messages={logMessages} processing={processing} progress={processProgress} />
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
                  onRemoveMedia={handleRemoveMedia}
                  onReplaceImage={handleReplaceImage}
                  replacingImageStopId={replacingImageStopId}
                  onCreateProvider={handleCreateProvider}
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
