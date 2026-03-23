'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface Props {
  messages: string[]
  processing: boolean
  progress: number
}

export function ProcessingLog({ messages, processing, progress }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          {processing && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          {processing ? 'Building your tour...' : 'Processing complete'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{progress}%</p>
        </div>
        <div className="bg-muted rounded-lg p-4 max-h-60 overflow-y-auto font-mono text-xs space-y-1">
          {messages.map((msg, i) => (
            <div key={i} className="text-muted-foreground">
              {msg}
            </div>
          ))}
          {processing && (
            <div className="animate-pulse text-primary">...</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
