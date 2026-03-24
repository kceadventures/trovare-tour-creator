'use client'

import { useEffect } from 'react'
import { motion } from 'motion/react'
import { spring } from '@/lib/motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface Props {
  messages: string[]
  processing: boolean
  progress: number
}

export function ProcessingLog({ messages, processing, progress }: Props) {
  // Warn before unload while processing
  useEffect(() => {
    if (!processing) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [processing])

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
        {processing && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2 text-center">
            Please don&apos;t refresh or close this page while processing is in progress.
          </p>
        )}
        <div className="space-y-1.5">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{progress}%</p>
        </div>
        <div className="bg-muted rounded-lg p-4 max-h-60 overflow-y-auto font-mono text-xs space-y-1">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring.gentle, delay: Math.min(i * 0.02, 0.5) }}
              className="text-muted-foreground"
            >
              {msg}
            </motion.div>
          ))}
          {processing && (
            <div className="animate-pulse text-primary">...</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
