import { readFile } from 'node:fs/promises';
import { createEpisode, applyReview, writeEpisode } from '../lib/episode.mjs';
import { renderEpisode } from '../lib/video.mjs';
import { readWorld, OUT_DIR } from '../lib/store.mjs';

const world = await readWorld();
const outDir = OUT_DIR;
const args = process.argv.slice(2);
const duration = args.includes('--preview') ? 15 : 100;
let episode;
try {
  episode = JSON.parse(await readFile(`${outDir}/day-${String(world.day).padStart(4, '0')}.json`, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  episode = createEpisode(world);
}
// This explicit flag is for the operator who has already completed the checklist.
if (args.includes('--reviewed')) applyReview(episode, [true, true, true, true, true]);
await writeEpisode(episode, outDir);
if (!episode.review.approved) {
  console.error('待审清单已写入 out。请在运营台完成五项审核后导出。');
  console.error('命令行操作者确认已完成全部审核后，可使用 --reviewed。');
  process.exitCode = 1;
} else {
  const result = await renderEpisode({
    world, episode, outDir, duration,
    onProgress: progress => { if (progress % 10 === 0 || progress === 100) console.log(`导出 ${progress}%`); },
  });
  console.log(`已生成 ${duration} 秒视频：${result.filename}（${(result.size / 1024 / 1024).toFixed(2)} MB）`);
}
