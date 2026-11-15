// 世界规则只依赖数据与可保存的随机种子，便于复盘、备份及离线运行。
export const SPECIES = ['灯鱼', '小丑鱼', '蝴蝶鱼', '鹦嘴鱼', '刺尾鱼', '箱鲀', '海马', '狮子鱼', '比目鱼', '鳐'];
export const PALETTES = ['金', '银', '橙', '青', '紫', '白', '墨', '绯', '翠', '琥珀'];
export const PATTERNS = ['纯色', '竖条', '斑点', '腹部亮带'];
export const TRAITS = ['贪吃', '胆小', '好斗', '爱干净', '话多', '孤僻', '爱管闲事', '护短', '记仇', '好奇心重', '爱收藏', '嘴硬心软'];
export const REGIONS = ['浅滩', '珊瑚城', '深水区', '沉船带'];
export const EVENT_TYPES = ['出海', '吵架', '鲸落', '风暴', '渔民', '入睡', '新生', '洋流', '觅食'];
export const EXPEDITION_ROUTES = ['跟鲸群往北', '下潜沉船带', '跟洋流散步'];
const RISKS = [0.1, 0.3, 0.6, 0.85];
const NAMES = ['小满', '阿蓝', '泡泡', '小盐', '星点', '团团', '海栗', '浅浅', '贝贝', '阿礁', '糯米', '珊珊', '咕噜', '月牙', '银梭', '豆丁', '棉花', '小墨', '橘子', '闪闪', '海葵', '白露', '小岛', '沫沫', '青团', '乌米', '暖暖', '花卷', '石榴', '浮光'];
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round = value => Math.round(value * 100) / 100;
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name}须为 ${min}–${max} 的整数`);
  return value;
}

function seedNumber(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash || 1;
}

function random(world) {
  let state = world.rngState >>> 0;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  world.rngState = state >>> 0 || 1;
  return world.rngState / 4294967296;
}

const pick = (world, values) => values[Math.floor(random(world) * values.length)];
const recordId = (world, prefix) => `${prefix}-${world.nextRecordNumber++}`;
const currentFish = world => {
  const ids = new Set(world.residents.map(resident => resident.currentFishId));
  return world.fish.filter(fish => ids.has(fish.id));
};
const aliveFish = world => currentFish(world).filter(fish => fish.status === 'alive');
const permanentId = id => typeof id === 'string' ? id.split(':g')[0] : '';

function log(world, fish, type, text, reason, importance = 1) {
  const entry = { id: recordId(world, 'action'), day: world.day, fishId: fish.residentId, type, text, reason, importance };
  world.actionLog.push(entry);
  return entry;
}

function eventRecord(world, type, title, description, fishIds = []) {
  const event = { id: recordId(world, 'event'), day: world.day, type, title, description, fishIds };
  world.events.push(event);
  return event;
}

function generationName(name, generation) {
  const numerals = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  return generation === 1 ? name : `${name}${numerals[generation] || generation}世`;
}

/** Upgrade in place; preserve progress, unknown fields, original identities and history. */
export function upgradeWorld(world) {
  if (!world || typeof world !== 'object' || Array.isArray(world)) throw new Error('世界数据必须为对象');
  for (const key of ['residents', 'fish', 'relationships', 'events', 'actionLog', 'expeditions']) {
    if (world[key] === undefined) world[key] = [];
    if (!Array.isArray(world[key])) throw new Error(`世界字段 ${key} 必须为数组`);
  }
  world.schemaVersion = Math.max(finite(world.schemaVersion, 1), 2);
  world.day = Math.max(0, Math.floor(finite(world.day, 0)));
  world.seed ??= 'deepsea-chronicle';
  world.rngState = (finite(world.rngState, seedNumber(world.seed)) >>> 0) || 1;
  const highestResidentNumber = world.residents.reduce((max, resident) => Math.max(max, Number(String(resident.id).slice(1)) || 0), 0);
  world.nextResidentNumber = Math.max(Math.floor(finite(world.nextResidentNumber, 1)), highestResidentNumber + 1);
  if (!Number.isInteger(world.nextRecordNumber) || world.nextRecordNumber < 1) {
    const records = [...world.actionLog, ...world.events, ...world.relationships, ...world.expeditions];
    world.nextRecordNumber = records.reduce((max, record) => Math.max(max, Number(String(record.id).split('-').at(-1)) || 0), 0) + 1;
  }
  const residentMap = new Map(world.residents.map(resident => [resident.id, resident]));
  for (const fish of world.fish) {
    fish.residentId ??= permanentId(fish.id);
    fish.generation = Math.max(1, Math.floor(finite(fish.generation, 1)));
    fish.id ??= `${fish.residentId}:g${fish.generation}`;
    fish.name ??= generationName(residentMap.get(fish.residentId)?.name || fish.residentId, fish.generation);
    fish.species ??= SPECIES[0];
    fish.palette ??= PALETTES[0];
    fish.pattern ??= PATTERNS[0];
    fish.trait ??= TRAITS[0];
    fish.region ??= REGIONS[0];
    fish.status ??= 'alive';
    // 孵化中的下一世尚未出生；升级/载入不能把 null 改成当前日期。
    if (fish.bornOnDay === undefined) fish.bornOnDay = fish.status === 'hatching' ? null : world.day;
    fish.ageDays = Math.max(0, Math.floor(finite(fish.ageDays, world.day - fish.bornOnDay)));
    fish.vitality = round(clamp(finite(fish.vitality, 58)));
    fish.mood = round(clamp(finite(fish.mood, 60)));
    fish.fame = Math.max(0, finite(fish.fame, 0));
    fish.scars = Math.max(0, Math.floor(finite(fish.scars, 0)));
  }
  for (const resident of world.residents) {
    resident.name ??= resident.id;
    resident.isDemo ??= true;
    resident.ownerId ??= null;
    resident.intimacy = clamp(finite(resident.intimacy, 0));
    if (!resident.currentFishId) {
      resident.currentFishId = world.fish.filter(fish => fish.residentId === resident.id).sort((a, b) => b.generation - a.generation)[0]?.id || null;
    }
  }
  for (const relationship of world.relationships) {
    relationship.id ??= recordId(world, 'relation');
    relationship.a = permanentId(relationship.a);
    relationship.b = permanentId(relationship.b);
    relationship.type ??= 'friend';
    relationship.strength = round(clamp(finite(relationship.strength, 20)));
    relationship.since ??= world.day;
  }
  return world;
}

function addResident(world, name, isDemo) {
  if (world.residents.length >= 10000) throw new Error('本地原型最多容纳 10000 位居民');
  const number = world.nextResidentNumber++;
  const id = `#${String(number).padStart(4, '0')}`;
  const fishId = `${id}:g1`;
  const resident = { id, name, isDemo, ownerId: null, intimacy: 0, currentFishId: fishId };
  const fish = {
    id: fishId, residentId: id, name, generation: 1,
    species: pick(world, SPECIES), palette: pick(world, PALETTES),
    pattern: PATTERNS[(number - 1) % PATTERNS.length], trait: pick(world, TRAITS),
    region: '浅滩', bornOnDay: world.day, ageDays: 0,
    vitality: 58, mood: 60, fame: 0, scars: 0, status: 'alive',
  };
  world.residents.push(resident);
  world.fish.push(fish);
  return fish;
}

