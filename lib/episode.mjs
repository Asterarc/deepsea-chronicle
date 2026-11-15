import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const REVIEW_ITEMS = [
  '涉及真实用户的昵称和头像已获授权或完成脱敏',
  '广告或品牌内容已显著标识；无广告时也已确认',
  '发布时将勾选“内容由 AI 生成”',
  '涉及远征的名单和反悔窗口已提前公示；无远征时也已确认',
  '已检查文案措辞、事实依据和模拟数据标识',
];

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.codePointAt(0), 16777619);
  return result >>> 0;
}

function randomFor(seed) {
  let state = hash(seed) || 1;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 每个昵称在同一阵营仅保留点赞最高的一条，避免重复导入累计计票。 */
export function validateVotes(input) {
  const votes = Array.isArray(input) ? input : input?.votes;
  if (!Array.isArray(votes)) throw new Error('投票文件必须是数组，或包含 votes 数组的对象。');
  if (votes.length > 10000) throw new Error('一次最多导入 10000 条投票。');
  const unique = new Map();
  for (const [index, vote] of votes.entries()) {
    if (!vote || typeof vote !== 'object') throw new Error(`第 ${index + 1} 条投票格式不正确。`);
    if (typeof vote.nickname !== 'string') throw new Error(`第 ${index + 1} 条投票缺少昵称。`);
    const nickname = vote.nickname.trim();
    if (!nickname || [...nickname].length > 24 || /[\u0000-\u001f\u007f]/u.test(nickname)) {
      throw new Error(`第 ${index + 1} 条昵称须为 1–24 个可见字符。`);
    }
    if (!['A', 'B'].includes(vote.side)) throw new Error(`第 ${index + 1} 条阵营必须为 A 或 B。`);
    if (typeof vote.likes !== 'number' || !Number.isFinite(vote.likes) || vote.likes < 0 || vote.likes > 10000000) {
      throw new Error(`第 ${index + 1} 条点赞数须为 0–10000000 的有限数字。`);
    }
    const clean = { nickname, side: vote.side, likes: Math.floor(vote.likes) };
    const key = `${nickname}\u0000${vote.side}`;
    if (!unique.has(key) || unique.get(key).likes < clean.likes) unique.set(key, clean);
  }
  return [...unique.values()];
}

function getCurrentFish(world) {
  const currentIds = new Set((world.residents || []).map(item => item.currentFishId));
  const seen = new Set();
  return (world.fish || []).filter(fish => {
    const id = fish.residentId || fish.id;
    if (currentIds.size && !currentIds.has(fish.id)) return false;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const identity = fish => fish.residentId || fish.id;
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function recentLogs(world, fish) {
  return (world.actionLog || [])
    .filter(log => log.fishId === identity(fish) && numeric(log.day) >= numeric(world.day) - 2 && numeric(log.day) <= world.day)
    .sort((a, b) => numeric(a.day) - numeric(b.day) || String(a.id).localeCompare(String(b.id)));
}

function asCast(fish, pool) {
  return { fishId: identity(fish), name: fish.name, pool, generation: fish.generation, region: fish.region };
}

function storyFor(world, fish, pool) {
  const logs = recentLogs(world, fish);
  const selected = logs.slice(-3);
  const latest = selected.at(-1);
  const story = selected.length
    ? selected.map(log => `第${log.day}天：${log.text}${log.reason ? `（${log.reason}）` : ''}`).join('\n')
    : `第${world.day}天，${fish.name}在${fish.region}。活力${Math.round(fish.vitality)}，心情${Math.round(fish.mood)}。尚无最近三天的行为记录，等待下一次世界推进。`;
  return {
    ...asCast(fish, pool),
    headline: latest?.text || `${fish.name}的第一份档案`,
    story,
    reason: latest?.reason || '依据当前世界档案；未编造尚未发生的经历。',
    sourceLogIds: selected.map(log => log.id).filter(Boolean),
  };
}

/** 三池选材是世界快照的纯函数，不会为了节目效果改写世界。 */
export function createEpisode(world, votes = null) {
  if (!world || !Number.isInteger(world.day) || world.day < 0) throw new Error('世界日期不正确。');
  const allFish = getCurrentFish(world);
  const random = randomFor(`episode:${world.day}:${world.rngState || 0}:${allFish.length}`);
  const target = Math.min(30, allFish.length);
  const counts = [Math.ceil(target / 3), Math.ceil((target - Math.ceil(target / 3)) / 2)];
  counts.push(target - counts[0] - counts[1]);
  const selected = new Set();
  const popularity = fish => (1 + numeric(fish.fame)) * (1 + numeric(fish.ageDays))
    * (1 + numeric(fish.scars)) * Math.max(1, numeric(fish.generation));
  const drama = fish => recentLogs(world, fish).reduce((total, log) => total + 1 + numeric(log.importance), 0)
    + Math.abs(numeric(fish.mood) - 60) / 20;
  const take = (ranked, count, pool) => {
    const result = ranked.filter(fish => !selected.has(identity(fish))).slice(0, count);
    result.forEach(fish => selected.add(identity(fish)));
    return { pool, fish: result };
  };
  const tie = (a, b) => identity(a).localeCompare(identity(b));
  const residents = new Map((world.residents || []).map(item => [item.id, item]));
  const pools = [
    take([...allFish].sort((a, b) => popularity(b) - popularity(a) || tie(a, b)), counts[0], '人气'),
    take([...allFish].sort((a, b) => drama(b) - drama(a) || tie(a, b)), counts[1], '故事'),
  ];
  const lottery = allFish.filter(fish => !selected.has(identity(fish))).map(fish => {
    const resident = residents.get(identity(fish));
    const appearances = numeric(fish.appearanceCount ?? resident?.appearanceCount ?? resident?.appearances);
    const daysSince = Math.max(1, world.day - numeric(resident?.lastFeaturedDay));
    const weight = appearances === 0 ? 20 : 1 + Math.min(4, daysSince / 7);
    return { fish, key: Math.pow(Math.max(0.000001, random()), 1 / weight) };
  }).sort((a, b) => b.key - a.key || tie(a.fish, b.fish));
  pools.push(take(lottery.map(item => item.fish), counts[2], '随机'));
  const protagonists = pools.filter(pool => pool.fish.length).map(({ fish, pool }) => {
    const withLogs = fish.find(item => recentLogs(world, item).length);
    return storyFor(world, withLogs || fish[0], pool);
  });
  const cast = pools.flatMap(({ fish, pool }) => fish.map(item => asCast(item, pool)));
  const simulatedVotes = Array.from({ length: 28 }, (_, index) => ({
    nickname: `模拟居民${String(index + 1).padStart(2, '0')}`,
    side: random() > 0.5 ? 'A' : 'B',
    likes: 1 + Math.floor(random() * 40),
  }));
  const comments = validateVotes(votes === null ? simulatedVotes : votes);
  const options = [
    { id: 'A', label: '留在珊瑚城', votes: 0 },
    { id: 'B', label: '一起去浅滩', votes: 0 },
  ];
  for (const comment of comments) options.find(option => option.id === comment.side).votes += comment.likes;
  const hasExpedition = (world.expeditions || []).some(item => item.status === 'departed' && item.departedOnDay >= world.day - 1);
  return {
    id: `day-${String(world.day).padStart(4, '0')}`,
    day: world.day,
    title: `深海纪事 · 第 ${world.day} 天`,
    hook: protagonists[0] ? `${protagonists[0].fishId} ${protagonists[0].headline}` : '海洋正在等待第一位居民。',
    vote: {
      question: '如果洋流转冷，我们该留在珊瑚城，还是一起去浅滩？',
      options,
      source: votes === null ? 'simulated' : 'imported',
      comments: [...comments].sort((a, b) => b.likes - a.likes),
      method: '按每条评论的点赞数累计；同昵称同阵营仅保留最高点赞的一条。',
    },
    filmingRegion: options[0].votes > options[1].votes ? '珊瑚城' : '浅滩',
    protagonists,
    cast,
    pools: pools.map(({ pool, fish }) => ({ name: pool, count: fish.length })),
    timeline: [
      { start: 0, end: 3, title: '开场钩子' },
      { start: 3, end: 18, title: '两边的声音' },
      { start: 18, end: 20, title: '计票揭晓' },
      { start: 20, end: 65, title: '三条鱼的小传' },
      { start: 65, end: 92, title: '海底群像' },
      { start: 92, end: 100, title: '下一天的约定' },
    ],
    review: { checks: [false, false, false, false, false], items: [...REVIEW_ITEMS], approved: false, hasExpedition },
    files: {},
    dataNotice: votes === null ? '本期使用模拟居民与模拟投票，未接入真实平台评论。' : '投票由本地文件导入；昵称授权与内容标识需人工复核。',
  };
}

export function applyReview(episode, checks) {
  if (!Array.isArray(checks) || checks.length !== 5 || checks.some(value => typeof value !== 'boolean')) {
    throw new Error('审核清单必须包含五个明确的布尔值。');
  }
  episode.review = { ...episode.review, checks: [...checks], items: [...REVIEW_ITEMS], approved: checks.every(Boolean) };
  return episode;
}

function markdownEscape(value) {
  return String(value ?? '').replace(/[\\`*_{}\[\]<>#|]/g, '\\$&');
}

export async function writeEpisode(episode, outDir) {
  await mkdir(outDir, { recursive: true });
  const base = `day-${String(episode.day).padStart(4, '0')}`;
  episode.files = { ...episode.files, json: `/out/${base}.json`, markdown: `/out/${base}.md` };
  const text = [
    `# ${episode.title}`,
    '',
    `> ${episode.dataNotice}`,
    '',
    '## 发布前审核',
    '',
    ...REVIEW_ITEMS.map((item, index) => `- [${episode.review.checks[index] ? 'x' : ' '}] ${item}`),
    '',
    `审核状态：${episode.review.approved ? '已完成本地审核；发布仍需在平台勾选 AI 标识。' : '待审核，不可导出。'}`,
    '',
    '## 开场',
    '',
    markdownEscape(episode.hook),
    '',
    '## 两边的声音',
    '',
    episode.vote.question,
    ...episode.vote.options.map(option => `- ${option.id}：${option.label} — ${option.votes} 赞`),
    '',
    `来源：${episode.vote.source === 'simulated' ? '模拟投票' : '人工导入'}。${episode.vote.method}`,
    '',
    '## 三条主角',
    '',
    ...episode.protagonists.flatMap(fish => [
      `### ${markdownEscape(fish.fishId)} ${markdownEscape(fish.name)}（${fish.pool}池）`,
      '', markdownEscape(fish.headline), '', markdownEscape(fish.story), '', `选材依据：${markdownEscape(fish.reason)}`, '',
    ]),
    '## 群像名单',
    '',
    ...episode.cast.map(fish => `- ${markdownEscape(fish.fishId)} ${markdownEscape(fish.name)} · ${fish.pool}池 · ${fish.region}`),
    '',
    '## 100 秒分镜',
    '',
    ...episode.timeline.map(scene => `- ${scene.start}–${scene.end} 秒：${scene.title}`),
    '',
  ].join('\n');
  await writeFile(path.join(outDir, `${base}.md`), text, 'utf8');
  await writeFile(path.join(outDir, `${base}.json`), `${JSON.stringify(episode, null, 2)}\n`, 'utf8');
  return episode;
}
