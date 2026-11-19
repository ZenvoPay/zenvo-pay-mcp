import { createServer as httpServer } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createServer } from './connector.mjs';

const port = Number(process.env.PORT || 3333);
const origin = new URL(process.env.MCP_PUBLIC_URL || 'http://127.0.0.1:' + port);
if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))) {
  throw new Error('Configure MCP_PUBLIC_URL com HTTPS para hospedar o conector.');
}

httpServer((req, res) => {
  function reject(status) {
    res.writeHead(status);
    res.end();
  }
  if (req.headers.host !== origin.host || (req.headers.origin && req.headers.origin !== origin.origin)) return reject(403);
  if (req.url !== '/mcp') return reject(404);
  const bearer = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
  if (!bearer) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="Zenvo MCP"');
    return reject(401);
  }
  const handler = createMcpHandler(() => createServer(bearer[1]));
  res.once('close', () => { void handler.close(); });
  toNodeHandler(handler)(req, res).catch(() => {
    if (!res.headersSent) reject(500);
    else res.end();
  });
}).listen(port, process.env.HOST || '127.0.0.1');
