// WordStar 集中式存储后端：静态文件 + 数据 API 一体（局域网家用）
// 用法: node server.mjs [端口=5567] [静态目录=../.output/public] [数据目录=../../server-data]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.argv[2] || 5567)
const STATIC_ROOT = path.resolve(process.argv[3] || path.join(__dirname, '../.output/public'))
const DATA_DIR = path.resolve(process.argv[4] || path.join(__dirname, '../../server-data'))

fs.mkdirSync(DATA_DIR, { recursive: true })

// ── 数据存储：每用户一个 JSON 文件，内存缓存 + 防抖落盘 ──
const caches = new Map() // user -> { data: Map(key->value), dirty: bool, timer }
const USER_RE = /^[a-zA-Z0-9_-]+$/

function userOf(key) {
  // key 形如 'duoduo:typing-word-dict'；无前缀归 default
  const i = String(key).indexOf(':')
  const u = i > 0 ? String(key).slice(0, i) : 'default'
  return USER_RE.test(u) ? u : 'default'
}

function loadUser(u) {
  if (caches.has(u)) return caches.get(u)
  const file = path.join(DATA_DIR, `${u}.json`)
  const data = new Map()
  try {
    const raw = fs.readFileSync(file, 'utf8')
    for (const [k, v] of Object.entries(JSON.parse(raw))) data.set(k, v)
    console.log(`[data] loaded ${u}: ${data.size} keys`)
  } catch {
    /* 新用户 */
  }
  const entry = { data, timer: null }
  caches.set(u, entry)
  return entry
}

function flushUser(u) {
  const entry = caches.get(u)
  if (!entry) return
  clearTimeout(entry.timer)
  entry.timer = null
  const file = path.join(DATA_DIR, `${u}.json`)
  const tmp = file + '.tmp'
  const obj = Object.fromEntries(entry.data)
  fs.writeFileSync(tmp, JSON.stringify(obj))
  fs.renameSync(tmp, file)
}

function scheduleFlush(u) {
  const entry = loadUser(u)
  clearTimeout(entry.timer)
  entry.timer = setTimeout(() => flushUser(u), 500)
}

// ── API ──
async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks)
}

async function handleApi(req, res, url) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()

  const key = url.searchParams.get('key')
  if (!key || key.length > 512) return res.writeHead(400).end('bad key')
  const u = userOf(key)
  const entry = loadUser(u)

  try {
    if (req.method === 'GET') {
      if (!entry.data.has(key)) return res.writeHead(404).end()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(entry.data.get(key)))
    }
    if (req.method === 'PUT') {
      const body = await readBody(req)
      let value
      try {
        value = JSON.parse(body.toString('utf8'))
      } catch {
        return res.writeHead(400).end('bad json')
      }
      entry.data.set(key, value)
      scheduleFlush(u)
      return res.writeHead(200).end('ok')
    }
    if (req.method === 'DELETE') {
      entry.data.delete(key)
      scheduleFlush(u)
      return res.writeHead(200).end('ok')
    }
    res.writeHead(405).end()
  } catch (e) {
    console.error('[api]', e)
    res.writeHead(500).end('server error')
  }
}

// ── 静态文件 ──
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json',
}

function serveStatic(res, url) {
  let p = decodeURIComponent(url.pathname)
  if (p.endsWith('/')) p += 'index.html'
  const file = path.normalize(path.join(STATIC_ROOT, p))
  if (!file.startsWith(STATIC_ROOT)) return res.writeHead(403).end()

  const send = (f, code = 200) => {
    const ext = path.extname(f)
    res.writeHead(code, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=604800',
    })
    fs.createReadStream(f).on('error', () => res.writeHead(404).end()).pipe(res)
  }

  // 存在真实文件 → 直接发；否则 SPA fallback 到 200.html
  fs.stat(file, (err, st) => {
    if (!err && st.isFile()) return send(file)
    const fallback = path.join(STATIC_ROOT, '200.html')
    fs.access(fallback, fs.constants.F_OK, e => {
      if (!e) return send(fallback)
      send(path.join(STATIC_ROOT, '404.html'), 404)
    })
  })
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url)
  serveStatic(res, url)
})

// 退出前把脏数据落盘
function flushAll() {
  for (const u of caches.keys()) {
    const e = caches.get(u)
    if (e.timer) flushUser(u)
  }
}
process.on('SIGTERM', () => {
  flushAll()
  process.exit(0)
})
process.on('SIGINT', () => {
  flushAll()
  process.exit(0)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[wordstar] listening on 0.0.0.0:${PORT}`)
  console.log(`[wordstar] static: ${STATIC_ROOT}`)
  console.log(`[wordstar] data:   ${DATA_DIR}`)
})
