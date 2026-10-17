// dsh-brand-text 0.4.0 —— DSH 品牌设置（一体化）
//
// 功能按重要性分成两组，面板与双击弹窗都按这个顺序排：
//
//   ① 基本设置（插件本职）
//        · 浏览器标题 / favicon / PWA 图标
//        · 左上角 Logo + 左上角文字
//        · 空会话正中间那句标题
//
//   ② 水印（新功能）
//        · A 页面水印：DSH 页面上叠一层半透明斜向文字，透明度/角度/字号可调
//        · B 文件/文件夹贴标：把「为什么加 / 在干什么活」写进项目目录，
//          资源管理器悬停可见，图标换成品牌徽标
//
// 设计要点：
//   * 单一数据源 = configPath 指向的 brand.json；面板只写这个文件。
//   * 面板与 DSH 同源同端口，保存后刷新页面即可，不需要重启、不会抢端口。
//   * 品牌数据用 kind:'global' 注入，保证早于客户端 bundle 执行。
import { mkdir, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { dirname, join } from 'node:path'
import {
  DEFAULT_PRODUCT,
  GLOBAL_KEY,
  PLUGIN_DIR,
  ROUTE,
  VERSION,
  buildState,
  escapeHtml,
  normalizeWatermark,
  readBrand,
  readLogo,
  resolveConfigPath,
  writeBrand
} from './config.js'
import { buildCardSvg, buildWatermarkSvg, isoDay, markTargetFs, stamp, unmarkTargetFs } from './watermark.js'
import { renderPanel } from './panel.js'

const inject = ['webServer']

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
        reject(new Error('请求体过大（上限 12 MB）'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function queryOf(req) {
  try {
    return new URL(req.url || '/', 'http://127.0.0.1').searchParams
  } catch {
    return new URLSearchParams()
  }
}

/** 方形图标外壳：把 logo 塞进 1:1 的 svg，供 favicon / PWA / 侧栏使用 */
function renderMarkSvg(dataHref) {
  const href = dataHref.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><image href="${href}" width="1" height="1" preserveAspectRatio="xMidYMid meet"/></svg>`
}

// ------------------------------------------------------------------ index.html 改写
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
  const wm = state.brand.watermark
  const on = wm.enabled && wm.onPage
  return {
    productName: state.brand.productName,
    heroText: state.brand.heroText,
    logoHref: state.logo ? state.logo.dataHref : '',
    logoAlt: state.brand.productName,
    version: VERSION,
    watermark: wm,
    // 服务端算好 SVG，客户端只管铺（避免两端各实现一遍）
    watermarkSvg: on ? buildWatermarkSvg(wm, state.brand.productName) : ''
  }
}

// ------------------------------------------------------------------ 插件入口
async function apply(ctx, config = {}) {
  const configPath = config && config.configPath
  let state = await buildState(configPath)

  const log = (level, text) => {
    const fn = ctx.logger && ctx.logger[level]
    if (typeof fn === 'function') fn.call(ctx.logger, text)
  }
  const wm0 = state.brand.watermark
  log(
    'info',
    `dsh-brand-text v${VERSION}: 品牌 = ${state.brand.productName} / 中央文案 = ${state.brand.heroText || '（官方默认）'} / 水印 = ${wm0.enabled ? '开（' + (wm0.task || wm0.text || '未填') + '，透明度 ' + wm0.opacity + '）' : '关'}`
  )

  const refresh = async () => {
    const brand = await readBrand(state.file)
    state.brand = brand
    state.logo = await readLogo(brand.logoPath)
  }

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
  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: ROUTE, handler: (req, res) => send(res, 200, renderPanel()) }),
    'dsh-brand-text: panel'
  )
  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: ROUTE + '/', handler: (req, res) => send(res, 200, renderPanel()) }),
    'dsh-brand-text: panel slash'
  )

  // 4) 配置读取（① 基本 + ② 水印）
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE + '/api/config',
      handler: (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
        sendJson(res, 200, {
          productName: state.brand.productName,
          heroText: state.brand.heroText,
          logoPath: state.brand.logoPath,
          watermark: state.brand.watermark,
          configPath: state.file,
          pluginDir: PLUGIN_DIR,
          version: VERSION
        })
      }
    }),
    'dsh-brand-text: config api'
  )

  // 5) ① 基本设置保存
  ctx.effect(
    () => ctx.webServer.register({
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
          if (typeof data.productName === 'string') brand.productName = data.productName.trim() || DEFAULT_PRODUCT
          if (typeof data.heroText === 'string') brand.heroText = data.heroText.trim()

          const logo = typeof data.logoDataUrl === 'string' ? data.logoDataUrl : ''
          if (logo) {
            const m = /^data:image\/(png|jpeg|jpg|svg\+xml|webp);base64,(.+)$/s.exec(logo)
            if (!m) return sendJson(res, 200, { ok: false, error: '图标格式不支持（png / jpg / svg / webp）' })
            const ext = { png: '.png', jpeg: '.jpg', jpg: '.jpg', 'svg+xml': '.svg', webp: '.webp' }[m[1]]
            const logoFile = join(dirname(state.file), 'custom-logo' + ext)
            await mkdir(dirname(logoFile), { recursive: true })
            await writeFile(logoFile, Buffer.from(m[2], 'base64'))
            brand.logoPath = logoFile
          }

          await writeBrand(state.file, brand)
          await refresh()
          log('info', `dsh-brand-text: 已保存品牌 = ${state.brand.productName}`)
          return sendJson(res, 200, { ok: true, logoPath: state.brand.logoPath })
        } catch (e) {
          return sendJson(res, 200, { ok: false, error: String((e && e.message) || e) })
        }
      }
    }),
    'dsh-brand-text: save api'
  )

  // 6) ② 水印保存（页面水印那几个字段）
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE + '/api/watermark',
      handler: async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
        let data
        try {
          data = JSON.parse((await readBody(req)) || '{}')
        } catch (e) {
          return sendJson(res, 400, { ok: false, error: '请求解析失败: ' + e.message })
        }
        try {
          const merged = normalizeWatermark({ ...state.brand.watermark, ...data })
          const brand = { ...state.brand, watermark: merged }
          await writeBrand(state.file, brand)
          await refresh()
          return sendJson(res, 200, { ok: true, watermark: state.brand.watermark })
        } catch (e) {
          return sendJson(res, 200, { ok: false, error: String((e && e.message) || e) })
        }
      }
    }),
    'dsh-brand-text: watermark api'
  )

  // 7) ② -b 文件/文件夹贴标：新增 / 撤标
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE + '/api/watermark/target',
      handler: async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
        let data
        try {
          data = JSON.parse((await readBody(req)) || '{}')
        } catch (e) {
          return sendJson(res, 400, { ok: false, error: '请求解析失败: ' + e.message })
        }
        const path = String(data.path || '').trim()
        if (!path) return sendJson(res, 200, { ok: false, error: '路径为空' })
        try {
          const brand = { ...state.brand }
          const wm = { ...brand.watermark }
          const list = (wm.targets || []).slice()

          if (data.remove === true) {
            const r = await unmarkTargetFs(path)
            wm.targets = list.filter((t) => t.path !== path)
            brand.watermark = normalizeWatermark(wm)
            await writeBrand(state.file, brand)
            await refresh()
            return sendJson(res, 200, { ok: true, detail: r.detail })
          }

          const entry = {
            path,
            purpose: String(data.purpose || '').trim() || wm.note || '',
            task: String(data.task || '').trim() || wm.task || '',
            at: stamp(),
            marked: true
          }
          const r = await markTargetFs(entry, brand.logoPath)
          const at = list.findIndex((t) => t.path === path)
          if (at === -1) list.push(entry)
          else list[at] = { ...list[at], ...entry }
          wm.targets = list
          brand.watermark = normalizeWatermark(wm)
          await writeBrand(state.file, brand)
          await refresh()
          return sendJson(res, 200, { ok: true, detail: r.detail })
        } catch (e) {
          return sendJson(res, 200, { ok: false, error: String((e && e.message) || e) })
        }
      }
    }),
    'dsh-brand-text: watermark target api'
  )

  // 8) 打开台账里的目录（只认台账里登记过的路径）
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE + '/api/open',
      handler: async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
        let data = {}
        try {
          data = JSON.parse((await readBody(req, 64 * 1024)) || '{}')
        } catch {
          /* ignore */
        }
        const path = String(data.path || '').trim()
        const known = (state.brand.watermark.targets || []).some((t) => t.path === path)
        if (!known) return sendJson(res, 200, { ok: false, error: '该路径不在台账里，拒绝打开' })
        execFile('explorer', [path], { windowsHide: true }, () => {})
        return sendJson(res, 200, { ok: true })
      }
    }),
    'dsh-brand-text: open api'
  )

  // 9) 水印 SVG：不带参数 = 当前配置；带参数 = 面板实时预览
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE + '/watermark.svg',
      handler: (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed')
        const q = queryOf(req)
        const over = {}
        for (const k of ['text', 'task', 'note', 'opacity', 'angle', 'scale', 'repeat', 'color', 'enabled', 'onPage']) {
          if (!q.has(k)) continue
          const v = q.get(k)
          if (k === 'repeat' || k === 'enabled' || k === 'onPage') over[k] = v === '1' || v === 'true'
          else if (['opacity', 'angle', 'scale'].includes(k)) over[k] = Number(v)
          else over[k] = v
        }
        const wm = normalizeWatermark({ ...state.brand.watermark, ...over })
        const svg = buildWatermarkSvg(wm, state.brand.productName)
        if (!svg) return send(res, 404, 'no watermark text')
        send(res, 200, svg, 'image/svg+xml; charset=utf-8')
      }
    }),
    'dsh-brand-text: watermark svg'
  )

  // 10) 说明卡（下载/打印用）
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE + '/watermark-card.svg',
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed')
        const logo = await readLogo(state.brand.logoPath)
        send(res, 200, buildCardSvg(state.brand.watermark, state.brand, logo ? logo.dataHref : ''), 'image/svg+xml; charset=utf-8')
      }
    }),
    'dsh-brand-text: watermark card'
  )

  // 11) 品牌资源：logo 原图 / 方形图标 / manifest
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE + '/logo',
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed')
        const logo = await readLogo(state.brand.logoPath)
        if (!logo) return send(res, 404, 'no logo')
        send(res, 200, req.method === 'HEAD' ? Buffer.alloc(0) : logo.bytes, logo.contentType)
      }
    }),
    'dsh-brand-text: logo route'
  )

  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE + '/mark.svg',
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed')
        const logo = await readLogo(state.brand.logoPath)
        if (!logo) return send(res, 404, 'no logo')
        send(res, 200, renderMarkSvg(logo.dataHref), 'image/svg+xml')
      }
    }),
    'dsh-brand-text: mark route'
  )

  ctx.effect(
    () => ctx.webServer.register({
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
    }),
    'dsh-brand-text: manifest route'
  )
}

export { inject, apply }

// 便于外部查看配置路径（调试用）
export { resolveConfigPath, GLOBAL_KEY, ROUTE, isoDay }
