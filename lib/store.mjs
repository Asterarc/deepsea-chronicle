import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createWorld, upgradeWorld, tickWorld, adoptFish } from './world.mjs';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DATA_DIR = path.resolve(process.env.DEEPSEA_DATA_DIR || path.join(ROOT, 'data'));
export const OUT_DIR = path.join(DATA_DIR, 'out');
export const WORLD_PATH = path.join(DATA_DIR, 'world.json');

let world;
let loading;
let queue = Promise.resolve();

export async function atomicWrite(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temp, file);
}

export function loadWorld() {
  if (loading) return loading;
  if (world) return Promise.resolve(world);
  loading = initializeWorld().catch(error => { world = undefined; throw error; }).finally(() => { loading = null; });
  return loading;
}

async function initializeWorld() {
  await mkdir(OUT_DIR, { recursive: true });
  try {
    world = JSON.parse(await readFile(WORLD_PATH, 'utf8'));
    upgradeWorld(world);
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`世界文件无法读取，已保留原文件：${error.message}`);
    world = createWorld(96, 20261115);
    const regions = ['浅滩', '珊瑚城', '珊瑚城', '深水区', '沉船带'];
    world.fish.forEach((fish, index) => { fish.region = regions[index % regions.length]; });
    tickWorld(world, 8);
  }

  // 第一步创建的世界尚无运营数据。仅扩充这份模拟世界，并先保留原始备份。
  if (world.day === 0 && world.fish.length === 30 && world.residents.every(item => item.isDemo && !item.ownerId)) {
    await mkdir(path.join(DATA_DIR, 'backups'), { recursive: true });
    await copyFile(WORLD_PATH, path.join(DATA_DIR, 'backups', 'world-step1.json'));
    const extraNames = ['阿潮','小礁','露珠','奶盖','青柠','沙沙','小雨','北北','松果','小夜','桃桃','阿光','蓝莓','小麦','团子','荔枝','小浪','岩岩','海棠','米粒','星河','雪团','阿贝','小沧','晚风','柚子','小荷','阿珀','云朵','赤豆','小茸','阿砂','南星','墨丸','笋笋','月白','小舟','海风','布丁','霜叶','阿橙','小笛','水晶','芒果','小羽','竹叶','阿紫','小冰','燕麦','松露','海月','小柔','桂圆','冬青','春水','微澜','小桃','阿翠','玄米','小芽','眠眠','长夏','小虾','远山','清池','夏至'];
    for (const name of extraNames) {
      const fish = adoptFish(world, name);
      world.residents.find(resident => resident.id === fish.residentId).isDemo = true;
    }
    const regions = ['浅滩', '珊瑚城', '珊瑚城', '深水区', '沉船带'];
    world.fish.forEach((fish, index) => { fish.region = regions[index % regions.length]; });
    tickWorld(world, 8);
    world.demoExpanded = true;
  }
  await atomicWrite(WORLD_PATH, world);
  return world;
}

export async function readWorld() {
  await queue;
  return structuredClone(await loadWorld());
}

export function updateWorld(operation, { contentChanged = true } = {}) {
  const task = queue.then(async () => {
    await loadWorld();
    const draft = structuredClone(world);
    const result = await operation(draft);
    if (contentChanged) draft.contentRevision = (world.contentRevision || 0) + 1;
    await copyFile(WORLD_PATH, `${WORLD_PATH}.backup`);
    await atomicWrite(WORLD_PATH, draft);
    world = draft;
    return { world: structuredClone(world), result };
  });
  queue = task.catch(() => {});
  return task;
}
