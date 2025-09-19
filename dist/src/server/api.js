"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
/**
 * Minimal built-in HTTP server for ecosystem integration.
 * No external deps (uses Node http/url). Safe to run alongside tests.
 *
 * Endpoints:
 * - POST /api/debug/run
 * - GET  /api/envelopes/:id
 * - GET  /api/envelopes?limit=N
 * - GET  /api/history/similar?message=...&code=...
 * - POST /api/chat/:session/message
 * - GET  /api/chat/:session/messages?limit=N
 * - GET  /api/openapi.json
 * - GET  /api/schemas/debug.json
 * - GET  /api/schemas/debug.out.json
 * - GET  /health
 */
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ai_debugging_1 = require("../../ai-debugging");
const confidence_scoring_1 = require("../../utils/typescript/confidence_scoring");
const memory_adapter_1 = __importDefault(require("../../utils/typescript/memory_adapter"));
// Singleton debugger and ephemeral stores for API runs
const debuggerInstance = new ai_debugging_1.AIDebugger();
const envelopes = new Map();
const chatSessions = new Map();
// Optional: file persistence for envelopes
const PERSIST = process.env.PERSIST_ENVELOPES === '1' || process.env.PERSIST_ENVELOPES === 'true';
const DATA_DIR = path_1.default.resolve(process.cwd(), 'data');
const ENVELOPES_FILE = path_1.default.join(DATA_DIR, 'envelopes.json');
function loadEnvelopesFromDisk() {
    if (!PERSIST)
        return;
    try {
        if (fs_1.default.existsSync(ENVELOPES_FILE)) {
            const arr = JSON.parse(fs_1.default.readFileSync(ENVELOPES_FILE, 'utf-8'));
            arr.forEach(e => { if (e === null || e === void 0 ? void 0 : e.patch_id)
                envelopes.set(e.patch_id, e); });
        }
    }
    catch { /* ignore */ }
}
function saveEnvelopeToDisk(env) {
    if (!PERSIST)
        return;
    try {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
        const all = Array.from(envelopes.values());
        fs_1.default.writeFileSync(ENVELOPES_FILE, JSON.stringify(all, null, 2));
    }
    catch { /* ignore */ }
}
function getChat(sessionId) {
    const id = sessionId || 'default';
    let chat = chatSessions.get(id);
    if (!chat) {
        chat = new memory_adapter_1.default(debuggerInstance.memory || debuggerInstance._memory, id);
        chatSessions.set(id, chat);
    }
    return chat;
}
function json(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(payload);
}
function notFound(res) {
    json(res, 404, { error: 'Not Found' });
}
function toErrorType(s) {
    switch ((s || '').toUpperCase()) {
        case 'SYNTAX': return confidence_scoring_1.ErrorType.SYNTAX;
        case 'LOGIC': return confidence_scoring_1.ErrorType.LOGIC;
        case 'RUNTIME': return confidence_scoring_1.ErrorType.RUNTIME;
        case 'PERFORMANCE': return confidence_scoring_1.ErrorType.PERFORMANCE;
        case 'SECURITY': return confidence_scoring_1.ErrorType.SECURITY;
        default: return confidence_scoring_1.ErrorType.SYNTAX;
    }
}
async function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            if (!raw)
                return resolve({});
            try {
                resolve(JSON.parse(raw));
            }
            catch (e) {
                reject(new Error('Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
}
function openApiSpec(origin) {
    return {
        openapi: '3.0.3',
        info: { title: 'Self-Healing Debugger API', version: '0.1.0' },
        servers: [{ url: origin.replace(/\/$/, '') }],
        paths: {
            '/api/debug/run': {
                post: {
                    summary: 'Run a debug attempt',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        error_type: { type: 'string', enum: ['SYNTAX', 'LOGIC', 'RUNTIME', 'PERFORMANCE', 'SECURITY'] },
                                        message: { type: 'string' },
                                        patch_code: { type: 'string' },
                                        original_code: { type: 'string' },
                                        logits: { type: 'array', items: { type: 'number' } },
                                        sessionId: { type: 'string' },
                                        maxAttempts: { type: 'integer', minimum: 1, default: 1 }
                                    },
                                    required: ['error_type', 'message', 'patch_code', 'original_code']
                                }
                            }
                        }
                    },
                    responses: {
                        '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } }
                    }
                }
            },
            '/api/envelopes/{id}': {
                get: {
                    summary: 'Fetch an envelope by id',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } }
                }
            },
            '/api/envelopes': {
                get: {
                    summary: 'List recent envelopes',
                    parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, default: 25 } }],
                    responses: { '200': { description: 'OK' } }
                }
            },
            '/api/history/similar': {
                get: {
                    summary: 'Find similar outcomes',
                    parameters: [
                        { name: 'message', in: 'query', schema: { type: 'string' } },
                        { name: 'code', in: 'query', schema: { type: 'string' } }
                    ],
                    responses: { '200': { description: 'OK' } }
                }
            },
            '/api/chat/{session}/message': {
                post: {
                    summary: 'Mirror an external chat message',
                    parameters: [{ name: 'session', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', properties: { role: { type: 'string' }, content: {}, meta: { type: 'object' } }, required: ['role', 'content'] } } }
                    },
                    responses: { '204': { description: 'No Content' } }
                }
            },
            '/api/chat/{session}/messages': {
                get: {
                    summary: 'Get chat transcript for a session',
                    parameters: [
                        { name: 'session', in: 'path', required: true, schema: { type: 'string' } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, default: 100 } }
                    ],
                    responses: { '200': { description: 'OK' } }
                }
            },
            '/api/schemas/debug.json': {
                get: {
                    summary: 'JSON Schema for debug function input',
                    responses: { '200': { description: 'OK' } }
                }
            },
            '/api/schemas/debug.out.json': {
                get: {
                    summary: 'JSON Schema for debug function output',
                    responses: { '200': { description: 'OK' } }
                }
            },
            '/health': {
                get: {
                    summary: 'Basic health and metrics',
                    responses: { '200': { description: 'OK' } }
                }
            }
        }
    };
}
function startServer(port = Number(process.env.PORT) || 8787) {
    const server = http_1.default.createServer(async (req, res) => {
        var _a, _b, _c, _d, _e, _f;
        // CORS preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            return res.end();
        }
        const url = new url_1.URL(req.url || '/', `http://${req.headers.host}`);
        try {
            if (req.method === 'GET' && url.pathname === '/api/openapi.json') {
                return json(res, 200, openApiSpec(`${url.origin}`));
            }
            if (req.method === 'GET' && url.pathname === '/api/schemas/debug.json') {
                const schema = {
                    $schema: 'http://json-schema.org/draft-07/schema#',
                    title: 'DebugFunctionInput',
                    type: 'object',
                    properties: {
                        error_type: { type: 'string', enum: ['SYNTAX', 'LOGIC', 'RUNTIME', 'PERFORMANCE', 'SECURITY'] },
                        message: { type: 'string' },
                        patch_code: { type: 'string' },
                        original_code: { type: 'string' },
                        logits: { type: 'array', items: { type: 'number' } },
                        sessionId: { type: 'string' },
                        maxAttempts: { type: 'integer', minimum: 1 }
                    },
                    required: ['error_type', 'message', 'patch_code', 'original_code'],
                    additionalProperties: false
                };
                return json(res, 200, schema);
            }
            if (req.method === 'GET' && url.pathname === '/api/schemas/debug.out.json') {
                // Output shape is intentionally flexible; envelope content varies by observers.
                const schema = {
                    $schema: 'http://json-schema.org/draft-07/schema#',
                    title: 'DebugFunctionOutput',
                    type: 'object',
                    properties: {
                        action: { type: 'string', description: 'High-level result classification (e.g., SUCCESS, RETRY, FAIL)' },
                        envelope: {
                            type: 'object',
                            description: 'Best-effort success or result envelope if available',
                            properties: {
                                patch_id: { type: 'string' },
                                type: { type: 'string' },
                                timestamp: { type: 'string' },
                                success_metrics: { type: 'object', additionalProperties: true },
                                message: { type: 'string' },
                                celebration: { type: 'object', additionalProperties: true },
                                final_state: { type: 'object', additionalProperties: true },
                                hints: { type: 'array', items: { type: 'string' }, description: 'Optional hints or suggestions' }
                            },
                            additionalProperties: true
                        },
                        extras: { type: 'object', additionalProperties: true }
                    },
                    required: ['action'],
                    additionalProperties: false
                };
                return json(res, 200, schema);
            }
            if (req.method === 'GET' && url.pathname === '/health') {
                const mem = ((_b = (_a = debuggerInstance.memory) === null || _a === void 0 ? void 0 : _a.getMetrics) === null || _b === void 0 ? void 0 : _b.call(_a)) || null;
                const metrics = {
                    status: 'ok',
                    uptime_s: Math.floor(process.uptime()),
                    envelopes_cached: envelopes.size,
                    persist_enabled: !!PERSIST,
                    memory_metrics: mem
                };
                const wantsProm = url.searchParams.get('format') === 'prom' || /text\/plain/.test(String(req.headers['accept'] || ''));
                if (!wantsProm) {
                    return json(res, 200, metrics);
                }
                // Prometheus text exposition format (very minimal)
                const lines = [];
                lines.push('# HELP selfhealer_uptime_seconds Uptime in seconds');
                lines.push('# TYPE selfhealer_uptime_seconds gauge');
                lines.push(`selfhealer_uptime_seconds ${metrics.uptime_s}`);
                lines.push('# HELP selfhealer_envelopes_cached Number of envelopes cached in memory');
                lines.push('# TYPE selfhealer_envelopes_cached gauge');
                lines.push(`selfhealer_envelopes_cached ${metrics.envelopes_cached}`);
                lines.push('# HELP selfhealer_persist_enabled Whether envelope persistence is enabled (1/0)');
                lines.push('# TYPE selfhealer_persist_enabled gauge');
                lines.push(`selfhealer_persist_enabled ${metrics.persist_enabled ? 1 : 0}`);
                if (mem && typeof mem.size === 'number') {
                    lines.push('# HELP selfhealer_memory_size Memory buffer size');
                    lines.push('# TYPE selfhealer_memory_size gauge');
                    lines.push(`selfhealer_memory_size ${mem.size}`);
                }
                if (mem && typeof mem.evictions === 'number') {
                    lines.push('# HELP selfhealer_memory_evictions Number of TTL/size evictions');
                    lines.push('# TYPE selfhealer_memory_evictions counter');
                    lines.push(`selfhealer_memory_evictions ${mem.evictions}`);
                }
                if (mem && typeof mem.failures === 'number') {
                    lines.push('# HELP selfhealer_memory_failures Number of memory write/load failures');
                    lines.push('# TYPE selfhealer_memory_failures counter');
                    lines.push(`selfhealer_memory_failures ${mem.failures}`);
                }
                const body = lines.join('\n') + '\n';
                res.writeHead(200, {
                    'Content-Type': 'text/plain; version=0.0.4',
                    'Access-Control-Allow-Origin': '*'
                });
                return res.end(body);
            }
            if (req.method === 'POST' && url.pathname === '/api/debug/run') {
                const body = await readBody(req);
                const errorType = toErrorType(body.error_type);
                const message = String(body.message || '');
                const patch_code = String(body.patch_code || '');
                const original_code = String(body.original_code || '');
                const logits = Array.isArray(body.logits) ? body.logits.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [];
                const sessionId = body.sessionId ? String(body.sessionId) : undefined;
                const maxAttempts = Math.max(1, Number(body.maxAttempts) || 1);
                if (!message || !patch_code || !original_code) {
                    return json(res, 400, { error: 'Missing required fields: message, patch_code, original_code' });
                }
                const chat = getChat(sessionId);
                const result = await debuggerInstance.attemptWithBackoff(errorType, message, patch_code, original_code, logits, { maxAttempts, sessionId, chatAdapter: chat });
                try {
                    if ((_c = result === null || result === void 0 ? void 0 : result.envelope) === null || _c === void 0 ? void 0 : _c.patch_id) {
                        envelopes.set(result.envelope.patch_id, result.envelope);
                        saveEnvelopeToDisk(result.envelope);
                    }
                }
                catch { }
                return json(res, 200, result);
            }
            if (req.method === 'GET' && url.pathname.startsWith('/api/envelopes/')) {
                const id = url.pathname.split('/').pop() || '';
                const env = envelopes.get(id);
                if (!env)
                    return notFound(res);
                return json(res, 200, env);
            }
            if (req.method === 'GET' && url.pathname === '/api/envelopes') {
                const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit')) || 25));
                const list = Array.from(envelopes.values()).slice(-limit);
                return json(res, 200, list);
            }
            if (req.method === 'GET' && url.pathname === '/api/history/similar') {
                const message = url.searchParams.get('message') || undefined;
                const code = url.searchParams.get('code') || undefined;
                const items = ((_e = (_d = debuggerInstance.memory) === null || _d === void 0 ? void 0 : _d.getSimilarOutcomes) === null || _e === void 0 ? void 0 : _e.call(_d, { message, code })) || [];
                return json(res, 200, items);
            }
            if (req.method === 'POST' && url.pathname.startsWith('/api/chat/')) {
                const parts = url.pathname.split('/'); // ['', 'api', 'chat', ':session', 'message']
                const session = parts[3];
                const tail = parts[4];
                if (tail === 'message' && session) {
                    const body = await readBody(req);
                    const role = String(body.role || 'user');
                    const content = (_f = body.content) !== null && _f !== void 0 ? _f : '';
                    const meta = typeof body.meta === 'object' && body.meta ? body.meta : {};
                    const chat = getChat(session);
                    await Promise.resolve(chat.addMessage(role, content, meta));
                    res.writeHead(204, {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type'
                    });
                    return res.end();
                }
            }
            if (req.method === 'GET' && url.pathname.startsWith('/api/chat/')) {
                const parts = url.pathname.split('/'); // ['', 'api', 'chat', ':session', 'messages']
                const session = parts[3];
                const tail = parts[4];
                if (tail === 'messages' && session) {
                    const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit')) || 100));
                    const chat = getChat(session);
                    const msgs = await Promise.resolve(chat.getMessages(limit));
                    return json(res, 200, msgs);
                }
            }
            return notFound(res);
        }
        catch (err) {
            return json(res, 500, { error: (err === null || err === void 0 ? void 0 : err.message) || 'Internal Server Error' });
        }
    });
    server.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`[api] listening on http://localhost:${port}`);
    });
    return server;
}
// Auto-start if executed directly (node dist/server/api.js)
if (require.main === module) {
    loadEnvelopesFromDisk();
    startServer();
}