export function createWorld(count = 96, seed = 'deepsea-chronicle') {
  integer(count, '初始居民数', 0, 10000);
  const world = upgradeWorld({ schemaVersion: 2, day: 0, seed, rngState: seedNumber(seed), nextResidentNumber: 1 });
  for (let index = 0; index < count; index++) {
    const name = index < NAMES.length ? NAMES[index] : `${NAMES[index % NAMES.length]}${Math.floor(index / NAMES.length) + 1}`;
    addResident(world, name, true);
  }
  return world;
}

export function adoptFish(world, name) {
  upgradeWorld(world);
  if (typeof name !== 'string') throw new Error('请填写鱼的名字');
  name = name.trim();
  if ([...name].length < 1 || [...name].length > 16 || /[\u0000-\u001f\u007f]/u.test(name)) throw new Error('名字须为 1–16 个可见字符');
  if (world.residents.some(resident => resident.name === name)) throw new Error('这座海里已有同名居民，请换个名字');
  const fish = addResident(world, name, false);
  log(world, fish, '入海', `${fish.name}游进了浅滩，找到了自己的第一块贝壳。`, '本地创建的新居民，尚未绑定平台账号', 2);
  return fish;
}

function socialCounts(world) {
  const counts = new Map(world.residents.map(resident => [resident.id, { total: 0, friends: 0, rivals: 0 }]));
  for (const relation of world.relationships) {
    for (const id of [relation.a, relation.b]) {
      const value = counts.get(id);
      if (!value) continue;
      value.total++;
      if (relation.type === 'rival') value.rivals++;
      else value.friends++;
    }
  }
  return counts;
}

