import { drawFishPixel, PALETTES } from './sprites.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = {
  ocean: '<path d="M2 9c3-4 5 4 8 0s5 4 8 0 4 0 4 0M2 15c3-4 5 4 8 0s5 4 8 0 4 0 4 0"/>',
  fish: '<path d="M6 12c4-7 11-7 15 0-4 7-11 7-15 0ZM6 12 2 7v10Z"/><circle cx="16" cy="10.5" r=".7" fill="currentColor" stroke="none"/>',
  journal: '<path d="M5 3h14v18H5zM9 7h6M9 11h6M9 15h4M3 7h3M3 12h3M3 17h3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4ZM17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4ZM17 9l5 6M22 9l-5 6"/>',
  next: '<path d="m9 5 7 7-7 7M20 5v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  heart: '<path d="M12 20S2 14 2 7.5C2 2 9 2 12 6c3-4 10-4 10 1.5C22 14 12 20 12 20Z"/>',
  link: '<path d="m9 15 6-6M7 13l-2 2a4 4 0 0 0 6 6l3-3M10 6l3-3a4 4 0 0 1 6 6l-2 2"/>',
  spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  file: '<path d="M5 2h9l5 5v15H5ZM14 2v6h5M9 12h6M9 16h6"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  food: '<path d="M5 5c3 4 11 4 14 0M5 5v7a7 7 0 0 0 14 0V5M8 2v3M12 1v4M16 2v3"/>',
  storm: '<path d="M5 15a5 5 0 1 1 2-9 6 6 0 0 1 11 2 4 4 0 0 1 1 8M13 12l-4 6h5l-3 5"/>',
  fight: '<path d="m4 3 8 8M20 3l-8 8M4 3v5l4-1M20 3v5l-4-1M5 20l6-7M19 20l-6-7M3 17l5 4M21 17l-5 4"/>',
  whale: '<path d="M3 12c2 2 4 3 7 2V7c1-3 3-3 4 0v7c4 0 6-3 8-6v6c-2 5-7 7-13 5-5 0-7-4-6-7ZM11 3l-2-2M15 3l2-2"/>',
  net: '<path d="M3 4h18L18 19H6ZM3 4l15 15M9 4l10 10M15 4l5 5M21 4 6 19M15 4 5 14M9 4 4 9"/>',
  sleep: '<path d="M17 3A9 9 0 1 0 21 17 9 9 0 0 1 17 3ZM6 5h5L6 10h5M16 10h4l-4 4h4"/>',
  current: '<path d="M2 6h15l-3-3M2 12h20l-3-3M2 18h15l-3-3"/>',
  hatch: '<path d="M12 2C9 2 4 10 4 15a8 8 0 0 0 16 0C20 10 15 2 12 2ZM5 12l5 3 3-5 6 4"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.spark}</svg>`;
const regions = ['浅滩', '珊瑚城', '深水区', '沉船带'];
const regionEnglish = ['THE SHALLOWS', 'CORAL CITY', 'THE DEEP', 'SHIPWRECK COAST'];
const eventTypes = [['出海', 'compass'], ['吵架', 'fight'], ['鲸落', 'whale'], ['风暴', 'storm'], ['渔民', 'net'], ['入睡', 'sleep'], ['新生', 'hatch'], ['洋流', 'current'], ['觅食', 'food']];
const reviews = ['本期只有模拟居民；真实用户若入镜，已获同意或完成脱敏', '品牌与广告元素已检查，有商业合作时添加广告标识', '发布时将勾选“内容由 AI 生成”', '远征名单与反悔期已核对，真实参与者须提前公示', '已检查文案，避免不当表述'];
const state = { world: null, episode: null, status: null, files: [], page: 'ocean', region: '浅滩', selected: null, busy: false, sound: false, audio: null, scene: null, visualEvent: null, query: '', residentRegion: '全部', residentStatus: '全部', renderJob: null, poll: null };

async function api(path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(path, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || `请求失败（${response.status}）`);
  return data;
}
function toast(message, error = false) {
  const el = document.createElement('div'); el.className = `toast${error ? ' error' : ''}`; el.textContent = message; $('#toast-region').append(el); setTimeout(() => el.remove(), error ? 6500 : 4200);
}
const currentFish = () => (state.world?.residents || []).map(r => state.world.fish.find(f => f.id === r.currentFishId)).filter(Boolean);
const aliveFish = () => currentFish().filter(f => f.status === 'alive');
const fishByResident = id => currentFish().find(f => f.residentId === id || f.id === id);
const residentName = id => state.world.residents.find(r => r.id === id)?.name || id;
const fishId = f => f?.residentId || f?.id;
const generationName = n => n === 1 ? '初代居民' : `第 ${n} 世 · 归来者`;
const average = key => Math.round(aliveFish().reduce((sum, f) => sum + (f[key] || 0), 0) / (aliveFish().length || 1));
function getLogs(id, limit = 5) { return (state.world.actionLog || []).filter(l => !id || l.fishId === id || l.fishIds?.includes(id)).slice().reverse().slice(0, limit); }
function getSelected() { return fishByResident(state.selected) || aliveFish()[0] || currentFish()[0]; }

