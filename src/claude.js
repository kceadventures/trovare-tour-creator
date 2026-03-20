// Shared Claude API caller — routes through /api/claude proxy to avoid CORS
export async function callClaude({ prompt, system, useWebSearch = false, maxTokens = 1200 }) {
  const body = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  }
  if (system) body.system = system
  if (useWebSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search' }]

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  // Concatenate all text content blocks (web search may produce multiple)
  return data.content?.filter(c => c.type === 'text').map(c => c.text).join('') || ''
}