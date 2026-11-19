import { readFile } from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

const base = new URL(process.env.ZENVO_API_BASE || 'https://api.zenvopay.com');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
if (!(local && base.protocol === 'http:') && base.origin !== 'https://api.zenvopay.com') {
  throw new Error('ZENVO_API_BASE deve apontar para localhost ou https://api.zenvopay.com.');
}
if (base.username || base.password || base.search || base.hash) throw new Error('URL base inválida.');
const contract = new URL('./docs/api-publica.txt', import.meta.url);
const text = value => ({ type: 'text', text: value });
const failure = message => ({ isError: true, content: [text(message)] });
const uuid = z.uuid();
const sku = z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/);
const pagination = { limit: z.int().min(1).max(100).optional(), after: uuid.optional() };

async function requestApi(key, path, { query = {}, body } = {}) {
  if (!key) return failure('Configure ZENVO_API_KEY no ambiente do servidor MCP.');
  const url = new URL(base);
  url.pathname = base.pathname.replace(/\/$/, '') + path;
  for (const [field, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(field, String(value));
  }
  try {
    const headers = { Authorization: 'Bearer ' + key, Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET', headers, body: body && JSON.stringify(body),
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return failure('A API Zenvo respondeu HTTP ' + res.status + '. Consulte o contrato da operação.');
    return { content: [text(JSON.stringify(await res.json()))] };
  } catch {
    return failure('Falha ao consultar a API. Confira a base e a disponibilidade do servidor. Para links, reutilize a referência do pedido.');
  }
}

export function createServer(key) {
  const callApi = (path, options) => requestApi(key, path, options);
  const server = new McpServer({ name: 'zenvo', version: '0.2.0' });
  server.registerResource('api-publica', 'zenvo://docs/api-publica', {
    description: 'Guia de autenticação, consultas e criação de links pelo conector Zenvo.', mimeType: 'text/plain',
  }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'text/plain', text: await readFile(contract, 'utf8') }] }));
  function queryTool(name, description, shape, callback) {
    server.registerTool(name, { description, inputSchema: z.strictObject(shape), annotations: { readOnlyHint: true } }, callback);
  }
  queryTool('verificar_chave', 'Verifica a chave configurada e identifica sandbox ou produção.', {}, () => callApi('/auth/verify'));
  queryTool('listar_produtos', 'Lista produtos por SKU exato ou cursor.', { ...pagination, external_id: sku.optional() }, query => callApi('/products', { query }));
  queryTool('consultar_produto', 'Consulta um produto pelo UUID.', { id: uuid }, ({ id }) => callApi('/products/' + id));
  queryTool('consultar_link', 'Consulta o estado do link e do pagamento pelo UUID do link.', { id: uuid }, ({ id }) => callApi('/payment-links/' + id));
  queryTool('listar_vendas', 'Lista vendas da conta no ambiente da chave. since é inclusivo e until exclusivo.', {
    ...pagination, link_id: uuid.optional(), status: z.string().regex(/^[A-Z_]+$/).optional(),
    since: z.iso.datetime({ offset: true }).optional(), until: z.iso.datetime({ offset: true }).optional(),
  }, query => callApi('/sales', { query }));
  queryTool('consultar_venda', 'Consulta o registro financeiro pelo UUID da venda.', { id: uuid }, ({ id }) => callApi('/sales/' + id));

  if (process.env.ZENVO_MCP_WRITE === '1') {
    const origin = z.strictObject({
      postal_code: z.string().regex(/^\d{5}-?\d{3}$/), number: z.string().min(1).max(32).optional(),
      complement: z.string().max(150).optional(),
    });
    server.registerTool('criar_link', {
      description: 'Cria um link hospedado. Use o mesmo external_id do pedido e os mesmos dados para repetir após timeout.',
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      inputSchema: z.strictObject({
        external_id: sku, product: z.union([
          z.strictObject({ external_id: sku, quantity: z.int().min(1).max(999).optional() }),
          z.strictObject({ id: uuid, quantity: z.int().min(1).max(999).optional() }),
        ]),
        delivery: z.discriminatedUnion('method', [
          z.strictObject({ method: z.literal('none') }),
          z.strictObject({ method: z.literal('carrier'), origin: origin.optional() }),
          z.strictObject({ method: z.literal('courier'), package_size: z.enum(['medium','large']), origin: origin.optional() }),
        ]),
        name: z.string().trim().min(1).max(200).optional(),
        payment_methods: z.array(z.enum(['pix','credit_card'])).min(1).max(2).optional(),
      }),
    }, body => callApi('/payment-links', { body }));
  }
  return server;
}
