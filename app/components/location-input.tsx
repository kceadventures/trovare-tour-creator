'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Input } from '@/components/ui/input'
import { spring } from '@/lib/motion'

interface GeocodeSuggestion {
  display_name: string
  lat: number
  lon: number
}

interface LocationInputProps {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
  layoutIdPrefix?: string
}

// Module-level rate limiting for Nominatim (1 req/sec)
let lastRequest = 0

export function LocationInput({ lat, lng, onChange, layoutIdPrefix = 'location' }: LocationInputProps) {
  const hasCoords = lat !== 0 || lng !== 0
  const [tab, setTab] = useState<'search' | 'coords'>(hasCoords ? 'coords' : 'search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [selectedName, setSelectedName] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([])
      setShowDropdown(false)
      return
    }

    // Rate limit
    const now = Date.now()
    const wait = Math.max(0, 1000 - (now - lastRequest))
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastRequest = Date.now()

    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error()
      const data: GeocodeSuggestion[] = await res.json()
      setResults(data)
      setShowDropdown(true)
      setHighlightIndex(-1)
    } catch {
      setError(true)
      setResults([])
      setShowDropdown(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 3) {
      setResults([])
      setShowDropdown(false)
      return
    }
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  function selectResult(result: GeocodeSuggestion) {
    onChange(result.lat, result.lon)
    setSelectedName(result.display_name.split(',')[0])
    setQuery(result.display_name.split(',')[0])
    setShowDropdown(false)
    setResults([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault()
      selectResult(results[highlightIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  const tabs = ['search', 'coords'] as const

  return (
    <div className="space-y-2">
      {/* Tab row */}
      <div className="relative flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            className={`relative px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab(t)}
          >
            {t === 'search' ? 'Search' : 'Coordinates'}
            {tab === t && (
              <motion.div
                layoutId={`${layoutIdPrefix}-tab`}
                className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground"
                transition={spring.snappy}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {tab === 'search' && (
          <motion.div
            key="search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="relative">
              <div className="relative">
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setSelectedName('')
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => { if (results.length > 0) setShowDropdown(true) }}
                  placeholder="Search for an address..."
                  className="h-7 text-xs pr-8"
                />
                {loading && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Dropdown */}
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={spring.smooth}
                    className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden"
                  >
                    {error ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Search unavailable — use Coordinates tab
                      </div>
                    ) : results.length === 0 && !loading ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No results found
                      </div>
                    ) : (
                      results.map((r, i) => {
                        const parts = r.display_name.split(',')
                        const primary = parts[0]
                        const secondary = parts.slice(1).join(',').trim()
                        return (
                          <motion.button
                            key={`${r.lat}-${r.lon}`}
                            type="button"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.02 }}
                            className={`flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-accent transition-colors ${
                              i === highlightIndex ? 'bg-accent' : ''
                            }`}
                            onClick={() => selectResult(r)}
                          >
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{primary}</div>
                              {secondary && (
                                <div className="text-muted-foreground text-[11px] mt-0.5">{secondary}</div>
                              )}
                            </div>
                          </motion.button>
                        )
                      })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Resolved coordinates */}
            {selectedName && hasCoords && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-1.5 flex items-center justify-between"
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  {Math.abs(lat).toFixed(5)}° {lat >= 0 ? 'N' : 'S'}, {Math.abs(lng).toFixed(5)}° {lng >= 0 ? 'E' : 'W'}
                </span>
                <span className="text-[10px] text-muted-foreground/60">auto-filled</span>
              </motion.div>
            )}
          </motion.div>
        )}

        {tab === 'coords' && (
          <motion.div
            key="coords"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-2 gap-2"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Latitude</label>
              <Input
                type="number"
                step="any"
                value={lat !== 0 ? lat : ''}
                placeholder="0.00000"
                onChange={(e) => onChange(parseFloat(e.target.value) || 0, lng)}
                className="h-7 font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Longitude</label>
              <Input
                type="number"
                step="any"
                value={lng !== 0 ? lng : ''}
                placeholder="0.00000"
                onChange={(e) => onChange(lat, parseFloat(e.target.value) || 0)}
                className="h-7 font-mono text-xs"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
