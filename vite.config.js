import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import http from 'node:http'
import https from 'node:https'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    {
      /**
       * Custom CORS proxy plugin.
       * The browser cannot call http://192.168.x.x:8080 directly (CORS block).
       * Instead, the Vue app routes local-mode requests through:
       *   POST /sms-proxy/message   (this Vite server)
       * and this middleware forwards them to the actual Android device,
       * then returns the response — no CORS issues.
       *
       * The target device URL is passed per-request via the X-Gateway-Url header.
       */
      name: 'android-sms-gateway-proxy',
      configureServer(server) {
        server.middlewares.use('/sms-proxy', (req, res) => {
          // Always allow CORS for preflight
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Gateway-Url')

          if (req.method === 'OPTIONS') {
            res.writeHead(204)
            res.end()
            return
          }

          const targetBase = req.headers['x-gateway-url']
          if (!targetBase) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Missing X-Gateway-Url header' }))
            return
          }

          // Collect request body
          const chunks = []
          req.on('data', chunk => chunks.push(chunk))
          req.on('end', () => {
            const body = Buffer.concat(chunks)

            // Build the target URL: targetBase + path-after-/sms-proxy
            const apiPath = req.url || '/'
            // Build target URL: concatenate base + path
            // NOTE: we do NOT use new URL(path, base) because if path starts
            // with '/' it replaces the entire base path (e.g. drops /3rdparty/v1).
            const base = targetBase.replace(/\/$/, '') // strip trailing slash
            const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`
            const rawUrl = base + path

            let fullTarget
            try {
              fullTarget = new URL(rawUrl)
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: `Invalid target URL: ${rawUrl}` }))
              return
            }

            const lib = fullTarget.protocol === 'https:' ? https : http
            const port = fullTarget.port
              ? parseInt(fullTarget.port)
              : fullTarget.protocol === 'https:' ? 443 : 80

            const proxyHeaders = {
              'content-type': req.headers['content-type'] || 'application/json',
              'host': fullTarget.host,
            }
            if (req.headers['authorization']) {
              proxyHeaders['authorization'] = req.headers['authorization']
            }
            if (body.length > 0) {
              proxyHeaders['content-length'] = body.length
            }

            const options = {
              hostname: fullTarget.hostname,
              port,
              path: fullTarget.pathname + fullTarget.search,
              method: req.method,
              headers: proxyHeaders,
            }

            const proxyReq = lib.request(options, (proxyRes) => {
              const responseChunks = []
              proxyRes.on('data', c => responseChunks.push(c))
              proxyRes.on('end', () => {
                const responseBody = Buffer.concat(responseChunks)
                res.writeHead(proxyRes.statusCode, {
                  'content-type': proxyRes.headers['content-type'] || 'application/json',
                  'access-control-allow-origin': '*',
                })
                res.end(responseBody)
              })
            })

            proxyReq.on('error', (err) => {
              console.error('[sms-proxy] Error:', err.message)
              if (!res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' })
              }
              res.end(JSON.stringify({ error: err.message, code: err.code }))
            })

            if (body.length > 0) {
              proxyReq.write(body)
            }
            proxyReq.end()
          })
        })
      },
    },
  ],
})
