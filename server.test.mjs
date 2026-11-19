import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

test('cliente oficial lê o contrato e usa a API pelo subprocesso stdio', async t => {
  const calls = [];
  const api = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    calls.push({ url: req.url, method: req.method, auth: req.headers.authorization, raw });
    res.writeHead(req.url.startsWith('/api/sales') ? 401 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ environment: 'sandbox' }));
  });
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => api.close(resolve)));
  for (const modern of [true, false]) {
    const client = new Client({ name: 'zenvo-test', version: '1.0' }, {
      versionNegotiation: { mode: modern ? { pin: '2026-07-28' } : 'legacy' },
    });
    try {
      await client.connect(new StdioClientTransport({
        command: process.execPath, args: [fileURLToPath(new URL('./server.mjs', import.meta.url))],
        env: { ZENVO_API_BASE: 'http://127.0.0.1:' + api.address().port + '/api',
          ZENVO_API_KEY: 'znv_test_fixture', ZENVO_MCP_WRITE: modern ? '0' : '1' },
      }));
      const { tools } = await client.listTools();
      assert.equal(tools.length, modern ? 6 : 7);
      assert.equal(tools.some(tool => tool.name === 'criar_link'), !modern);
      const { resources } = await client.listResources();
      assert.equal(resources[0].uri, 'zenvo://docs/api-publica');
      const resource = await client.readResource({ uri: resources[0].uri });
      assert.match(resource.contents[0].text, /GET \/auth\/verify/);
      const products = await client.callTool({ name: 'listar_produtos', arguments: { external_id: 'bolsa', limit: 2 } });
      assert.equal(JSON.parse(products.content[0].text).environment, 'sandbox');
      const last = calls.at(-1);
      assert.equal(last.auth, 'Bearer znv_test_fixture');
      assert.equal(last.url, '/api/products?limit=2&external_id=bolsa');
      assert.equal((await client.callTool({ name: 'listar_vendas', arguments: {} })).isError, true);
      if (!modern) {
        const body = { external_id: 'pedido-1', product: { external_id: 'bolsa' }, delivery: { method: 'none' } };
        await client.callTool({ name: 'criar_link', arguments: body });
        assert.equal(calls.at(-1).method, 'POST');
        assert.deepEqual(JSON.parse(calls.at(-1).raw), body);
      }
    } finally { await client.close(); }
  }
});
