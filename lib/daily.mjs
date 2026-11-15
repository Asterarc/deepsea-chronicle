// 本机日更模式：运行期间每天上海时间09:00后最多推进一次，生成待审核清单。
import { readWorld, updateWorld } from './store.mjs';
import { tickWorld } from './world.mjs';

export function localDayParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const value = type => parts.find(part => part.type === type).value;
  return { date: `${value('year')}-${value('month')}-${value('day')}`, hour: Number(value('hour')) };
}

export async function advanceScheduledDay(now = new Date()) {
  const local = localDayParts(now);
  if (local.hour < 9) return false;
  if ((await readWorld()).lastAutoTickOn === local.date) return false;
  let advanced = false;
  await updateWorld(world => {
    if (world.lastAutoTickOn === local.date) return;
    tickWorld(world, 1);
    world.lastAutoTickOn = local.date;
    advanced = true;
  });
  return advanced;
}
