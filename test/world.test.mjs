import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, upgradeWorld, tickWorld, applyEvent, adoptFish, createExpedition, cancelExpedition, departExpedition } from '../lib/world.mjs';

test('seeded creation and daily progression are reproducible', () => {
  const a = createWorld(96, '复盘-1');
  const b = createWorld(96, '复盘-1');
  tickWorld(a, 12);
  tickWorld(b, 12);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.rngState, createWorld(96, 'other').rngState);
});

test('upgrade preserves legacy progress and is idempotent', () => {
  const world = createWorld(30, 7);
  delete world.rngState;
  delete world.expeditions;
  delete world.nextRecordNumber;
  world.schemaVersion = 1;
  world.customField = { keep: true };
  world.fish[0].vitality = 23;
  world.day = 19;
  const upgraded = upgradeWorld(world);
  assert.equal(upgraded, world);
  const snapshot = structuredClone(world);
  upgradeWorld(world);
  assert.deepEqual(world, snapshot);
  assert.equal(world.day, 19);
  assert.equal(world.fish[0].vitality, 23);
  assert.equal(world.residents[0].currentFishId, '#0001:g1');
  assert.deepEqual(world.customField, { keep: true });
});

test('180-day world remains bounded, alive, connected and persistent across reload', () => {
  let world = createWorld(96, '180-days');
  tickWorld(world, 90);
  world = JSON.parse(JSON.stringify(world));
  tickWorld(world, 90);
  assert.equal(world.day, 180);
  assert.equal(world.residents.length, 96);
  assert.equal(world.fish.length, 96);
  assert.equal(new Set(world.residents.map(item => item.id)).size, 96);
  assert.equal(new Set(world.residents.map(item => item.name)).size, 96);
  assert.ok(world.relationships.length > 0);
  for (const fish of world.fish) {
    assert.equal(fish.status, 'alive');
    assert.ok(fish.vitality >= 0 && fish.vitality <= 100);
    assert.ok(fish.mood >= 0 && fish.mood <= 100);
    assert.equal(fish.ageDays, 180);
    assert.ok(world.relationships.filter(item => item.a === fish.residentId || item.b === fish.residentId).length <= 8);
  }
  assert.ok(world.actionLog.length > 0);
  assert.ok(world.actionLog.every(entry => entry.day >= 167 && entry.day <= 180 && entry.reason && entry.fishId.startsWith('#')));
  assert.equal(new Set(world.actionLog.map(item => item.id)).size, world.actionLog.length);
  const resumed = JSON.parse(JSON.stringify(world));
  tickWorld(world);
  tickWorld(resumed);
  assert.deepEqual(world, resumed);
});

test('ordinary events cannot cause voyage and new birth adds a resident only', () => {
  const world = createWorld(12, 'events');
  for (let i = 0; i < 20; i++) {
    applyEvent(world, '风暴');
    applyEvent(world, '渔民');
  }
  assert.ok(world.fish.every(fish => fish.status === 'alive' && fish.generation === 1));
  const originalIds = world.fish.map(fish => fish.id);
  for (const type of ['出海', '吵架', '鲸落', '入睡', '洋流', '觅食']) assert.equal(applyEvent(world, type).type, type);
  const birth = applyEvent(world, '新生');
  assert.equal(world.residents.length, 13);
  assert.deepEqual(world.fish.slice(0, 12).map(fish => fish.id), originalIds);
  assert.equal(world.fish.at(-1).generation, 1);
  assert.equal(birth.fishIds.length, 1);
  assert.equal(world.residents.at(-1).isDemo, true);
});

test('adoption validates input and preserves unique permanent identities', () => {
  const world = createWorld(0);
  const fish = adoptFish(world, '  我的鱼  ');
  assert.equal(fish.name, '我的鱼');
  assert.equal(fish.residentId, '#0001');
  assert.equal(world.residents[0].currentFishId, fish.id);
  assert.equal(world.residents[0].isDemo, false);
  for (const name of ['', ' ', 'a'.repeat(17), 'hi\nthere', null, 7]) assert.throws(() => adoptFish(world, name));
  assert.throws(() => adoptFish(world, '我的鱼'), /同名/);
  assert.equal(world.residents.length, 1);
});

