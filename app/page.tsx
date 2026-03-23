'use client'

import { useState, useEffect, useCallback } from 'react'
import { UploadedFile, Tour, Stop, PublishResult } from '@/lib/types'
import { parseGPX } from '@/lib/gpx'
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

const STORAGE_KEY = 'trovare_draft'
const HISTORY_KEY = 'trovare_history'
const MAX_HISTORY = 5

interface SavedDraft {
  screen: Screen
  files: UploadedFile[]
  unmatchedFiles: UploadedFile[]
  tour: Tour | null
}

interface TourHistoryEntry {
  id: string
  title: string
  stopCount: number
  distance: number
  tourType: string
  createdAt: string
  dryRun: boolean
  draft: SavedDraft
}

function loadHistory(): TourHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

function saveToHistory(tour: Tour, files: UploadedFile[], unmatchedFiles: UploadedFile[], dryRun: boolean) {
  const entry: TourHistoryEntry = {
    id: crypto.randomUUID(),
    title: tour.title || 'Untitled Tour',
    stopCount: tour.stops.length,
    distance: tour.distance,
    tourType: tour.tourType,
    createdAt: new Date().toISOString(),
    dryRun,
    draft: { screen: 'review', files, unmatchedFiles, tour },
  }
  const history = loadHistory()
  // Dedupe by title — replace if same title exists
  const filtered = history.filter((h) => h.title !== entry.title)
  filtered.unshift(entry)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_HISTORY)))
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

