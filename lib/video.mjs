import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile, stat, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';

const require = createRequire(import.meta.url);
const WIDTH = 180;
const HEIGHT = 320;
const FPS = 24;
const TAU = Math.PI * 2;

export function getFfmpegPath() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  try {
    const candidate = require('ffmpeg-static');
    return candidate && existsSync(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function getFont() {
  const candidates = [
    process.env.DEEPSEA_FONT,
    'C:/Windows/Fonts/msyh.ttc',
    'C:/Windows/Fonts/simhei.ttf',
    'C:/Windows/Fonts/simsun.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    '/System/Library/Fonts/PingFang.ttc',
  ];
  return candidates.find(candidate => candidate && existsSync(candidate));
}

const colorCache = new Map();
function color(value) {
  if (colorCache.has(value)) return colorCache.get(value);
  let result = [255, 255, 255, 1];
  if (typeof value === 'string' && value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map(char => char + char).join('');
    result = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1];
  } else if (typeof value === 'string' && value.startsWith('rgb')) {
    const parts = value.match(/[\d.]+/g)?.map(Number) || [];
    result = [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts[3] ?? 1];
  }
  colorCache.set(value, result);
  return result;
}

/** Sprite renderer needs only these two Canvas-compatible members. */
class Raster {
  constructor() {
    this.data = Buffer.alloc(WIDTH * HEIGHT * 3);
    this.fillStyle = '#ffffff';
  }

  fillRect(x, y, width, height) {
    if (width < 0) { x += width; width = -width; }
    if (height < 0) { y += height; height = -height; }
    const left = Math.max(0, Math.floor(x));
    const top = Math.max(0, Math.floor(y));
    const right = Math.min(WIDTH, Math.ceil(x + width));
    const bottom = Math.min(HEIGHT, Math.ceil(y + height));
    const [red, green, blue, alpha] = color(this.fillStyle);
    if (alpha <= 0) return;
    for (let row = top; row < bottom; row++) {
      for (let column = left; column < right; column++) {
        const i = (row * WIDTH + column) * 3;
        this.data[i] = alpha === 1 ? red : Math.round(red * alpha + this.data[i] * (1 - alpha));
        this.data[i + 1] = alpha === 1 ? green : Math.round(green * alpha + this.data[i + 1] * (1 - alpha));
        this.data[i + 2] = alpha === 1 ? blue : Math.round(blue * alpha + this.data[i + 2] * (1 - alpha));
      }
    }
  }
}

function rect(ctx, fill, x, y, w, h) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function baseBackground() {
  const ctx = new Raster();
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < HEIGHT; y++) {
    const level = y / HEIGHT;
    for (let x = 0; x < WIDTH; x++) {
      const dither = (bayer[(x % 4) + (y % 4) * 4] / 16 - 0.5) * 2;
      const i = (y * WIDTH + x) * 3;
      ctx.data[i] = Math.round(7 - level * 3 + dither);
      ctx.data[i + 1] = Math.round(52 - level * 35 + dither);
      ctx.data[i + 2] = Math.round(67 - level * 35 + dither);
    }
  }
  // The reef is built in pixels, just like the fish, with no external art assets.
  rect(ctx, '#102f39', 0, 293, 180, 27);
  for (let i = 0; i < 9; i++) {
    const x = i * 23 - 8;
    const h = 9 + (i * 7) % 19;
    rect(ctx, '#17434a', x, 296 - h, 18, h);
    rect(ctx, '#24545a', x + 2, 296 - h, 12, 4);
  }
  for (let i = 0; i < 7; i++) {
    const x = 7 + i * 27;
    const h = 11 + (i * 11) % 23;
    rect(ctx, i % 2 ? '#d68a80' : '#2d8b7c', x, 300 - h, 3, h);
    rect(ctx, i % 2 ? '#b56b74' : '#369e8a', x - 4, 307 - h, 11, 3);
    rect(ctx, i % 2 ? '#e7a48b' : '#70b89d', x - 4, 303 - h, 3, 5);
    rect(ctx, i % 2 ? '#e7a48b' : '#70b89d', x + 4, 300 - h, 3, 9);
  }
  return Buffer.from(ctx.data);
}

