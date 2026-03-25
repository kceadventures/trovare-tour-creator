import { NextRequest, NextResponse } from 'next/server'

interface GeocodeSuggestion {
  display_name: string
  lat: number
  lon: number
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.length < 3) {
    return NextResponse.json([])
  }

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '5')
  url.searchParams.set('addressdetails', '1')

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'TrovareTourCreator/1.0',
    },
  })

  if (!res.ok) {
    return NextResponse.json([], { status: res.status })
  }

  const data = await res.json()
  const suggestions: GeocodeSuggestion[] = data.map((item: { display_name: string; lat: string; lon: string }) => ({
    display_name: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }))

  return NextResponse.json(suggestions)
}
