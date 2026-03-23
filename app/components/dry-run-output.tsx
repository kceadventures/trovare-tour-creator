'use client'

import { useState } from 'react'
import { DryRunOutput } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Props {
  data: DryRunOutput
}

export function DryRunOutputPanel({ data }: Props) {
  const [openDocs, setOpenDocs] = useState<Set<string>>(new Set())

  function toggleDoc(id: string) {
    setOpenDocs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
  }

  return (
    <Card className="border-yellow-500/40 bg-yellow-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <span>⚠️</span> Testing Mode
          </CardTitle>
          <Button variant="outline" size="sm" onClick={copyJson}>
            Copy JSON
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Warnings */}
        {data.warnings.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-yellow-600 dark:text-yellow-400">
              Warnings
            </h3>
            <ul className="space-y-1">
              {data.warnings.map((w, i) => (
                <li key={i} className="text-xs text-yellow-700 dark:text-yellow-300">
                  {w}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Documents */}
        {data.documents.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Documents ({data.documents.length})
            </h3>
            <div className="space-y-2">
              {data.documents.map((doc) => (
                <div
                  key={doc._id}
                  className="rounded-lg border border-border bg-muted/30"
                >
                  <button
                    type="button"
                    onClick={() => toggleDoc(doc._id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {doc._type}
                      </Badge>
                      <span className="font-mono text-muted-foreground">
                        {doc._id}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {openDocs.has(doc._id) ? '▲' : '▼'}
                    </span>
                  </button>
                  {openDocs.has(doc._id) && (
                    <pre className="overflow-x-auto rounded-b-lg bg-background px-3 pb-3 text-[11px] text-foreground">
                      {JSON.stringify(doc, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Assets */}
        {data.assets.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Assets ({data.assets.length})
            </h3>
            <ul className="space-y-1">
              {data.assets.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span className="font-mono">{a.filename}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {a.type}
                    </Badge>
                    <span>{(a.size / 1024).toFixed(0)} KB</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* References */}
        {data.references.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              References ({data.references.length})
            </h3>
            <ul className="space-y-1">
              {data.references.map((r, i) => (
                <li key={i} className="font-mono text-xs text-muted-foreground">
                  {r.from} → <span className="text-primary">{r.to}</span>{' '}
                  <span className="text-[10px]">({r.field})</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  )
}