function wrap(text, length = 15, maxLines = 3) {
  const chars = [...String(text).replace(/\s+/g, ' ').trim()];
  const lines = [];
  for (let i = 0; i < chars.length && lines.length < maxLines; i += length) lines.push(chars.slice(i, i + length).join(''));
  if (chars.length > length * maxLines && lines.length) lines[lines.length - 1] = `${lines.at(-1).slice(0, -1)}…`;
  return lines.join('\n');
}

function captionPlan(episode, duration) {
  const scale = duration / 100;
  const captions = [];
  const add = (text, start, end, y, size = 52, fill = '0xeaf9f3', x = '(w-text_w)/2') => {
    captions.push({ text, start: start * scale, end: end * scale, y, size, fill, x });
  };
  add('深 海 纪 事', 0, 100, 75, 42, '0x8bd7c5');
  add(`第 ${String(episode.day).padStart(3, '0')} 天   /   海底新闻`, 0, 100, 143, 27, '0x8caaa9');
  add('AI 生成 · 模拟世界', 0, 100, 1840, 27, '0xb0cbc3');
  if (episode.vote.source === 'simulated') add('本期投票为模拟数据', 3, 20, 1710, 27, '0xd4b68a');
  add(wrap(episode.hook, 15, 3), 0, 3, 1200, 57);
  add(wrap(episode.vote.question, 15, 2), 3, 18, 300, 52);
  const a = episode.vote.options[0];
  const b = episode.vote.options[1];
  add(`A  ${a.label}`, 3, 18, 590, 45, '0x8bd7c5', '95');
  add(`B  ${b.label}`, 3, 18, 1165, 45, '0xf2b299', '95');
  add(`${a.votes} 赞`, 3, 18, 695, 70, '0xe9faf3', '95');
  add(`${b.votes} 赞`, 3, 18, 1270, 70, '0xe9faf3', '95');
  const comments = episode.vote.comments.slice(0, 6);
  comments.forEach((comment, index) => {
    add(`${comment.nickname}  +${comment.likes}`, 3 + index * 1.5, 18,
      comment.side === 'A' ? 840 + (index % 3) * 70 : 1415 + (index % 3) * 70, 29,
      comment.side === 'A' ? '0x8bd7c5' : '0xe9b8a5', '110');
  });
  add(a.votes === b.votes ? '两边同票 · 共同商议' : `本期选择：${a.votes > b.votes ? a.label : b.label}`, 18, 20, 1300, 58);
  add(`今日镜头前往：${episode.filmingRegion || '浅滩'}`, 18, 20, 1415, 38, '0xa5d9c5');
  episode.protagonists.forEach((fish, index) => {
    const start = 20 + index * 15;
    add(`${fish.pool}池   /   ${fish.fishId}`, start, start + 15, 325, 39, '0x83cdbc');
    add(fish.name, start, start + 15, 400, 82);
    add(wrap(fish.headline, 15, 2), start, start + 15, 1150, 55);
    const entries = fish.story.split('\n').filter(Boolean).slice(-3);
    entries.forEach((entry, storyIndex) => {
      const interval = 15 / entries.length;
      add(wrap(entry, 17, 4), start + storyIndex * interval, start + (storyIndex + 1) * interval - 0.03, 1390, 40, '0xb6ceca');
    });
  });
  add('它们，也在这片海里', 65, 92, 295, 55);
  const protagonists = new Set(episode.protagonists.map(fish => fish.fishId));
  const ensemble = episode.cast.filter(fish => !protagonists.has(fish.fishId)).slice(0, 27);
  ensemble.forEach((fish, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const y = 550 + row * 125;
    add(fish.fishId, 65 + index * 0.65, 92, y, 24, '0x8fbdba', String(75 + column * 335));
    add([...fish.name].slice(0, 6).join(''), 65 + index * 0.65, 92, y + 37, 31, '0xe7f4ee', String(75 + column * 335));
  });
  add('每一条鱼，都有自己的明天', 92, 100, 1135, 55);
  add('下一次洋流，会带来怎样的故事？', 92, 100, 1240, 39, '0xa6c8c2');
  add('关注自己的鱼，也记得照顾自己', 94, 100, 1430, 37, '0xe5b895');
  return captions;
}

