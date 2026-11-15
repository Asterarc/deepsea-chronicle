process.env.DEEPSEA_AUTO_TICK = '1';
const { startServer } = await import('../server.mjs');
await startServer();
