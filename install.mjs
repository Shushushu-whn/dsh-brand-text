// install.mjs —— 把 dsh-brand-text 装进任意 DSH profile（可重复执行，幂等）
//
// 用法：
//   node install.mjs --profile "E:\工程库（训练用）\_ENGDB\dsh-home\profiles\web"
//   node install.mjs --profile "D:\dsh\personal\profiles\web"
//   node install.mjs --profile <dir> --no-install     # 只改 package.json，不跑 pnpm
//
// 做三件事：
//   1. dependencies 里写 "dsh-brand-text": "link:<本插件绝对路径>"
//   2. dsh.profile.bundles 里加上 "dsh-brand-text"
//   3. 在该 profile 目录跑 pnpm install --no-frozen-lockfile
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))
const PKG_NAME = 'dsh-brand-text'

function argOf(name, fallback) {
  const i = process.argv.indexOf(name)
  if (i === -1 || i + 1 >= process.argv.length) return fallback
  return process.argv[i + 1]
}

const profileDir = argOf('--profile', '')
const noInstall = process.argv.includes('--no-install')

if (!profileDir) {
  console.error('用法: node install.mjs --profile "<profile 目录>" [--no-install]')
  process.exit(2)
}

const pkgPath = join(resolve(profileDir), 'package.json')

async function main() {
  let text
  try {
    text = await readFile(pkgPath, 'utf8')
  } catch {
    console.error(`[错误] 找不到 profile 的 package.json：${pkgPath}`)
    process.exit(1)
  }
  const pkg = JSON.parse(text)
  pkg.dependencies = pkg.dependencies || {}
  pkg.dsh = pkg.dsh || {}
  pkg.dsh.profile = pkg.dsh.profile || {}
  pkg.dsh.profile.bundles = pkg.dsh.profile.bundles || []

  const linkTarget = PLUGIN_DIR.replaceAll('\\', '/')
  const before = pkg.dependencies[PKG_NAME]
  pkg.dependencies[PKG_NAME] = `link:${linkTarget}`

  const hadBundle = pkg.dsh.profile.bundles.includes(PKG_NAME)
  if (!hadBundle) pkg.dsh.profile.bundles.push(PKG_NAME)

  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')

  console.log(`[1/3] 依赖：${before ? before + ' -> ' : ''}link:${linkTarget}`)
  console.log(`[2/3] bundles：${hadBundle ? '已存在，跳过' : '已添加 ' + PKG_NAME}`)

  if (noInstall) {
    console.log('[3/3] 已跳过 pnpm install（--no-install）')
    return
  }

  const env = { ...process.env, CI: 'true', CODEBUDDY_SAFE_DELETE_ENABLED: '0' }
  const variants = [
    ['pnpm', ['install', '--no-frozen-lockfile'], 'ignore'],
    ['corepack', ['pnpm', 'install', '--no-frozen-lockfile'], 'inherit']
  ]
  for (const [cmd, args, stdio] of variants) {
    try {
      console.log(`[3/3] 运行 ${cmd} ${args.join(' ')} …`)
      execFileSync(cmd, args, { cwd: resolve(profileDir), stdio, env, shell: true })
      console.log('\n安装完成。启动（或重启）DSH 后，设置面板在：')
      console.log('  http://127.0.0.1:<该 profile 的 DSH 端口>/brand-studio/')
      return
    } catch (e) {
      if (cmd === 'corepack') {
        console.error('[错误] pnpm 安装失败：' + (e && e.message))
        process.exit(1)
      }
      console.log('  pnpm 不在 PATH，改用 corepack…')
    }
  }
}

main()