function renderNavigation() {
  $('#navigation').innerHTML = [['ocean', 'ocean', '海洋'], ['residents', 'fish', '居民'], ['episode', 'journal', '纪事'], ['expeditions', 'compass', '远征']].map(([page, glyph, label]) => `<button class="nav-button${state.page === page ? ' active' : ''}" data-nav="${page}" aria-label="${label}" ${state.page === page ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span></button>`).join('');
  $('#sound-toggle').innerHTML = icon(state.sound ? 'sound' : 'mute');
  $('#sound-toggle').setAttribute('aria-label', state.sound ? '关闭海洋声音' : '开启海洋声音');
  $('#sound-toggle').setAttribute('aria-pressed', String(state.sound));
}
function render() {
  state.scene = null;
  renderNavigation();
  $('#world-date').textContent = `海洋历 · 第 ${String(state.world.day).padStart(3, '0')} 天`;
  $('#main').innerHTML = state.page === 'residents' ? residentsPage() : state.page === 'episode' ? episodePage() : state.page === 'expeditions' ? expeditionsPage() : oceanPage();
  drawPortraits();
  if (state.page === 'ocean') setupOcean();
  if (state.page === 'episode' && !state.episode) loadEpisode();
}
function heading(eyebrow, title, subtitle, buttons = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="heading-actions">${buttons}</div></div>`;
}
function advanceButton() { return `<button class="button primary" data-action="advance" id="advance-day" ${state.busy ? 'disabled' : ''}>${icon('next')}推进一天</button>`; }
function sprite(fish, width = 112, height = 72, extra = '') {
  return fish ? `<canvas width="${width}" height="${height}" data-fish-sprite="${esc(fish.id)}" ${extra} aria-label="${esc(fish.name)}的像素形象" role="img"></canvas>` : '';
}
function drawPortraits(root = document) {
  $$('canvas[data-fish-sprite]', root).forEach(canvas => {
    const fish = state.world.fish.find(f => f.id === canvas.dataset.fishSprite) || fishByResident(canvas.dataset.fishSprite);
    if (!fish) return;
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const scale = Math.min(canvas.width / 32, canvas.height / 22);
    drawFishPixel(ctx, fish, (canvas.width - scale * 28) / 2, (canvas.height - scale * 18) / 2, scale);
  });
}
function oceanPage() {
  const fish = aliveFish();
  const regionCounts = regions.map(region => fish.filter(f => f.region === region).length);
  return `${heading('A LIVING WORLD, ONE DAY AT A TIME', '一片海，正在发生。', `本地模拟世界 · ${state.world.residents.length} 位居民，各自生活，也彼此相遇。`, `<button class="button ghost" data-action="adopt" id="adopt-fish">${icon('plus')}领养小鱼</button>${advanceButton()}`)}
  <div class="stats-strip"><div class="stat"><div class="stat-icon">${icon('fish')}</div><div><div class="stat-label">海洋居民</div><div class="stat-value">${state.world.residents.length}<span>位</span></div></div></div><div class="stat"><div class="stat-icon">${icon('heart')}</div><div><div class="stat-label">平均活力</div><div class="stat-value">${average('vitality')}<span>/ 100</span></div></div></div><div class="stat"><div class="stat-icon">${icon('link')}</div><div><div class="stat-label">关系正在生长</div><div class="stat-value">${state.world.relationships.length}<span>段</span></div></div></div><div class="stat"><div class="stat-icon">${icon('journal')}</div><div><div class="stat-label">今日新故事</div><div class="stat-value">${getLogs(null, 10000).filter(l => l.day === state.world.day).length}<span>则</span></div></div></div></div>
  <div class="ocean-layout"><div class="ocean-column"><div class="region-tabs" role="tablist" aria-label="海区">${regions.map((region, i) => `<button class="region-tab${state.region === region ? ' active' : ''}" data-action="region" data-region="${region}" role="tab" aria-selected="${state.region === region}">${region}<span>${String(regionCounts[i]).padStart(2, '0')}</span></button>`).join('')}</div>
  <div class="ocean-stage" id="ocean-stage"><canvas id="ocean-canvas" width="960" height="600" aria-label="${state.region}像素海洋，点击鱼可以查看档案；也可从居民页面用键盘选择" role="img"></canvas><div class="stage-heading"><h2>${state.region}</h2><p>${regionEnglish[regions.indexOf(state.region)]} / ZONE 0${regions.indexOf(state.region) + 1}</p></div><span class="stage-badge">PIXEL OCEAN · LIVE</span><div class="stage-corner" id="fish-tooltip"></div><div class="stage-bottom"><span class="live-status"><i></i> ${regionCounts[regions.indexOf(state.region)]} 条小鱼，正在这里生活</span><span>点击小鱼 · 查看它的故事</span></div></div>
  <div class="ocean-caption"><span>海不会催促谁，故事也一样。</span><span><b>第 ${state.world.day} 天</b> · 普通事件不会让鱼远航</span></div>
  <div class="event-tray"><div class="section-header"><h2>给海洋一点变化</h2><small>每个事件，都会留下痕迹</small></div><div class="event-buttons">${eventTypes.map(([type, glyph]) => `<button class="event-button" data-action="event" data-type="${type}" aria-label="触发${type}事件">${icon(glyph)}<span>${type}</span></button>`).join('')}</div></div></div>
  <aside class="right-column"><div class="panel panel-pad fish-card" id="selected-profile">${fishProfile(getSelected())}</div><div class="panel feed-panel"><div class="section-header"><h2>海底电台</h2><button class="text-button" data-action="open-episode">全部纪事 ${icon('arrow')}</button></div>${feedMarkup()}</div></aside></div>`;
}
function fishProfile(fish) {
  if (!fish) return '<div class="empty-state">这片海正等待第一位居民。</div>';
  const relationships = state.world.relationships.filter(r => r.a === fish.residentId || r.b === fish.residentId);
  const log = getLogs(fish.residentId, 1)[0];
  return `<div class="panel-label">居民观察窗<span>RESIDENT FILE</span></div><div class="fish-portrait">${sprite(fish, 140, 90)}</div><h2 class="fish-name">${esc(fish.name)}</h2><div class="fish-number">${esc(fish.residentId)} / ${generationName(fish.generation)}</div><div class="tag-list"><span class="tag">${esc(fish.species)}</span><span class="tag">${esc(fish.trait)}</span><span class="tag coral">${fish.status === 'hatching' ? '等待归来' : esc(fish.region)}</span></div><div class="meter"><span>活力</span><div class="meter-track"><div class="meter-fill" style="width:${Math.max(0, Math.min(100, fish.vitality))}%"></div></div><b>${Math.round(fish.vitality)}</b></div><div class="meter mood"><span>心情</span><div class="meter-track"><div class="meter-fill" style="width:${Math.max(0, Math.min(100, fish.mood))}%"></div></div><b>${Math.round(fish.mood)}</b></div><dl class="fish-detail-grid"><div><dt>在海里的日子</dt><dd>${fish.ageDays || 0} 天</dd></div><div><dt>关系</dt><dd>${relationships.length} 段</dd></div><div><dt>经历印记</dt><dd>${fish.scars || 0} 枚</dd></div></dl><div class="profile-note">${log ? `最近，<strong>${esc(log.text)}</strong>` : '刚刚来到这片海。它的第一段故事，正在路上。'}<br><button class="text-button" style="margin-top:9px" data-action="fish-detail" data-id="${esc(fish.residentId)}">打开完整档案 ${icon('arrow')}</button></div>`;
}
function feedMarkup() {
  const logs = getLogs(null, 4);
  if (!logs.length) return '<div class="empty-state" style="padding:20px 0">今天还很安静。推进一天，听听海里的新消息。</div>';
  return logs.map(log => `<div class="feed-item"><i class="feed-dot"></i><div><p>${esc(log.text)}</p><small>DAY ${String(log.day).padStart(3, '0')} · ${esc(log.fishId || '海洋事件')}</small></div></div>`).join('');
}

function residentsPage() {
  const rows = currentFish().filter(f => (!state.query || `${f.name}${f.residentId}${f.species}${f.trait}`.toLowerCase().includes(state.query.toLowerCase())) && (state.residentRegion === '全部' || f.region === state.residentRegion) && (state.residentStatus === '全部' || f.status === state.residentStatus));
  return `${heading('EVERY NUMBER HAS A STORY', '海洋居民簿', '永久编号，是它在这片海里的名字，也是记忆的起点。', `<button class="button primary" data-action="adopt">${icon('plus')}领养小鱼</button>`)}<div class="list-toolbar"><div class="search-box">${icon('search')}<input id="resident-search" type="search" placeholder="寻找名字、编号或性格…" value="${esc(state.query)}" aria-label="搜索居民"></div><select id="resident-region" aria-label="筛选海区"><option>全部</option>${regions.map(r => `<option${state.residentRegion === r ? ' selected' : ''}>${r}</option>`).join('')}</select><select id="resident-status" aria-label="筛选状态"><option value="全部">全部状态</option><option value="alive"${state.residentStatus === 'alive' ? ' selected' : ''}>在海中</option><option value="hatching"${state.residentStatus === 'hatching' ? ' selected' : ''}>等待孵化</option></select><span class="result-count">${rows.length} 位居民</span></div><div class="resident-grid">${rows.map(f => `<button class="resident-card${f.status === 'hatching' ? ' hatching' : ''}" data-action="fish-detail" data-id="${esc(f.residentId)}"><div class="fish-number">${esc(f.residentId)}</div>${sprite(f, 112, 72)}<h3>${esc(f.name)}<small>${f.status === 'hatching' ? '孵化中' : esc(f.region)}</small></h3><div class="tag-list"><span class="tag">${esc(f.species)}</span><span class="tag">${esc(f.trait)}</span><span class="tag coral">${f.generation} 世</span></div><div class="mini-bars" aria-label="活力${Math.round(f.vitality)}，心情${Math.round(f.mood)}"><span><i style="width:${f.vitality}%"></i></span><span><i style="width:${f.mood}%;background:#c6c38d"></i></span></div></button>`).join('') || `<div class="empty-state">${icon('search')}没有找到这位居民。试试其他名字或编号。</div>`}</div>`;
}

function episodePage() {
  const ep = state.episode;
  if (!ep) return `${heading('NEWS FROM UNDER THE SURFACE', '每日纪事', '故事从世界里读出来，再写进今天的海洋新闻。')}<div class="loading-screen"><div class="loading-fish"></div><p>正在整理海里的故事…</p></div>`;
  const protagonists = ep.protagonists || [];
  const cast = (ep.cast || []).filter(c => !protagonists.some(p => p.fishId === c.fishId));
  const checks = ep.review?.checks || [false, false, false, false, false];
  const options = ep.vote?.options || [];
  return `${heading('NEWS FROM UNDER THE SURFACE', '把今天，写成一则纪事。', `第 ${ep.day} 天 · 真实读取模拟世界日志 · 人工审核后可导出视频`, `<button class="button ghost" data-action="regenerate">${icon('journal')}重新选材</button>${advanceButton()}`)}<div class="episode-layout"><div><article class="episode-banner"><div class="eyebrow">DEEPSEA DAILY / ${String(ep.day).padStart(3, '0')}</div><h2>${esc(ep.title)}</h2><p>${esc(ep.hook)}</p><div class="episode-meta"><span>100 SEC</span><span>3 位主角</span><span>${cast.length + protagonists.length} 位居民入镜</span></div></article><div class="section-header"><h2>三位主角，三种相遇</h2><small>人气 · 故事 · 随机</small></div><div class="protagonist-list">${protagonists.map((p, i) => { const f = fishByResident(p.fishId); return `<article class="story-card"><div class="pool-label">0${i + 1} / ${esc(p.pool)}池</div>${sprite(f, 112, 72)}<div class="story-fish">${esc(p.name)}<span>${esc(p.fishId)}</span></div><h3>${esc(p.headline)}</h3><p>${esc(p.story)}</p><div class="story-reason">入选理由 · ${esc(p.reason)}</div></article>`; }).join('')}</div><div class="vote-box"><div class="section-header"><h2>下一期，由居民共同决定</h2><button class="text-button" data-action="import-votes">${icon('upload')}导入投票</button></div><h3 class="vote-question">${esc(ep.vote?.question || '海洋的下一站在哪里？')}</h3><div class="vote-comparison">${options.map(o => `<div class="vote-side"><b>${Number(o.votes || 0).toLocaleString()}</b><span>${esc(o.id)} · ${esc(o.label)}</span></div>`).join('')}</div><div class="vote-source"><span>${ep.vote?.source === 'imported' ? '已导入评论数据 · 按点赞数累计' : '演示投票 · 模拟数据，未接入真实评论'}</span><span>LIKES, NOT HEADCOUNT</span></div></div><div class="panel panel-pad" style="margin-bottom:20px"><div class="section-header"><h2>100 秒，海洋的一天</h2><small>EPISODE TIMELINE</small></div><div class="timeline">${(ep.timeline || []).map(t => `<div class="timeline-part" style="flex:${Math.max(1, t.end - t.start)}" title="${esc(t.title)} · ${t.start}–${t.end}秒"><span>${t.end - t.start >= 8 ? esc(t.title) : ''}</span><small>${t.start}–${t.end}s</small></div>`).join('')}</div><div class="timeline-caption">钩子 · 计票 · 揭晓 · 三位主角 · 群像 · 收尾</div></div><div class="panel panel-pad"><div class="section-header"><h2>今天的群像名单</h2><small>每一个编号，都值得被看见</small></div><div class="cast-grid">${cast.map(c => `<button class="cast-chip" data-action="fish-detail" data-id="${esc(c.fishId)}"><span>${esc(c.name)}</span><small>${esc(c.fishId)} · ${esc(c.pool)}</small></button>`).join('')}</div></div></div><aside class="episode-sidebar"><div class="panel panel-pad" style="margin-bottom:18px"><div class="panel-label">发布前，停一小会儿<span>HUMAN REVIEW</span></div><div class="review-list">${reviews.map((text, i) => `<label class="review-check"><input type="checkbox" data-review="${i}" ${checks[i] ? 'checked' : ''}><span>${text}</span></label>`).join('')}</div><div class="review-status${ep.review?.approved ? ' approved' : ''}" id="review-status">${ep.review?.approved ? '5 项审核已完成 · 可以生成视频' : '请逐项确认，完成后解锁视频导出'}</div><button class="button primary render-button" data-action="render-video" data-duration="100" ${ep.review?.approved && !isRendering() ? '' : 'disabled'}>${icon('play')}生成 100 秒正片</button><button class="button ghost render-button" data-action="render-video" data-duration="15" ${ep.review?.approved && !isRendering() ? '' : 'disabled'}>${icon('play')}先看 15 秒样片</button><p class="render-notice">本地合成 · 像素画面 + 中文字幕 + 合成音效</p><div id="render-state">${renderJobMarkup()}</div></div><div class="panel panel-pad"><div class="panel-label">今天的交付文件<span>LOCAL OUTPUT</span></div><div class="file-list" id="episode-files">${filesMarkup()}</div></div></aside></div>`;
}
function isRendering() { return state.renderJob && !['complete', 'completed', 'succeeded', 'error', 'failed'].includes(state.renderJob.status); }
function renderJobMarkup() {
  const job = state.renderJob;
  if (!job) return '';
  if (job.status === 'error' || job.status === 'failed') return `<p class="render-caption" style="color:var(--red)">合成失败：${esc(job.error || '请重试')}</p>`;
  if (['complete', 'completed', 'succeeded'].includes(job.status)) return `<p class="render-caption">${icon('check')}视频已完成，已保存到输出目录。</p>${job.result?.url ? `<a class="button mint render-button" href="${esc(job.result.url)}" download>${icon('download')}下载视频</a><video controls preload="metadata" src="${esc(job.result.url)}" style="width:100%;max-height:300px;border-radius:8px;margin-top:12px;background:#061e28"></video>` : ''}`;
  return `<div class="render-progress"><i style="${Number.isFinite(job.progress) ? `animation:none;width:${job.progress}%` : ''}"></i></div><p class="render-caption">${esc(job.message || '正在绘制海洋与合成字幕…')}${Number.isFinite(job.progress) ? ` ${job.progress}%` : ''}</p>`;
}
function filesMarkup() {
  const list = [...state.files];
  const epFiles = state.episode?.files;
  if (epFiles) Object.entries(epFiles).forEach(([type, value]) => { const url = typeof value === 'string' ? value : value?.url; if (url && !list.some(f => f.url === url)) list.push({ name: url.split('/').pop() || type, url, size: 0 }); });
  return list.slice().reverse().slice(0, 10).map(f => `<div class="file-item">${icon('file')}<a href="${esc(f.url)}" download>${esc(f.name)}</a><small>${f.size ? formatBytes(f.size) : ''}</small></div>`).join('') || '<p class="subtitle">生成纪事后，清单与视频会出现在这里。</p>';
}
function formatBytes(n) { return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`; }

