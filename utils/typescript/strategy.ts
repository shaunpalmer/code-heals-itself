abstract class DebuggingStrategy {
  abstract execute(context: Record<string, any>): Record<string, any>;
}
// Execute the strategy against provided context.
// Concrete subclasses return a structured outcome.

class LogAndFixStrategy extends DebuggingStrategy {
  execute(context: Record<string, any>): Record<string, any> {
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
  execute(context: Record<string, any>): Record<string, any> {
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
  execute(context: Record<string, any>): Record<string, any> {
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
  constructor(private strategy: DebuggingStrategy) { }

  setStrategy(strategy: DebuggingStrategy): void {
    this.strategy = strategy;
  }

  debug(context: Record<string, any>): Record<string, any> {
    return this.strategy.execute(context);
  }
}

// NOTE: Removed side-effect demo execution to keep module import clean.
// If you need a manual demo, create a separate script or call these classes directly.

export { DebuggingStrategy, LogAndFixStrategy, RollbackStrategy, SecurityAuditStrategy, Debugger };