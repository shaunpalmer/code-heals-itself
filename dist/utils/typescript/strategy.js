"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Debugger = exports.SecurityAuditStrategy = exports.RollbackStrategy = exports.LogAndFixStrategy = exports.DebuggingStrategy = void 0;
class DebuggingStrategy {
}
exports.DebuggingStrategy = DebuggingStrategy;
// Execute the strategy against provided context.
// Concrete subclasses return a structured outcome.
class LogAndFixStrategy extends DebuggingStrategy {
    execute(context) {
        const error = context.error || "";
        const fix = `Logged and fixed: ${error}`;
        const outcome = {
            strategy: "LogAndFixStrategy",
            error: error,
            fix: fix,
            success: true,
            details: "Error logged and basic fix applied"
        };
        return outcome;
    }
}
exports.LogAndFixStrategy = LogAndFixStrategy;
class RollbackStrategy extends DebuggingStrategy {
    execute(context) {
        const error = context.error || "";
        const rollbackAction = `Rolled back changes due to: ${error}`;
        const outcome = {
            strategy: "RollbackStrategy",
            error: error,
            rollback_action: rollbackAction,
            success: true,
            details: "Changes rolled back to previous stable state"
        };
        return outcome;
    }
}
exports.RollbackStrategy = RollbackStrategy;
class SecurityAuditStrategy extends DebuggingStrategy {
    execute(context) {
        const vulnerability = context.vulnerability || "";
        const auditResult = `Security audit passed for: ${vulnerability}`;
        const outcome = {
            strategy: "SecurityAuditStrategy",
            vulnerability: vulnerability,
            audit_result: auditResult,
            success: true,
            details: "Security vulnerability addressed"
        };
        return outcome;
    }
}
exports.SecurityAuditStrategy = SecurityAuditStrategy;
class Debugger {
    constructor(strategy) {
        this.strategy = strategy;
    }
    setStrategy(strategy) {
        this.strategy = strategy;
    }
    debug(context) {
        return this.strategy.execute(context);
    }
}
exports.Debugger = Debugger;
