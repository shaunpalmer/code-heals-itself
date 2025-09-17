"use strict";
/**
 * Self-Healing Pipeline with Persistent Memory
 * Uses the existing AIDebugger system with persistent memory
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
exports.PipelineExamples = exports.SelfHealingPipeline = void 0;
exports.demonstratePipeline = demonstratePipeline;
var ai_debugging_1 = require("../ai-debugging");
var confidence_scoring_1 = require("../utils/typescript/confidence_scoring");
/**
 * Self-healing pipeline using the existing AIDebugger
 */
var SelfHealingPipeline = /** @class */ (function () {
    function SelfHealingPipeline(policy) {
        if (policy === void 0) { policy = {}; }
        this.debugger = new ai_debugging_1.AIDebugger(policy);
    }
    /**
     * Execute a patch using the real AIDebugger system
     */
    SelfHealingPipeline.prototype.executePatch = function (errorMessage_1, patchCode_1, originalCode_1) {
        return __awaiter(this, arguments, void 0, function (errorMessage, patchCode, originalCode, errorType, logits, metadata) {
            var result;
            if (errorType === void 0) { errorType = confidence_scoring_1.ErrorType.LOGIC; }
            if (logits === void 0) { logits = [0.8, 0.9, 0.7]; }
            if (metadata === void 0) { metadata = {}; }
            return __generator(this, function (_a) {
                console.log("\uFFFD Processing error: ".concat(errorMessage));
                result = this.debugger.process_error(errorType, errorMessage, patchCode, originalCode, logits, {}, metadata);
                console.log("\u2705 Action: ".concat(result.action));
                return [2 /*return*/, result];
            });
        });
    };
    /**
     * Save memory to file
     */
    SelfHealingPipeline.prototype.saveMemory = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.debugger.saveMemory(filePath)];
                    case 1:
                        _a.sent();
                        console.log('💾 Memory saved');
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Load memory from file
     */
    SelfHealingPipeline.prototype.loadMemory = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.debugger.loadMemory(filePath)];
                    case 1:
                        _a.sent();
                        console.log('� Memory loaded');
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get memory statistics
     */
    SelfHealingPipeline.prototype.getMemoryStats = function () {
        return this.debugger.getMemoryStats();
    };
    return SelfHealingPipeline;
}());
exports.SelfHealingPipeline = SelfHealingPipeline;
/**
 * Example usage
 */
var PipelineExamples = /** @class */ (function () {
    function PipelineExamples() {
    }
    /**
     * Local development example
     */
    PipelineExamples.createLocalPipeline = function () {
        return __awaiter(this, void 0, void 0, function () {
            var pipeline;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        pipeline = new SelfHealingPipeline({
                            sandbox_isolation: "partial",
                            rate_limit_per_min: 20
                        });
                        return [4 /*yield*/, pipeline.loadMemory('./local-memory.json')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, pipeline];
                }
            });
        });
    };
    /**
     * Production environment with strict policy
     */
    PipelineExamples.createProductionPipeline = function () {
        return __awaiter(this, void 0, void 0, function () {
            var pipeline;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        pipeline = new SelfHealingPipeline({
                            syntax_conf_floor: 0.99,
                            logic_conf_floor: 0.85,
                            require_human_on_risky: true,
                            rate_limit_per_min: 5
                        });
                        return [4 /*yield*/, pipeline.loadMemory('./production-memory.json')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, pipeline];
                }
            });
        });
    };
    return PipelineExamples;
}());
exports.PipelineExamples = PipelineExamples;
/**
 * Demonstration script using the real AIDebugger
 */
function demonstratePipeline() {
    return __awaiter(this, void 0, void 0, function () {
        var pipeline, syntaxResult, logicResult, stats, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🚀 Self-Healing Pipeline Demonstration (Real AIDebugger)');
                    console.log('=======================================================');
                    return [4 /*yield*/, PipelineExamples.createLocalPipeline()];
                case 1:
                    pipeline = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 6, , 7]);
                    // Syntax error example
                    console.log('\n� Processing syntax error...');
                    return [4 /*yield*/, pipeline.executePatch('SyntaxError: Unexpected token', 'console.log("fixed syntax");', 'console.log("broken syntax"', confidence_scoring_1.ErrorType.SYNTAX, [0.95, 0.98, 0.90] // High confidence logits
                        )];
                case 3:
                    syntaxResult = _a.sent();
                    console.log('Result:', syntaxResult.action);
                    // Logic error example  
                    console.log('\n🔧 Processing logic error...');
                    return [4 /*yield*/, pipeline.executePatch('TypeError: Cannot read property of undefined', 'if (obj && obj.prop) return obj.prop;', 'return obj.prop;', confidence_scoring_1.ErrorType.LOGIC, [0.75, 0.80, 0.85] // Medium confidence logits
                        )];
                case 4:
                    logicResult = _a.sent();
                    console.log('Result:', logicResult.action);
                    // Show memory stats
                    console.log('\n📊 Memory Stats:');
                    stats = pipeline.getMemoryStats();
                    console.log(JSON.stringify(stats, null, 2));
                    // Save memory
                    return [4 /*yield*/, pipeline.saveMemory()];
                case 5:
                    // Save memory
                    _a.sent();
                    console.log('\n✅ Demonstration completed successfully!');
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _a.sent();
                    console.error('❌ Demo failed:', error_1.message);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// Run demonstration if this file is executed directly
if (require.main === module) {
    demonstratePipeline().catch(console.error);
}