async function writeFilter(directory, episode, duration, font) {
  const captions = captionPlan(episode, duration);
  const escapedFont = font.replaceAll('\\', '/').replaceAll(':', '\\:').replaceAll("'", "\\'");
  const filters = ['scale=1080:1920:flags=neighbor', 'setsar=1'];
  for (const [index, caption] of captions.entries()) {
    const filename = `caption-${String(index).padStart(3, '0')}.txt`;
    await writeFile(path.join(directory, filename), caption.text, 'utf8');
    filters.push(`drawtext=fontfile='${escapedFont}':textfile='${filename}':expansion=none:fontsize=${caption.size}:fontcolor=${caption.fill}:line_spacing=14:borderw=2:bordercolor=0x061c25@0.7:x=${caption.x}:y=${caption.y}:enable='gte(t,${caption.start.toFixed(3)})*lt(t,${caption.end.toFixed(3)})'`);
  }
  await writeFile(path.join(directory, 'filters.txt'), filters.join(',\n'), 'utf8');
  return captions;
}

function makeAudio(duration, captions) {
  const rate = 22050;
  const count = Math.ceil(duration * rate);
  const samples = new Float32Array(count);
  let noiseState = 91821;
  const noise = () => {
    noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
    return noiseState / 4294967296 * 2 - 1;
  };
  let filtered = 0;
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    filtered = filtered * 0.985 + noise() * 0.015;
    samples[i] = 0.026 * Math.sin(TAU * 55 * t) + 0.012 * Math.sin(TAU * 82.4 * t) + filtered * 0.055;
  }
  const tone = (when, frequency, seconds, volume, glide = 0) => {
    const start = Math.max(0, Math.floor(when * rate));
    const length = Math.min(Math.floor(seconds * rate), count - start);
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const envelope = Math.min(1, t * 150) * Math.exp(-t * 8 / seconds);
      samples[start + i] += Math.sin(TAU * (frequency * t + glide * t * t)) * envelope * volume;
    }
  };
  for (const [index, caption] of captions.entries()) {
    if (caption.start > 0) tone(caption.start, 510 + index % 7 * 31, 0.12, 0.06);
  }
  for (let t = 0.6; t < duration; t += 1.73) tone(t, 800 + (Math.floor(t) % 5) * 110, 0.25, 0.035, -300);
  for (const time of [18, 20, 65, 92]) {
    const start = Math.floor(time * duration / 100 * rate);
    const length = Math.floor(0.32 * rate);
    for (let i = 0; i < length && start + i < count; i++) samples[start + i] += noise() * (1 - i / length) * 0.055;
  }
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    const edge = Math.min(1, i / (rate * 0.5), (count - i) / (rate * 0.7));
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * edge)) * 32767), 44 + i * 2);
  }
  return wav;
}

