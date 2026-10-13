import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { createMemoryStore, handleRequest, type Store } from './amplify/functions/wordcloud-api/core.ts'

const devApiPort = 8787
const devApiGlobal = globalThis as typeof globalThis & { __wordCloudDevApi?: Server }

function devApi(): Plugin {
  return {
    name: 'wordcloud-dev-api',
    async configureServer(viteServer) {
      if (devApiGlobal.__wordCloudDevApi) {
        await closeServer(devApiGlobal.__wordCloudDevApi)
        devApiGlobal.__wordCloudDevApi = undefined
      }

      const store = createMemoryStore()
      const apiServer = createServer((request, response) => {
        void handleNodeRequest(store, request, response)
      })
      devApiGlobal.__wordCloudDevApi = apiServer
      apiServer.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.warn(`Word cloud dev API is already listening on ${devApiPort}`)
          return
        }
        console.error(error)
      })
      apiServer.listen(devApiPort, () => {
        console.log(`Word cloud dev API at http://localhost:${devApiPort}`)
      })
      viteServer.httpServer?.on('close', () => {
        void closeServer(apiServer)
        if (devApiGlobal.__wordCloudDevApi === apiServer) {
          devApiGlobal.__wordCloudDevApi = undefined
        }
      })
    },
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}

async function handleNodeRequest(store: Store, request: IncomingMessage, response: ServerResponse) {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, x-admin-secret',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, cors)
    response.end()
    return
  }

  const path = (request.url ?? '/').split('?')[0] ?? '/'
  const result = await handleRequest(store, {
    method: request.method ?? 'GET',
    path,
    headers: flattenHeaders(request.headers),
    body: await readBody(request),
  })

  response.writeHead(result.statusCode, {
    ...cors,
    'content-type': 'application/json',
  })
  response.end(JSON.stringify(result.body))
}

function flattenHeaders(headers: IncomingMessage['headers']): Record<string, string | undefined> {
  const flat: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(headers)) {
    flat[key] = Array.isArray(value) ? value.join(',') : value
  }
  return flat
}

function readBody(request: IncomingMessage): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      resolve(chunks.length === 0 ? undefined : Buffer.concat(chunks).toString('utf8'))
    })
    request.on('error', reject)
  })
}

export default defineConfig({
  plugins: [react(), devApi()],
})
