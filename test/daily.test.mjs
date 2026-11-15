import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('上海09:00日更，每个自然日只推进一次，隔天可再推进', async () => {
  process.env.DEEPSEA_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), 'deepsea-daily-'));
  const { advanceScheduledDay, localDayParts } = await import('../lib/daily.mjs');
  const { readWorld } = await import('../lib/store.mjs');
  const day = (await readWorld()).day;
  assert.deepEqual(localDayParts(new Date('2026-11-15T00:59:00Z')), { date: '2026-11-15', hour: 8 });
  assert.equal(await advanceScheduledDay(new Date('2026-11-15T00:59:00Z')), false);
  assert.equal(await advanceScheduledDay(new Date('2026-11-15T01:00:00Z')), true);
  assert.equal(await advanceScheduledDay(new Date('2026-11-15T07:00:00Z')), false);
  assert.equal(await advanceScheduledDay(new Date('2026-11-16T01:00:00Z')), true);
  assert.equal((await readWorld()).day, day + 2);
});