test('expedition requires 50 participants and one simulated-day cancellation window', () => {
  const world = createWorld(60, 'window');
  const ids = world.residents.slice(0, 50).map(item => item.id);
  const expedition = createExpedition(world, { route: '跟鲸群往北', fishIds: ids });
  assert.equal(expedition.departOnDay, 1);
  assert.throws(() => departExpedition(world, expedition.id), /反悔窗口/);
  assert.throws(() => createExpedition(world, { route: '跟洋流散步', fishIds: ids }), /其他/);
  tickWorld(world);
  assert.equal(expedition.status, 'gathering');
  assert.ok(world.fish.every(fish => fish.status === 'alive'));
  cancelExpedition(world, expedition.id);
  assert.equal(expedition.status, 'cancelled');
  assert.throws(() => departExpedition(world, expedition.id));
  const tooSmall = createExpedition(world, { route: '下潜沉船带', fishIds: ids.slice(0, 49) });
  tickWorld(world);
  assert.throws(() => departExpedition(world, tooSmall.id), /50/);
  assert.equal(tooSmall.status, 'gathering');
});

test('generations retain identity, intimacy, relationship graph and old-life archives', () => {
  const world = createWorld(60, 'generations');
  world.residents.forEach(resident => { resident.intimacy = 42; });
  world.relationships.push({ id: 'relation-999', a: '#0001', b: '#0002', type: 'friend', strength: 80, since: 0 });
  const expedition = createExpedition(world, { route: '跟鲸群往北', fishIds: world.fish.map(fish => fish.id) });
  tickWorld(world);
  const relationSnapshot = structuredClone(world.relationships);
  departExpedition(world, expedition.id);
  const hatching = world.fish.filter(fish => fish.status === 'hatching');
  assert.ok(hatching.length >= 60 * 0.6 && hatching.length <= 60 * 0.7);
  assert.equal(hatching.length, 39);
  assert.deepEqual(world.relationships, relationSnapshot);
  assert.equal(world.fish.filter(fish => fish.status === 'soul').length, 39);
  assert.equal(new Set(hatching.map(fish => fish.hatchOnDay)).size, 3);
  upgradeWorld(world);
  assert.ok(hatching.every(fish => fish.bornOnDay === null), '尚未孵化的鱼不能提前记录出生日期');
  for (const fish of hatching) {
    const resident = world.residents.find(item => item.id === fish.residentId);
    assert.equal(resident.currentFishId, fish.id);
    assert.equal(resident.intimacy, 42);
    assert.equal(fish.generation, 2);
    assert.equal(fish.scars, 0);
  }
  assert.throws(() => departExpedition(world, expedition.id));
  tickWorld(world, 2);
  assert.equal(hatching.filter(fish => fish.status === 'alive').length, 0);
  tickWorld(world);
  assert.equal(hatching.filter(fish => fish.status === 'alive').length, 13);
  tickWorld(world, 4);
  assert.ok(hatching.every(fish => fish.status === 'alive'));
  assert.equal(world.fish.length, 99);
  assert.equal(world.residents.length, 60);
  assert.ok(world.fish.filter(fish => fish.status === 'soul').every(fish => fish.generation === 1));
});

test('input boundaries reject malformed counts, days, routes and participants', () => {
  for (const count of [-1, 1.2, 10001, NaN, '30']) assert.throws(() => createWorld(count));
  assert.equal(createWorld(0).fish.length, 0);
  const world = createWorld(2);
  for (const days of [-1, 0.1, 3651, Infinity, '1']) assert.throws(() => tickWorld(world, days));
  const snapshot = structuredClone(world);
  assert.equal(tickWorld(world, 0), world);
  assert.deepEqual(world, snapshot);
  assert.throws(() => applyEvent(world, '神秘按钮'));
  assert.throws(() => createExpedition(world, { route: '错路', fishIds: ['#0001'] }));
  assert.throws(() => createExpedition(world, { route: '跟鲸群往北', fishIds: [] }));
  assert.throws(() => createExpedition(world, { route: '跟鲸群往北', fishIds: ['#9999'] }));
  assert.throws(() => upgradeWorld(null));
  assert.throws(() => upgradeWorld({ residents: 'broken' }));
});

test('an empty ocean advances safely and can receive its first resident', () => {
  const world = createWorld(0, 'empty-ocean');
  tickWorld(world, 180);
  assert.equal(world.fish.length, 0);
  assert.equal(world.relationships.length, 0);
  assert.throws(() => applyEvent(world, '吵架'), /两条/);
  const event = applyEvent(world, '新生');
  assert.equal(event.fishIds.length, 1);
  assert.equal(world.residents[0].id, '#0001');
  assert.equal(world.fish[0].bornOnDay, 180);
});
