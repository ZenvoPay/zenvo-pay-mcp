# Zenvo MCP

Conecte o Claude Desktop, Cursor ou outro cliente MCP à sua conta Zenvo. O cliente inicia o servidor via stdio. O guia das operações do conector acompanha o pacote em `docs/api-publica.txt`.

## Instalar

Com Node.js 20 ou superior, instale a versão 0.1.0:

```sh
git clone --branch v0.1.0 --depth 1 https://github.com/kaikynetto/zenvo-pay-mcp.git
cd zenvo-pay-mcp
npm ci --omit=dev
```

Você também pode [baixar o ZIP da versão 0.1.0](https://github.com/kaikynetto/zenvo-pay-mcp/releases/download/v0.1.0/zenvo-mcp-0.1.0.zip), extrair a pasta e executar `npm ci --omit=dev` dentro dela.

## Conectar

No Claude Desktop, abra o arquivo de configuração pelo menu de desenvolvedor. No Cursor, use o arquivo pessoal `~/.cursor/mcp.json`. Mescle a entrada abaixo com os servidores existentes e ajuste o caminho de `server.mjs`.

```json
{
  "mcpServers": {
    "zenvo": {
      "command": "node",
      "args": ["/caminho/absoluto/zenvo-mcp/server.mjs"],
      "env": { "ZENVO_API_KEY": "SUBSTITUA_PELA_SUA_CHAVE" }
    }
  }
}
```

Reinicie o cliente. Para conferir a instalação sem depender de uma API online, peça a leitura do recurso `zenvo://docs/api-publica`. Para validar a conta, peça ao assistente para executar `verificar_chave`. A base padrão é `https://api.zenvopay.com`, cuja publicação e homologação estão pendentes. Para uma API local em execução, configure `ZENVO_API_BASE=http://localhost:3000/api` no ambiente do servidor MCP.

## Ferramentas

Por padrão, o servidor expõe verificar_chave, listar_produtos, consultar_produto, consultar_link, listar_vendas e consultar_venda. Para criar links hospedados, adicione `"ZENVO_MCP_WRITE": "1"` ao bloco env e reconecte. Reutilize o mesmo external_id e os mesmos dados quando repetir a criação após timeout.

## Desenvolvimento

Execute `npm ci` e `npm test`. O teste usa o cliente oficial e uma API local com dados fictícios. Ao preparar uma versão, atualize o contrato incluído no pacote e gere o ZIP com `python3 package-release.py /pasta/de/destino`.
