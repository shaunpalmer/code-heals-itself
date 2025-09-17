class DebuggingStrategy {
  execute(context) {
    throw new Error("execute method must be implemented by subclass");
  }
}

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

// Usage example
const debugInstance = new Debugger(new LogAndFixStrategy());

const context = { error: "Null pointer exception" };
const result = debugInstance.debug(context);
console.log(JSON.stringify(result, null, 2));

// Switch to rollback strategy
debugInstance.setStrategy(new RollbackStrategy());
const result2 = debugInstance.debug(context);
console.log(JSON.stringify(result2, null, 2));

// Security strategy
debugInstance.setStrategy(new SecurityAuditStrategy());
const securityContext = { vulnerability: "Buffer overflow" };
const result3 = debugInstance.debug(securityContext);
console.log(JSON.stringify(result3, null, 2));

module.exports = { DebuggingStrategy, LogAndFixStrategy, RollbackStrategy, SecurityAuditStrategy, Debugger };