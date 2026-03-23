import { createClient } from '@sanity/client'

export const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID || '48sx65rc',
  dataset: process.env.SANITY_DATASET || 'production',
  apiVersion: '2022-03-07',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

export async function uploadSanityAsset(
  blob: Buffer,
  type: 'image' | 'file',
  filename: string,
  contentType: string
): Promise<string> {
  const asset = type === 'image'
    ? await sanity.assets.upload('image', blob, { filename, contentType })
    : await sanity.assets.upload('file', blob, { filename, contentType })
  return asset._id
}

export async function fetchTourProviders(): Promise<{ _id: string; title: string }[]> {
  return sanity.fetch('*[_type == "tourProvider"]{_id, title} | order(title asc)')
}

export async function fetchRegions(): Promise<{ _id: string; title: string }[]> {
  return sanity.fetch('*[_type == "region"]{_id, title} | order(title asc)')
}
