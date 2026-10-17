// dsh-brand-text —— 设置面板页面（/brand-studio/）
//
// 分区原则：**基本功能在前，新功能在后。**
//   ① 基本设置 —— 左上角 Logo / 左上角文字 / 中央标题（插件的本职）
//   ② 水印     —— 新功能：页面水印 + 文件/文件夹贴标
import { DEFAULT_PRODUCT, PLUGIN_DIR, ROUTE, VERSION, escapeHtml } from './config.js'

const PANEL_CSS = `
:root{--bg:#0f1419;--card:#171d26;--line:#2a3441;--fg:#e6edf3;--dim:#8b98a5;--pri:#1a7f5a;--pri2:#2ea36f;--new:#5b6fd8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 "Microsoft YaHei",system-ui,sans-serif}
.wrap{max-width:820px;margin:0 auto;padding:32px 20px 60px}
h1{font-size:20px;margin:0 0 4px}p.sub{color:var(--dim);margin:0 0 24px;font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin-bottom:16px}
.card h2{font-size:15px;margin:0 0 14px;display:flex;align-items:center;gap:8px}
.tag{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--line);color:var(--dim)}
.tag.new{color:#a9b6ff;border-color:#3a4680;background:#1b2140}
label{display:block;font-size:13px;color:var(--dim);margin:0 0 6px}
input[type=text]{width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:#0d1218;color:var(--fg);font-size:15px;outline:none}
input[type=text]:focus{border-color:var(--pri2)}
input[type=range]{width:100%;accent-color:var(--pri2)}
.hint{color:var(--dim);font-size:12px;margin:6px 0 0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.logo-row{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.preview{width:72px;height:72px;border-radius:12px;background:#0d1218;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;overflow:hidden}
.preview img{max-width:56px;max-height:56px}
button{cursor:pointer;border:0;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:600}
.btn-pri{background:var(--pri);color:#fff}.btn-pri:hover{background:var(--pri2)}
.btn-new{background:var(--new);color:#fff}.btn-new:hover{filter:brightness(1.12)}
.btn-ghost{background:transparent;color:var(--fg);border:1px solid var(--line)}
.btn-sm{padding:6px 12px;font-size:12px;font-weight:500}
.btn-danger{background:transparent;color:#f85149;border:1px solid #5a2b2b}
.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
#msg,#wmMsg,#tMsg{margin-top:14px;font-size:13px;min-height:20px}
.ok{color:#3fb950}.err{color:#f85149}.warn{color:#d29922}
code{background:#0d1218;border:1px solid var(--line);border-radius:5px;padding:1px 6px;font-size:12px;word-break:break-all}
.meta td{padding:5px 0;border-bottom:1px dashed var(--line);font-size:12px;color:var(--dim);vertical-align:top}
.meta td:first-child{width:110px;white-space:nowrap}
.wmprev{height:150px;border-radius:10px;border:1px solid var(--line);background:#0d1218;background-size:auto;overflow:hidden;margin-top:10px}
table.led{width:100%;border-collapse:collapse;font-size:12px}
table.led th{text-align:left;color:var(--dim);font-weight:500;padding:6px 8px;border-bottom:1px solid var(--line)}
table.led td{padding:8px;border-bottom:1px dashed var(--line);vertical-align:top;word-break:break-all}
.switch{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dim);margin-bottom:10px}
.switch input{width:16px;height:16px;accent-color:var(--pri2)}
`