function addRelationship(world, a, b, type = 'friend', strength = 20, counts = socialCounts(world)) {
  if (!a || !b || a.residentId === b.residentId) return null;
  const existing = world.relationships.find(relation => (relation.a === a.residentId && relation.b === b.residentId) || (relation.a === b.residentId && relation.b === a.residentId));
  if (existing) {
    if (existing.type !== type) existing.type = type;
    existing.strength = round(clamp(existing.strength + strength));
    return existing;
  }
  if (counts.get(a.residentId)?.total >= 8 || counts.get(b.residentId)?.total >= 8) return null;
  const relation = { id: recordId(world, 'relation'), a: a.residentId, b: b.residentId, type, strength, since: world.day };
  world.relationships.push(relation);
  for (const fish of [a, b]) if (counts.has(fish.residentId)) counts.get(fish.residentId).total++;
  return relation;
}

const ACTIONS = {
  贪吃: ['掏鱼粮', '翻找贝壳里的碎屑', '追着气泡找零食'],
  胆小: ['躲进岩缝', '探头观察水面', '贴着珊瑚游过去'],
  好斗: ['巡领地', '抖鳍炫耀', '对着倒影瞪眼'],
  爱干净: ['整理洞穴', '擦亮贝壳', '把海草排整齐'],
  话多: ['对着石头讲故事', '追着邻居聊天', '跟气泡打招呼'],
  孤僻: ['独自看洋流', '在岩石后发呆', '慢慢绕着海草游'],
  爱管闲事: ['检查邻居的洞穴', '围观礁石边的动静', '帮忙摆正海草'],
  护短: ['守在朋友身旁', '巡看熟悉的路口', '给邻居留一块贝壳'],
  记仇: ['隔着礁石瞪邻居', '绕开旧日的路口', '盯着被挪过的贝壳'],
  好奇心重: ['追逐陌生亮光', '研究岩缝里的气泡', '探索礁石背面'],
  爱收藏: ['收藏亮片', '清点洞穴里的贝壳', '把小石子藏进海草'],
  嘴硬心软: ['悄悄送出一片海草', '假装路过朋友洞口', '替邻居挡住洋流'],
};

function dailyAction(world, fish) {
  let action;
  let reason;
  if (fish.vitality < 28) {
    action = '躲进岩缝休息'; reason = `活力只有 ${Math.round(fish.vitality)}，需要保存体力`;
    fish.vitality = clamp(fish.vitality + 3);
  } else if (fish.mood < 30) {
    action = '追着自己的尾巴转圈'; reason = `心情只有 ${Math.round(fish.mood)}，试着让自己开心一点`;
    fish.mood = clamp(fish.mood + 3);
  } else {
    action = pick(world, ACTIONS[fish.trait] || ACTIONS.好奇心重);
    reason = `性格「${fish.trait}」提高了这种行为的概率`;
    fish.mood = clamp(fish.mood + random(world) * 3 - 0.7);
  }
  fish.fame = round(fish.fame + (random(world) < 0.08 ? 1 : 0));
  log(world, fish, '微动作', `${fish.name}在${fish.region}${action}。`, reason);
  if (fish.ageDays > 3 && random(world) < 0.12) {
    const behavior = fish.trait === '爱收藏' ? '整理了洞穴里的亮片' : fish.trait === '爱干净' ? '清理了自己的洞穴' : '给洞穴添了一株海草';
    log(world, fish, '长行为', `${fish.name}${behavior}。`, `已在海里生活 ${fish.ageDays} 天，开始经营自己的住处`, 2);
  }
}

function normalizeFishIds(world, fishIds) {
  if (!Array.isArray(fishIds) || fishIds.length === 0) throw new Error('请至少选择一条参与的鱼');
  const ids = [...new Set(fishIds.map(permanentId))];
  const alive = new Map(aliveFish(world).map(fish => [fish.residentId, fish]));
  if (ids.some(id => !alive.has(id))) throw new Error('参与者必须是当前在世的居民');
  return ids;
}

