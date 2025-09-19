// AWS Lambda handler exposing the debug.run functionality via API Gateway (proxy integration)
import { AIDebugger } from '../../ai-debugging';
import { ErrorType } from '../../utils/typescript/confidence_scoring';
import ChatMessageHistoryAdapter from '../../utils/typescript/memory_adapter';

const debuggerInstance = new AIDebugger();
const chats = new Map<string, ChatMessageHistoryAdapter>();

function getChat(id: string) {
  let c = chats.get(id);
  if (!c) {
    c = new ChatMessageHistoryAdapter((debuggerInstance as any).memory || (debuggerInstance as any)._memory, id);
    chats.set(id, c);
  }
  return c;
}

function toErrorType(s: string | undefined): ErrorType {
  switch ((s || '').toUpperCase()) {
    case 'SYNTAX': return ErrorType.SYNTAX;
    case 'LOGIC': return ErrorType.LOGIC;
    case 'RUNTIME': return ErrorType.RUNTIME;
    case 'PERFORMANCE': return ErrorType.PERFORMANCE;
    case 'SECURITY': return ErrorType.SECURITY;
    default: return ErrorType.SYNTAX;
  }
}

export const handler = async (event: any) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }
    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const errorType = toErrorType(body.error_type);
    const message = String(body.message || '');
    const patch_code = String(body.patch_code || '');
    const original_code = String(body.original_code || '');
    if (!message || !patch_code || !original_code) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing required fields' }) };
    }
    const logits = Array.isArray(body.logits) ? body.logits : [];
    const sessionId = body.sessionId ? String(body.sessionId) : undefined;
    const maxAttempts = Math.max(1, Number(body.maxAttempts) || 1);
    const chat = getChat(sessionId || 'default');
    const result = await debuggerInstance.attemptWithBackoff(
      errorType,
      message,
      patch_code,
      original_code,
      logits,
      { maxAttempts, sessionId, chatAdapter: chat }
    );
    return { statusCode: 200, headers: cors(), body: JSON.stringify(result) };
  } catch (e: any) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: e?.message || 'Internal Error' }) };
  }
};

function cors() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