function renderFrame(ctx, background, drawFish, fishById, episode, t, duration) {
  ctx.data.set(background);
  const scriptTime = t * 100 / duration;
  if (scriptTime >= 18 && scriptTime < 65 && episode.filmingRegion === '珊瑚城') {
    rect(ctx, '#52735b15', 0, 34, WIDTH, 270);
    for (let i = 0; i < 4; i++) {
      rect(ctx, '#cb7d7b', 15 + i * 47, 273 - i % 2 * 12, 4, 25 + i % 2 * 12);
      rect(ctx, '#dca18d', 9 + i * 47, 277 - i % 2 * 12, 16, 4);
    }
  }
  // Slow light rays and rising bubbles keep the whole episode alive.
  for (let beam = 0; beam < 4; beam++) {
    const x = 8 + beam * 51 + Math.sin(t * 0.2 + beam) * 6;
    for (let y = 35; y < 280; y += 4) rect(ctx, '#69cbb308', x + y * 0.16, y, 12, 4);
  }
  for (let i = 0; i < 18; i++) {
    const y = 290 - (i * 37 + t * (5 + i % 4)) % 265;
    const x = 9 + i * 29 % 165 + Math.sin(t + i) * 3;
    rect(ctx, '#92ccba45', x, y, 1, 2);
    if (i % 3 === 0) rect(ctx, '#92ccba20', x + 1, y + 1, 1, 1);
  }
  const fishList = [...fishById.values()];
  for (let i = 0; i < Math.min(16, fishList.length); i++) {
    const x = ((i * 43 + t * (i % 2 ? 4 : -3) + 1000) % 225) - 30;
    const y = 85 + i * 31 % 170 + Math.sin(t * 0.8 + i) * 4;
    drawFish(ctx, fishList[i], x, y, 0.4 + i % 3 * 0.1, i % 2 === 0, t);
  }
  rect(ctx, '#061a23d9', 0, 0, 180, 34);
  rect(ctx, '#061a2399', 0, 303, 180, 17);

  const heroAt = index => fishById.get(episode.protagonists[index]?.fishId) || fishList[index % Math.max(1, fishList.length)];
  if (scriptTime < 3) {
    const hero = heroAt(0);
    if (hero) drawFish(ctx, hero, 43 + Math.sin(t * 2) * 3, 112 + Math.sin(t * 3) * 3, 3.2, false, t);
    rect(ctx, '#061a23d9', 7, 194, 166, 93);
  } else if (scriptTime < 18) {
    rect(ctx, '#134c4be8', 10, 92, 160, 88);
    rect(ctx, '#403634ed', 10, 188, 160, 88);
    rect(ctx, '#74cbb2', 10, 92, 2, 88);
    rect(ctx, '#e6a48c', 10, 188, 2, 88);
    const a = episode.vote.options[0].votes;
    const b = episode.vote.options[1].votes;
    const fill = Math.min(1, (scriptTime - 3) / 13);
    rect(ctx, '#82cdb1', 16, 168, 145 * a / Math.max(1, a + b) * fill, 3);
    rect(ctx, '#e3a78e', 16, 264, 145 * b / Math.max(1, a + b) * fill, 3);
  } else if (scriptTime < 20) {
    const hero = heroAt(0);
    if (hero) drawFish(ctx, hero, 45, 110, 3, false, t);
    rect(ctx, '#061a23d9', 5, 209, 170, 42);
  } else if (scriptTime < 65) {
    const index = Math.min(2, Math.floor((scriptTime - 20) / 15));
    const hero = heroAt(index);
    if (hero) drawFish(ctx, hero, 43 + Math.sin(t * 1.4) * 3, 122 + Math.sin(t * 2.1) * 4, 3.2, false, t);
    rect(ctx, '#061a23ed', 6, 187, 168, 108);
    rect(ctx, '#73bea3', 6, 187, 2, 108);
  } else if (scriptTime < 92) {
    rect(ctx, '#061a23e8', 7, 82, 166, 200);
    const heroes = new Set(episode.protagonists.map(fish => fish.fishId));
    const ensemble = episode.cast.filter(fish => !heroes.has(fish.fishId)).slice(0, 27);
    ensemble.forEach((member, index) => {
      if (scriptTime < 65 + index * 0.65) return;
      const fish = fishById.get(member.fishId);
      if (!fish) return;
      const x = 34 + index % 3 * 56;
      const y = 88 + Math.floor(index / 3) * 21;
      drawFish(ctx, fish, x, y, 0.65, index % 2 === 0, t);
    });
  } else {
    for (let i = 0; i < 12; i++) {
      const x = 12 + i * 31 % 155;
      const y = 280 - ((scriptTime - 92) * 18 + i * 20) % 220;
      rect(ctx, '#a5dbc2', x, y, 2, 2);
      rect(ctx, '#a5dbc230', x - 1, y - 1, 4, 4);
    }
    rect(ctx, '#061a23de', 5, 180, 170, 82);
  }
  rect(ctx, '#5fbaa4', 0, 318, WIDTH * t / duration, 2);
  return ctx.data;
}

