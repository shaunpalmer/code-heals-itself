"use strict";
/**
 * Self-Healing Pipeline with Persistent Memory
 * Uses the existing AIDebugger system with persistent memory
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineExamples = exports.SelfHealingPipeline = void 0;
exports.demonstratePipeline = demonstratePipeline;
const ai_debugging_1 = require("../../ai-debugging");
const confidence_scoring_1 = require("../../utils/typescript/confidence_scoring");
/**
 * Self-healing pipeline using the existing AIDebugger
 */
class SelfHealingPipeline {
    constructor(policy = {}) {
        this.debugger = new ai_debugging_1.AIDebugger(policy);
    }
    /**
     * Execute a patch using the real AIDebugger system
     */
    async executePatch(errorMessage, patchCode, originalCode, errorType = confidence_scoring_1.ErrorType.LOGIC, logits = [0.8, 0.9, 0.7], metadata = {}) {
        console.log(`� Processing error: ${errorMessage}`);
        const result = this.debugger.process_error(errorType, errorMessage, patchCode, originalCode, logits, {}, metadata);
        console.log(`✅ Action: ${result.action}`);
        return result;
    }
    /**
     * Save memory to file
     */
    async saveMemory(filePath) {
        await this.debugger.saveMemory(filePath);
        console.log('💾 Memory saved');
    }
    /**
     * Load memory from file
     */
    async loadMemory(filePath) {
        await this.debugger.loadMemory(filePath);
        console.log('� Memory loaded');
    }
    /**
     * Get memory statistics
     */
    getMemoryStats() {
        return this.debugger.getMemoryStats();
    }
}
exports.SelfHealingPipeline = SelfHealingPipeline;
/**
 * Example usage
 */
class PipelineExamples {
    /**
     * Local development example
     */
    static async createLocalPipeline() {
        const pipeline = new SelfHealingPipeline({
            sandbox_isolation: "partial",
            rate_limit_per_min: 20
        });
        await pipeline.loadMemory('./local-memory.json');
        return pipeline;
    }
    /**
     * Production environment with strict policy
     */
    static async createProductionPipeline() {
        const pipeline = new SelfHealingPipeline({
            syntax_conf_floor: 0.99,
            logic_conf_floor: 0.85,
            require_human_on_risky: true,
            rate_limit_per_min: 5
        });
        await pipeline.loadMemory('./production-memory.json');
        return pipeline;
    }
}
exports.PipelineExamples = PipelineExamples;
/**
 * Demonstration script using the real AIDebugger
 */
async function demonstratePipeline() {
    console.log('🚀 Self-Healing Pipeline Demonstration (Real AIDebugger)');
    console.log('=======================================================');
    const pipeline = await PipelineExamples.createLocalPipeline();
    try {
        // Syntax error example
        console.log('\n� Processing syntax error...');
        const syntaxResult = await pipeline.executePatch('SyntaxError: Unexpected token', 'console.log("fixed syntax");', 'console.log("broken syntax"', confidence_scoring_1.ErrorType.SYNTAX, [0.95, 0.98, 0.90] // High confidence logits
        );
        console.log('Result:', syntaxResult.action);
        // Logic error example  
        console.log('\n🔧 Processing logic error...');
        const logicResult = await pipeline.executePatch('TypeError: Cannot read property of undefined', 'if (obj && obj.prop) return obj.prop;', 'return obj.prop;', confidence_scoring_1.ErrorType.LOGIC, [0.75, 0.80, 0.85] // Medium confidence logits
        );
        console.log('Result:', logicResult.action);
        // Show memory stats
        console.log('\n📊 Memory Stats:');
        const stats = pipeline.getMemoryStats();
        console.log(JSON.stringify(stats, null, 2));
        // Save memory
        await pipeline.saveMemory();
        console.log('\n✅ Demonstration completed successfully!');
    }
    catch (error) {
        console.error('❌ Demo failed:', error.message);
    }
}
// Run demonstration if this file is executed directly
if (require.main === module) {
    demonstratePipeline().catch(console.error);
}