function expeditionsPage() {
  const list = (state.world.expeditions || []).slice().reverse();
  const reserved = new Set((state.world.expeditions || []).filter(exp => exp.status === 'gathering').flatMap(exp => exp.fishIds || []));
  const eligible = aliveFish().filter(f => !reserved.has(f.residentId));
  return `${heading('THE JOURNEY WE CHOOSE TOGETHER', '远方，等一次共同出发。', '本地模拟远征 · 每个决定留有反悔的时间，每个编号都能再次归来。', advanceButton())}<div class="expedition-intro"><div><div class="eyebrow">A NAME NEVER DISAPPEARS</div><h2>它会去远方，也会带着故事回来。</h2><p>满 50 条模拟鱼即可集结。等待一个完整海洋日，才能确认出发；期间可以取消。远征后，部分居民带伤归来，部分进入 3 / 5 / 7 天的孵化期，保留编号与关系，开启下一世。</p></div><div class="expedition-symbol">${icon('compass')}</div></div><div class="expedition-layout"><div class="expedition-list">${list.length ? list.map(exp => expeditionCard(exp)).join('') : `<div class="panel empty-state" style="padding:65px 25px">${icon('compass')}<h3>第一支远征队，还没有出发。</h3><p>在右侧选择路线与模拟参与者，写下这片海的第一段远行。</p></div>`}</div><div class="panel panel-pad"><div class="panel-label">集结一支远征队<span>SIMULATION</span></div><form id="expedition-form"><div class="field"><label for="expedition-route">航行路线</label><select id="expedition-route"><option>跟鲸群往北</option><option>下潜沉船带</option><option>跟洋流散步</option></select></div><div class="field"><label>模拟参与者</label><div class="participant-tools"><span id="participant-count">已选 0 / 至少 50</span><button type="button" class="text-button" data-action="select-participants">全选在世鱼</button></div><div class="participants-list">${eligible.map(f => `<label class="participant-option"><input type="checkbox" name="participants" value="${esc(f.residentId)}"><span>${esc(f.name)}</span><small>${esc(f.residentId)}</small></label>`).join('')}</div></div><div class="notice">远征会改变鱼的世代。此处全部为模拟参与者，不代表真实用户同意。真实运营前需另行接入报名与公示。</div><p class="form-error" id="expedition-error"></p><button class="button primary" style="width:100%" type="submit">${icon('compass')}发起模拟远征</button></form></div></div>`;
}
function expeditionCard(exp) {
  const status = exp.status || 'pending';
  const pending = ['pending', 'gathering', 'collecting', 'scheduled', 'waiting', 'open'].includes(status);
  const cancelled = ['cancelled', 'canceled'].includes(status);
  const ids = exp.fishIds || exp.participants || [];
  const count = ids.length || exp.participantCount || 0;
  const departDay = exp.departOnDay ?? exp.departDay ?? (exp.createdOnDay ?? exp.createdDay ?? state.world.day) + 1;
  const canDepart = pending && state.world.day >= departDay && count >= 50;
  const outcome = exp.outcome || exp.result;
  const hatchingIds = exp.hatchingFishIds || [];
  const survivorIds = exp.survivorFishIds || [];
  const resultMarkup = hatchingIds.length || survivorIds.length ? `<div class="exp-result"><span><b>${survivorIds.length}</b> 位带伤归来</span><span><b>${hatchingIds.length}</b> 位进入下一世</span></div><p class="subtitle">孵化分 D+3 / D+5 / D+7 三批进行，具体归来日期见下方公示名单。</p>` : outcome ? `<p class="subtitle">${typeof outcome === 'string' ? esc(outcome) : '远征结果已保存至居民档案。'}</p>` : '';
  const roster = `<details class="exp-roster"><summary>完整模拟名单 <span>${count} 位居民 · 点击展开</span></summary><div class="exp-roster-list">${ids.map(id => { const f = fishByResident(id); const statusText = cancelled ? '已取消 · 留在海里' : hatchingIds.includes(id) ? (f?.status === 'hatching' ? `D${f.hatchOnDay} 孵化 · 第${f.generation}世` : `已归来 · 第${f?.generation || 2}世`) : survivorIds.includes(id) ? '带伤归来 · 原世代' : '公示中 · 尚未出发'; return `<div class="roster-person"><span><b>${esc(residentName(id))}</b><small>${esc(id)}</small></span><em>${esc(statusText)}</em></div>`; }).join('')}</div></details>`;
  return `<article class="exp-card"><span class="status-badge${pending ? '' : ' finished'}">${cancelled ? '已取消' : pending ? (canDepart ? '反悔期结束 · 等待确认' : '24 小时反悔期') : '已出发 · 世代正在延续'}</span><h3>${esc(exp.route || exp.name || '海洋远征')}</h3><p class="subtitle">${count} 个编号，一起写下新的经历。</p><div class="exp-meta"><span>集结日 · D${exp.createdOnDay ?? exp.createdDay ?? exp.day ?? '—'}</span><span>最早出发 · D${departDay}</span><span>模拟名单</span></div>${resultMarkup}${roster}${pending ? `<div class="button-row" style="margin-top:16px"><button class="button mint small" data-action="depart-expedition" data-id="${esc(exp.id)}" ${canDepart ? '' : 'disabled'}>${icon('compass')}确认出发</button><button class="button ghost small" data-action="cancel-expedition" data-id="${esc(exp.id)}">取消远征</button>${!canDepart ? '<small style="font-size:9px">推进到下一个海洋日后可出发</small>' : ''}</div>` : ''}</article>`;
}

