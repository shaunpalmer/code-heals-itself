"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// Clean minimal integration tests for AIDebugger behavior
const ai_debugging_1 = require("../../ai-debugging");
const confidence_scoring_1 = require("../../utils/typescript/confidence_scoring");
describe('AIDebugger integration (minimal)', () => {
    let aiDebugger;
    beforeEach(() => {
        const testPolicy = {
            max_syntax_attempts: 3,
            max_logic_attempts: 5,
            syntax_error_budget: 0.05,
            logic_error_budget: 0.10,
            syntax_conf_floor: 0.30,
            logic_conf_floor: 0.20,
        };
        aiDebugger = new ai_debugging_1.AIDebugger(testPolicy);
    });
    it('process_error returns an envelope and action', () => {
        const result = aiDebugger.process_error(confidence_scoring_1.ErrorType.SYNTAX, 'SyntaxError: missing ) after argument list', 'console.log("fixed");', 'console.log("broken"', [0.99, 0.98, 0.97]);
        expect(result).toBeDefined();
        expect(result.envelope).toBeDefined();
        expect(typeof result.action).toBe('string');
    });
    it('persists memory across instances', async () => {
        aiDebugger.process_error(confidence_scoring_1.ErrorType.LOGIC, 'TypeError: Cannot read properties of undefined', 'if (obj) { console.log(obj.a); }', 'console.log(obj.a)', [0.85, 0.82, 0.80]);
        const path = './test-integration-memory.json';
        await aiDebugger.saveMemory(path);
        const stats = aiDebugger.getMemoryStats();
        expect(stats.bufferSize).toBeGreaterThan(0);
        const newDebugger = new ai_debugging_1.AIDebugger();
        await newDebugger.loadMemory(path);
        const newStats = newDebugger.getMemoryStats();
        expect(newStats.bufferSize).toBe(stats.bufferSize);
        // Cleanup best-effort
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            await fs.unlink(path);
        }
        catch {
            // ignore
        }
    });
});
