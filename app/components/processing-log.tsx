'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  messages: string[]
  processing: boolean
}

export function ProcessingLog({ messages, processing }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {processing && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          Processing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 font-mono text-xs">
          {messages.map((msg, i) => (
            <li key={i} className="text-muted-foreground">
              {msg}
            </li>
          ))}
          {processing && (
            <li className="animate-pulse text-primary">...</li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}
