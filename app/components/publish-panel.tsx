'use client'

import { Tour, PublishResult } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DryRunOutputPanel } from './dry-run-output'

interface Props {
  tour: Tour | null
  publishResult: PublishResult | null
  publishing: boolean
  onPublish: (dryRun: boolean) => void
  onReset: () => void
}

function canPublish(tour: Tour | null): boolean {
  if (!tour) return false
  if (!tour.title?.trim()) return false
  if (!tour.stops.length) return false
  return tour.stops.every((s) => !!s.imageId)
}

export function PublishPanel({
  tour,
  publishResult,
  publishing,
  onPublish,
  onReset,
}: Props) {
  const publishable = canPublish(tour)

  const missingImages =
    tour?.stops.filter((s) => !s.imageId).map((s) => s.title || 'Unnamed') ??
    []

  // Success state
  if (publishResult?.success && publishResult.studioUrl) {
    return (
      <Card className="border-green-500/40 bg-green-500/5">
        <CardHeader>
          <CardTitle className="text-green-600 dark:text-green-400">
            Published!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your tour has been published to Sanity.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={publishResult.studioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
            >
              Open in Sanity Studio
            </a>
            <Button variant="outline" onClick={onReset}>
              Start over
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Error display */}
      {publishResult?.error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">{publishResult.error}</p>
          </CardContent>
        </Card>
      )}

      {/* Missing images warning */}
      {missingImages.length > 0 && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardContent className="pt-4">
            <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">
              Stops missing images ({missingImages.length}):
            </p>
            <ul className="mt-1 list-inside list-disc text-xs text-yellow-700 dark:text-yellow-300">
              {missingImages.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Dry run result */}
      {publishResult?.dryRun && (
        <DryRunOutputPanel data={publishResult.dryRun} />
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => onPublish(true)}
          disabled={publishing || !tour}
        >
          {publishing ? 'Running…' : 'Dry Run'}
        </Button>
        <Button
          onClick={() => onPublish(false)}
          disabled={publishing || !publishable}
          title={
            !publishable
              ? 'Add title, stops, and images to all stops before publishing'
              : undefined
          }
        >
          {publishing ? 'Publishing…' : 'Publish Tour'}
        </Button>
      </div>
    </div>
  )
}