function showDialog(content) {
  const dialog = $('#app-dialog'); dialog.innerHTML = content; if (!dialog.open) dialog.showModal(); drawPortraits(dialog);
  $('.dialog-close', dialog)?.addEventListener('click', () => dialog.close());
  $$('[data-close]', dialog).forEach(b => b.addEventListener('click', () => dialog.close()));
  return dialog;
}
function showAdopt() {
  const dialog = showDialog(`<div class="dialog-header"><h2>给一条小鱼，一个名字。</h2><button class="dialog-close" aria-label="关闭">×</button></div><p class="dialog-subtitle">它会获得一个永久编号，从浅滩开始自己的生活。当前是本地模拟领养，不会绑定真实账号。</p><form id="adopt-form"><div class="field"><label for="fish-name-input">它叫什么？</label><input id="fish-name-input" name="name" placeholder="比如：小满、阿蓝、海盐" maxlength="16" required autocomplete="off"><small>1–16 个字符。名字可以温柔一点，也可以有点古怪。</small></div><p class="form-error" id="adopt-error"></p><div class="dialog-actions"><button type="button" class="button ghost" data-close>再想一想</button><button class="button primary" type="submit">${icon('fish')}让它入海</button></div></form>`);
  $('#adopt-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = $('button[type="submit"]', dialog); button.disabled = true;
    try { const result = await api('/api/adopt', { name: $('#fish-name-input').value.trim() }); state.world = result.world; state.selected = result.fish.residentId; state.region = result.fish.region; state.page = 'ocean'; state.episode = null; location.hash = 'ocean'; dialog.close(); render(); toast(`${result.fish.name} 已入海，编号 ${result.fish.residentId}。`); playTone(640); }
    catch (error) { $('#adopt-error').textContent = error.message; button.disabled = false; }
  });
  setTimeout(() => $('#fish-name-input')?.focus(), 20);
}
function showFishDetail(id) {
  const fish = fishByResident(id); if (!fish) return;
  state.selected = fish.residentId;
  const relationships = state.world.relationships.filter(r => r.a === id || r.b === id);
  const lives = state.world.fish.filter(f => f.residentId === id).slice().sort((a, b) => b.generation - a.generation);
  const relationLabels = { friend: '朋友', rival: '对头', lover: '伴侣', mentor: '师友' };
  const logs = getLogs(id, 8);
  const dialog = showDialog(`<div class="dialog-header"><h2>居民档案</h2><button class="dialog-close" aria-label="关闭">×</button></div><div class="detail-hero">${sprite(fish, 150, 105)}<div><div class="eyebrow">${esc(id)} · PERMANENT RESIDENT</div><h2 style="font-size:27px">${esc(fish.name)}</h2><p class="subtitle">${esc(fish.species)} · ${esc(fish.trait)} · ${fish.status === 'hatching' ? '孵化中，等待下一世' : esc(fish.region)}</p><div class="tag-list" style="justify-content:flex-start;margin:10px 0 0"><span class="tag coral">第 ${fish.generation} 世</span><span class="tag">${fish.ageDays || 0} 天</span><span class="tag">${fish.scars || 0} 枚印记</span><span class="tag">模拟居民</span></div></div></div><div class="detail-layout"><section><div class="section-header"><h2>它的关系网</h2><small>${relationships.length} / 8</small></div><div class="relationship-list">${relationships.map(r => { const other = r.a === id ? r.b : r.a; return `<div class="relationship-row"><span>${esc(residentName(other))}<small> ${esc(other)}</small></span><b>${relationLabels[r.type] || esc(r.type)} · ${Number(r.strength).toFixed(1)}</b></div>`; }).join('') || '<p class="subtitle">还没有建立关系，下一次相遇就在路上。</p>'}</div><div class="section-header" style="margin-top:24px"><h2>世代档案</h2><small>${lives.length} 世</small></div>${lives.map(l => `<div class="relationship-row" style="margin-bottom:7px"><span>第 ${l.generation} 世 · ${esc(l.name)}</span><b>${l.status === 'soul' ? '已远航' : l.status === 'hatching' ? '等待归来' : '在海里'}</b></div>`).join('')}</section><section><div class="section-header"><h2>最近的经历</h2><small>LAST 14 DAYS</small></div>${logs.map(l => `<div class="detail-log"><small>第 ${l.day} 天</small>${esc(l.text)}${l.reason ? `<em>因为：${esc(l.reason)}</em>` : ''}</div>`).join('') || '<p class="subtitle">它的故事还没有开始。推进一天，看看会发生什么。</p>'}</section></div><div class="dialog-actions"><button class="button mint" id="follow-fish">${icon('ocean')}回海里找它</button></div>`);
  $('#follow-fish').addEventListener('click', () => { state.page = 'ocean'; state.region = fish.region; location.hash = 'ocean'; dialog.close(); render(); });
  if (state.page === 'ocean') { $('#selected-profile').innerHTML = fishProfile(fish); drawPortraits($('#selected-profile')); }
}
function showHelp() {
  showDialog(`<div class="dialog-header"><h2>欢迎来到这片海。</h2><button class="dialog-close" aria-label="关闭">×</button></div><p class="dialog-subtitle">这是《深海纪事》的本地可运行版本。世界、故事与导出文件保存在你的电脑上，当前居民和预置投票均为模拟数据。</p><div class="help-list"><article><h3>01 · 看一看它们</h3><p>切换四个海区，点一条游过的小鱼，看看它的性格、朋友和最近的经历。居民簿里可以按名字或编号查找。</p></article><article><h3>02 · 让一天发生</h3><p>“推进一天”会真正改变世界并保存。鱼会变老、迁徙、交朋友，也会因为性格做出不同的事。底部九种事件可以即时触发。</p></article><article><h3>03 · 把经历写成纪事</h3><p>打开纪事，系统从三个池子挑选 30 位居民。检查五项审核，再生成 15 秒样片或 100 秒正片。视频、JSON 与 Markdown 都能下载。</p></article><article><h3>04 · 一起去远方</h3><p>50 条模拟鱼可发起远征。等待一个海洋日后确认出发，部分鱼会在孵化后开启下一世。编号、关系和前世档案会留下。</p></article></div><div class="dialog-actions"><button class="button primary" data-close>我准备好下潜了 ${icon('arrow')}</button></div>`);
}
function showImportVotes() {
  const dialog = showDialog(`<div class="dialog-header"><h2>导入评论投票</h2><button class="dialog-close" aria-label="关闭">×</button></div><p class="dialog-subtitle">从本机选择 JSON 文件，或直接粘贴数据。支持数组或 { "votes": [...] }，票数按 likes 累计。导入后会重新生成本期选材，并需要再次审核。</p><div class="field"><label for="votes-file">选择 JSON 文件</label><input type="file" id="votes-file" accept=".json,application/json"></div><form id="votes-form"><div class="field"><label for="votes-json">投票内容</label><textarea id="votes-json" rows="7" spellcheck="false" placeholder='[{"nickname":"海盐","side":"A","likes":12},{"nickname":"阿蓝","side":"B","likes":8}]' required></textarea></div><p class="form-error" id="votes-error"></p><div class="dialog-actions"><button type="button" class="button ghost" data-close>取消</button><button type="submit" class="button primary">${icon('upload')}导入并计票</button></div></form>`);
  $('#votes-file').addEventListener('change', async e => { const file = e.target.files[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { $('#votes-error').textContent = '文件请控制在 2 MB 以内。'; return; } $('#votes-json').value = await file.text(); });
  $('#votes-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = $('button[type="submit"]', dialog); button.disabled = true;
    try { const value = JSON.parse($('#votes-json').value); const result = await api('/api/votes', { votes: Array.isArray(value) ? value : value.votes }); state.episode = result.episode; dialog.close(); render(); toast('评论投票已导入，已按点赞数重新计票。'); }
    catch (error) { $('#votes-error').textContent = error.message; button.disabled = false; }
  });
}

