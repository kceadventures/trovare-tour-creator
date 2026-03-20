export const config = { runtime: 'edge' }
export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  const body = await req.text()
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05,interleaved-thinking-2025-05-14' }
  , body })
  const text = await upstream.text()
  return new Response(text, { status: upstream.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
}