export function createExpedition(world, { route, fishIds } = {}) {
  upgradeWorld(world);
  if (!EXPEDITION_ROUTES.includes(route)) throw new Error('请选择有效的远征路线');
  const ids = normalizeFishIds(world, fishIds);
  const reserved = new Set(world.expeditions.filter(expedition => expedition.status === 'gathering').flatMap(expedition => expedition.fishIds));
  if (ids.some(id => reserved.has(id))) throw new Error('有居民已参加其他尚未出发的远征');
  const expedition = {
    id: recordId(world, 'expedition'), route, fishIds: ids, status: 'gathering',
    createdOnDay: world.day, departOnDay: world.day + 1,
    minimumParticipants: 50, cancellationNotice: '模拟世界推进 1 天代表 24 小时反悔窗口；不会自动出发。',
  };
  world.expeditions.push(expedition);
  eventRecord(world, '远征集结', `${route}：名单公示`, `${ids.length} 位居民正在集结，至少 50 位且经过 1 天反悔窗口后，仍需手动确认出发。`, ids);
  return expedition;
}

function getExpedition(world, id) {
  const expedition = world.expeditions.find(item => item.id === id);
  if (!expedition) throw new Error('未找到这次远征');
  if (expedition.status !== 'gathering') throw new Error('这次远征已结束集结，不能重复操作');
  return expedition;
}

export function cancelExpedition(world, id) {
  upgradeWorld(world);
  const expedition = getExpedition(world, id);
  expedition.status = 'cancelled';
  expedition.cancelledOnDay = world.day;
  eventRecord(world, '远征取消', '居民决定留在这片海', `${expedition.route}已取消，所有参与者保留原来的生活。`, expedition.fishIds);
  return expedition;
}

export function departExpedition(world, id) {
  upgradeWorld(world);
  const expedition = getExpedition(world, id);
  if (world.day < expedition.departOnDay) throw new Error('24 小时反悔窗口尚未结束，请先推进 1 天');
  if (expedition.fishIds.length < 50) throw new Error('远征至少需要 50 位居民报名');
  const fishIds = normalizeFishIds(world, expedition.fishIds);
  const alive = new Map(aliveFish(world).map(fish => [fish.residentId, fish]));
  const residents = new Map(world.residents.map(resident => [resident.id, resident]));
  const shuffled = [...fishIds];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random(world) * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  const hatchingCount = Math.ceil(fishIds.length * 0.65);
  expedition.hatchingFishIds = shuffled.slice(0, hatchingCount);
  expedition.survivorFishIds = shuffled.slice(hatchingCount);
  expedition.status = 'departed';
  expedition.departedOnDay = world.day;
  for (const [index, residentId] of shuffled.entries()) {
    const fish = alive.get(residentId);
    fish.scars++;
    if (index < hatchingCount) {
      fish.status = 'soul';
      fish.departedOnDay = world.day;
      fish.expeditionId = expedition.id;
      const resident = residents.get(residentId);
      const generation = fish.generation + 1;
      const newFish = {
        ...fish, id: `${residentId}:g${generation}`, name: generationName(resident.name, generation),
        generation, region: '浅滩', ageDays: 0, bornOnDay: null,
        vitality: 58, mood: 60, fame: 0, scars: 0, status: 'hatching',
        hatchOnDay: world.day + [3, 5, 7][index % 3], previousFishId: fish.id,
      };
      delete newFish.departedOnDay;
      world.fish.push(newFish);
      resident.currentFishId = newFish.id;
      log(world, fish, '远航', `${fish.name}跟随远征的光点游向了远海；下一世将在第 ${newFish.hatchOnDay} 天孵化。`, '参与者主动报名，经过反悔窗口后手动确认出发', 5);
    } else {
      fish.vitality = clamp(fish.vitality - 15);
      fish.mood = clamp(fish.mood + 8);
      fish.fame += 3;
      log(world, fish, '归航', `${fish.name}带着一枚旧硬币和新的伤痕回到了${fish.region}。`, `参加「${expedition.route}」后平安归来，带回了故事`, 4);
    }
  }
  eventRecord(world, '远征出发', `${expedition.route}：远海的回声`, `${fishIds.length} 位居民出发，${hatchingCount} 位进入下一世孵化，${fishIds.length - hatchingCount} 位带着故事归来。`, fishIds);
  return expedition;
}