const PANEL_JS = `
var ROUTE = "${ROUTE}";
var logoDataUrl = null;
function $(id){ return document.getElementById(id); }
function msg(id, t, kind){ var m=$(id); if(!m) return; m.textContent=t; m.className = kind || ''; }

// ---------------------------------------------------------------- ① 基本设置
async function load(){
  var r = await fetch(ROUTE + '/api/config'); var d = await r.json();
  $('productName').value = d.productName || '';
  $('heroText').value = d.heroText || '';
  $('logoImg').src = ROUTE + '/logo?ts=' + Date.now();
  $('logoPath').textContent = d.logoPath || '（未设置）';
  $('cfgPath').textContent = d.configPath || '';
  var w = d.watermark || {};
  $('wmEnabled').checked = !!w.enabled;
  $('wmText').value = w.text || '';
  $('wmTask').value = w.task || '';
  $('wmNote').value = w.note || '';
  $('wmOpacity').value = w.opacity != null ? w.opacity : 0.16;
  $('wmAngle').value = w.angle != null ? w.angle : -20;
  $('wmScale').value = w.scale != null ? w.scale : 1;
  $('wmRepeat').checked = w.repeat !== false;
  $('wmOnPage').checked = w.onPage !== false;
  renderTargets(w.targets || []);
  refreshPreview();
}
$('logoFile').addEventListener('change', async function(e){
  var f = e.target.files[0]; if(!f) return;
  var b64 = await new Promise(function(res){ var fr=new FileReader(); fr.onload=function(){res(fr.result)}; fr.readAsDataURL(f); });
  logoDataUrl = b64;
  $('logoImg').src = b64;
  msg('msg','已选择新图标，记得点「保存基本设置」', 'ok');
});
async function saveBrand(){
  var body = { productName: $('productName').value.trim(), heroText: $('heroText').value.trim(), logoDataUrl: logoDataUrl };
  msg('msg','保存中…','');
  var r = await fetch(ROUTE + '/api/save', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
  var d = await r.json();
  if(!d.ok){ msg('msg','保存失败：' + d.error, 'err'); return; }
  logoDataUrl = null;
  $('logoPath').textContent = d.logoPath || '（未设置）';
  msg('msg','已保存。回到 DSH 页面按 F5 刷新即可（不用重启）。', 'ok');
}

// ---------------------------------------------------------------- ② 水印
function refreshPreview(){
  var q = new URLSearchParams({
    text: $('wmText').value, task: $('wmTask').value,
    opacity: $('wmOpacity').value, angle: $('wmAngle').value,
    scale: $('wmScale').value, repeat: $('wmRepeat').checked ? '1' : '0',
    color: '#ffffff', ts: Date.now()
  });
  $('wmPreview').style.backgroundImage = 'url("' + ROUTE + '/watermark.svg?' + q.toString() + '")';
  $('wmPreview').style.backgroundRepeat = $('wmRepeat').checked ? 'repeat' : 'no-repeat';
  $('wmPreview').style.backgroundPosition = $('wmRepeat').checked ? '0 0' : 'center';
  $('wmOpacityVal').textContent = Number($('wmOpacity').value).toFixed(2);
  $('wmAngleVal').textContent = $('wmAngle').value + '°';
  $('wmScaleVal').textContent = Number($('wmScale').value).toFixed(1) + 'x';
}
['wmText','wmTask','wmOpacity','wmAngle','wmScale','wmRepeat'].forEach(function(id){
  $(id).addEventListener('input', refreshPreview);
});
async function saveWatermark(){
  var body = {
    enabled: $('wmEnabled').checked,
    text: $('wmText').value.trim(),
    task: $('wmTask').value.trim(),
    note: $('wmNote').value.trim(),
    opacity: Number($('wmOpacity').value),
    angle: Number($('wmAngle').value),
    scale: Number($('wmScale').value),
    repeat: $('wmRepeat').checked,
    onPage: $('wmOnPage').checked
  };
  msg('wmMsg','保存中…','');
  var r = await fetch(ROUTE + '/api/watermark', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
  var d = await r.json();
  if(!d.ok){ msg('wmMsg','保存失败：' + d.error, 'err'); return; }
  msg('wmMsg','已保存。回 DSH 按 F5：' + (body.enabled && body.onPage ? '页面上会浮出半透明水印。' : '水印层已关闭。'), 'ok');
}

// ---------------------------------------------------------------- ② -b 文件/文件夹贴标
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }
function renderTargets(list){
  var tb = $('tBody');
  if(!list.length){ tb.innerHTML = '<tr><td colspan="5" style="color:#8b98a5">还没有贴过标。下面填路径 + 用途 → 点「贴标」。</td></tr>'; return; }
  tb.innerHTML = list.map(function(t, i){
    return '<tr>' +
      '<td>' + esc(t.path) + '</td>' +
      '<td>' + esc(t.purpose || '—') + '</td>' +
      '<td>' + esc(t.task || '—') + '</td>' +
      '<td>' + esc(t.at || '—') + '</td>' +
      '<td style="white-space:nowrap"><button class="btn-sm btn-ghost" data-open="' + i + '">打开</button> ' +
      '<button class="btn-sm btn-danger" data-un="' + i + '">撤标</button></td></tr>';
  }).join('');
  tb.querySelectorAll('[data-open]').forEach(function(b){
    b.addEventListener('click', function(){ fetch(ROUTE + '/api/open', {method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({path: list[+b.dataset.open].path})}); });
  });
  tb.querySelectorAll('[data-un]').forEach(function(b){
    b.addEventListener('click', function(){ unmark(list[+b.dataset.un].path); });
  });
}
async function unmark(path){
  if(!confirm('撤掉这个标记？\\n' + path)) return;
  msg('tMsg','处理中…','');
  var r = await fetch(ROUTE + '/api/watermark/target', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({remove:true, path: path})});
  var d = await r.json();
  if(!d.ok){ msg('tMsg','失败：' + d.error, 'err'); return; }
  msg('tMsg','已撤标：' + (d.detail||[]).join('；'), 'ok');
  load();
}
async function mark(){
  var path = $('tPath').value.trim();
  if(!path){ msg('tMsg','先填路径','err'); return; }
  msg('tMsg','贴标中…','');
  var r = await fetch(ROUTE + '/api/watermark/target', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
    path: path, purpose: $('tPurpose').value.trim(), task: $('tTask').value.trim()
  })});
  var d = await r.json();
  if(!d.ok){ msg('tMsg','失败：' + d.error, 'err'); return; }
  msg('tMsg','已贴标：' + (d.detail||[]).join('；'), 'ok');
  $('tPath').value = ''; $('tPurpose').value = ''; $('tTask').value = '';
  load();
}
load();
`

