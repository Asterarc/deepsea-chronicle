import http from 'node:http';
import path from 'node:path';
import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, DATA_DIR, OUT_DIR, WORLD_PATH, readWorld, updateWorld } from './lib/store.mjs';
import { tickWorld, applyEvent, adoptFish, createExpedition, cancelExpedition, departExpedition } from './lib/world.mjs';
import { createEpisode, applyReview, validateVotes, writeEpisode } from './lib/episode.mjs';
import { getFfmpegPath, renderEpisode } from './lib/video.mjs';
import { advanceScheduledDay } from './lib/daily.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.png': 'image/png', '.svg': 'image/svg+xml' };
let episode;
let votes = null;
let votesDay = null;
let job = null;
let renderStarting = false;
let episodeQueue = Promise.resolve();

function serializeEpisode(operation) {
  const task = episodeQueue.then(operation);
  episodeQueue = task.catch(() => {});
  return task;
}

async function currentEpisode(regenerate = false) {
  const world = await readWorld();
  const revision = world.contentRevision || 0;
  if (!episode || episode.day !== world.day || episode.worldRevision !== revision || regenerate) {
    if (!regenerate) {
      try {
        const saved = JSON.parse(await readFile(path.join(OUT_DIR, `day-${String(world.day).padStart(4, '0')}.json`), 'utf8'));
        if (saved.day === world.day && saved.worldRevision === revision && Array.isArray(saved.protagonists)) episode = saved;
      } catch (error) { if (error.code !== 'ENOENT') console.warn('已重新生成纪事：', error.message); }
    }
    if (!episode || episode.day !== world.day || episode.worldRevision !== revision || regenerate) {
      if (votesDay !== world.day) {
        votes = null;
        try {
          const imported = JSON.parse(await readFile(path.join(DATA_DIR, 'inbox', 'votes.json'), 'utf8'));
          if (imported.day === world.day) { votes = validateVotes(imported.votes); votesDay = world.day; }
        } catch (error) { if (error.code !== 'ENOENT') console.warn('投票文件未使用：', error.message); }
      }
      episode = createEpisode(world, votes);
      episode.id = `${episode.id}-${randomUUID().slice(0, 8)}`;
      episode.worldRevision = revision;
    }
    await writeEpisode(episode, OUT_DIR);
  }
  return episode;
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) { const error = new Error('文件太大，请控制在 1MB 内。'); error.status = 413; throw error; }
    chunks.push(chunk);
  }
  try { return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }
  catch { throw new Error('请输入有效的 JSON。'); }
}

