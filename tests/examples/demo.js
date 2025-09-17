"use strict";
/**
 * Simple demo script to test the pipeline integration
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var pipeline_integration_1 = require("./pipeline-integration");
function runDemo() {
    return __awaiter(this, void 0, void 0, function () {
        var pipeline, result1, syntaxError, result2, error_1, health, i, error, e_1, finalHealth;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🚀 Self-Healing Pipeline Demo');
                    console.log('============================');
                    return [4 /*yield*/, pipeline_integration_1.PipelineExamples.createLocalPipeline()];
                case 1:
                    pipeline = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 16, 18]);
                    // Test 1: Successful patch
                    console.log('\n✅ Test 1: Successful patch');
                    return [4 /*yield*/, pipeline.executePatch('demo-patch-001', 'typescript', 'console.log("before");', 'console.log("after");')];
                case 3:
                    result1 = _a.sent();
                    console.log("Success: ".concat(result1.success, ", Breaker tripped: ").concat(result1.breakerTripped));
                    // Test 2: Failed patch with error signature
                    console.log('\n❌ Test 2: Failed patch');
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    syntaxError = new SyntaxError('Unexpected token }');
                    return [4 /*yield*/, pipeline.executePatch('demo-patch-002', 'typescript', 'const valid = true;', 'const invalid = }', syntaxError)];
                case 5:
                    result2 = _a.sent();
                    console.log("Success: ".concat(result2.success, ", Breaker tripped: ").concat(result2.breakerTripped));
                    console.log("Error signature: ".concat(result2.errorSignature));
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _a.sent();
                    console.log('Patch execution failed as expected:', error_1 instanceof Error ? error_1.message : 'Unknown error');
                    return [3 /*break*/, 7];
                case 7:
                    // Test 3: Health stats
                    console.log('\n📊 Test 3: Health stats');
                    return [4 /*yield*/, pipeline.getHealthStats()];
                case 8:
                    health = _a.sent();
                    console.log('Recent patches:', health.recentPatches);
                    console.log('Success rate:', health.successRate);
                    console.log('Breaker state:', health.breakerState.state);
                    console.log('Memory stats:', health.memoryStats);
                    // Test 4: Multiple failures to trigger breaker
                    console.log('\n⚡ Test 4: Triggering circuit breaker');
                    i = 0;
                    _a.label = 9;
                case 9:
                    if (!(i < 6)) return [3 /*break*/, 14];
                    _a.label = 10;
                case 10:
                    _a.trys.push([10, 12, , 13]);
                    error = new Error("Simulated error ".concat(i));
                    return [4 /*yield*/, pipeline.executePatch("fail-patch-".concat(i), 'javascript', 'console.log("good");', 'throw new Error("bad");', error)];
                case 11:
                    _a.sent();
                    return [3 /*break*/, 13];
                case 12:
                    e_1 = _a.sent();
                    console.log("Attempt ".concat(i + 1, ": ").concat(e_1 instanceof Error ? e_1.message : 'Unknown error'));
                    return [3 /*break*/, 13];
                case 13:
                    i++;
                    return [3 /*break*/, 9];
                case 14: return [4 /*yield*/, pipeline.getHealthStats()];
                case 15:
                    finalHealth = _a.sent();
                    console.log('\n🎯 Final breaker state:', finalHealth.breakerState.state);
                    console.log('Total patches processed:', finalHealth.recentPatches);
                    return [3 /*break*/, 18];
                case 16: return [4 /*yield*/, pipeline.close()];
                case 17:
                    _a.sent();
                    console.log('\n🔒 Pipeline closed successfully');
                    return [7 /*endfinally*/];
                case 18: return [2 /*return*/];
            }
        });
    });
}
if (require.main === module) {
    runDemo().catch(console.error);
}
