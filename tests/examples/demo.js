"use strict";
/**
 * Simple demo script to test the pipeline integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
const pipeline_integration_1 = require("./pipeline-integration");
async function runDemo() {
    console.log('🚀 Self-Healing Pipeline Demo');
    console.log('============================');
    const pipeline = await pipeline_integration_1.PipelineExamples.createLocalPipeline();
    try {
        // Test 1: Successful patch
        console.log('\n✅ Test 1: Successful patch');
        const result1 = await pipeline.executePatch('demo-patch-001', 'typescript', 'console.log("before");', 'console.log("after");');
        console.log(`Success: ${result1.success}, Breaker tripped: ${result1.breakerTripped}`);
        // Test 2: Failed patch with error signature
        console.log('\n❌ Test 2: Failed patch');
        try {
            const syntaxError = new SyntaxError('Unexpected token }');
            const result2 = await pipeline.executePatch('demo-patch-002', 'typescript', 'const valid = true;', 'const invalid = }', syntaxError);
            console.log(`Success: ${result2.success}, Breaker tripped: ${result2.breakerTripped}`);
            console.log(`Error signature: ${result2.errorSignature}`);
        }
        catch (error) {
            console.log('Patch execution failed as expected:', error instanceof Error ? error.message : 'Unknown error');
        }
        // Test 3: Health stats
        console.log('\n📊 Test 3: Health stats');
        const health = await pipeline.getHealthStats();
        console.log('Recent patches:', health.recentPatches);
        console.log('Success rate:', health.successRate);
        console.log('Breaker state:', health.breakerState.state);
        console.log('Memory stats:', health.memoryStats);
        // Test 4: Multiple failures to trigger breaker
        console.log('\n⚡ Test 4: Triggering circuit breaker');
        for (let i = 0; i < 6; i++) {
            try {
                const error = new Error(`Simulated error ${i}`);
                await pipeline.executePatch(`fail-patch-${i}`, 'javascript', 'console.log("good");', 'throw new Error("bad");', error);
            }
            catch (e) {
                console.log(`Attempt ${i + 1}: ${e instanceof Error ? e.message : 'Unknown error'}`);
            }
        }
        // Check final breaker state
        const finalHealth = await pipeline.getHealthStats();
        console.log('\n🎯 Final breaker state:', finalHealth.breakerState.state);
        console.log('Total patches processed:', finalHealth.recentPatches);
    }
    finally {
        await pipeline.close();
        console.log('\n🔒 Pipeline closed successfully');
    }
}
if (require.main === module) {
    runDemo().catch(console.error);
}