const EFFECTS = {
  出海: { mood: 8, text: '鱼群结伴绕过礁石又回到家园，心情 +8；这次短游不会触发远航。' },
  鲸落: { mood: 20, vitality: 10, text: '远处的巨大身影缓缓落下，鱼群见证了海底的新绿洲。' },
  风暴: { vitality: -8, text: '风暴掠过海面，鱼群躲进礁石，活力 -8；没有居民因此远航。' },
  渔民: { vitality: -14, text: '渔网的影子压下，鱼群及时下潜，活力 -14；所有居民仍在海里。' },
  入睡: { mood: 10, text: '海面安静下来，居民们靠着海草入睡，心情 +10。' },
  洋流: { vitality: -4, text: '冷洋流穿过海区，鱼群调整了方向，活力 -4。' },
  觅食: { mood: 6, vitality: 6, text: '一阵细碎食物缓缓落下，心情和活力各 +6。' },
  水母潮: { mood: 4, text: '透明的水母经过浅滩，居民们隔着安全距离看了一下午。' },
  深海发光: { mood: 5, text: '深处亮起一串蓝光，好奇的鱼停下了游动。' },
  陌生鱼群: { mood: 3, text: '陌生鱼群从礁石外经过，带来了远海的消息。' },
  珊瑚吐卵: { mood: 5, text: '珊瑚的光点随水流上浮，整片海像落了一场雪。' },
  洋流北上: { vitality: -5, text: '北上的洋流改变了老路口，居民们开始寻找避风处。' },
  水温异常: { vitality: -6, text: '今天的水温偏高，居民们在阴凉处多休息了一会儿。' },
  赤潮预警: { vitality: -7, text: '远方传来赤潮预警，浅水居民提前躲进安全的海草区。' },
  沉船发现: { mood: 12, text: '洋流露出沉船的一角，一枚旧硬币引来了围观的居民。' },
};

export function applyEvent(world, type) {
  upgradeWorld(world);
  if (!EVENT_TYPES.includes(type) && !Object.hasOwn(EFFECTS, type)) throw new Error('未知海洋事件');
  const alive = aliveFish(world);
  if (type === '新生') {
    let name = `小浪${world.nextResidentNumber}`;
    while (world.residents.some(resident => resident.name === name)) name += '新';
    const fish = addResident(world, name, true);
    log(world, fish, '入海', `${fish.name}从浅滩探出头，新居民的故事开始了。`, '新生事件只增加模拟居民，不改变其他居民的世代', 3);
    return eventRecord(world, type, '一位新居民入海', `${fish.name}获得了永久编号 ${fish.residentId}。`, [fish.residentId]);
  }
  if (type === '吵架') {
    if (alive.length < 2) throw new Error('吵架事件至少需要两条在世的鱼');
    const aIndex = Math.floor(random(world) * alive.length);
    const a = alive[aIndex];
    const others = alive.filter(fish => fish.residentId !== a.residentId);
    const b = pick(world, others.filter(fish => fish.region === a.region).length ? others.filter(fish => fish.region === a.region) : others);
    const relation = addRelationship(world, a, b, 'rival', 22);
    for (const fish of [a, b]) {
      fish.mood = clamp(fish.mood - 12);
      log(world, fish, '关系事件', `${a.name}和${b.name}为了洞口的一块贝壳拌了嘴。`, relation ? '相遇后形成或加深了对头关系' : '双方社交名额已满，保留争执记录，未增加关系', 3);
    }
    return eventRecord(world, type, '礁石边的一次争执', `${a.name}与${b.name}心情 -12。${relation ? '对头关系已记录。' : '关系上限为 8，未新增关系。'}`, [a.residentId, b.residentId]);
  }
  const effect = EFFECTS[type];
  for (const fish of alive) {
    fish.vitality = round(clamp(fish.vitality + (effect.vitality || 0)));
    fish.mood = round(clamp(fish.mood + (effect.mood || 0)));
    if (['风暴', '渔民', '沉船发现'].includes(type)) fish.scars++;
  }
  return eventRecord(world, type, `${type}经过了这片海`, effect.text, alive.map(fish => fish.residentId));
}

