export const POI_KINDS = [
  'airport', 'bankAtm', 'barPub', 'beach', 'cafeRestaurant', 'gasStation',
  'hospital', 'hotel', 'museum', 'park', 'parking', 'pharmacy',
  'publicTransport', 'shopSupermarket', 'toilet', 'touristAttraction',
] as const

export const TOUR_TYPES = ['walk', 'bike', 'drive', 'run'] as const
export const CATEGORY_TAGS = ['food', 'culture', 'nature', 'history', 'adventure', 'scenic'] as const

export const REGIONS = [
  { _id: 'f62ad0f8-efa5-4870-be0e-e0647ad25cfb', title: 'Cannon Beach' },
  { _id: '585c28d9-6212-4a9e-b124-f9c8102dff3a', title: 'Casablanca' },
  { _id: 'c5bd0b4c-a671-4939-af44-7d8cee79b739', title: 'Colombian Highlands' },
  { _id: 'd68d9de9-563c-415d-86fb-fcb621e12c58', title: 'Copenhagen' },
  { _id: '46c56d61-4174-42b8-803d-f34361858510', title: 'Edinburgh' },
  { _id: '8ab3a446-3359-42fe-ad20-414264314151', title: 'Gran Canaria' },
  { _id: 'f98b5496-91b4-4271-8d24-e5e528d83cdc', title: 'Kyoto' },
  { _id: 'a51a17e1-b7ad-43e1-a493-3cb12c4c643b', title: 'Marrakesh' },
] as const

export const FILE_LIMITS = {
  image: 20 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  gpx: 5 * 1024 * 1024,
  text: 1 * 1024 * 1024,
} as const

export const ACCEPTED_TYPES: Record<string, string[]> = {
  gpx: ['.gpx'],
  image: ['.jpg', '.jpeg', '.png'],
  audio: ['.mp3'],
  video: ['.mp4'],
  text: ['.txt', '.md'],
}

export const SANITY_PROJECT = '48sx65rc'
export const SANITY_DATASET = 'production'
export const SANITY_API_VERSION = '2022-03-07'
