import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';

test('并发导出只启动一个真实编码任务，样片不计正式上镜', { timeout: 30000 }, async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'deepsea-render-'));
  process.env.DEEPSEA_DATA_DIR = temp;
  const { startServer } = await import('../server.mjs');
  const { getFfmpegPath } = await import('../lib/video.mjs');
  if (!getFfmpegPath()) { t.skip('未安装可选视频组件'); return; }
  const server = await startServer(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, value) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  const { episode } = await (await fetch(base + '/api/episode')).json();
  const review = await post('/api/episode/review', { episodeId: episode.id, worldRevision: episode.worldRevision, checks: [true, true, true, true, true] });
  assert.equal(review.status, 200);
  const responses = await Promise.all([post('/api/render', { duration: 15 }), post('/api/render', { duration: 15 })]);
  assert.deepEqual(responses.map(response => response.status).sort(), [202, 409]);
  const accepted = await responses.find(response => response.status === 202).json();
  let job;
  for (let attempt = 0; attempt < 100; attempt++) {
    ({ job } = await (await fetch(base + `/api/render/${accepted.job.id}`)).json());
    if (job.status !== 'running') break;
    await delay(200);
  }
  assert.equal(job.status, 'complete', job.error);
  assert.equal(job.result.duration, 15);
  assert.ok((await stat(path.join(temp, 'out', job.result.filename))).size > 10000);
  const world = await (await fetch(base + '/api/world')).json();
  assert.ok(!world.featuredDays?.length);
  assert.equal(world.residents.filter(resident => resident.appearanceCount).length, 0);
});
