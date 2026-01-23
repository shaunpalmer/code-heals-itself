/* MCP stdio proxy server for the PHP API.
 * Exposes debug.run tool and forwards to POST /mcp/tool.
 */
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const PHP_API_BASE = process.env.PHP_API_BASE || 'http://127.0.0.1:8000';

function postJson(path: string, body: Record<string, unknown>): Promise<any> {
  const url = new URL(path, PHP_API_BASE);
  const payload = JSON.stringify(body);
  const isHttps = url.protocol === 'https:';
  const reqFn = isHttps ? https.request : http.request;

  return new Promise((resolve, reject) => {
    const req = reqFn(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data || '{}');
            resolve(json);
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const server = new McpServer({
  name: 'self-heal-php-mcp',
  version: '0.1.0'
});
const registerTool: any = (server as any).registerTool.bind(server);

registerTool(
  'debug.run',
  {
    description: 'Run PHP healing loop via PHP API (/mcp/tool).',
    inputSchema: {
      code: z.string().optional().describe('PHP code to heal (preferred).'),
      patch_code: z.string().optional().describe('Alternate field; used as code if provided.'),
      error_count: z.number().int().optional(),
      attemptNumber: z.number().int().min(1).optional(),
      errorMessage: z.string().optional(),
      temperature: z.number().optional(),
      message: z.string().optional().describe('Alias for errorMessage.')
    } as any
  },
  async (args: any) => {
    const { code, patch_code, error_count, attemptNumber, errorMessage, temperature, message } = args || {};
    const resolvedCode = String(code || patch_code || '').trim();
    if (!resolvedCode) {
      return { content: [{ type: 'json', data: { success: false, error: 'Missing code or patch_code' } }] };
    }

    const payload = {
      tool: 'debug.run',
      arguments: {
        code: resolvedCode,
        error_count: Number(error_count || 0),
        attemptNumber: Math.max(1, Number(attemptNumber || 1)),
        errorMessage: String(errorMessage || message || ''),
        temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 1.0
      }
    };

    const result = await postJson('/mcp/tool', payload);
    return { content: [{ type: 'json', data: result }] };
  }
);

if (process.argv.includes('--probe')) {
  const tools = Object.keys((server as any)._registeredTools || {});
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ mcp: true, tools }));
  process.exit(0);
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.log('[mcp] php proxy server started (stdio) tool: debug.run');
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('[mcp] php proxy fatal', err);
  process.exit(1);
});