import { pauseAndJitterConsult } from '../../utils/typescript/backoff';

describe('pauseAndJitterConsult envelope enrichment', () => {
  it('includes wider context and syntax balance, and extracts proposed patch', async () => {
    const original = `
export function add(a: number, b: number) {
  return a + b
}
`;
    const lastPatch = `
export function add(a: number, b: number) {
  console.log('adding')
  return a + b
`;
    const errorMsg = 'SyntaxError: Unexpected end of input (missing })';

    const llmAdapter = async (prompt: string) => {
      // Ensure prompt contains our enriched fields
      const obj = JSON.parse(prompt);
      expect(obj.context.wider_context).toBeTruthy();
      expect(obj.context.syntax_balance).toBeTruthy();
      // Return a minimal corrected code block
      return { text: '```\nexport function add(a: number, b: number) {\n  console.log("adding");\n  return a + b;\n}\n```' };
    };

    const consult = await pauseAndJitterConsult({
      summary: { is_improving: false, should_continue_attempts: true },
      minMs: 5,
      maxMs: 15,
      errorMessage: errorMsg,
      originalCode: original,
      lastPatch,
      language: 'typescript',
      llmAdapter
    });

    expect(consult.envelope.context.wider_context).toBeDefined();
    expect(consult.envelope.context.syntax_balance).toBeDefined();
    expect(typeof consult.llmReplyText).toBe('string');
    expect(consult.proposedPatch).toContain('export function add');
    expect(consult.proposedPatch).toContain('return a + b;');
  }, 1000);
});