function loadSaved(): SavedDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as {
      screen: Screen
      files: UploadedFile[]
      unmatchedFiles: UploadedFile[]
      tour: Tour | null
    }
  } catch {
    return null
  }
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
    window.history.replaceState({ screen }, '', `#${screen}`)

    function onPopState(e: PopStateEvent) {
      const s = e.state?.screen as Screen | undefined
      if (s) setScreenRaw(s)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [files, setFiles] = useState<UploadedFile[]>([])
  const [unmatchedFiles, setUnmatchedFiles] = useState<UploadedFile[]>([])
  const [tour, setTour] = useState<Tour | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Restore saved draft from localStorage after hydration
  useEffect(() => {
    const saved = loadSaved()
    if (saved) {
      setScreenRaw(saved.screen)
      window.history.replaceState({ screen: saved.screen }, '', `#${saved.screen}`)
      setFiles(saved.files)
      setUnmatchedFiles(saved.unmatchedFiles)
      setTour(saved.tour)
    }
    setHydrated(true)
  }, [])

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!hydrated) return
    if (screen === 'processing') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ screen, files, unmatchedFiles, tour }))
    } catch { /* storage full or unavailable */ }
  }, [screen, files, unmatchedFiles, tour, hydrated])
  const [tourProviders, setTourProviders] = useState<TourProvider[]>([])
  const [regions, setRegions] = useState<{ _id: string; title: string }[]>([])
  const [logMessages, setLogMessages] = useState<string[]>([])
  const [processProgress, setProcessProgress] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)

  // Fetch tour providers and regions when entering review screen
  useEffect(() => {
    if (screen !== 'review') return
    if (tourProviders.length === 0) {
      fetch('/api/providers')
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setTourProviders(data) })
        .catch(() => {})
    }
    if (regions.length === 0) {
      fetch('/api/regions')
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setRegions(data) })
        .catch(() => {})
    }
  }, [screen, tourProviders.length, regions.length])

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

      if (data.success) {
        saveToHistory(tour, files, unmatchedFiles, dryRun)
        if (!dryRun) setScreen('publish')
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

  const [uploadingGpx, setUploadingGpx] = useState(false)

  async function handleUploadGpx(file: File) {
    setUploadingGpx(true)
    try {
      // Parse GPX client-side for route points + waypoints
      const gpxText = await file.text()
      const gpxData = parseGPX(gpxText)

      // Upload to DO Spaces
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const uploaded: UploadedFile = await res.json()
      setFiles((prev) => [...prev, uploaded])

      // Create stops from waypoints
      const newStops: Stop[] = gpxData.waypoints.map((wp) => ({
        id: crypto.randomUUID(),
        title: wp.name,
        kind: 'touristAttraction',
        details: '',
        lat: wp.lat,
        lng: wp.lng,
      }))

      setTour((prev) => {
        if (!prev) return prev
        // Merge: keep existing stops that have content, add new waypoint stops
        const existingWithContent = prev.stops.filter(
          (s) => s.title || s.details || s.imageId || s.audioId || s.videoId
        )
        const mergedStops = existingWithContent.length > 0
          ? existingWithContent
          : newStops.length > 0 ? newStops : prev.stops

        return {
          ...prev,
          gpxFileId: uploaded.id,
          routePoints: gpxData.trackPoints,
          distance: gpxData.distance,
          stops: newStops.length > 0 && existingWithContent.length === 0 ? newStops : mergedStops,
        }
      })
    } catch (e) {
      console.error('GPX upload failed:', e)
    } finally {
      setUploadingGpx(false)
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

  async function handleCreateRegion(data: { title: string; description: string; lat?: number; lng?: number }) {
    try {
      const res = await fetch('/api/regions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) return null
      const created = await res.json()
      setRegions((prev) => [...prev, { _id: created._id, title: created.title }])
      return created as { _id: string; title: string }
    } catch {
      return null
    }
  }

  function handleResume(entry: TourHistoryEntry) {
    setFiles(entry.draft.files)
    setUnmatchedFiles(entry.draft.unmatchedFiles)
    setTour(entry.draft.tour)
    setScreen('review')
  }

  const [historyEntries, setHistoryEntries] = useState<TourHistoryEntry[]>([])

  // Load history on mount
  useEffect(() => {
    setHistoryEntries(loadHistory())
  }, [screen])

  function handleClearHistory() {
    clearHistory()
    setHistoryEntries([])
  }

  const [savedNotice, setSavedNotice] = useState(false)

  function handleSaveForLater() {
    if (!tour) return
    saveToHistory(tour, files, unmatchedFiles, true)
    setHistoryEntries(loadHistory())
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 2000)
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
    // Save current work to history before clearing
    if (tour && (tour.title || tour.stops.some((s) => s.title))) {
      saveToHistory(tour, files, unmatchedFiles, true)
    }
    // Replace rather than push so back doesn't cycle through resets
    window.history.pushState({ screen: 'choose' }, '', '#choose')
    setScreenRaw('choose')
    setFiles([])
    setUnmatchedFiles([])
    setTour(null)
    setTourProviders([])
    setRegions([])
    setLogMessages([])
    setProcessProgress(0)
    setProcessing(false)
    setUploading(false)
    setPublishing(false)
    setPublishResult(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <button
            className="font-heading text-base font-semibold tracking-tight hover:opacity-70 transition-opacity"
            onClick={handleReset}
          >
            Trovare Tour Creator
          </button>
          <div className="flex items-center gap-2">
            {screen === 'review' && (
              <>
                {savedNotice && (
                  <span className="text-xs text-primary animate-in fade-in">Saved!</span>
                )}
                <Button variant="outline" size="sm" onClick={handleSaveForLater}>
                  Save for later
                </Button>
              </>
            )}
            {screen !== 'choose' && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Start over
              </Button>
            )}
          </div>
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
              {(() => {
                const aiDisabled = process.env.NEXT_PUBLIC_DISABLE_AI === 'true'
                const aiDisabledReason = process.env.NEXT_PUBLIC_DISABLE_AI_REASON
                return (
                  <Card
                    className={
                      aiDisabled
                        ? 'opacity-60 cursor-not-allowed'
                        : 'cursor-pointer transition-colors hover:border-primary'
                    }
                    onClick={() => { if (!aiDisabled) setScreen('drop') }}
                  >
                    <CardContent className="pt-6 text-center space-y-3">
                      <div className="text-4xl">✦</div>
                      <h2 className="text-lg font-semibold">AI-Assisted</h2>
                      <p className="text-sm text-muted-foreground text-balance text-left">
                        Drop your GPX, photos, audio, and notes. AI will organize everything into a complete tour.
                      </p>
                      {aiDisabled && (
                        <p className="text-xs text-yellow-500 bg-yellow-500/10 rounded px-2 py-1.5 text-left">
                          {aiDisabledReason || 'AI-assisted generation is temporarily unavailable.'}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })()}
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

            {/* Continue from recent tours */}
            {historyEntries.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Continue from...</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-destructive"
                    onClick={handleClearHistory}
                  >
                    Clear all
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {historyEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex w-full items-center gap-2 rounded-md border border-border text-sm transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      <button
                        className="flex flex-1 items-center justify-between px-3 py-2.5 text-left"
                        onClick={() => handleResume(entry)}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">
                            {entry.title}
                            {entry.dryRun && <span className="ml-1.5 text-xs text-yellow-500">(draft)</span>}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {entry.stopCount} stops · {entry.distance} mi · {entry.tourType}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 ml-3">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                      </button>
                      <button
                        className="px-2 py-2.5 text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => {
                          const updated = historyEntries.filter((h) => h.id !== entry.id)
                          setHistoryEntries(updated)
                          localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
                        }}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                  regions={regions}
                  onCreateRegion={handleCreateRegion}
                  onUploadGpx={handleUploadGpx}
                  uploadingGpx={uploadingGpx}
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
