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
var ResourceLimits = /** @class */ (function () {
    function ResourceLimits(max_execution_time_ms, // 30 seconds
    max_memory_mb, max_cpu_percent) {
        if (max_execution_time_ms === void 0) { max_execution_time_ms = 30000; }
        if (max_memory_mb === void 0) { max_memory_mb = 500; }
        if (max_cpu_percent === void 0) { max_cpu_percent = 80; }
        this.max_execution_time_ms = max_execution_time_ms;
        this.max_memory_mb = max_memory_mb;
        this.max_cpu_percent = max_cpu_percent;
    }
    return ResourceLimits;
}());
exports.ResourceLimits = ResourceLimits;
var TestResult = /** @class */ (function () {
    function TestResult(test_type, // syntax, unit, integration, performance, security
    passed, execution_time_ms, error_message) {
        if (error_message === void 0) { error_message = ""; }
        this.test_type = test_type;
        this.passed = passed;
        this.execution_time_ms = execution_time_ms;
        this.error_message = error_message;
    }
    return TestResult;
}());
exports.TestResult = TestResult;
var SandboxExecution = /** @class */ (function () {
    function SandboxExecution(environment, isolation_level, resource_limits) {
        if (environment === void 0) { environment = Environment.SANDBOX; }
        if (isolation_level === void 0) { isolation_level = IsolationLevel.FULL; }
        if (resource_limits === void 0) { resource_limits = null; }
        this.environment = environment;
        this.isolation_level = isolation_level;
        this.resource_limits = resource_limits || new ResourceLimits();
        this.test_results = [];
        this.start_time = null;
        this.end_time = null;
    }
    SandboxExecution.prototype.execute_patch = function (patch_data) {
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
            var result = void 0;
            if (this.isolation_level === IsolationLevel.FULL) {
                result = this._execute_with_full_isolation(patch_data);
            }
            else if (this.isolation_level === IsolationLevel.PARTIAL) {
                result = this._execute_with_partial_isolation(patch_data);
            }
            else {
                result = this._execute_without_isolation(patch_data);
            }
            // Run comprehensive tests
            this._run_test_suite(patch_data, result);
            return result;
        }
        catch (error) {
            return this._create_failure_result("Execution failed: ".concat(error.message));
        }
        finally {
            this.end_time = new Date();
        }
    };
    SandboxExecution.prototype._check_resource_limits = function () {
        /** Check if execution is within resource limits */
        // In a real implementation, this would monitor actual resource usage
        // For now, return true as we're in a simulated environment
        return true;
    };
    SandboxExecution.prototype._execute_with_full_isolation = function (patch_data) {
        /** Execute patch with full process isolation */
        // Simulate full isolation execution
        return {
            success: true,
            isolation_level: "full",
            execution_time_ms: 1500,
            memory_used_mb: 45,
            cpu_used_percent: 15,
            side_effects: [],
            test_results: this.test_results
        };
    };
    SandboxExecution.prototype._execute_with_partial_isolation = function (patch_data) {
        /** Execute patch with partial isolation */
        // Simulate partial isolation execution
        return {
            success: true,
            isolation_level: "partial",
            execution_time_ms: 1200,
            memory_used_mb: 38,
            cpu_used_percent: 12,
            side_effects: ["logged_warning"],
            test_results: this.test_results
        };
    };
    SandboxExecution.prototype._execute_without_isolation = function (patch_data) {
        /** Execute patch without isolation (dangerous - for testing only) */
        // Simulate no isolation execution
        return {
            success: true,
            isolation_level: "none",
            execution_time_ms: 800,
            memory_used_mb: 25,
            cpu_used_percent: 8,
            side_effects: ["potential_system_impact"],
            test_results: this.test_results
        };
    };
    SandboxExecution.prototype._run_test_suite = function (patch_data, execution_result) {
        /** Run comprehensive test suite */
        var test_types = ["syntax", "unit", "integration", "performance", "security"];
        for (var i = 0; i < test_types.length; i++) {
            var test_type = test_types[i];
            // Simulate test execution
            var passed = this._simulate_test(test_type, patch_data);
            var execution_time = 100 + (i * 50); // Variable execution time
            this.test_results.push(new TestResult(test_type, passed, execution_time, passed ? "" : "".concat(test_type, " test failed")));
        }
    };
    SandboxExecution.prototype._simulate_test = function (test_type, patch_data) {
        /** Simulate test execution (in real implementation, this would run actual tests) */
        // Simple simulation - in reality, this would execute actual test suites
        var code_length = patch_data.patched_code ? patch_data.patched_code.length : 0;
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
    };
    SandboxExecution.prototype._create_failure_result = function (error_message) {
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
    };
    SandboxExecution.prototype.get_execution_summary = function () {
        /** Get summary of sandbox execution */
        var total_time = 0;
        if (this.start_time && this.end_time) {
            total_time = this.end_time.getTime() - this.start_time.getTime();
        }
        var passed_tests = this.test_results.filter(function (test) { return test.passed; }).length;
        var total_tests = this.test_results.length;
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
    };
    return SandboxExecution;
}());
exports.SandboxExecution = SandboxExecution;
var CascadingErrorHandler = /** @class */ (function () {
    function CascadingErrorHandler() {
        this.error_chain = [];
        this.max_cascade_depth = 5;
        this.max_attempts_per_error = 3;
    }
    CascadingErrorHandler.prototype.add_error_to_chain = function (error_type, error_message, confidence_score, attempt_number) {
        /**
         * Add an error to the cascading chain
         *
         * @param error_type Type of error encountered
         * @param error_message Error message/details
         * @param confidence_score Confidence score when error occurred
         * @param attempt_number Which attempt this was for this error type
         */
        var error_entry = {
            error_type: error_type,
            error_message: error_message,
            confidence_score: confidence_score,
            attempt_number: attempt_number,
            timestamp: new Date().toISOString(),
            is_cascading: this.error_chain.length > 0
        };
        this.error_chain.push(error_entry);
    };
    CascadingErrorHandler.prototype.should_stop_attempting = function () {
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
            return [true, "Cascade depth exceeded (".concat(this.error_chain.length, " >= ").concat(this.max_cascade_depth, ")")];
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
    };
    CascadingErrorHandler.prototype._has_repeating_pattern = function () {
        /** Check if the same error types are repeating */
        if (this.error_chain.length < 3) {
            return false;
        }
        var recent_errors = this.error_chain.slice(-3);
        var error_types = recent_errors.map(function (entry) { return entry.error_type; });
        // Check if all recent errors are the same type
        return new Set(error_types).size === 1;
    };
    CascadingErrorHandler.prototype._has_degrading_confidence = function () {
        /** Check if confidence scores are consistently decreasing */
        if (this.error_chain.length < 3) {
            return false;
        }
        var recent_scores = this.error_chain.slice(-3).map(function (entry) { return entry.confidence_score; });
        return recent_scores[0] > recent_scores[1] && recent_scores[1] > recent_scores[2];
    };
    CascadingErrorHandler.prototype._has_error_escalation = function () {
        /** Check if error severity is increasing */
        if (this.error_chain.length < 2) {
            return false;
        }
        var severity_levels = {
            "syntax": 1,
            "logic": 2,
            "runtime": 3,
            "performance": 4,
            "security": 5
        };
        var recent_severities = [];
        var start_index = Math.max(0, this.error_chain.length - 3);
        for (var i = start_index; i < this.error_chain.length; i++) {
            var error_type = this.error_chain[i].error_type;
            var severity = severity_levels[error_type] || 1;
            recent_severities.push(severity);
        }
        // Check if severity is consistently increasing
        if (recent_severities.length >= 2) {
            return recent_severities[recent_severities.length - 1] > recent_severities[recent_severities.length - 2];
        }
        return false;
    };
    CascadingErrorHandler.prototype.get_cascade_analysis = function () {
        /** Get analysis of the current error cascade */
        if (this.error_chain.length === 0) {
            return { cascade_depth: 0, analysis: "No errors in cascade" };
        }
        // Analyze error types frequency
        var error_type_counts = {};
        for (var _i = 0, _a = this.error_chain; _i < _a.length; _i++) {
            var entry = _a[_i];
            var error_type = entry.error_type;
            error_type_counts[error_type] = (error_type_counts[error_type] || 0) + 1;
        }
        // Analyze confidence trend
        var confidence_scores = this.error_chain.map(function (entry) { return entry.confidence_score; });
        var confidence_trend = "stable";
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
            average_confidence: confidence_scores.reduce(function (a, b) { return a + b; }, 0) / confidence_scores.length,
            most_common_error: Object.keys(error_type_counts).reduce(function (a, b) {
                return error_type_counts[a] > error_type_counts[b] ? a : b;
            }),
            recommendation: this._generate_recommendation()
        };
    };
    CascadingErrorHandler.prototype._generate_recommendation = function () {
        /** Generate recommendation based on cascade analysis */
        var analysis = this.get_cascade_analysis();
        if (analysis.cascade_depth >= this.max_cascade_depth) {
            return "Stop attempting fixes - cascade depth limit reached";
        }
        if (analysis.confidence_trend === "degrading") {
            return "Consider rolling back to earlier successful state";
        }
        var most_common = analysis.most_common_error;
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
    };
    CascadingErrorHandler.prototype.reset_cascade = function () {
        /** Reset the error cascade (use when starting fresh attempt) */
        this.error_chain = [];
    };
    CascadingErrorHandler.prototype.get_error_chain_json = function () {
        /** Get the error chain as JSON for transmission */
        return JSON.stringify({
            error_chain: this.error_chain,
            cascade_analysis: this.get_cascade_analysis(),
            timestamp: new Date().toISOString()
        }, null, 2);
    };
    return CascadingErrorHandler;
}());
exports.CascadingErrorHandler = CascadingErrorHandler;
