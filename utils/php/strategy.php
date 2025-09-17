<?php

abstract class DebuggingStrategy {
    abstract public function execute(array $context): array;
}

class LogAndFixStrategy extends DebuggingStrategy {
    public function execute(array $context): array {
        $error = $context["error"] ?? "";
        $fix = "Logged and fixed: {$error}";

        $outcome = [
            "strategy" => "LogAndFixStrategy",
            "error" => $error,
            "fix" => $fix,
            "success" => true,
            "details" => "Error logged and basic fix applied"
        ];
        return $outcome;
    }
}

class RollbackStrategy extends DebuggingStrategy {
    public function execute(array $context): array {
        $error = $context["error"] ?? "";
        $rollbackAction = "Rolled back changes due to: {$error}";

        $outcome = [
            "strategy" => "RollbackStrategy",
            "error" => $error,
            "rollback_action" => $rollbackAction,
            "success" => true,
            "details" => "Changes rolled back to previous stable state"
        ];
        return $outcome;
    }
}

class SecurityAuditStrategy extends DebuggingStrategy {
    public function execute(array $context): array {
        $vulnerability = $context["vulnerability"] ?? "";
        $auditResult = "Security audit passed for: {$vulnerability}";

        $outcome = [
            "strategy" => "SecurityAuditStrategy",
            "vulnerability" => $vulnerability,
            "audit_result" => $auditResult,
            "success" => true,
            "details" => "Security vulnerability addressed"
        ];
        return $outcome;
    }
}

class Debugger {
    private DebuggingStrategy $strategy;

    public function __construct(DebuggingStrategy $strategy) {
        $this->strategy = $strategy;
    }

    public function setStrategy(DebuggingStrategy $strategy): void {
        $this->strategy = $strategy;
    }

    public function debug(array $context): array {
        return $this->strategy->execute($context);
    }
}

// Usage example
$debugger = new Debugger(new LogAndFixStrategy());

$context = ["error" => "Null pointer exception"];
$result = $debugger->debug($context);
echo json_encode($result, JSON_PRETTY_PRINT) . "\n";

// Switch to rollback strategy
$debugger->setStrategy(new RollbackStrategy());
$result2 = $debugger->debug($context);
echo json_encode($result2, JSON_PRETTY_PRINT) . "\n";

// Security strategy
$debugger->setStrategy(new SecurityAuditStrategy());
$securityContext = ["vulnerability" => "Buffer overflow"];
$result3 = $debugger->debug($securityContext);
echo json_encode($result3, JSON_PRETTY_PRINT) . "\n";

?>