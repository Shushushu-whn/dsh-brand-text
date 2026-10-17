// dsh-brand-text 0.2.0 —— 品牌设置（一体化）
//
// 一个插件同时管四件事：
//   1. 浏览器标题、favicon、PWA 图标        （tapIndex 改 index.html）
//   2. 左上角文字 + 左上角 Logo             （global 注入，客户端插槽渲染）
//   3. 空会话中央那句文案                    （客户端替换被写死的 i18n 文本）
//   4. 可视化设置面板 /brand-studio/         （本文件自带 HTTP 路由，不再单独起进程）
//
// 设计要点：
//   * 单一数据源 = configPath 指向的 brand.json；面板只写这个文件。
//   * 面板与 DSH 同源同端口，因此不需要额外端口、不需要重启、不会出现
//     "两套服务抢端口" 那类问题；保存后刷新页面即可看到效果。
//   * 品牌数据以 global 注入（kind: 'global'），保证早于客户端 bundle 执行。
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const VERSION = '0.3.0'

/** 设置面板与品牌资源的统一前缀（同源，无需令牌） */
const ROUTE = '/brand-studio'
/** 注入给浏览器端的全局变量名（客户端 bundle 读它） */
const GLOBAL_KEY = '__DSH_BRAND_STUDIO__'

const DEFAULT_PRODUCT = '湖北交投'
const DEFAULT_LOGO_NAME = 'brand-logo.png'

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

const inject = ['webServer']

// ------------------------------------------------------------------ 配置读写
function resolveConfigPath(configPath) {
  const raw = typeof configPath === 'string' ? configPath.trim() : ''
  if (!raw) return join(PLUGIN_DIR, 'brand.json')
  return raw
}

function normalize(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  return {
    productName: String(data.productName || DEFAULT_PRODUCT).trim() || DEFAULT_PRODUCT,
    // 留空 = 不替换官方文案
    heroText: String(data.heroText || '').trim(),
    logoPath: String(data.logoPath || '').trim()
  }
}

async function readBrand(file) {
  let raw = {}
  try {
    raw = JSON.parse(await readFile(file, 'utf8'))
  } catch (e) {
    // 首次安装：文件不存在属正常，用默认值
  }
  const brand = normalize(raw)
  if (!brand.logoPath) brand.logoPath = join(dirname(file), DEFAULT_LOGO_NAME)
  return brand
}