/** Exports an actual local H.264/AAC MP4; no remote generation service is used. */
export async function renderEpisode({ world, episode, outDir, duration = 100, onProgress = () => {} }) {
  if (![15, 100].includes(duration)) throw new Error('视频时长只能选择 15 秒预览或 100 秒完整成片。');
  if (!episode?.review?.approved || episode.review.checks?.length !== 5 || !episode.review.checks.every(value => value === true)) {
    throw new Error('请先完成五项发布前审核，再导出视频。');
  }
  if (!episode.cast?.length) throw new Error('海洋中还没有可用于拍摄的鱼。');
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) throw new Error('未找到 FFmpeg。请运行 npm install，或设置 FFMPEG_PATH。');
  const font = getFont();
  if (!font) throw new Error('未找到中文字体。请用 DEEPSEA_FONT 指向一份中文字体文件。');
  const { drawFishPixel } = await import('../web/sprites.js');
  const resolvedOut = path.resolve(outDir);
  await mkdir(resolvedOut, { recursive: true });
  const directory = await mkdtemp(path.join(resolvedOut, '.render-'));
  const filename = `day-${String(episode.day).padStart(4, '0')}${duration === 15 ? '-preview' : ''}.mp4`;
  const target = path.join(resolvedOut, filename);
  const partial = path.join(directory, 'output.mp4');
  let child;
  let stderr = '';
  let processError;
  try {
    onProgress(1);
    const captions = await writeFilter(directory, episode, duration, font);
    await writeFile(path.join(directory, 'ocean.wav'), makeAudio(duration, captions));
    const args = [
      '-hide_banner', '-loglevel', 'warning', '-y',
      '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', `${WIDTH}x${HEIGHT}`, '-framerate', String(FPS), '-i', 'pipe:0',
      '-i', 'ocean.wav', '-filter_script:v', 'filters.txt',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-t', String(duration), '-shortest', partial,
    ];
    child = spawn(ffmpegPath, args, { cwd: directory, windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-10000); });
    child.on('error', error => { processError = error; });
    child.stdin.on('error', error => { processError = error; });
    const completion = new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg 导出失败：${stderr || processError?.message || `退出码 ${code}`}`)));
    });
    // Attach immediately so an early filter error cannot become an unhandled rejection.
    completion.catch(() => {});
    const frame = new Raster();
    const background = baseBackground();
    const fishById = new Map();
    const current = new Set((world.residents || []).map(resident => resident.currentFishId));
    for (const fish of world.fish || []) {
      if (!current.size || current.has(fish.id)) fishById.set(fish.residentId || fish.id, fish);
    }
    const frames = duration * FPS;
    for (let index = 0; index < frames; index++) {
      if (processError || child.exitCode !== null) {
        await completion;
        throw processError || new Error(`FFmpeg 提前结束：${stderr}`);
      }
      const data = renderFrame(frame, background, drawFishPixel, fishById, episode, index / FPS, duration);
      if (!child.stdin.write(Buffer.from(data))) await once(child.stdin, 'drain');
      if (index % FPS === 0) onProgress(Math.round(4 + index / frames * 88));
    }
    child.stdin.end();
    onProgress(94);
    await completion;
    const { copyFile } = await import('node:fs/promises');
    await copyFile(partial, target);
    const details = await stat(target);
    onProgress(100);
    return { filename, url: `/out/${filename}`, size: details.size, duration, width: 1080, height: 1920, fps: FPS };
  } catch (error) {
    if (child && child.exitCode === null) {
      const stopped = new Promise(resolve => child.once('close', resolve));
      child.stdin?.destroy();
      child.kill();
      await stopped;
    }
    if (stderr && !String(error.message).includes(stderr)) throw new Error(`${error.message}\n${stderr}`);
    throw error;
  } finally {
    // directory was created by mkdtemp directly inside this resolved export directory.
    if (path.dirname(directory) === resolvedOut && path.basename(directory).startsWith('.render-')) {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
