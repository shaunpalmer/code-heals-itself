"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.MemoryBuffer = exports.AIPatchEnvelope = exports.PatchWrapper = exports.PatchEnvelope = void 0;
var PatchEnvelope = /** @class */ (function () {
    function PatchEnvelope(patchId, patchData, metadata, attempts, confidenceComponents, breakerState, cascadeDepth, resourceUsage) {
        if (metadata === void 0) { metadata = {}; }
        if (attempts === void 0) { attempts = []; }
        if (confidenceComponents === void 0) { confidenceComponents = {}; }
        if (breakerState === void 0) { breakerState = "CLOSED"; }
        if (cascadeDepth === void 0) { cascadeDepth = 0; }
        if (resourceUsage === void 0) { resourceUsage = {}; }
        this.patchId = patchId;
        this.patchData = patchData;
        this.metadata = metadata;
        this.attempts = attempts;
        this.metadata = __assign({ created_at: new Date().toISOString(), language: "typescript", ai_generated: true }, metadata);
        this.attempts = attempts;
        this.confidenceComponents = confidenceComponents;
        this.breakerState = breakerState;
        this.cascadeDepth = cascadeDepth;
        this.resourceUsage = resourceUsage;
        this.success = false;
        this.flaggedForDeveloper = false;
        this.developerMessage = "";
    }
    PatchEnvelope.prototype.toJson = function () {
        return JSON.stringify({
            patch_id: this.patchId,
            patch_data: this.patchData,
            metadata: this.metadata,
            attempts: this.attempts,
            confidenceComponents: this.confidenceComponents,
            breakerState: this.breakerState,
            cascadeDepth: this.cascadeDepth,
            resourceUsage: this.resourceUsage,
            success: this.success,
            flagged_for_developer: this.flaggedForDeveloper,
            developer_message: this.developerMessage,
            timestamp: new Date().toISOString()
        }, null, 2);
    };
    PatchEnvelope.fromJson = function (jsonStr) {
        var data = JSON.parse(jsonStr);
        var envelope = new PatchEnvelope(data.patch_id, data.patch_data, data.metadata, data.attempts, data.confidenceComponents || {}, data.breakerState || "CLOSED", data.cascadeDepth || 0, data.resourceUsage || {});
        envelope.success = data.success || false;
        envelope.flaggedForDeveloper = data.flagged_for_developer || false;
        envelope.developerMessage = data.developer_message || "";
        return envelope;
    };
    return PatchEnvelope;
}());
exports.PatchEnvelope = PatchEnvelope;
var PatchWrapper = /** @class */ (function () {
    function PatchWrapper() {
    }
    return PatchWrapper;
}());
exports.PatchWrapper = PatchWrapper;
var AIPatchEnvelope = /** @class */ (function (_super) {
    __extends(AIPatchEnvelope, _super);
    function AIPatchEnvelope() {
        var _this = _super.call(this) || this;
        _this.envelopes = new Map();
        return _this;
    }
    AIPatchEnvelope.prototype.wrapPatch = function (patch) {
        var patchId = "patch_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
        var envelope = new PatchEnvelope(patchId, patch);
        this.envelopes.set(patchId, envelope);
        return envelope;
    };
    AIPatchEnvelope.prototype.unwrapAndExecute = function (envelope) {
        // Check if this is a "big error" that should be flagged
        if (this.isBigError(envelope.patchData)) {
            envelope.flaggedForDeveloper = true;
            envelope.developerMessage = this.generateDeveloperMessage(envelope.patchData);
            return {
                success: false,
                flagged: true,
                message: "Patch flagged for developer review - potential critical issue",
                envelope: envelope.toJson()
            };
        }
        // Simulate successful execution
        var result = {
            success: true,
            patch_id: envelope.patchId,
            execution_details: "Patch executed successfully",
            envelope: envelope.toJson()
        };
        // Update envelope
        envelope.success = true;
        envelope.attempts.push({
            timestamp: new Date().toISOString(),
            result: "success",
            details: result.execution_details
        });
        return result;
    };
    AIPatchEnvelope.prototype.isBigError = function (patchData) {
        var errorIndicators = [
            patchData.database_schema_change,
            patchData.authentication_bypass,
            patchData.critical_security_vulnerability,
            patchData.production_data_modification,
            JSON.stringify(patchData).length > 1000 // Large/complex patches
        ];
        return errorIndicators.some(function (indicator) { return indicator; });
    };
    AIPatchEnvelope.prototype.generateDeveloperMessage = function (patchData) {
        if (patchData.database_schema_change) {
            return "Database schema modification detected. Please review for data integrity and migration implications.";
        }
        else if (patchData.authentication_bypass) {
            return "Authentication-related changes detected. Critical security review required.";
        }
        else if (patchData.production_data_modification) {
            return "Production data modification detected. Please verify backup and rollback procedures.";
        }
        else {
            return "Complex patch detected requiring manual review before deployment.";
        }
    };
    return AIPatchEnvelope;
}(PatchWrapper));
exports.AIPatchEnvelope = AIPatchEnvelope;
var MemoryBuffer = /** @class */ (function () {
    function MemoryBuffer(maxSize) {
        if (maxSize === void 0) { maxSize = 100; }
        this.buffer = [];
        this.maxSize = maxSize;
    }
    MemoryBuffer.prototype.addOutcome = function (envelopeJson) {
        this.buffer.push({
            envelope: envelopeJson,
            timestamp: new Date().toISOString()
        });
        // Maintain buffer size
        if (this.buffer.length > this.maxSize) {
            this.buffer.shift();
        }
    };
    MemoryBuffer.prototype.getSimilarOutcomes = function (patchData) {
        var similar = [];
        for (var _i = 0, _a = this.buffer; _i < _a.length; _i++) {
            var item = _a[_i];
            var envelope = PatchEnvelope.fromJson(item.envelope);
            if (this.isSimilar(envelope.patchData, patchData)) {
                similar.push(item);
            }
        }
        return similar.slice(-5); // Return last 5 similar outcomes
    };
    MemoryBuffer.prototype.isSimilar = function (pastPatch, currentPatch) {
        var pastStr = JSON.stringify(pastPatch).toLowerCase();
        var currentStr = JSON.stringify(currentPatch).toLowerCase();
        var pastWords = pastStr.split(/[^a-zA-Z0-9]/).filter(function (word) { return word.length > 0; });
        var currentWords = currentStr.split(/[^a-zA-Z0-9]/).filter(function (word) { return word.length > 0; });
        var intersection = pastWords.filter(function (word) { return currentWords.includes(word); });
        return intersection.length > 2;
    };
    // Persistence extensions - these can be overridden in subclasses
    MemoryBuffer.prototype.save = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var fs, path, data, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!filePath)
                            return [2 /*return*/]; // Base class does nothing
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('fs/promises'); })];
                    case 1:
                        fs = _a.sent();
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('path'); })];
                    case 2:
                        path = _a.sent();
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 6, , 7]);
                        return [4 /*yield*/, fs.mkdir(path.dirname(filePath), { recursive: true })];
                    case 4:
                        _a.sent();
                        data = {
                            buffer: this.buffer,
                            maxSize: this.maxSize,
                            saved_at: new Date().toISOString()
                        };
                        return [4 /*yield*/, fs.writeFile(filePath, JSON.stringify(data, null, 2))];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        error_1 = _a.sent();
                        console.error('Memory save failed:', error_1.message);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    MemoryBuffer.prototype.load = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var fs, content, data, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!filePath)
                            return [2 /*return*/]; // Base class does nothing
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('fs/promises'); })];
                    case 1:
                        fs = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, fs.readFile(filePath, 'utf-8')];
                    case 3:
                        content = _a.sent();
                        data = JSON.parse(content);
                        if (data.buffer && Array.isArray(data.buffer)) {
                            this.buffer = data.buffer;
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        if (error_2.code !== 'ENOENT') {
                            console.error('Memory load failed:', error_2.message);
                        }
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return MemoryBuffer;
}());
exports.MemoryBuffer = MemoryBuffer;