async function loadEpisode(regenerate = false) {
  try {
    const [result, files] = await Promise.all([api('/api/episode', regenerate ? { regenerate: true } : undefined), api('/api/files')]);
    state.episode = result.episode || result; state.files = files.files || [];
    if (state.page === 'episode') render();
  } catch (error) { toast(error.message, true); if (state.page === 'episode') $('#main').innerHTML = `${heading('DEEPSEA DAILY', '纪事暂时没有准备好', esc(error.message))}<button class="button primary" data-action="regenerate">重新整理</button>`; }
}
async function mutate(path, body, success) {
  if (state.busy) return;
  state.busy = true;
  $$('[data-action="advance"]').forEach(b => { b.disabled = true; b.innerHTML = `${icon('clock')}海洋正在演化…`; });
  try { const result = await api(path, body); if (result.world) state.world = result.world; state.episode = null; render(); if (success) toast(typeof success === 'function' ? success(result) : success); return result; }
  catch (error) { toast(error.message, true); }
  finally { state.busy = false; $$('[data-action="advance"]').forEach(b => { b.disabled = false; b.innerHTML = `${icon('next')}推进一天`; }); }
}
async function renderVideo(duration) {
  try {
    const result = await api('/api/render', { duration }); state.renderJob = result.job || result; render();
    startRenderPolling();
  } catch (error) { toast(error.message, true); }
}
function startRenderPolling() {
  if (state.poll) clearInterval(state.poll);
  if (!isRendering()) return;
  state.poll = setInterval(async () => {
    try {
      const update = await api(`/api/render/${encodeURIComponent(state.renderJob.id)}`); state.renderJob = update.job || update;
      if (!isRendering()) { clearInterval(state.poll); state.poll = null; const files = await api('/api/files'); state.files = files.files || []; if (state.page === 'episode') render(); toast(state.renderJob.status === 'complete' ? '视频合成完成，可以预览或下载。' : state.renderJob.error || '视频任务已结束。', state.renderJob.status === 'error'); }
      else if ($('#render-state')) $('#render-state').innerHTML = renderJobMarkup();
    } catch (error) { clearInterval(state.poll); state.poll = null; toast(`进度连接中断：${error.message}。刷新页面可继续查看。`, true); }
  }, 1600);
}

