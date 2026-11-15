import { updateWorld } from '../lib/store.mjs';
import { tickWorld } from '../lib/world.mjs';
const days = Number(process.argv[2] || 1);
if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('天数必须是 1–30 的整数。');
const { world } = await updateWorld(world => tickWorld(world, days));
console.log(`已推进 ${days} 天，现在是第 ${world.day} 天。`);