export function renderPanel() {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>品牌设置 · DSH</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${PANEL_CSS}</style></head><body><div class="wrap">
<h1>DSH 品牌设置</h1>
<p class="sub">① 基本设置（Logo / 文字 / 中央标题）在前，② 水印（新功能）在后。改完保存，回 DSH 页面按 <b>F5</b> 即可，不用重启。</p>

<!-- ============================ ① 基本设置 ============================ -->
<div class="card">
  <h2>① 基本设置 <span class="tag">插件本职</span></h2>

  <label>左上角文字（同时是浏览器标签标题）</label>
  <input type="text" id="productName" placeholder="${escapeHtml(DEFAULT_PRODUCT)}">
  <p class="hint">显示在侧边栏最上方；浏览器标签页、PWA 名称也用它。</p>

  <div style="height:16px"></div>
  <label>中央标题（新建对话时页面正中间那句）</label>
  <input type="text" id="heroText" placeholder="留空则用 DSH 官方默认（探索未至之境）">
  <p class="hint">留空 = 不替换，保持官方文案。</p>

  <div style="height:16px"></div>
  <label>左上角图标 / Logo</label>
  <div class="logo-row">
    <div class="preview"><img id="logoImg" alt=""></div>
    <div>
      <input type="file" id="logoFile" accept="image/png,image/jpeg,image/svg+xml,image/webp">
      <p class="hint">当前文件：<span id="logoPath"></span></p>
      <p class="hint">建议正方形透明底 PNG。同时接管浏览器图标与 PWA 图标。</p>
    </div>
  </div>

  <div class="actions" style="margin-top:16px">
    <button class="btn-pri" onclick="saveBrand()">保存基本设置</button>
    <a class="btn-ghost" href="/" style="text-decoration:none;display:inline-block;padding:10px 18px">打开 DSH</a>
  </div>
  <div id="msg"></div>
  <p class="hint">也可以直接在 DSH 页面里<b>双击左上角品牌</b>或<b>双击中央标题</b>就地改。</p>
</div>

<!-- ============================ ② 水印 ============================ -->
<div class="card">
  <h2>② 水印 <span class="tag new">新功能</span></h2>
  <p class="hint" style="margin:0 0 14px">
    干嘛用：DSH 干活时对应的项目文件/文件夹，隔两周再开就忘了「为什么加」「那阵子在干什么活」。
    把这两句记下来 —— 叠在 DSH 页面上（透明度可调），也能贴到项目文件夹上。
  </p>

  <div class="switch"><input type="checkbox" id="wmEnabled"><label for="wmEnabled" style="margin:0;color:#e6edf3">启用水印</label></div>
  <div class="switch"><input type="checkbox" id="wmOnPage"><label for="wmOnPage" style="margin:0;color:#e6edf3">叠在 DSH 页面上（关掉则只在文件夹上贴标）</label></div>

  <div class="grid2">
    <div>
      <label>水印主文字（留空 = 用左上角文字）</label>
      <input type="text" id="wmText" placeholder="例如：某某项目 X 标段">
    </div>
    <div>
      <label>在干什么活</label>
      <input type="text" id="wmTask" placeholder="例如：10 月计量支付资料整理">
    </div>
  </div>
  <div style="height:14px"></div>
  <label>为什么加（用途说明，贴到文件夹时会一起写进去）</label>
  <input type="text" id="wmNote" placeholder="例如：业主 11 月初内业检查，先归集这批原始记录">

  <div style="height:16px"></div>
  <div class="grid2">
    <div><label>透明度 <span id="wmOpacityVal"></span></label><input type="range" id="wmOpacity" min="0.03" max="0.9" step="0.01"></div>
    <div><label>倾斜角度 <span id="wmAngleVal"></span></label><input type="range" id="wmAngle" min="-80" max="80" step="1"></div>
  </div>
  <div class="grid2" style="margin-top:12px">
    <div><label>字号 <span id="wmScaleVal"></span></label><input type="range" id="wmScale" min="0.5" max="3" step="0.1"></div>
    <div class="switch" style="margin-top:22px"><input type="checkbox" id="wmRepeat"><label for="wmRepeat" style="margin:0;color:#e6edf3">平铺（关掉则只在正中放一个）</label></div>
  </div>

  <div id="wmPreview" class="wmprev"></div>

  <div class="actions" style="margin-top:14px">
    <button class="btn-new" onclick="saveWatermark()">保存水印</button>
    <a class="btn-ghost" href="${ROUTE}/watermark-card.svg" target="_blank" rel="noopener" style="text-decoration:none;display:inline-block;padding:10px 18px">下载说明卡（SVG）</a>
  </div>
  <div id="wmMsg"></div>
</div>

<!-- ============================ ② -b 文件/文件夹台账 ============================ -->
<div class="card">
  <h2>② -b 文件 / 文件夹贴标 <span class="tag new">新功能</span></h2>
  <p class="hint" style="margin:0 0 12px">
    填一个项目路径 + 用途，点「贴标」：目录里会写一份 <code>_DSH水印说明.md</code>，
    资源管理器<b>悬停该文件夹</b>就能看到「用途 / 在干什么活」，图标换成品牌徽标。
    <span class="warn">（会给该目录加「系统」属性，资源管理器可能要 F5 才刷新）</span>
  </p>

  <table class="led"><thead><tr><th>路径</th><th>用途（为什么加）</th><th>在干什么活</th><th>时间</th><th>操作</th></tr></thead>
  <tbody id="tBody"></tbody></table>

  <div style="height:16px"></div>
  <label>项目路径（文件夹优先；单个文件则只在旁边留说明）</label>
  <input type="text" id="tPath" placeholder="D:\\projects\\…\\2026-10 计量支付">
  <div class="grid2" style="margin-top:12px">
    <div><label>用途（为什么加）</label><input type="text" id="tPurpose" placeholder="留空则用水印里的「为什么加」"></div>
    <div><label>在干什么活</label><input type="text" id="tTask" placeholder="留空则用水印里的「在干什么活」"></div>
  </div>
  <div class="actions" style="margin-top:14px">
    <button class="btn-new" onclick="mark()">贴标</button>
  </div>
  <div id="tMsg"></div>
</div>

<!-- ============================ 信息 ============================ -->
<div class="card">
  <h2>插件信息</h2>
  <table class="meta">
    <tr><td>配置数据</td><td><span id="cfgPath"></span></td></tr>
    <tr><td>插件目录</td><td><code>${escapeHtml(PLUGIN_DIR)}</code></td></tr>
    <tr><td>版本</td><td>dsh-brand-text v${VERSION}（① 基本品牌 + ② 水印）</td></tr>
    <tr><td>重复安装</td><td><code>node install.mjs --profile "&lt;profile 目录&gt;"</code></td></tr>
  </table>
</div>
</div>
<script>${PANEL_JS}</script></body></html>`
}