async function writeBrand(file, brand) {
  const payload = {
    productName: brand.productName,
    heroText: brand.heroText,
    logoPath: brand.logoPath,
    _说明: '由 DSH「品牌设置」面板写入（/brand-studio/）。productName=左上角文字与浏览器标题；heroText=中央（空会话）文字，留空用官方默认；logoPath=左上角图标。'
  }
  await mkdir(dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  await writeFile(tmp, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  await rename(tmp, file)
}

/** 读 logo 文件 -> { bytes, contentType, dataHref }（读不到就返回 null） */
async function readLogo(logoPath) {
  if (!logoPath) return null
  try {
    const bytes = await readFile(logoPath)
    const contentType = MIME_BY_EXT[extname(logoPath).toLowerCase()] || 'application/octet-stream'
    if (!contentType.startsWith('image/')) return null
    return { bytes, contentType, dataHref: `data:${contentType};base64,${bytes.toString('base64')}` }
  } catch {
    return null
  }
}

/** 插件运行期状态：配置 + logo 缓存。保存后面板会就地刷新它。 */
async function buildState(configPath) {
  const file = resolveConfigPath(configPath)
  const brand = await readBrand(file)
  const logo = await readLogo(brand.logoPath)
  return { file, brand, logo }
}

// ------------------------------------------------------------------ index.html 改写
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderIndex(html, state) {
  let out = html
  const title = `<title>${escapeHtml(state.brand.productName)}</title>`
  if (/<title\b[^>]*>[\s\S]*?<\/title\s*>/i.test(out)) {
    out = out.replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/i, title)
  } else {
    out = out.replace(/<head\b[^>]*>/i, (m) => `${m}\n${title}`)
  }

  if (state.logo) {
    const icon = `<link rel="icon" href="${ROUTE}/mark.svg" type="image/svg+xml">`
    if (/<link\b(?=[^>]*\brel\s*=\s*["']icon["'])[^>]*>/i.test(out)) {
      out = out.replace(/<link\b(?=[^>]*\brel\s*=\s*["']icon["'])[^>]*>/i, icon)
    }
    const manifest = `<link rel="manifest" href="${ROUTE}/manifest.webmanifest">`
    if (/<link\b(?=[^>]*\brel\s*=\s*["']manifest["'])[^>]*>/i.test(out)) {
      out = out.replace(/<link\b(?=[^>]*\brel\s*=\s*["']manifest["'])[^>]*>/i, manifest)
    }
  }
  return out
}

/** 注入给浏览器的启动数据（早于客户端 bundle 执行） */
function bootPayload(state) {
  return {
    productName: state.brand.productName,
    heroText: state.brand.heroText,
    logoHref: state.logo ? state.logo.dataHref : '',
    logoAlt: state.brand.productName
  }
}

// ------------------------------------------------------------------ HTTP 小工具
function send(res, code, body, contentType = 'text/html; charset=utf-8') {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8')
  res.writeHead(code, {
    'content-type': contentType,
    'content-length': String(buf.byteLength),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  })
  res.end(buf)
}

function sendJson(res, code, value) {
  send(res, code, JSON.stringify(value), 'application/json; charset=utf-8')
}

function readBody(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('图标文件过大（上限 12 MB）'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** 方形图标外壳：把 logo 塞进 1:1 的 svg，供 favicon / PWA / 侧栏使用 */
function renderMarkSvg(dataHref) {
  const href = dataHref.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><image href="${href}" width="1" height="1" preserveAspectRatio="xMidYMid meet"/></svg>`
}

// ------------------------------------------------------------------ 设置面板页面
const PANEL_CSS = `
:root{--bg:#0f1419;--card:#171d26;--line:#2a3441;--fg:#e6edf3;--dim:#8b98a5;--pri:#1a7f5a;--pri2:#2ea36f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 "Microsoft YaHei",system-ui,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:32px 20px 60px}
h1{font-size:20px;margin:0 0 4px}p.sub{color:var(--dim);margin:0 0 24px;font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin-bottom:16px}
label{display:block;font-size:13px;color:var(--dim);margin:0 0 6px}
input[type=text]{width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:#0d1218;color:var(--fg);font-size:15px;outline:none}
input[type=text]:focus{border-color:var(--pri2)}
.hint{color:var(--dim);font-size:12px;margin:6px 0 0}
.logo-row{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.preview{width:72px;height:72px;border-radius:12px;background:#0d1218;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;overflow:hidden}
.preview img{max-width:56px;max-height:56px}
button{cursor:pointer;border:0;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:600}
.btn-pri{background:var(--pri);color:#fff}.btn-pri:hover{background:var(--pri2)}
.btn-ghost{background:transparent;color:var(--fg);border:1px solid var(--line)}
.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
#msg{margin-top:14px;font-size:13px;min-height:20px}
.ok{color:#3fb950}.err{color:#f85149}
code{background:#0d1218;border:1px solid var(--line);border-radius:5px;padding:1px 6px;font-size:12px;word-break:break-all}
.meta td{padding:5px 0;border-bottom:1px dashed var(--line);font-size:12px;color:var(--dim);vertical-align:top}
.meta td:first-child{width:110px;white-space:nowrap}
`

const PANEL_JS = `
let logoDataUrl = null;
function msg(t, ok){ const m=document.getElementById('msg'); m.textContent=t; m.className = ok?'ok':'err'; }
async function load(){
  const r = await fetch('${ROUTE}/api/config'); const d = await r.json();
  document.getElementById('productName').value = d.productName || '';
  document.getElementById('heroText').value = d.heroText || '';
  document.getElementById('logoImg').src = '${ROUTE}/logo?ts=' + Date.now();
  document.getElementById('logoPath').textContent = d.logoPath || '（未设置）';
  document.getElementById('cfgPath').textContent = d.configPath || '';
}
document.getElementById('logoFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if(!f) return;
  const b64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f); });
  logoDataUrl = b64;
  document.getElementById('logoImg').src = b64;
  msg('已选择新图标，记得点保存', true);
});
async function save(){
  const body = {
    productName: document.getElementById('productName').value.trim(),
    heroText: document.getElementById('heroText').value.trim(),
    logoDataUrl: logoDataUrl
  };
  msg('保存中…', true);
  const r = await fetch('${ROUTE}/api/save', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
  const d = await r.json();
  if(!d.ok){ msg('保存失败：' + d.error, false); return; }
  logoDataUrl = null;
  document.getElementById('logoPath').textContent = d.logoPath || '（未设置）';
  msg('已保存。回到 DSH 页面按 F5 刷新即可看到效果（不用重启）。', true);
}
load();
`

function renderPanel() {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>品牌设置 · DSH</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${PANEL_CSS}</style></head><body><div class="wrap">
<h1>品牌设置</h1>
<p class="sub">改完点「保存」，然后回 DSH 页面按 <b>F5</b> 刷新即可，无需重启服务。</p>

<div class="card">
  <label>左上角文字（同时是浏览器标签标题）</label>
  <input type="text" id="productName" placeholder="湖北交投">
  <p class="hint">显示在侧边栏最上方；浏览器标签页、PWA 名称也用它。</p>
</div>

<div class="card">
  <label>中央文字（新建对话时页面正中间那句）</label>
  <input type="text" id="heroText" placeholder="留空则用 DSH 官方默认（探索未至之境）">
  <p class="hint">留空 = 不替换，保持官方文案。</p>
</div>

<div class="card">
  <label>左上角图标 / Logo</label>
  <div class="logo-row">
    <div class="preview"><img id="logoImg" alt=""></div>
    <div>
      <input type="file" id="logoFile" accept="image/png,image/jpeg,image/svg+xml,image/webp">
      <p class="hint">当前文件：<span id="logoPath"></span></p>
      <p class="hint">建议用正方形透明底 PNG（深色侧栏更清楚）。同时接管浏览器图标与 PWA 图标。</p>
    </div>
  </div>
</div>

<div class="card">
  <div class="actions">
    <button class="btn-pri" onclick="save()">保存</button>
    <a class="btn-ghost" href="/" style="text-decoration:none;display:inline-block;padding:10px 18px;border-radius:8px;border:1px solid #2a3441;color:#e6edf3;font-size:14px;font-weight:600">打开 DSH</a>
  </div>
  <div id="msg"></div>
</div>

<div class="card">
  <label>本插件信息</label>
  <table class="meta">
    <tr><td>配置数据</td><td><span id="cfgPath"></span></td></tr>
    <tr><td>插件目录</td><td><code>${escapeHtml(PLUGIN_DIR)}</code></td></tr>
    <tr><td>版本</td><td>dsh-brand-text v${VERSION}（已合并原 dsh-client-ui-brand 的功能）</td></tr>
    <tr><td>重复安装</td><td><code>dsh plugin --profile &lt;profile&gt; add "${escapeHtml(PLUGIN_DIR)}"</code></td></tr>
  </table>
</div>
</div>
<script>${PANEL_JS}</script></body></html>`
}

// ------------------------------------------------------------------ 插件入口
async function apply(ctx, config = {}) {
  const configPath = config && config.configPath
  let state = await buildState(configPath)

  const log = (level, text) => {
    const fn = ctx.logger && ctx.logger[level]
    if (typeof fn === 'function') fn.call(ctx.logger, text)
  }
  log('info', `dsh-brand-text: 品牌 = ${state.brand.productName} / 中央文案 = ${state.brand.heroText || '（官方默认）'}`)

  // 1) 启动数据：kind:'global' 保证早于客户端 bundle
  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'global', name: GLOBAL_KEY, value: bootPayload(state) })
  })

  // 2) index.html 改写：标题 / favicon / manifest
  ctx.effect(
    () => ctx.webServer.tapIndex((html) => renderIndex(html, state)),
    'dsh-brand-text: document metadata'
  )

  // 3) 设置面板
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE,
    handler: (req, res) => send(res, 200, renderPanel())
  }), 'dsh-brand-text: panel')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE + '/',
    handler: (req, res) => send(res, 200, renderPanel())
  }), 'dsh-brand-text: panel slash')

  // 4) 配置读写 API
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE + '/api/config',
    handler: (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
      sendJson(res, 200, {
        productName: state.brand.productName,
        heroText: state.brand.heroText,
        logoPath: state.brand.logoPath,
        configPath: state.file,
        pluginDir: PLUGIN_DIR,
        version: VERSION
      })
    }
  }), 'dsh-brand-text: config api')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE + '/api/save',
    handler: async (req, res) => {
      if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
      let data
      try {
        data = JSON.parse((await readBody(req)) || '{}')
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: '请求解析失败: ' + e.message })
      }
      try {
        const brand = { ...state.brand }
        if (typeof data.productName === 'string') {
          brand.productName = data.productName.trim() || DEFAULT_PRODUCT
        }
        if (typeof data.heroText === 'string') {
          brand.heroText = data.heroText.trim()
        }
        const logo = typeof data.logoDataUrl === 'string' ? data.logoDataUrl : ''
        if (logo) {
          const m = /^data:image\/(png|jpeg|jpg|svg\+xml|webp);base64,(.+)$/s.exec(logo)
          if (!m) return sendJson(res, 200, { ok: false, error: '图标格式不支持（png / jpg / svg / webp）' })
          const ext = { png: '.png', jpeg: '.jpg', jpg: '.jpg', 'svg+xml': '.svg', webp: '.webp' }[m[1]]
          const safeName = 'custom-logo' + ext
          const logoFile = join(dirname(state.file), safeName)
          await mkdir(dirname(logoFile), { recursive: true })
          await writeFile(logoFile, Buffer.from(m[2], 'base64'))
          brand.logoPath = logoFile
        }
        await writeBrand(state.file, brand)
        // 就地刷新（面板与页面同源，下一次请求就用新值）
        const next = await readBrand(state.file)
        state.brand = next
        state.logo = await readLogo(next.logoPath)
        log('info', `dsh-brand-text: 已保存品牌 = ${next.productName}`)
        return sendJson(res, 200, { ok: true, logoPath: next.logoPath })
      } catch (e) {
        return sendJson(res, 200, { ok: false, error: String(e && e.message || e) })
      }
    }
  }), 'dsh-brand-text: save api')

  // 5) 品牌资源：logo 原图 / 方形图标 / manifest
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE + '/logo',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed')
      const logo = await readLogo(state.brand.logoPath)
      if (!logo) return send(res, 404, 'no logo')
      send(res, 200, req.method === 'HEAD' ? Buffer.alloc(0) : logo.bytes, logo.contentType)
    }
  }), 'dsh-brand-text: logo route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE + '/mark.svg',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed')
      const logo = await readLogo(state.brand.logoPath)
      if (!logo) return send(res, 404, 'no logo')
      send(res, 200, renderMarkSvg(logo.dataHref), 'image/svg+xml')
    }
  }), 'dsh-brand-text: mark route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE + '/manifest.webmanifest',
    handler: (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed')
      send(res, 200, JSON.stringify({
        id: '/',
        name: state.brand.productName,
        short_name: state.brand.productName,
        start_url: '/',
        scope: '/',
        display: 'fullscreen',
        icons: [{ src: ROUTE + '/mark.svg', purpose: 'any', type: 'image/svg+xml' }]
      }), 'application/manifest+json; charset=utf-8')
    }
  }), 'dsh-brand-text: manifest route')
}

export { inject, apply }

// 便于外部查看配置路径（调试用）
export { resolveConfigPath, GLOBAL_KEY, ROUTE }