/** One tick equals one simulated day; ordinary changes never kill or replace a fish. */
export function tickWorld(world, days = 1) {
  integer(days, '推进天数', 0, 3650);
  upgradeWorld(world);
  for (let step = 0; step < days; step++) {
    world.day++;
    for (const fish of currentFish(world)) {
      if (fish.status === 'hatching' && world.day >= fish.hatchOnDay) {
        fish.status = 'alive';
        fish.bornOnDay = world.day;
        fish.ageDays = 0;
        log(world, fish, '孵化', `${fish.name}在浅滩破壳归来。`, `继承永久编号 ${fish.residentId}、与主人的亲密度及关系网`, 5);
        eventRecord(world, '孵化', `${fish.name}回来了`, '新一世从浅滩开始，旧一世的档案仍然保留。', [fish.residentId]);
      }
    }
    const alive = aliveFish(world);
    const counts = socialCounts(world);
    for (const fish of alive) {
      fish.ageDays = Math.max(0, world.day - fish.bornOnDay);
      const social = counts.get(fish.residentId) || { friends: 0, rivals: 0 };
      const risk = RISKS[REGIONS.indexOf(fish.region)] || 0.1;
      const drift = (58 - fish.vitality) * 0.07 + random(world) * 7 - 3.5 + social.friends * 1.3 - social.rivals * 1.6 - risk * 3 + (fish.generation >= 3 ? 1 : 0);
      fish.vitality = round(clamp(fish.vitality + drift));
      fish.mood = round(clamp(fish.mood + (60 - fish.mood) * 0.06 + random(world) * 6 - 3));
      dailyAction(world, fish);
      const regionIndex = REGIONS.indexOf(fish.region);
      if (fish.vitality < 25 && regionIndex > 0) {
        fish.region = REGIONS[regionIndex - 1];
        log(world, fish, '迁徙', `${fish.name}搬到了更安静的${fish.region}。`, '活力偏低，主动前往风险更低的水域', 3);
      } else if (fish.ageDays > 3 && fish.vitality > 45 && random(world) < (fish.trait === '好奇心重' ? 0.1 : 0.018)) {
        const oldRegion = fish.region;
        fish.region = pick(world, REGIONS);
        if (oldRegion !== fish.region) log(world, fish, '迁徙', `${fish.name}从${oldRegion}搬到了${fish.region}。`, '活力充足，性格与探索倾向促成了迁徙', 2);
      }
    }
    const byRegion = new Map(REGIONS.map(region => [region, alive.filter(fish => fish.region === region)]));
    for (const fish of alive) {
      if (counts.get(fish.residentId)?.total >= 8 || random(world) > (fish.trait === '孤僻' ? 0.025 : 0.16)) continue;
      const neighbors = byRegion.get(fish.region)?.filter(other => other.residentId !== fish.residentId && counts.get(other.residentId)?.total < 8) || [];
      if (!neighbors.length) continue;
      const other = pick(world, neighbors);
      const prior = world.relationships.some(relation => (relation.a === fish.residentId && relation.b === other.residentId) || (relation.b === fish.residentId && relation.a === other.residentId));
      if (prior) continue;
      const type = random(world) < (fish.trait === '好斗' || other.trait === '好斗' ? 0.55 : 0.12) ? 'rival' : 'friend';
      const relation = addRelationship(world, fish, other, type, 15 + Math.floor(random(world) * 20), counts);
      if (relation) log(world, fish, '关系事件', `${fish.name}和${other.name}${type === 'rival' ? '在礁石边互不相让，结下了梁子' : '分享了一片海草，成了朋友'}。`, `同在${fish.region}，双方关系数均不超过 8，性格影响相处结果`, 3);
    }
    if (world.day % 3 === 0) {
      for (const relation of world.relationships) relation.strength = round(relation.strength - 0.5);
      world.relationships = world.relationships.filter(relation => relation.strength >= 2);
    }
    const chance = random(world);
    if (chance < 0.7) eventRecord(world, '平静日', '今天没有大事', '海草轻轻晃动，每位居民都在过自己的日子。');
    else if (chance < 0.9) applyEvent(world, pick(world, ['水母潮', '深海发光', '陌生鱼群', '珊瑚吐卵']));
    else if (chance < 0.98) applyEvent(world, pick(world, ['洋流北上', '水温异常', '赤潮预警']));
    else applyEvent(world, pick(world, ['风暴', '渔民', '鲸落', '沉船发现']));
    world.actionLog = world.actionLog.filter(entry => entry.day > world.day - 14);
  }
  return world;
}
