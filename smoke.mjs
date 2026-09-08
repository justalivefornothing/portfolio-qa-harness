// Headless smoke test for a built Vite project.
// Usage: node smoke.mjs --dir <projectDir> --port <port> --out <screenshot.png> [--path /route] [--wait 4000] [--width 1440] [--height 900]
// Spawns `npx vite preview` in <projectDir>, loads the page in headless Edge (Chromium),
// collects console errors/warnings and uncaught page errors, takes a screenshot, prints a JSON report, exits 0/1.
import { chromium } from 'playwright'
import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import fs from 'node:fs'

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'])
  return acc
}, []))

const dir = path.resolve(args.dir || '.')
const port = Number(args.port || 4173)
const out = args.out ? path.resolve(args.out) : null
const route = args.path || '/'
const settle = Number(args.wait || 4000)
const width = Number(args.width || 1440)
const height = Number(args.height || 900)
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

function waitForPort(p, timeoutMs = 30000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const s = net.createConnection({ port: p, host: '127.0.0.1' })
      s.once('connect', () => { s.destroy(); resolve() })
      s.once('error', () => {
        s.destroy()
        if (Date.now() - start > timeoutMs) reject(new Error(`port ${p} never opened`))
        else setTimeout(tryOnce, 300)
      })
    }
    tryOnce()
  })
}

if (!fs.existsSync(path.join(dir, 'dist'))) {
  console.log(JSON.stringify({ ok: false, error: `no dist/ in ${dir} — run npm run build first` }))
  process.exit(1)
}

const server = spawn('npx.cmd', ['vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
  cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], shell: true,
})
let serverLog = ''
server.stdout.on('data', d => { serverLog += d })
server.stderr.on('data', d => { serverLog += d })

const report = { ok: false, url: `http://127.0.0.1:${port}${route}`, consoleErrors: [], consoleWarnings: [], pageErrors: [], requestFailures: [], title: '', bodyTextSample: '', screenshot: out }
let browser
try {
  await waitForPort(port)
  browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const page = await browser.newPage({ viewport: { width, height } })
  page.on('console', m => {
    const t = m.type()
    if (t === 'error') report.consoleErrors.push(m.text())
    else if (t === 'warning') report.consoleWarnings.push(m.text())
  })
  page.on('pageerror', e => report.pageErrors.push(String(e && e.stack || e)))
  page.on('requestfailed', r => report.requestFailures.push(`${r.url()} — ${r.failure()?.errorText}`))
  await page.goto(report.url, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(settle)
  report.title = await page.title()
  const text = await page.evaluate(() => document.body ? document.body.innerText : '')
  report.bodyTextSample = text.replace(/\s+/g, ' ').slice(0, 600)
  report.rootHasChildren = await page.evaluate(() => { const r = document.getElementById('root') || document.body; return !!r && r.children.length > 0 })
  report.canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length)
  if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); await page.screenshot({ path: out, fullPage: false }) }
  report.ok = report.pageErrors.length === 0 && report.rootHasChildren
} catch (e) {
  report.error = String(e && e.stack || e)
} finally {
  if (browser) await browser.close().catch(() => {})
  killPortListeners(port)
  try { spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }) } catch {}
}

// `npx.cmd` via a shell means server.pid is cmd.exe; the actual node listener may outlive it, so kill by port too.
function killPortListeners(p) {
  try {
    const out = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' }).stdout || ''
    const pids = new Set()
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/)
      if (m && Number(m[1]) === p) pids.add(m[2])
    }
    for (const pid of pids) spawnSync('taskkill', ['/pid', pid, '/T', '/F'], { stdio: 'ignore' })
  } catch {}
}
if (!report.ok && serverLog) report.serverLog = serverLog.slice(-1500)
console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
