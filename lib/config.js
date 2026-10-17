// dsh-brand-text —— 配置层（第一组功能：基础品牌）
//
// 只负责一件事：把 brand.json 读成一份稳定的内存态，并在保存时原子写回。
// 文件里既有「基本品牌」字段，也有「水印」字段，但水印的渲染/贴标逻辑在
// lib/watermark.js，这里只做读写与归一化，不掺业务。
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
export const VERSION = '0.4.0'

/** 设置面板与品牌资源的统一前缀（与 DSH 同源，不需要额外端口/令牌） */
export const ROUTE = '/brand-studio'
/** 注入给浏览器端的全局变量名（客户端 bundle 读它） */
export const GLOBAL_KEY = '__DSH_BRAND_STUDIO__'

/** 中性默认值：插件本身不绑定任何公司/项目 */
export const DEFAULT_PRODUCT = 'DeepSeek Harness'
export const DEFAULT_LOGO_NAME = 'brand-logo.png'

export const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

// ------------------------------------------------------------------ 水印默认值
export const DEFAULT_WATERMARK = {
  enabled: false,
  // 水印主文字：留空则取左上角文字
  text: '',
  // 在干什么活
  task: '',
  // 为什么加（给文件/文件夹贴标时的用途说明）
  note: '',
  // 透明度 0~1（页面水印层）
  opacity: 0.16,
  // 倾斜角度（度）
  angle: -20,
  // 字号倍率
  scale: 1,
  // 平铺 or 只在正中放一个
  repeat: true,
  // 颜色
  color: '#ffffff',
  // 贴到 DSH 页面上的开关（关掉就只在文件/文件夹上留标）
  onPage: true,
  // 文件/文件夹台账
  targets: []
}

function clamp(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function normalizeWatermark(raw) {
  const w = raw && typeof raw === 'object' ? raw : {}
  const targets = Array.isArray(w.targets) ? w.targets : []
  return {
    enabled: w.enabled === true,
    text: String(w.text || '').trim(),
    task: String(w.task || '').trim(),
    note: String(w.note || '').trim(),
    opacity: clamp(w.opacity, 0.03, 0.9, DEFAULT_WATERMARK.opacity),
    angle: clamp(w.angle, -80, 80, DEFAULT_WATERMARK.angle),
    scale: clamp(w.scale, 0.5, 3, DEFAULT_WATERMARK.scale),
    repeat: w.repeat !== false,
    color: /^#[0-9a-fA-F]{6}$/.test(String(w.color || '')) ? String(w.color) : DEFAULT_WATERMARK.color,
    onPage: w.onPage !== false,
    targets: targets
      .filter((t) => t && typeof t === 'object' && typeof t.path === 'string' && t.path.trim())
      .map((t) => ({
        path: t.path.trim(),
        purpose: String(t.purpose || '').trim(),
        task: String(t.task || '').trim(),
        at: String(t.at || '').trim(),
        marked: t.marked === true
      }))
  }
}

// ------------------------------------------------------------------ 品牌读写
export function resolveConfigPath(configPath) {
  const raw = typeof configPath === 'string' ? configPath.trim() : ''
  if (!raw) return join(PLUGIN_DIR, 'brand.json')
  return raw
}

export function normalize(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  return {
    productName: String(data.productName || DEFAULT_PRODUCT).trim() || DEFAULT_PRODUCT,
    // 留空 = 不替换官方中央文案
    heroText: String(data.heroText || '').trim(),
    logoPath: String(data.logoPath || '').trim(),
    watermark: normalizeWatermark(data.watermark)
  }
}

export async function readBrand(file) {
  let raw = {}
  try {
    raw = JSON.parse(await readFile(file, 'utf8'))
  } catch {
    // 首次安装：文件不存在属正常，用默认值
  }
  const brand = normalize(raw)
  if (!brand.logoPath) brand.logoPath = join(dirname(file), DEFAULT_LOGO_NAME)
  return brand
}

export async function writeBrand(file, brand) {
  const payload = {
    productName: brand.productName,
    heroText: brand.heroText,
    logoPath: brand.logoPath,
    watermark: brand.watermark,
    _说明:
      '由 DSH「品牌设置」面板（/brand-studio/）写入。' +
      '[基本] productName=左上角文字与浏览器标题；heroText=中央（空会话）文字，留空用官方默认；logoPath=左上角图标。' +
      '[水印] watermark.enabled=总开关；text=水印主文字；task=在干什么活；note=为什么加；opacity=透明度；targets=已贴标的文件/文件夹台账。'
  }
  await mkdir(dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  await writeFile(tmp, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  await rename(tmp, file)
}

/** 读 logo 文件 -> { bytes, contentType, dataHref }（读不到就返回 null） */
export async function readLogo(logoPath) {
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
export async function buildState(configPath) {
  const file = resolveConfigPath(configPath)
  const brand = await readBrand(file)
  const logo = await readLogo(brand.logoPath)
  return { file, brand, logo }
}
