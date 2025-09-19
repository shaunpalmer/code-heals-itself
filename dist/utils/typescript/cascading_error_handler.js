"use strict";
/**
 * Cascading Error Handler and Sandbox Environment for Self-Healing Code
 * Handles error type transitions and provides safe testing environment
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CascadingErrorHandler = exports.SandboxExecution = exports.TestResult = exports.ResourceLimits = exports.IsolationLevel = exports.Environment = void 0;
var Environment;
(function (Environment) {
    Environment["SANDBOX"] = "sandbox";
    Environment["PRODUCTION"] = "production";
})(Environment || (exports.Environment = Environment = {}));
var IsolationLevel;
(function (IsolationLevel) {
    IsolationLevel["FULL"] = "full";
    IsolationLevel["PARTIAL"] = "partial";
    IsolationLevel["NONE"] = "none";
})(IsolationLevel || (exports.IsolationLevel = IsolationLevel = {}));
class ResourceLimits {
    constructor(max_execution_time_ms = 30000, // 30 seconds
    max_memory_mb = 500, max_cpu_percent = 80) {
        this.max_execution_time_ms = max_execution_time_ms;
        this.max_memory_mb = max_memory_mb;
        this.max_cpu_percent = max_cpu_percent;
    }
}
exports.ResourceLimits = ResourceLimits;
class TestResult {
    constructor(test_type, // syntax, unit, integration, performance, security
    passed, execution_time_ms, error_message = "") {
        this.test_type = test_type;
        this.passed = passed;
        this.execution_time_ms = execution_time_ms;
        this.error_message = error_message;
    }
}
exports.TestResult = TestResult;
class SandboxExecution {
    constructor(environment = Environment.SANDBOX, isolation_level = IsolationLevel.FULL, resource_limits = null) {
        this.environment = environment;
        this.isolation_level = isolation_level;
        this.resource_limits = resource_limits || new ResourceLimits();
        this.test_results = [];
        this.start_time = null;
        this.end_time = null;
        this.last_resource_usage = null;
    }
    execute_patch(patch_data) {
        /**
         * Execute patch in sandbox environment with safety checks
         *
         * @param patch_data Patch data from transmission schema
         * @returns Execution results with safety metrics
         */
        this.start_time = new Date();
        try {
            // Apply resource limits
            if (!this._check_resource_limits()) {
                return this._create_failure_result("Resource limits exceeded");
            }
            // Execute based on isolation level
            let result;
            if (this.isolation_level === IsolationLevel.FULL) {
                result = this._execute_with_full_isolation(patch_data);
            }
            else if (this.isolation_level === IsolationLevel.PARTIAL) {
                result = this._execute_with_partial_isolation(patch_data);
            }
            else {
                result = this._execute_without_isolation(patch_data);
            }
            // Enforce resource limits based on observed metrics and elapsed time
            this._evaluate_limits(result);
            // Run comprehensive tests
            this._run_test_suite(patch_data, result);
            return result;
        }
        catch (error) {
            return this._create_failure_result(`Execution failed: ${error.message}`);
        }
        finally {
            this.end_time = new Date();
        }
    }
    _check_resource_limits() {
        /** Check if execution is within resource limits */
        // In a real implementation, this would monitor actual resource usage
        // For now, return true as we're in a simulated environment
        return true;
    }
    _execute_with_full_isolation(patch_data) {
        /** Execute patch with full process isolation */
        // Simulate full isolation execution
        const simulated = {
            success: true,
            isolation_level: "full",
            execution_time_ms: 1500,
            memory_used_mb: 45,
            cpu_used_percent: 15,
            side_effects: [],
            test_results: this.test_results
        };
        // Store as last observed usage (limits evaluated later)
        this.last_resource_usage = {
            execution_time_ms: simulated.execution_time_ms,
            memory_used_mb: simulated.memory_used_mb,
            cpu_used_percent: simulated.cpu_used_percent,
            limits_hit: { time: false, memory: false, cpu: false }
        };
        return simulated;
    }
    _execute_with_partial_isolation(patch_data) {
        /** Execute patch with partial isolation */
        // Simulate partial isolation execution
        const simulated = {
            success: true,
            isolation_level: "partial",
            execution_time_ms: 1200,
            memory_used_mb: 38,
            cpu_used_percent: 12,
            side_effects: ["logged_warning"],
            test_results: this.test_results
        };
        this.last_resource_usage = {
            execution_time_ms: simulated.execution_time_ms,
            memory_used_mb: simulated.memory_used_mb,
            cpu_used_percent: simulated.cpu_used_percent,
            limits_hit: { time: false, memory: false, cpu: false }
        };
        return simulated;
    }
    _execute_without_isolation(patch_data) {
        /** Execute patch without isolation (dangerous - for testing only) */
        // Simulate no isolation execution
        const simulated = {
            success: true,
            isolation_level: "none",
            execution_time_ms: 800,
            memory_used_mb: 25,
            cpu_used_percent: 8,
            side_effects: ["potential_system_impact"],
            test_results: this.test_results
        };
        this.last_resource_usage = {
            execution_time_ms: simulated.execution_time_ms,
            memory_used_mb: simulated.memory_used_mb,
            cpu_used_percent: simulated.cpu_used_percent,
            limits_hit: { time: false, memory: false, cpu: false }
        };
        return simulated;
    }
    _run_test_suite(patch_data, execution_result) {
        /** Run comprehensive test suite */
        const test_types = ["syntax", "unit", "integration", "performance", "security"];
        for (let i = 0; i < test_types.length; i++) {
            const test_type = test_types[i];
            // Simulate test execution
            const passed = this._simulate_test(test_type, patch_data);
            const execution_time = 100 + (i * 50); // Variable execution time
            this.test_results.push(new TestResult(test_type, passed, execution_time, passed ? "" : `${test_type} test failed`));
        }
    }
    _simulate_test(test_type, patch_data) {
        /** Simulate test execution (in real implementation, this would run actual tests) */
        // Simple simulation - in reality, this would execute actual test suites
        const code_length = patch_data.patched_code ? patch_data.patched_code.length : 0;
        if (test_type === "syntax") {
            // Syntax tests usually pass if code compiles
            return true;
        }
        else if (test_type === "unit") {
            // Unit tests might fail occasionally
            return code_length % 3 !== 0;
        }
        else if (test_type === "integration") {
            // Integration tests more likely to fail
            return code_length % 5 !== 0;
        }
        else if (test_type === "performance") {
            // Performance tests usually pass
            return true;
        }
        else if (test_type === "security") {
            // Security tests might flag issues
            return code_length % 7 !== 0;
        }
        return true;
    }
    _create_failure_result(error_message) {
        /** Create failure result with error details */
        return {
            success: false,
            error_message: error_message,
            isolation_level: this.isolation_level,
            execution_time_ms: 0,
            memory_used_mb: 0,
            cpu_used_percent: 0,
            side_effects: ["execution_failed"],
            test_results: []
        };
    }
    _evaluate_limits(execution_result) {
        /**
         * Enforce resource limits using both simulated result metrics and actual wall time
         */
        const elapsed_ms = (this.start_time && this.end_time)
            ? (this.end_time.getTime() - this.start_time.getTime())
            : null;
        const execMs = typeof execution_result.execution_time_ms === 'number' ? execution_result.execution_time_ms : 0;
        const memMb = typeof execution_result.memory_used_mb === 'number' ? execution_result.memory_used_mb : 0;
        const cpuPct = typeof execution_result.cpu_used_percent === 'number' ? execution_result.cpu_used_percent : 0;
        const timeExceeded = (elapsed_ms !== null ? elapsed_ms : execMs) > this.resource_limits.max_execution_time_ms;
        const memExceeded = memMb > this.resource_limits.max_memory_mb;
        const cpuExceeded = cpuPct > this.resource_limits.max_cpu_percent;
        // Update last resource usage snapshot
        this.last_resource_usage = {
            execution_time_ms: (elapsed_ms !== null ? elapsed_ms : execMs),
            memory_used_mb: memMb,
            cpu_used_percent: cpuPct,
            limits_hit: { time: timeExceeded, memory: memExceeded, cpu: cpuExceeded }
        };
        const anyExceeded = timeExceeded || memExceeded || cpuExceeded;
        if (anyExceeded) {
            execution_result.success = false;
            const reasons = [];
            if (timeExceeded)
                reasons.push(`time>${this.resource_limits.max_execution_time_ms}ms`);
            if (memExceeded)
                reasons.push(`mem>${this.resource_limits.max_memory_mb}MB`);
            if (cpuExceeded)
                reasons.push(`cpu>${this.resource_limits.max_cpu_percent}%`);
            execution_result.error_message = `Resource limits exceeded: ${reasons.join(", ")}`;
            execution_result.limits_hit = { time: timeExceeded, memory: memExceeded, cpu: cpuExceeded };
        }
        else {
            execution_result.limits_hit = { time: false, memory: false, cpu: false };
        }
    }
    getResourceUsage() {
        /**
         * Return last observed resource usage along with configured limits
         */
        return {
            observed: this.last_resource_usage || {
                execution_time_ms: 0,
                memory_used_mb: 0,
                cpu_used_percent: 0,
                limits_hit: { time: false, memory: false, cpu: false }
            },
            limits: {
                max_execution_time_ms: this.resource_limits.max_execution_time_ms,
                max_memory_mb: this.resource_limits.max_memory_mb,
                max_cpu_percent: this.resource_limits.max_cpu_percent
            }
        };
    }
    get_execution_summary() {
        /** Get summary of sandbox execution */
        let total_time = 0;
        if (this.start_time && this.end_time) {
            total_time = this.end_time.getTime() - this.start_time.getTime();
        }
        const passed_tests = this.test_results.filter(test => test.passed).length;
        const total_tests = this.test_results.length;
        return {
            environment: this.environment,
            isolation_level: this.isolation_level,
            total_execution_time_ms: total_time,
            tests_passed: passed_tests,
            tests_total: total_tests,
            test_success_rate: passed_tests / Math.max(1, total_tests),
            resource_limits: {
                max_execution_time_ms: this.resource_limits.max_execution_time_ms,
                max_memory_mb: this.resource_limits.max_memory_mb,
                max_cpu_percent: this.resource_limits.max_cpu_percent
            }
        };
    }
}
exports.SandboxExecution = SandboxExecution;
class CascadingErrorHandler {
    constructor() {
        this.error_chain = [];
        // Allow deeper exploration before the cascade guard stops attempts.
        // This gives the circuit breaker time to form a baseline and act.
        this.max_cascade_depth = 10;
        this.max_attempts_per_error = 3;
    }
    add_error_to_chain(error_type, error_message, confidence_score, attempt_number) {
        /**
         * Add an error to the cascading chain
         *
         * @param error_type Type of error encountered
         * @param error_message Error message/details
         * @param confidence_score Confidence score when error occurred
         * @param attempt_number Which attempt this was for this error type
         */
        const error_entry = {
            error_type: error_type,
            error_message: error_message,
            confidence_score: confidence_score,
            attempt_number: attempt_number,
            timestamp: new Date().toISOString(),
            is_cascading: this.error_chain.length > 0
        };
        this.error_chain.push(error_entry);
    }
    should_stop_attempting() {
        /**
         * Determine if we should stop attempting fixes based on error cascade
         *
         * @returns [should_stop, reason]
         */
        if (this.error_chain.length === 0) {
            return [false, "No errors in chain"];
        }
        // Check cascade depth
        if (this.error_chain.length >= this.max_cascade_depth) {
            return [true, `Cascade depth exceeded (${this.error_chain.length} >= ${this.max_cascade_depth})`];
        }
        // Check for repeating error patterns
        if (this._has_repeating_pattern()) {
            return [true, "Repeating error pattern detected"];
        }
        // Check for degrading confidence
        if (this._has_degrading_confidence()) {
            return [true, "Confidence scores degrading with each attempt"];
        }
        // Check for error type escalation
        if (this._has_error_escalation()) {
            return [true, "Error severity escalating with each fix attempt"];
        }
        return [false, "Continue attempting fixes"];
    }
    _has_repeating_pattern() {
        /** Check if the same error types are repeating */
        if (this.error_chain.length < 3) {
            return false;
        }
        const recent_errors = this.error_chain.slice(-3);
        const error_types = recent_errors.map(entry => entry.error_type);
        const error_messages = recent_errors.map(entry => entry.error_message);
        // Treat as a repeating pattern only if both type AND message are identical
        // This avoids stopping when the category is the same but the concrete error differs
        const sameType = new Set(error_types).size === 1;
        const sameMessage = new Set(error_messages).size === 1;
        return sameType && sameMessage;
    }
    _has_degrading_confidence() {
        /** Check if confidence scores are consistently decreasing */
        if (this.error_chain.length < 3) {
            return false;
        }
        const recent_scores = this.error_chain.slice(-3).map(entry => entry.confidence_score);
        return recent_scores[0] > recent_scores[1] && recent_scores[1] > recent_scores[2];
    }
    _has_error_escalation() {
        /** Check if error severity is increasing */
        if (this.error_chain.length < 2) {
            return false;
        }
        const severity_levels = {
            "syntax": 1,
            "logic": 2,
            "runtime": 3,
            "performance": 4,
            "security": 5
        };
        const recent_severities = [];
        const start_index = Math.max(0, this.error_chain.length - 3);
        for (let i = start_index; i < this.error_chain.length; i++) {
            const error_type = this.error_chain[i].error_type;
            const severity = severity_levels[error_type] || 1;
            recent_severities.push(severity);
        }
        // Check if severity is consistently increasing
        if (recent_severities.length >= 2) {
            return recent_severities[recent_severities.length - 1] > recent_severities[recent_severities.length - 2];
        }
        return false;
    }
    get_cascade_analysis() {
        /** Get analysis of the current error cascade */
        if (this.error_chain.length === 0) {
            return { cascade_depth: 0, analysis: "No errors in cascade" };
        }
        // Analyze error types frequency
        const error_type_counts = {};
        for (const entry of this.error_chain) {
            const error_type = entry.error_type;
            error_type_counts[error_type] = (error_type_counts[error_type] || 0) + 1;
        }
        // Analyze confidence trend
        const confidence_scores = this.error_chain.map(entry => entry.confidence_score);
        let confidence_trend = "stable";
        if (confidence_scores.length >= 2) {
            if (confidence_scores[confidence_scores.length - 1] > confidence_scores[0]) {
                confidence_trend = "improving";
            }
            else if (confidence_scores[confidence_scores.length - 1] < confidence_scores[0]) {
                confidence_trend = "degrading";
            }
        }
        return {
            cascade_depth: this.error_chain.length,
            error_type_distribution: error_type_counts,
            confidence_trend: confidence_trend,
            average_confidence: confidence_scores.reduce((a, b) => a + b, 0) / confidence_scores.length,
            most_common_error: Object.keys(error_type_counts).reduce((a, b) => error_type_counts[a] > error_type_counts[b] ? a : b),
            recommendation: this._generate_recommendation()
        };
    }
    _generate_recommendation() {
        /** Generate recommendation based on cascade analysis */
        const analysis = this.get_cascade_analysis();
        if (analysis.cascade_depth >= this.max_cascade_depth) {
            return "Stop attempting fixes - cascade depth limit reached";
        }
        if (analysis.confidence_trend === "degrading") {
            return "Consider rolling back to earlier successful state";
        }
        const most_common = analysis.most_common_error;
        if (most_common === "syntax") {
            return "Focus on syntax validation before proceeding";
        }
        else if (most_common === "logic") {
            return "Consider human review for complex logic issues";
        }
        else if (most_common === "runtime") {
            return "Add more comprehensive runtime testing";
        }
        else if (most_common === "performance") {
            return "Review performance implications of recent changes";
        }
        else if (most_common === "security") {
            return "Security review recommended before proceeding";
        }
        return "Continue with caution - monitor for further cascades";
    }
    reset_cascade() {
        /** Reset the error cascade (use when starting fresh attempt) */
        this.error_chain = [];
    }
    get_error_chain_json() {
        /** Get the error chain as JSON for transmission */
        return JSON.stringify({
            error_chain: this.error_chain,
            cascade_analysis: this.get_cascade_analysis(),
            timestamp: new Date().toISOString()
        }, null, 2);
    }
}
exports.CascadingErrorHandler = CascadingErrorHandler;
