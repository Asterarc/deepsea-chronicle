// 浏览器与视频渲染共用的像素鱼。仅依赖 fillStyle / fillRect。
export const PALETTES = {
  金: ['#f4ca65', '#e89543', '#fff0a7'], 银: ['#b9dce7', '#7099b5', '#ecf9ff'],
  橙: ['#fb9a68', '#d86558', '#ffe0a1'], 青: ['#64d4cc', '#309aab', '#b3f2dc'],
  紫: ['#b49cde', '#7b6cb6', '#e4d1fa'], 白: ['#e2e7d9', '#9ebfc0', '#fffce7'],
  墨: ['#728d9c', '#405b75', '#b6ccd4'], 绯: ['#ef7d87', '#bd526f', '#ffd1bc'],
  翠: ['#8fcf9c', '#4b9e8b', '#d8efac'], 琥珀: ['#dca75a', '#a97349', '#f8dc89'],
};

export function drawFishPixel(ctx, fish, x, y, scale = 3, flip = false, time = 0) {
  const colors = PALETTES[fish.palette] || PALETTES.青;
  const species = fish.species || '灯鱼';
  const n = Number(String(fish.residentId || fish.id || '1').replace(/\D/g, '').slice(0, 5)) || 1;
  const tail = Math.floor(time * 4 + n) % 2;
  const rect = (px, py, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x + (flip ? 28 - px - w : px) * scale), Math.round(y + py * scale), Math.ceil(w * scale), Math.ceil(h * scale));
  };
  const dark = '#143544';
  const tall = species === '小丑鱼' || species === '蝴蝶鱼' || species === '箱鲀';
  const flat = species === '鳐' || species === '比目鱼';
  // 轮廓、尾鳍和背鳍。
  rect(1, 5 + tail, 3, 8 - tail * 2, dark);
  rect(4, 7, 3, 5, dark);
  rect(2, 6 + tail, 2, 6 - tail * 2, colors[1]);
  rect(7, flat ? 6 : 4, 13, flat ? 7 : 10, dark);
  rect(10, flat ? 4 : 2, 6, 3, dark);
  rect(9, flat ? 7 : 3, 10, flat ? 5 : 11, dark);
  rect(19, 5, 5, 8, dark);
  rect(23, 7, 2, 4, dark);
  rect(8, tall ? 4 : 5, 12, tall ? 10 : 8, colors[0]);
  rect(11, 4, 7, 10, colors[0]);
  rect(19, 6, 4, 6, colors[0]);
  rect(11, 3, 5, 1, colors[1]);
  rect(8, 11, 11, 2, colors[1]);
  rect(11, 13, 5, 2, colors[1]);
  rect(11, 5, 7, 1, colors[2]);
  if (species === '海马') { rect(9, 13, 3, 4, dark); rect(10, 13, 1, 3, colors[1]); rect(23, 8, 4, 2, colors[0]); }
  if (species === '狮子鱼') { rect(9, 0, 1, 4, colors[1]); rect(13, 0, 1, 3, colors[1]); rect(17, 1, 1, 3, colors[1]); rect(9, 14, 1, 3, colors[1]); rect(15, 14, 1, 3, colors[1]); }
  if (species === '鳐') { rect(6, 3, 5, 3, colors[1]); rect(6, 13, 5, 3, colors[1]); rect(0, 8, 7, 1, colors[1]); }
  const pattern = fish.pattern || ['纯色', '竖条', '斑点', '腹部亮带'][n % 4];
  if (pattern === '竖条' || species === '小丑鱼') { rect(10, 5, 2, 7, colors[2]); rect(15, 5, 2, 8, colors[2]); }
  if (pattern === '斑点' || species === '箱鲀') { rect(10, 6, 1, 1, colors[1]); rect(13, 9, 2, 1, colors[1]); rect(16, 6, 1, 1, colors[1]); }
  if (pattern === '腹部亮带') rect(10, 10, 9, 2, colors[2]);
  // 大眼、眼睛高光与腮红是全世界统一的外观。
  rect(18, 5, 5, 5, dark);
  rect(19, 5, 4, 4, '#fff6df');
  rect(21, 6, 2, 3, '#153848');
  rect(21, 6, 1, 1, '#ffffff');
  rect(17, 10, 3, 2, '#f79d9e');
  rect(24, 9, 1, 1, '#fff3d4');
}
