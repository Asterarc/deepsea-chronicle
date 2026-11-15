import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 3080);
try {
  const response = await fetch(`http://127.0.0.1:${port}/api/status`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error('端口上的服务不是深海纪事。');
  const status = await response.json();
  const root = fileURLToPath(new URL('../', import.meta.url));
  const expected = path.join(path.resolve(process.env.DEEPSEA_DATA_DIR || path.join(root, 'data')), 'world.json');
  if (path.resolve(status.dataFile || '') !== expected || !Number.isInteger(status.processId)) throw new Error('服务信息不匹配，已保留正在运行的进程。');
  if (status.renderJob?.status === 'running') throw new Error('视频正在生成，请等待完成后再停止。');
  process.kill(status.processId, 'SIGTERM');
  console.log('深海纪事已停止，世界数据已保留。');
} catch (error) {
  console.error(error.cause?.code === 'ECONNREFUSED' ? '深海纪事当前没有运行。' : error.message);
  process.exitCode = 1;
}
