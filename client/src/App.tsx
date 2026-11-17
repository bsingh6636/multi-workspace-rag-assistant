import { useEffect, useState } from 'react'

type Health = 'checking' | 'ok' | 'down'

// Part 0 placeholder page: proves the built client is served and can reach the API.
export default function App() {
  const [health, setHealth] = useState<Health>('checking')

  useEffect(() => {
    fetch('/health')
      .then((res) => setHealth(res.ok ? 'ok' : 'down'))
      .catch(() => setHealth('down'))
  }, [])

  return (
    <main>
      <h1>Workspace Assistant</h1>
      <p>Multi-workspace document assistant with RAG and tool calling.</p>
      <p>
        Server: <strong>{health}</strong>
      </p>
    </main>
  )
}