$('#navigation').addEventListener('click', event => { const button = event.target.closest('[data-nav]'); if (button) location.hash = button.dataset.nav; });
$('#main').addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'advance') { await mutate('/api/tick', { days: 1 }, () => `海洋历第 ${state.world.day} 天，新的故事已经写入。`); playTone(490); }
  else if (action === 'adopt') showAdopt();
  else if (action === 'region') { state.region = button.dataset.region; render(); }
  else if (action === 'fish-detail') showFishDetail(button.dataset.id);
  else if (action === 'open-episode') location.hash = 'episode';
  else if (action === 'event') {
    const type = button.dataset.type;
    const result = await mutate('/api/event', { type }, result => result.event?.description || `${type}已经发生，世界状态已保存。`);
    if (result) { state.visualEvent = { type, start: performance.now() }; playTone(type === '风暴' ? 160 : 640); }
  } else if (action === 'regenerate') { button.disabled = true; await loadEpisode(true); }
  else if (action === 'import-votes') showImportVotes();
  else if (action === 'render-video') renderVideo(Number(button.dataset.duration));
  else if (action === 'select-participants') { const inputs = $$('input[name="participants"]'); const shouldCheck = inputs.some(c => !c.checked); inputs.forEach(c => c.checked = shouldCheck); updateParticipantCount(); }
  else if (action === 'cancel-expedition') await mutate(`/api/expeditions/${encodeURIComponent(button.dataset.id)}/cancel`, {}, '远征已取消，所有模拟参与者仍留在海里。');
  else if (action === 'depart-expedition') await mutate(`/api/expeditions/${encodeURIComponent(button.dataset.id)}/depart`, {}, '远征队已经出发，名单与世代变化已写入档案。');
});
$('#main').addEventListener('input', event => {
  if (event.target.id === 'resident-search') { const input = event.target; const start = input.selectionStart; state.query = input.value; render(); const next = $('#resident-search'); next.focus(); try { next.setSelectionRange(start, start); } catch {} }
});
$('#main').addEventListener('change', async event => {
  if (event.target.id === 'resident-region') { state.residentRegion = event.target.value; render(); }
  if (event.target.id === 'resident-status') { state.residentStatus = event.target.value; render(); }
  if (event.target.name === 'participants') updateParticipantCount();
  if (event.target.matches('[data-review]')) {
    const checks = $$('[data-review]').map(c => c.checked);
    try { const result = await api('/api/episode/review', { checks, episodeId: state.episode.id, worldRevision: state.episode.worldRevision }); state.episode = result.episode; const label = $('#review-status'); label.classList.toggle('approved', state.episode.review.approved); label.textContent = state.episode.review.approved ? '5 项审核已完成 · 可以生成视频' : '请逐项确认，完成后解锁视频导出'; $$('[data-action="render-video"]').forEach(b => b.disabled = !state.episode.review.approved || isRendering()); }
    catch (error) { toast(error.message, true); await loadEpisode(); }
  }
});
function updateParticipantCount() { const el = $('#participant-count'); if (el) el.textContent = `已选 ${$$('input[name="participants"]:checked').length} / 至少 50`; }
$('#main').addEventListener('submit', async event => {
  if (event.target.id !== 'expedition-form') return; event.preventDefault();
  const ids = $$('input[name="participants"]:checked').map(c => c.value);
  if (ids.length < 50) { $('#expedition-error').textContent = '至少选择 50 条模拟鱼才能集结。'; return; }
  const result = await mutate('/api/expeditions', { route: $('#expedition-route').value, fishIds: ids }, '远征已集结。推进一个海洋日后，才可确认出发。');
  if (result) playTone(380);
});
$('#help-button').addEventListener('click', showHelp);
$('#sound-toggle').addEventListener('click', () => { state.sound = !state.sound; renderNavigation(); if (state.sound) { playTone(320); toast('海洋音效已开启。'); } else toast('海洋音效已关闭。'); });
window.addEventListener('hashchange', () => { const value = location.hash.slice(1); state.page = ['ocean', 'residents', 'episode', 'expeditions'].includes(value) ? value : 'ocean'; if (state.world) render(); window.scrollTo({ top: 0, behavior: 'instant' }); });
function playTone(freq) {
  if (!state.sound) return;
  try { state.audio ||= new AudioContext(); state.audio.resume(); const osc = state.audio.createOscillator(), gain = state.audio.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(freq, state.audio.currentTime); gain.gain.setValueAtTime(.045, state.audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, state.audio.currentTime + .35); osc.connect(gain); gain.connect(state.audio.destination); osc.start(); osc.stop(state.audio.currentTime + .4); } catch {}
}

