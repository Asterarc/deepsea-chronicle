import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

test('首次并发读取单次初始化；并发推进不丢写；失败操作不落盘', async () => {
  process.env.DEEPSEA_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), 'deepsea-store-'));
  const { readWorld, updateWorld, WORLD_PATH } = await import('../lib/store.mjs');
  const { tickWorld } = await import('../lib/world.mjs');
  const worlds = await Promise.all(Array.from({ length: 8 }, () => readWorld()));
  assert.equal(new Set(worlds.map(world => world.rngState)).size, 1);
  const day = worlds[0].day;
  await Promise.all(Array.from({ length: 12 }, () => updateWorld(world => tickWorld(world, 1))));
  assert.equal((await readWorld()).day, day + 12);
  const before = await readFile(WORLD_PATH, 'utf8');
  await assert.rejects(updateWorld(world => { world.day = 999; throw new Error('模拟失败'); }), /模拟失败/);
  assert.equal(await readFile(WORLD_PATH, 'utf8'), before);
  assert.equal((await readWorld()).day, day + 12);
});
