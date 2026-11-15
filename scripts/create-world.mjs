// 第一步：创建世界并保存。这里只生成模拟居民，不绑定任何真实用户。
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dataDirectory = new URL('../data/', import.meta.url);
const worldFile = new URL('world.json', dataDirectory);

const names = [
  '小满', '阿蓝', '泡泡', '小盐', '星点', '团团', '海栗', '浅浅', '贝贝', '阿礁',
  '糯米', '珊珊', '咕噜', '月牙', '银梭', '豆丁', '棉花', '小墨', '橘子', '闪闪',
  '海葵', '白露', '小岛', '沫沫', '青团', '乌米', '暖暖', '花卷', '石榴', '浮光',
];
const species = ['灯鱼', '小丑鱼', '蝴蝶鱼', '鹦嘴鱼', '刺尾鱼', '箱鲀', '海马', '狮子鱼', '比目鱼', '鳐'];
const palettes = ['金', '银', '橙', '青', '紫', '白', '墨', '绯', '翠', '琥珀'];
const patterns = ['纯色', '竖条', '斑点', '腹部亮带'];
const traits = ['贪吃', '胆小', '好斗', '爱干净', '话多', '孤僻', '爱管闲事', '护短', '记仇', '好奇心重', '爱收藏', '嘴硬心软'];

const world = {
  schemaVersion: 1,
  day: 0,
  nextResidentNumber: names.length + 1,
  residents: [],
  fish: [],
  relationships: [],
  events: [],
  actionLog: [],
};

for (const [index, name] of names.entries()) {
  const number = index + 1;
  const residentId = `#${String(number).padStart(4, '0')}`;
  const fishId = `${residentId}:g1`;

  // residentId 是永久编号；fishId 标识某一世，方便以后保留历代档案。
  world.residents.push({
    id: residentId,
    name,
    isDemo: true,
    ownerId: null,
    intimacy: 0,
    currentFishId: fishId,
  });

  world.fish.push({
    id: fishId,
    residentId,
    name,
    generation: 1,
    species: species[index % species.length],
    palette: palettes[(index * 3) % palettes.length],
    pattern: patterns[(number - 1) % patterns.length],
    trait: traits[index % traits.length],
    region: '浅滩',
    bornOnDay: 0,
    ageDays: 0,
    vitality: 58,
    mood: 60,
    fame: 0,
    scars: 0,
    status: 'alive',
  });
}

await mkdir(dataDirectory, { recursive: true });

try {
  // wx 只允许新建文件；重复运行时保护已有世界，不覆盖进度。
  await writeFile(worldFile, `${JSON.stringify(world, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  console.log(`已创建世界：第 ${world.day} 天，${world.fish.length} 条模拟鱼。`);
  console.log(`世界文件：${fileURLToPath(worldFile)}`);
  console.log('所有鱼都在浅滩，等待第一次每日推进。');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('世界文件已存在，已保留原有进度。');
  console.log(`世界文件：${fileURLToPath(worldFile)}`);
}
