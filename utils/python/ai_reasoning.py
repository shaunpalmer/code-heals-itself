import json
from typing import Dict, Any, List
from collections import defaultdict

class PatternLearner:
    def __init__(self):
        self.patterns = defaultdict(lambda: {"success_count": 0, "failure_count": 0, "avg_time": 0})
    
    def learn_from_outcome(self, pattern_type: str, success: bool, execution_time: float):
        self.patterns[pattern_type]["success_count" if success else "failure_count"] += 1
        # Update rolling average
        current_avg = self.patterns[pattern_type]["avg_time"]
        count = self.patterns[pattern_type]["success_count"] + self.patterns[pattern_type]["failure_count"]
        self.patterns[pattern_type]["avg_time"] = (current_avg * (count - 1) + execution_time) / count
    
    def get_best_pattern(self, available_patterns: List[str]) -> str:
        best_pattern = max(available_patterns, 
                          key=lambda p: self.patterns[p]["success_count"] / 
                                        max(1, self.patterns[p]["success_count"] + self.patterns[p]["failure_count"]))
        return best_pattern
    
    def get_pattern_stats(self) -> Dict[str, Any]:
        return dict(self.patterns)

class AIReasoningEngine:
    def __init__(self, learner: PatternLearner, memory_buffer=None):
        self.learner = learner
        self.memory_buffer = memory_buffer
        self.decision_log = []
    
    def reason_about_patch(self, context: Dict[str, Any]) -> Dict[str, Any]:
        error_type = context.get("error_type", "unknown")
        available_strategies = ["LogAndFixStrategy", "RollbackStrategy", "SecurityAuditStrategy"]
        
        best_strategy = self.learner.get_best_pattern(available_strategies)
        
        # Check memory buffer for similar past outcomes
        similar_outcomes = []
        if self.memory_buffer:
            similar_outcomes = self.memory_buffer.get_similar_outcomes(context)
        
        reasoning = {
            "error_analysis": f"Detected {error_type} error",
            "historical_performance": self.learner.get_pattern_stats(),
            "recommended_strategy": best_strategy,
            "confidence": self._calculate_confidence(best_strategy),
            "alternative_strategies": [s for s in available_strategies if s != best_strategy],
            "similar_past_outcomes": len(similar_outcomes),
            "learning_insights": self._extract_insights(similar_outcomes)
        }
        
        self.decision_log.append({
            "context": context,
            "reasoning": reasoning,
            "timestamp": __import__('datetime').datetime.now().isoformat()
        })
        
        return reasoning
    
    def _calculate_confidence(self, strategy: str) -> float:
        stats = self.learner.patterns[strategy]
        total = stats["success_count"] + stats["failure_count"]
        if total == 0:
            return 0.5  # Neutral confidence for new strategies
        return stats["success_count"] / total
    
    def _extract_insights(self, similar_outcomes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Extract learning insights from similar past outcomes"""
        if not similar_outcomes:
            return {"insights": "No similar past outcomes found"}
        
        success_rate = sum(1 for outcome in similar_outcomes 
                          if json.loads(outcome["envelope"]).get("success", False)) / len(similar_outcomes)
        
        return {
            "success_rate_in_similar_cases": success_rate,
            "recommendation": "Proceed with caution" if success_rate < 0.7 else "High confidence",
            "patterns_to_avoid": self._identify_failure_patterns(similar_outcomes)
        }
    
    def _identify_failure_patterns(self, outcomes: List[Dict[str, Any]]) -> List[str]:
        """Identify common failure patterns from past outcomes"""
        failure_patterns = []
        for outcome in outcomes:
            envelope_data = json.loads(outcome["envelope"])
            if not envelope_data.get("success", False):
                # Extract failure reasons
                if envelope_data.get("flagged_for_developer"):
                    failure_patterns.append("Flagged for developer - complex issue")
                elif "circuit_breaker_tripped" in str(envelope_data):
                    failure_patterns.append("Circuit breaker tripped - potential infinite loop")
        
        return list(set(failure_patterns))  # Remove duplicates

# Enhanced Strategy with AI reasoning and memory
class AIEnhancedStrategy(DebuggingStrategy):
    def __init__(self, base_strategy: DebuggingStrategy, reasoning_engine: AIReasoningEngine, envelope_wrapper=None):
        self.base_strategy = base_strategy
        self.reasoning_engine = reasoning_engine
        self.envelope_wrapper = envelope_wrapper
    
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        reasoning = self.reasoning_engine.reason_about_patch(context)
        base_outcome = self.base_strategy.execute(context)
        
        # Wrap in envelope if available
        if self.envelope_wrapper:
            envelope = self.envelope_wrapper.wrap_patch(context)
            envelope_result = self.envelope_wrapper.unwrap_and_execute(envelope)
            
            enhanced_outcome = {
                **base_outcome,
                "ai_reasoning": reasoning,
                "envelope_result": envelope_result,
                "strategy": f"AIEnhanced{self.base_strategy.__class__.__name__}"
            }
        else:
            enhanced_outcome = {
                **base_outcome,
                "ai_reasoning": reasoning,
                "strategy": f"AIEnhanced{self.base_strategy.__class__.__name__}"
            }
        
        return enhanced_outcome

# Usage example
if __name__ == "__main__":
    from envelope import AIPatchEnvelope, MemoryBuffer
    
    learner = PatternLearner()
    memory = MemoryBuffer()
    reasoning_engine = AIReasoningEngine(learner, memory)
    envelope_wrapper = AIPatchEnvelope()
    
    # Simulate learning from past outcomes
    learner.learn_from_outcome("LogAndFixStrategy", True, 0.5)
    learner.learn_from_outcome("RollbackStrategy", False, 1.2)
    learner.learn_from_outcome("LogAndFixStrategy", True, 0.3)
    
    ai_strategy = AIEnhancedStrategy(LogAndFixStrategy(), reasoning_engine, envelope_wrapper)
    debugger = Debugger(ai_strategy)
    
    context = {"error": "Null pointer exception", "error_type": "memory"}
    result = debugger.debug(context)
    print(json.dumps(result, indent=2))