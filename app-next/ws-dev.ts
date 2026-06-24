import { createServer } from 'http';
import { attachWsServer } from './lib/ws/gameSocket.js';
import { ensureIndexes } from './lib/mongo.js';

const port = Number(process.env.WS_PORT) || 3001;
const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ws-dev: game socket server\n');
});
attachWsServer(server);
server.listen(port, () => {
  console.log(`[ws-dev] game socket on :${port}/ws`);
  if (process.env.MONGO_URL) ensureIndexes().catch(console.error);
});