async function serveFile(req, res, filename, download = false) {
  let info;
  try { info = await stat(filename); } catch (error) { if (error.code === 'ENOENT') return json(res, 404, { error: '文件不存在。' }); throw error; }
  if (!info.isFile()) return json(res, 404, { error: '文件不存在。' });
  const type = MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' };
  if (download) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(filename))}`;
  // 支持浏览器拖动视频进度条。
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  const data = await readFile(filename);
  if (range) {
    const start = Number(range[1]);
    const end = Math.min(Number(range[2] || data.length - 1), data.length - 1);
    if (start > end || start >= data.length) { res.writeHead(416, { 'Content-Range': `bytes */${data.length}` }); return res.end(); }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    return res.end(data.subarray(start, end + 1));
  }
  res.writeHead(200, { ...headers, 'Accept-Ranges': 'bytes', 'Content-Length': data.length });
  res.end(req.method === 'HEAD' ? undefined : data);
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const route = decodeURIComponent(url.pathname);
      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        const origin = req.headers.origin;
        if (origin && origin !== `http://${req.headers.host}`) return json(res, 403, { error: '请从本地海洋页面操作。' });
      }

      if (req.method === 'GET' && ['/api/world', '/ocean/state'].includes(route)) return json(res, 200, await readWorld());
      if (req.method === 'GET' && route === '/api/status') {
        const world = await readWorld();
        return json(res, 200, { day: world.day, population: world.fish.filter(fish => fish.status === 'alive').length, ffmpegAvailable: Boolean(getFfmpegPath()), renderJob: job, dataFile: WORLD_PATH, processId: process.pid, autoTickEnabled: process.env.DEEPSEA_AUTO_TICK === '1' });
      }
      if (req.method === 'POST' && route === '/api/tick') {
        const data = await body(req);
        const days = data.days ?? 1;
        if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('每次可推进 1–30 天。');
        const result = await updateWorld(world => tickWorld(world, days));
        episode = null;
        return json(res, 200, { world: result.world });
      }
      if (req.method === 'POST' && route === '/api/event') {
        const data = await body(req);
        const result = await updateWorld(world => applyEvent(world, data.type));
        episode = null;
        await serializeEpisode(() => currentEpisode(true));
        return json(res, 200, { world: result.world, event: result.result });
      }
      if (req.method === 'POST' && route === '/api/adopt') {
        const data = await body(req);
        const result = await updateWorld(world => adoptFish(world, data.name));
        episode = null;
        await serializeEpisode(() => currentEpisode(true));
        return json(res, 201, { world: result.world, fish: result.result });
      }
      if (req.method === 'POST' && route === '/api/expeditions') {
        const data = await body(req);
        const result = await updateWorld(world => createExpedition(world, data));
        return json(res, 201, { world: result.world, expedition: result.result });
      }
      const expeditionAction = /^\/api\/expeditions\/([^/]+)\/(cancel|depart)$/.exec(route);
      if (req.method === 'POST' && expeditionAction) {
        const result = await updateWorld(world => expeditionAction[2] === 'cancel' ? cancelExpedition(world, expeditionAction[1]) : departExpedition(world, expeditionAction[1]));
        episode = null;
        await serializeEpisode(() => currentEpisode(true));
        return json(res, 200, { world: result.world });
      }
      if (['GET', 'POST'].includes(req.method) && route === '/api/episode') {
        const data = req.method === 'POST' ? await body(req) : {};
        return json(res, 200, { episode: await serializeEpisode(() => currentEpisode(Boolean(data.regenerate))) });
      }
      if (req.method === 'POST' && route === '/api/episode/review') {
        const data = await body(req);
        const reviewed = await serializeEpisode(async () => {
          const next = structuredClone(await currentEpisode());
          if (data.episodeId !== next.id || data.worldRevision !== next.worldRevision) {
            const error = new Error('世界或纪事已变化，请刷新清单后重新审核。'); error.status = 409; throw error;
          }
          applyReview(next, data.checks);
          await writeEpisode(next, OUT_DIR);
          episode = next;
          return next;
        });
        return json(res, 200, { episode: reviewed });
      }
      if (req.method === 'POST' && route === '/api/votes') {
        const data = await body(req);
        votes = validateVotes(data.votes ?? data);
        votesDay = (await readWorld()).day;
        await mkdir(path.join(DATA_DIR, 'inbox'), { recursive: true });
        await writeFile(path.join(DATA_DIR, 'inbox', 'votes.json'), JSON.stringify({ day: votesDay, votes }, null, 2), 'utf8');
        return json(res, 200, { episode: await serializeEpisode(() => currentEpisode(true)) });
      }
      if (req.method === 'POST' && route === '/api/render') {
        const data = await body(req);
        if (renderStarting || job?.status === 'running') return json(res, 409, { error: '已有视频正在生成，请等待完成。', job });
        renderStarting = true;
        try {
        const selected = structuredClone(await serializeEpisode(() => currentEpisode()));
        if (!selected.review?.approved) throw new Error('请先完成五项审核，再导出视频。');
        const duration = data.duration ?? 100;
        if (![15, 100].includes(duration)) throw new Error('请选择 15 秒样片或 100 秒正片。');
        if (!getFfmpegPath()) throw new Error('视频组件未就绪，请运行 npm.cmd install。');
        const world = await readWorld();
        if (selected.day !== world.day || selected.worldRevision !== (world.contentRevision || 0)) {
          const error = new Error('世界已变化，请重新生成纪事并审核。'); error.status = 409; throw error;
        }
        job = { id: randomUUID(), status: 'running', progress: 0, duration, startedAt: new Date().toISOString() };
        const activeJob = job;
        renderEpisode({ world, episode: selected, outDir: OUT_DIR, duration, onProgress: progress => {
          activeJob.progress = Math.max(0, Math.min(99, Math.round(typeof progress === 'number' ? progress : (progress?.progress || 0))));
        } }).then(async result => {
          // 只有100秒正片成功落盘才算上镜；样片和失败不会影响选材公平性。
          if (duration === 100) await updateWorld(draft => {
            draft.featuredDays ??= [];
            if (draft.featuredDays.includes(selected.day)) return;
            draft.featuredDays.push(selected.day);
            const castIds = new Set(selected.cast.map(item => item.fishId));
            for (const resident of draft.residents) if (castIds.has(resident.id)) {
              resident.appearanceCount = (resident.appearanceCount || 0) + 1;
              resident.lastFeaturedDay = selected.day;
            }
          }, { contentChanged: false });
          Object.assign(activeJob, { status: 'complete', progress: 100, result, completedAt: new Date().toISOString() });
        })
          .catch(error => Object.assign(activeJob, { status: 'error', error: error.message }));
        return json(res, 202, { job: activeJob });
        } finally { renderStarting = false; }
      }
      if (req.method === 'GET' && route.startsWith('/api/render/')) {
        if (!job || route.split('/').pop() !== job.id) return json(res, 404, { error: '未找到导出任务。' });
        return json(res, 200, { job });
      }
      if (req.method === 'GET' && route === '/api/files') {
        const names = await readdir(OUT_DIR);
        const files = await Promise.all(names.filter(name => /\.(mp4|md|json)$/.test(name)).map(async name => ({ name, url: `/out/${encodeURIComponent(name)}`, size: (await stat(path.join(OUT_DIR, name))).size })));
        return json(res, 200, { files: files.sort((a, b) => b.name.localeCompare(a.name)) });
      }
      if (req.method === 'GET' && route === '/api/world/download') return serveFile(req, res, WORLD_PATH, true);
      if (route.startsWith('/api/')) return json(res, 404, { error: '接口不存在。' });
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: '此操作不支持。' });
      if (route.startsWith('/out/')) {
        const name = route.slice(5);
        if (!name || name.includes('/') || name.includes('\\') || !/\.(mp4|md|json)$/.test(name)) return json(res, 404, { error: '文件不存在。' });
        return serveFile(req, res, path.join(OUT_DIR, name), url.searchParams.has('download'));
      }
      const requestPath = ['/', '/ocean', '/ocean/'].includes(route) ? 'index.html' : route.replace(/^\//, '');
      const filename = path.resolve(ROOT, 'web', requestPath);
      const webRoot = path.resolve(ROOT, 'web') + path.sep;
      if (!filename.startsWith(webRoot)) return json(res, 404, { error: '文件不存在。' });
      return serveFile(req, res, filename);
    } catch (error) {
      console.error(error.message);
      if (!res.headersSent) json(res, error.status || 400, { error: error.message || '操作失败，请稍后重试。' });
      else res.end();
    }
  });
}

export async function startServer(port = Number(process.env.PORT || 3080)) {
  await readWorld();
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const address = server.address();
  if (process.env.DEEPSEA_AUTO_TICK === '1') {
    let advancing = false;
    const advance = async () => {
      if (advancing) return;
      advancing = true;
      try {
        if (await advanceScheduledDay()) {
          await serializeEpisode(() => currentEpisode(true));
          console.log('自动日更已完成，新一期清单等待人工审核。');
        }
      } catch (error) { console.error('自动日更未完成：', error.message); }
      finally { advancing = false; }
    };
    const timer = setInterval(advance, 30000);
    timer.unref();
    server.once('close', () => clearInterval(timer));
    await advance();
  }
  console.log(`\n深海纪事 · 本地海洋已开启\nhttp://127.0.0.1:${address.port}/ocean/\n世界数据：${WORLD_PATH}\n按 Ctrl+C 停止。\n`);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startServer().catch(error => { console.error(error.code === 'EADDRINUSE' ? '3080 端口已占用。请打开 http://127.0.0.1:3080/ocean/，或设置 PORT 使用其他端口。' : error.message); process.exitCode = 1; });
}
