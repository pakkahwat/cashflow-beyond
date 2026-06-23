import { createServer } from 'http';
import { attachWsServer } from './lib/ws/gameSocket.js';

const port = Number(process.env.WS_PORT) || 3001;
const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ws-dev: game socket server\n');
});
attachWsServer(server);
server.listen(port, () => console.log(`[ws-dev] game socket on :${port}/ws`));