// 海洋渲染：背景只绘制一次，鱼与事件保持实时运动。
function seeded(seed) { let n = seed >>> 0; return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; }; }
function hashId(id) { return String(id).split('').reduce((v, c) => (v * 31 + c.charCodeAt(0)) >>> 0, 7); }
function setupOcean() {
  const canvas = $('#ocean-canvas'); if (!canvas) return;
  const background = document.createElement('canvas'); background.width = 960; background.height = 600;
  drawBackground(background.getContext('2d'), regions.indexOf(state.region));
  state.scene = { canvas, ctx: canvas.getContext('2d'), background, hits: [], hovered: null, started: performance.now() };
  canvas.addEventListener('pointermove', event => {
    if (!state.scene) return; const bounds = canvas.getBoundingClientRect(); const x = (event.clientX - bounds.left) * 960 / bounds.width, y = (event.clientY - bounds.top) * 600 / bounds.height;
    const hit = state.scene.hits.slice().reverse().find(h => x > h.x - 8 && x < h.x + h.w + 8 && y > h.y - 8 && y < h.y + h.h + 8);
    state.scene.hovered = hit?.fish.residentId || null; canvas.style.cursor = hit ? 'pointer' : 'crosshair'; const label = $('#fish-tooltip');
    if (label) { label.classList.toggle('visible', !!hit); if (hit) label.textContent = `${hit.fish.residentId} · ${hit.fish.name} · ${hit.fish.trait}`; }
  });
  canvas.addEventListener('pointerleave', () => { if (state.scene) state.scene.hovered = null; $('#fish-tooltip')?.classList.remove('visible'); });
  canvas.addEventListener('click', event => {
    if (!state.scene) return;
    // 触屏点击不会先产生鼠标悬停，直接按本次点击位置寻找鱼。
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * 960 / bounds.width;
    const y = (event.clientY - bounds.top) * 600 / bounds.height;
    const margin = event.pointerType === 'touch' ? 18 : 8;
    const hit = state.scene.hits.slice().reverse().find(h => x > h.x - margin && x < h.x + h.w + margin && y > h.y - margin && y < h.y + h.h + margin);
    if (!hit) return;
    state.selected = hit.fish.residentId;
    $('#selected-profile').innerHTML = fishProfile(getSelected());
    drawPortraits($('#selected-profile'));
    playTone(560);
  });
}
function drawBackground(ctx, zone) {
  const rand = seeded(1301 + zone * 442); const colors = [['#285969', '#164250', '#10333e', '#11343d'], ['#204a59', '#153d4d', '#11323f', '#102f38'], ['#173746', '#112b3e', '#0d2433', '#0b2631'], ['#31464c', '#253a44', '#1a303a', '#183039']][zone];
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const top = rgb(colors[0]), bottom = rgb(colors[3]);
  const tones = Array.from({ length: 20 }, (_, i) => `rgb(${top.map((v, c) => Math.round(v + (bottom[c] - v) * i / 19)).join(',')})`);
  const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  // 相邻色级只差 1–3 个通道值；有序交错，避免随机噪声和纱窗。
  for (let y = 0; y < 600; y += 3) {
    const t = y / 600 * 19, k = Math.min(18, Math.floor(t)), mix = t - k;
    for (let x = 0; x < 960; x += 3) {
      ctx.fillStyle = tones[k + (mix > (bayer[(y / 3) % 4][(x / 3) % 4] + .5) / 16 ? 1 : 0)];
      ctx.fillRect(x, y, 3, 3);
    }
  }
  // 安静的水下光柱。
  ctx.save(); ctx.globalAlpha = zone === 2 ? .035 : .075; ctx.fillStyle = '#b9edce';
  [[90, 230, 420], [320, 420, 640], [690, 755, 960]].forEach(([x, w, end]) => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(w, 0); ctx.lineTo(end, 600); ctx.lineTo(end - 150, 600); ctx.closePath(); ctx.fill(); }); ctx.restore();
  // 远处的岩壁与块状海床。
  ctx.fillStyle = '#153a45'; for (let x = 0; x < 960; x += 12) { const y = 440 + Math.sin(x / 97) * 29 + rand() * 20; ctx.fillRect(x, y, 16, 600 - y); }
  ctx.fillStyle = '#1a4347'; for (let x = 0; x < 960; x += 8) { const y = 506 + Math.sin(x / 91) * 17 + rand() * 12; ctx.fillRect(x, y, 10, 600 - y); }
  for (let i = 0; i < 18; i++) drawPlant(ctx, 20 + i * 58 + rand() * 20, 540 + rand() * 50, 24 + rand() * 62, zone === 2 ? '#28505a' : '#3c6961', Math.floor(rand() * 9));
  // 独特的像素地景。
  if (zone === 3) drawWreck(ctx, 585, 465);
  else {
    drawRocks(ctx, 665, 465, 1.5, zone); drawRocks(ctx, 90, 507, .9, zone); drawRocks(ctx, 413, 533, .8, zone);
    drawCoral(ctx, 748, 512, 1.4, '#aa8071', '#d4a38a'); drawCoral(ctx, 680, 522, .9, '#628e7c', '#8eb499');
    drawCoral(ctx, 170, 527, 1.1, '#a7797a', '#c89588'); drawCoral(ctx, 281, 559, .7, '#858965', '#b3ac7a');
    if (zone === 1) { drawCoral(ctx, 490, 512, 1.4, '#9a7d86', '#bd9299'); drawCoral(ctx, 57, 503, 1.8, '#769a87', '#a6c6a2'); drawCoral(ctx, 867, 537, 1.2, '#9d8377', '#d1aa8a'); }
    if (zone === 2) { ctx.fillStyle = '#1e3b48'; ctx.fillRect(40, 420, 47, 110); ctx.fillRect(49, 403, 30, 20); ctx.fillStyle = '#315361'; ctx.fillRect(46, 420, 8, 90); for (let i = 0; i < 15; i++) { ctx.fillStyle = ['#658c97', '#75b2a5', '#a0b8a4'][i % 3]; ctx.fillRect(100 + i * 49, 430 + Math.sin(i * 3) * 33, 3, 3); } }
  }
  // 前景沙砾、贝壳与暖色小珊瑚。
  for (let i = 0; i < 150; i++) { ctx.fillStyle = ['#42625d', '#54716a', '#2b514f', '#7a8170'][i % 4]; const x = rand() * 960, y = 554 + rand() * 46; ctx.fillRect(Math.floor(x / 3) * 3, Math.floor(y / 3) * 3, 3 + rand() * 6, 3); }
  drawCoral(ctx, 935, 605, 1.6, '#294c4c', '#416761'); drawCoral(ctx, 28, 615, 2, '#274d4b', '#3d6256');
}
function drawRocks(ctx, x, y, scale, zone) {
  const r = (a,b,w,h,c) => { ctx.fillStyle = c; ctx.fillRect(x+a*scale,y+b*scale,w*scale,h*scale); };
  const base = zone === 2 ? '#29454d' : '#426566'; r(-45,-12,106,62,base); r(-32,-30,80,35,base); r(-20,-42,48,17,base); r(-38,-9,14,35,'#507b73'); r(-20,-38,48,6,'#739485'); r(20,-28,29,5,'#587e73'); r(-7,0,63,9,'#355452'); r(5,18,58,7,'#2a494a'); r(-52,30,38,24,'#365a56'); r(-47,29,29,5,'#668676');
}
function drawCoral(ctx, x, y, scale, dark, light) {
  const blocks = [[-4,-50,8,54],[-21,-32,20,8],[-23,-50,7,22],[3,-26,23,8],[20,-48,7,29],[-7,-67,8,25],[-16,-70,8,9],[5,-46,13,7],[11,-60,7,21]];
  for (const [a,b,w,h] of blocks) { ctx.fillStyle = dark; ctx.fillRect(Math.round(x+a*scale),Math.round(y+b*scale),w*scale,h*scale); ctx.fillStyle = light; ctx.fillRect(Math.round(x+a*scale),Math.round(y+b*scale),Math.max(2,w*scale-2),3*scale); }
}
function drawPlant(ctx, x,y,height,color,seed) {
  ctx.fillStyle = color; for (let i=0;i<height;i+=5) { const px=x+Math.sin(i/17+seed)*8; ctx.fillRect(px,y-i,4,7); if(i%15===0) { ctx.fillRect(px-8,y-i+3,8,3); ctx.fillRect(px+4,y-i-3,8,3); } }
}
function drawWreck(ctx, x, y) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(-.09); ctx.fillStyle='#594e47';ctx.fillRect(-125,-8,250,50);ctx.fillRect(-108,42,218,16);ctx.fillStyle='#806958';ctx.fillRect(-118,-11,230,7);ctx.fillRect(-83,-61,88,53);ctx.fillStyle='#b08b6a';ctx.fillRect(-76,-63,76,5);ctx.fillStyle='#293b3f';for(let i=0;i<7;i++)ctx.fillRect(-96+i*31,7,14,12);ctx.fillRect(-67,-47,17,20);ctx.fillRect(-33,-47,17,20);ctx.fillStyle='#66594c';ctx.fillRect(19,-110,7,103);ctx.fillRect(-17,-95,79,5);ctx.fillStyle='#738178';ctx.fillRect(28,-90,45,44);ctx.fillStyle='#52695f';ctx.fillRect(29,-49,33,7);ctx.fillStyle='#95785b';ctx.fillRect(-118,20,228,4);ctx.restore();drawCoral(ctx, x+116,y+56,.85,'#9b8172','#bf9b7f');
}
function animate(now) {
  const scene = state.scene;
  if (scene && state.page === 'ocean') {
    const { ctx, canvas } = scene; const time = now / 1000;
    ctx.clearRect(0,0,960,600);ctx.drawImage(scene.background,0,0);
    // 漂浮颗粒和缓慢上升的像素气泡。
    ctx.fillStyle='#83b5ad';ctx.globalAlpha=.24;for(let i=0;i<42;i++){const x=(i*127+Math.sin(time*.13+i)*9)%960,y=(i*73-time*(i%3+2)+60000)%540;ctx.fillRect(x,y,i%5===0?3:2,i%5===0?3:2);}ctx.globalAlpha=1;
    for(let i=0;i<11;i++){const x=(i*89+27+Math.sin(time*.7+i)*9)%960,y=560-(time*(9+i%3)+i*57)%550;ctx.strokeStyle='#8bc5bd44';ctx.lineWidth=1;ctx.strokeRect(Math.round(x),Math.round(y),4+(i%2)*2,5+(i%2)*2);}
    const visible=aliveFish().filter(f=>f.region===state.region).slice(0,70); scene.hits=[];
    const ev=state.visualEvent;const elapsed=ev?(now-ev.start)/1000:99;
    visible.forEach(f=>{
      const seed=hashId(f.residentId),dir=seed%2===0?1:-1,scale=1.45+(seed%6)/10,speed=5+seed%13;
      let x=((seed%850+time*speed*dir)%880+880)%880+22;
      let y=120+(seed%320)+Math.sin(time*.7+seed)*12;
      if(ev&&elapsed<7){if(ev.type==='觅食'){x+=(480-x)*Math.min(elapsed*.15,.55);y+=(150-y)*Math.min(elapsed*.12,.45);}if(ev.type==='出海'){x=((x+elapsed*50)%900)+10;y+=(290-y)*.4;}if(ev.type==='洋流')x=(x+elapsed*24)%910;if(ev.type==='入睡')y+=Math.sin(time*.2+seed)*3;if(ev.type==='渔民')y+=Math.min(elapsed*13,90);}
      if(y>500)y=500;
      if(f.residentId===state.selected||f.residentId===scene.hovered){ctx.strokeStyle=f.residentId===scene.hovered?'#c7e5b999':'#aed6b966';ctx.setLineDash([4,6]);ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x+14*scale,y+9*scale,22*scale,17*scale,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
      drawFishPixel(ctx,f,x,y,scale,dir<0,time);scene.hits.push({fish:f,x,y,w:28*scale,h:18*scale});
      if(f.residentId===state.selected){ctx.font='10px monospace';ctx.textAlign='center';ctx.fillStyle='#d1e3c4';ctx.fillText(f.residentId,x+14*scale,y-10);}
    });
    if(ev&&elapsed<8)drawEvent(ctx,ev.type,elapsed,time);
    if(ev&&elapsed>=8)state.visualEvent=null;
  }
  requestAnimationFrame(animate);
}
function drawEvent(ctx,type,elapsed,time){
  if(type==='风暴'||type==='渔民'){ctx.fillStyle='#071a30';ctx.globalAlpha=.15+Math.sin(elapsed*6)*.04;ctx.fillRect(0,0,960,600);ctx.globalAlpha=1;}
  if(type==='风暴'){ctx.strokeStyle='#99c4cd55';ctx.lineWidth=2;for(let i=0;i<60;i++){const x=(i*41+elapsed*80)%1000,y=(i*61+elapsed*160)%600;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-9,y+23);ctx.stroke();}}
  if(type==='渔民'){ctx.strokeStyle='#bbbd9f88';ctx.lineWidth=2;const bottom=Math.min(elapsed*30,180);for(let x=-100;x<1050;x+=35){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+100,bottom);ctx.stroke();ctx.beginPath();ctx.moveTo(x+100,0);ctx.lineTo(x,bottom);ctx.stroke();}ctx.beginPath();ctx.moveTo(0,bottom);ctx.lineTo(960,bottom);ctx.stroke();}
  if(type==='觅食'){ctx.fillStyle='#d5b781';for(let i=0;i<35;i++){const x=350+(i*31)%270,y=(elapsed*42+i*17)%490;ctx.fillRect(x,y,3,3);}}
  if(type==='鲸落'){const y=100+elapsed*34;ctx.fillStyle='#102e3de0';ctx.beginPath();ctx.ellipse(480,y,160,49,.1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(330,y);ctx.lineTo(270,y-55);ctx.lineTo(290,y);ctx.lineTo(265,y+45);ctx.closePath();ctx.fill();ctx.fillStyle='#78a7a6';ctx.fillRect(595,y-11,5,5);}
  if(type==='入睡'){ctx.font='15px monospace';ctx.fillStyle='#b3d2d099';for(let i=0;i<9;i++)ctx.fillText('z',90+i*96,150+Math.sin(i+time)*30);}
  if(type==='新生'){ctx.fillStyle='#f0ce9b';for(let i=0;i<14;i++){const a=i*Math.PI/7+time,r=elapsed*17;ctx.fillRect(480+Math.cos(a)*r,300+Math.sin(a)*r,4,4);}}
  if(type==='吵架'){ctx.fillStyle='#e9ad78';for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.fillRect(480+Math.cos(a)*elapsed*17,290+Math.sin(a)*elapsed*17,5,5);}}
  if(type==='洋流'||type==='出海'){ctx.strokeStyle='#b2d1c338';ctx.lineWidth=2;for(let i=0;i<8;i++){const x=(elapsed*150+i*120)%1100-100,y=120+i*46;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+80,y);ctx.stroke();}}
}
requestAnimationFrame(animate);

async function init() {
  state.page = ['ocean', 'residents', 'episode', 'expeditions'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'ocean';
  renderNavigation();
  try {
    const [world, status] = await Promise.all([api('/api/world'), api('/api/status').catch(() => null)]);
    state.world = world.world || world; state.status = status; state.selected = aliveFish()[0]?.residentId || null;
    if (status?.renderJob) { state.renderJob = status.renderJob; startRenderPolling(); }
    render();
  } catch (error) {
    $('#main').innerHTML = `<div class="error-page"><div class="eyebrow">WAITING FOR THE OCEAN</div><h1>暂时没有连接到世界。</h1><p>请确认本地服务正在运行，再重新下潜。</p><pre>${esc(error.message)}</pre><button class="button primary" id="retry-connection">重新连接 ${icon('arrow')}</button></div>`;
    $('#retry-connection').addEventListener('click', init);
  }
}
init();
