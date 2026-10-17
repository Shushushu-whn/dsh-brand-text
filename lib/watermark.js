// dsh-brand-text —— 水印层（第二组功能：新功能）
//
// 为什么要在 DSH 里做水印？
//   照片水印只是其中一半。另一半更常用：DSH 干活时对应的那批项目文件/文件夹，
//   过两周再打开就忘了「当时为什么加进来」「那阵子在干什么活」。
//   这里把这两句记下来，做成两种可见形式：
//     A. 页面水印 —— DSH 页面上叠一层半透明斜向文字，透明度可调，打开就看见；
//     B. 文件/文件夹贴标 —— 把同样的说明写进项目目录（说明文件 + 资源管理器
//        悬停提示 InfoTip + 可选图标），在 DSH 之外也认得出来。
//
// 本文件只负责"生成"与"贴标"，配置读写在 lib/config.js。
import { readFile, writeFile, unlink, stat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { basename, dirname, extname, join } from 'node:path'

// 贴标时写进目标目录的文件名（ASCII，避免 cmd/OEM 环境下的编码坑）
const MARK_INI = 'desktop.ini'
const MARK_ICO = 'dsh-mark.ico'
const MARK_BAK = 'desktop.ini.dshbak'
/** 目录说明文件（中文名，方便人直接认出来） */
const MARK_NOTE_DIR = '_DSH水印说明.md'
const MARK_TAG = 'dsh-brand-text'

const FONT = "'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',system-ui,sans-serif"

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`
}

function isoDay(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

/** 粗估文本宽度：中日韩字符按 1 个字宽，其余按 0.55 */
function estimateWidth(text, fontSize) {
  let w = 0
  for (const ch of String(text)) {
    const c = ch.codePointAt(0)
    const cjk =
      (c >= 0x2e80 && c <= 0x9fff) ||
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xff00 && c <= 0xff60)
    w += fontSize * (cjk ? 1 : 0.55)
  }
  return w
}

// ------------------------------------------------------------------ A. 页面水印
/**
 * 生成一块可平铺的水印 SVG。
 * @param {object} wm 归一化后的水印配置
 * @param {string} productName 左上角文字（wm.text 留空时的兜底）
 */
export function buildWatermarkSvg(wm, productName) {
  const main = String(wm.text || productName || '').trim()
  const task = String(wm.task || '').trim()
  const lines = []
  if (main) lines.push({ text: main, size: Math.round(26 * (wm.scale || 1)) })
  if (task) lines.push({ text: task, size: Math.max(13, Math.round(26 * (wm.scale || 1) * 0.6)) })
  if (!lines.length) return ''

  const gap = 10
  const totalH = lines.reduce((s, l) => s + l.size * 1.3, 0) + (lines.length - 1) * gap
  const maxW = Math.max(...lines.map((l) => estimateWidth(l.text, l.size)))
  // 旋转后需要更大的画布，否则字会被切掉
  const rad = (Math.abs(wm.angle || 0) * Math.PI) / 180
  const tw = Math.ceil(maxW * Math.cos(rad) + totalH * Math.sin(rad)) + 140
  const th = Math.ceil(maxW * Math.sin(rad) + totalH * Math.cos(rad)) + 140

  const cx = tw / 2
  const cy = th / 2
  let y = cy - totalH / 2
  const body = lines
    .map((l, i) => {
      const baseline = y + l.size
      y += l.size * 1.3 + gap
      return `<text x="${cx}" y="${baseline.toFixed(1)}" font-family="${FONT}" font-size="${l.size}" font-weight="${i === 0 ? 700 : 500}" text-anchor="middle" fill="${wm.color}" fill-opacity="0.95" stroke="rgba(0,0,0,.45)" stroke-width="0.8" paint-order="stroke">${escapeXml(l.text)}</text>`
    })
    .join('\n    ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}" viewBox="0 0 ${tw} ${th}">
  <g transform="rotate(${wm.angle} ${cx} ${cy})">
    ${body}
  </g>
</svg>`
}

/** 导出用的一张"水印说明卡"（可下载 / 打印 / 贴到照片上） */
export function buildCardSvg(wm, brand, logoHref) {
  const W = 720
  const H = 300
  const main = String(wm.text || brand.productName || '').trim()
  const task = String(wm.task || '').trim()
  const note = String(wm.note || '').trim()
  const rows = []
  rows.push({ k: '用途 / 为什么加', v: note || main })
  rows.push({ k: '在干什么活', v: task || '（未填写）' })
  rows.push({ k: '记录时间', v: stamp() })
  let y = 92
  const body = rows
    .map((r) => {
      const out = `<text x="220" y="${y}" font-family="${FONT}" font-size="14" fill="#7d8996">${escapeXml(r.k)}</text>
    <text x="220" y="${y + 24}" font-family="${FONT}" font-size="17" font-weight="600" fill="#e6edf3">${escapeXml(r.v)}</text>`
      y += 58
      return out
    })
    .join('\n    ')
  const logo = logoHref
    ? `<image href="${escapeXml(logoHref)}" x="40" y="44" width="140" height="140" preserveAspectRatio="xMidYMid meet"/>`
    : `<rect x="40" y="44" width="140" height="140" rx="20" fill="#1f2937"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="18" fill="#141a22" stroke="#2a3441"/>
  ${logo}
  <text x="220" y="66" font-family="${FONT}" font-size="20" font-weight="700" fill="#ffffff">${escapeXml(main || 'DSH 水印')}</text>
    ${body}
</svg>`
}

