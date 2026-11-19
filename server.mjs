import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './connector.mjs';

serveStdio(() => createServer(process.env.ZENVO_API_KEY));
