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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Debugger = exports.SecurityAuditStrategy = exports.RollbackStrategy = exports.LogAndFixStrategy = exports.DebuggingStrategy = void 0;
var DebuggingStrategy = /** @class */ (function () {
    function DebuggingStrategy() {
    }
    return DebuggingStrategy;
}());
exports.DebuggingStrategy = DebuggingStrategy;
var LogAndFixStrategy = /** @class */ (function (_super) {
    __extends(LogAndFixStrategy, _super);
    function LogAndFixStrategy() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LogAndFixStrategy.prototype.execute = function (context) {
        var error = context.error || "";
        var fix = "Logged and fixed: ".concat(error);
        var outcome = {
            strategy: "LogAndFixStrategy",
            error: error,
            fix: fix,
            success: true,
            details: "Error logged and basic fix applied"
        };
        return outcome;
    };
    return LogAndFixStrategy;
}(DebuggingStrategy));
exports.LogAndFixStrategy = LogAndFixStrategy;
var RollbackStrategy = /** @class */ (function (_super) {
    __extends(RollbackStrategy, _super);
    function RollbackStrategy() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    RollbackStrategy.prototype.execute = function (context) {
        var error = context.error || "";
        var rollbackAction = "Rolled back changes due to: ".concat(error);
        var outcome = {
            strategy: "RollbackStrategy",
            error: error,
            rollback_action: rollbackAction,
            success: true,
            details: "Changes rolled back to previous stable state"
        };
        return outcome;
    };
    return RollbackStrategy;
}(DebuggingStrategy));
exports.RollbackStrategy = RollbackStrategy;
var SecurityAuditStrategy = /** @class */ (function (_super) {
    __extends(SecurityAuditStrategy, _super);
    function SecurityAuditStrategy() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SecurityAuditStrategy.prototype.execute = function (context) {
        var vulnerability = context.vulnerability || "";
        var auditResult = "Security audit passed for: ".concat(vulnerability);
        var outcome = {
            strategy: "SecurityAuditStrategy",
            vulnerability: vulnerability,
            audit_result: auditResult,
            success: true,
            details: "Security vulnerability addressed"
        };
        return outcome;
    };
    return SecurityAuditStrategy;
}(DebuggingStrategy));
exports.SecurityAuditStrategy = SecurityAuditStrategy;
var Debugger = /** @class */ (function () {
    function Debugger(strategy) {
        this.strategy = strategy;
    }
    Debugger.prototype.setStrategy = function (strategy) {
        this.strategy = strategy;
    };
    Debugger.prototype.debug = function (context) {
        return this.strategy.execute(context);
    };
    return Debugger;
}());
exports.Debugger = Debugger;
// Usage example
var debugInstance = new Debugger(new LogAndFixStrategy());
var context = { error: "Null pointer exception" };
var result = debugInstance.debug(context);
console.log(JSON.stringify(result, null, 2));
// Switch to rollback strategy
debugInstance.setStrategy(new RollbackStrategy());
var result2 = debugInstance.debug(context);
console.log(JSON.stringify(result2, null, 2));
// Security strategy
debugInstance.setStrategy(new SecurityAuditStrategy());
var securityContext = { vulnerability: "Buffer overflow" };
var result3 = debugInstance.debug(securityContext);
console.log(JSON.stringify(result3, null, 2));
