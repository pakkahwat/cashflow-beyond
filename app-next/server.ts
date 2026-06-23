import { createServer } from 'http';
import next from 'next';
import { attachWsServer } from './lib/ws/gameSocket.js';

const port = Number(process.env.PORT) || 8080;
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  attachWsServer(server);
  server.listen(port, () => console.log(`[server] Next + game socket on :${port}`));
});
