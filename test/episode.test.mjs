import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createEpisode, validateVotes, applyReview, writeEpisode } from '../lib/episode.mjs';
import { renderEpisode } from '../lib/video.mjs';

function fixture(count = 96, day = 8) {
  const world = { day, rngState: 412, residents: [], fish: [], actionLog: [], relationships: [], expeditions: [] };
  for (let i = 1; i <= count; i++) {
    const id = `#${String(i).padStart(4, '0')}`;
    world.residents.push({ id, name: `模拟鱼${i}`, currentFishId: `${id}:g1`, isDemo: true, appearanceCount: 0 });
    world.fish.push({ id: `${id}:g1`, residentId: id, name: `模拟鱼${i}`, generation: 1, species: '灯鱼', palette: '青', pattern: '纯色', trait: '好奇心重', region: '浅滩', ageDays: day, vitality: 58, mood: 60, fame: i, scars: 0, status: 'alive' });
    world.actionLog.push({ id: `log-${i}`, day, fishId: id, type: '收藏', text: `在第${i}号礁石找到一枚亮片`, reason: '爱收藏的性格触发', importance: i % 4 });
  }
  return world;
}

test('三池选出30条互不重复的鱼，三位主角来自各自池，且不改写世界', () => {
  const world = fixture();
  const before = structuredClone(world);
  const episode = createEpisode(world);
  assert.equal(episode.cast.length, 30);
  assert.equal(new Set(episode.cast.map(item => item.fishId)).size, 30);
  assert.deepEqual(episode.pools.map(item => item.count), [10, 10, 10]);
  assert.deepEqual(episode.protagonists.map(item => item.pool), ['人气', '故事', '随机']);
  for (const hero of episode.protagonists) assert.ok(episode.cast.some(item => item.fishId === hero.fishId && item.pool === hero.pool));
  assert.deepEqual(world, before);
  assert.deepEqual(createEpisode(world), episode);
});

test('鱼不足30条也能分池；空世界不会编造主角', () => {
  for (const count of [0, 1, 2, 3, 9, 17, 29]) {
    const episode = createEpisode(fixture(count));
    assert.equal(episode.cast.length, count);
    assert.equal(new Set(episode.cast.map(item => item.fishId)).size, count);
    assert.equal(episode.protagonists.length, Math.min(3, count));
  }
});

test('主角经历能逐条追溯日志，不会使用未来的记录', () => {
  const world = fixture(30);
  world.actionLog.push({ id: 'future', day: 9, fishId: '#0030', text: '未来不可播出的事', reason: '未来', importance: 999 });
  const episode = createEpisode(world);
  for (const hero of episode.protagonists) {
    assert.ok(hero.sourceLogIds.length > 0);
    for (const id of hero.sourceLogIds) {
      const log = world.actionLog.find(item => item.id === id);
      assert.ok(log && log.day <= world.day);
      assert.ok(hero.story.includes(log.text));
    }
    assert.ok(!hero.story.includes('未来不可播出的事'));
  }
  assert.match(createEpisode(fixture(1, 0)).vote.question, /^如果/);
});

test('从未上镜的鱼在随机池中获得更高机会', () => {
  const world = fixture(120);
  for (const resident of world.residents) resident.appearanceCount = Number(resident.id.slice(1)) <= 60 ? 20 : 0;
  let newCount = 0;
  let total = 0;
  for (let day = 1; day <= 80; day++) {
    world.day = day;
    const randomPool = createEpisode(world).cast.filter(item => item.pool === '随机');
    newCount += randomPool.filter(item => Number(item.fishId.slice(1)) > 60).length;
    total += randomPool.length;
  }
  assert.ok(newCount / total > 0.65, `新鱼占比应高于等概率结果，实际 ${newCount}/${total}`);
});

test('投票按点赞计数，重复导入同阵营同昵称取最高点赞', () => {
  const votes = validateVotes([
    { nickname: '  阿蓝 ', side: 'A', likes: 10 },
    { nickname: '阿蓝', side: 'A', likes: 3 },
    { nickname: '小满', side: 'B', likes: 11.9 },
  ]);
  assert.deepEqual(votes, [{ nickname: '阿蓝', side: 'A', likes: 10 }, { nickname: '小满', side: 'B', likes: 11 }]);
  const episode = createEpisode(fixture(), votes);
  assert.equal(episode.vote.source, 'imported');
  assert.deepEqual(episode.vote.options.map(item => item.votes), [10, 11]);
  assert.equal(episode.filmingRegion, '浅滩');
  assert.equal(createEpisode(fixture()).vote.source, 'simulated');
  assert.match(createEpisode(fixture()).dataNotice, /模拟/);
});

test('拒绝错误投票内容和不明确的审核状态', () => {
  for (const value of [null, {}, [{ nickname: '', side: 'A', likes: 2 }], [{ nickname: '鱼', side: 'C', likes: 2 }], [{ nickname: '鱼', side: 'A', likes: -1 }], [{ nickname: '鱼', side: 'A', likes: Infinity }], [{ nickname: '鱼', side: 'A', likes: '5' }]]) {
    assert.throws(() => validateVotes(value));
  }
  const episode = createEpisode(fixture());
  assert.throws(() => applyReview(episode, [true]));
  assert.throws(() => applyReview(episode, [1, 1, 1, 1, 1]));
  applyReview(episode, [true, true, false, true, true]);
  assert.equal(episode.review.approved, false);
  applyReview(episode, [true, true, true, true, true]);
  assert.equal(episode.review.approved, true);
});

test('未审核的纪事无法开始真实视频导出', async () => {
  await assert.rejects(() => renderEpisode({ world: fixture(), episode: createEpisode(fixture()), outDir: '.' }), /审核/);
});

test('待审Markdown和JSON落盘后与页面审核状态一致', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'deepsea-episode-'));
  try {
    const episode = createEpisode(fixture());
    applyReview(episode, [true, true, true, true, true]);
    await writeEpisode(episode, directory);
    const stored = JSON.parse(await readFile(path.join(directory, 'day-0008.json'), 'utf8'));
    const markdown = await readFile(path.join(directory, 'day-0008.md'), 'utf8');
    assert.equal(stored.review.approved, true);
    assert.equal(stored.files.markdown, '/out/day-0008.md');
    assert.equal(markdown.match(/- \[x\]/g).length, 5);
    assert.match(markdown, /模拟居民与模拟投票/);
  } finally {
    if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('deepsea-episode-')) await rm(directory, { recursive: true, force: true });
  }
});