// ------------------------------------------------------------------ B. 文件/文件夹贴标
function noteText(target) {
  return [
    '# DSH 水印说明',
    '',
    `- 对象：\`${target.path}\``,
    `- 用途（为什么加）：${target.purpose || '（未填写）'}`,
    `- 在干什么活：${target.task || '（未填写）'}`,
    `- 记录时间：${target.at || stamp()}`,
    `- 由插件：dsh-brand-text（${MARK_TAG}）写入`,
    '',
    '> 这个文件可以直接删；要连资源管理器上的标记一起撤掉，',
    '> 去 DSH 的 /brand-studio/ → 水印 → 台账里点「撤标」。',
    ''
  ].join('\n')
}

/** 把 PNG 包成 Vista+ 支持的 PNG-in-ICO */
function pngToIco(png) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry.writeUInt8(0, 0) // width 256
  entry.writeUInt8(0, 1) // height 256
  entry.writeUInt8(0, 2) // color count
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(22, 12)
  return Buffer.concat([header, entry, png])
}

async function readIcoSource(logoPath) {
  if (!logoPath || extname(logoPath).toLowerCase() !== '.png') return null
  try {
    const buf = await readFile(logoPath)
    if (buf.length > 2 * 1024 * 1024) return null
    return buf
  } catch {
    return null
  }
}

function runAttrib(args) {
  return new Promise((resolve) => {
    execFile('attrib', args, { windowsHide: true }, (err) => resolve(err ? String(err.message) : ''))
  })
}

/**
 * 把一次"用途 / 在干什么活"写进目标（目录优先）。
 * @returns {Promise<{ok:boolean, detail:string[]}>}
 */
export async function markTargetFs(target, logoPath) {
  const p = target.path
  const info = await stat(p)
  const isDir = info.isDirectory()
  const dir = isDir ? p : dirname(p)
  const noteName = isDir ? MARK_NOTE_DIR : `${basename(p)}.DSH水印说明.md`
  const notePath = join(dir, noteName)
  const detail = [`说明文件：${notePath}`]

  await writeFile(notePath, noteText(target), 'utf8')

  if (!isDir) {
    // 单个文件改不了图标，只留说明文件（台账里仍可查）
    return { ok: true, detail }
  }

  // 1) 图标（用品牌 logo 当徽标，PNG 才行）
  const png = await readIcoSource(logoPath)
  if (png) {
    await writeFile(join(p, MARK_ICO), pngToIco(png))
    detail.push(`图标：${join(p, MARK_ICO)}`)
  }

  // 2) desktop.ini：资源管理器悬停就能看到"为什么加 / 在干什么活"
  const tip = `【DSH 水印】用途：${target.purpose || '未填写'} ｜ 在做：${target.task || '未填写'} ｜ ${target.at || isoDay()}`
  const ini =
    `[.ShellClassInfo]\r\n` +
    `InfoTip=${tip}\r\n` +
    (png ? `IconFile=${MARK_ICO}\r\nIconIndex=0\r\n` : '') +
    `; written by ${MARK_TAG}\r\n`
  const iniPath = join(p, MARK_INI)
  try {
    const old = await readFile(iniPath)
    await writeFile(join(p, MARK_BAK), old)
    detail.push(`原 ${MARK_INI} 已备份为 ${MARK_BAK}`)
  } catch {
    // 原本没有 desktop.ini
  }
  // Windows 资源管理器读 UTF-16LE（带 BOM）的 desktop.ini
  await writeFile(iniPath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(ini, 'utf16le')]))

  // 3) 让资源管理器真的去读它
  const e1 = await runAttrib(['+h', '+s', iniPath])
  const e2 = await runAttrib(['+s', p])
  if (e1 || e2) {
    detail.push(`（attrib 未生效：${e1 || e2}——悬停提示可能不显示，说明文件仍然可用）`)
  } else {
    detail.push('资源管理器：悬停可看说明，图标已换成徽标')
  }
  return { ok: true, detail }
}

/** 撤掉贴标，尽量还原现场 */
export async function unmarkTargetFs(path) {
  const info = await stat(path).catch(() => null)
  const detail = []
  if (info && info.isDirectory()) {
    for (const f of [MARK_INI, MARK_ICO, MARK_NOTE_DIR]) {
      try {
        await unlink(join(path, f))
        detail.push(`已删 ${f}`)
      } catch {
        /* 本来就没有 */
      }
    }
    try {
      const bak = await readFile(join(path, MARK_BAK))
      await writeFile(join(path, MARK_INI), bak)
      await unlink(join(path, MARK_BAK))
      detail.push(`已还原原 ${MARK_INI}`)
    } catch {
      /* 没有备份 */
    }
    await runAttrib(['-s', path])
  } else {
    const dir = dirname(path)
    for (const f of [MARK_NOTE_DIR, `${basename(path)}.DSH水印说明.md`]) {
      try {
        await unlink(join(dir, f))
        detail.push(`已删 ${f}`)
      } catch {
        /* 本来就没有 */
      }
    }
  }
  return { ok: true, detail }
}

export { MARK_TAG, stamp, isoDay }
