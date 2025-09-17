import json
from typing import Dict, Any, List
from abc import ABC, abstractmethod

class HumanDebuggingHeuristic(ABC):
    @abstractmethod
    def analyze_error(self, error: str, context: Dict[str, Any]) -> Dict[str, Any]:
        pass

class PathAnalysisHeuristic(HumanDebuggingHeuristic):
    def analyze_error(self, error: str, context: Dict[str, Any]) -> Dict[str, Any]:
        # Simulate human-like path analysis
        if "undefined" in error.lower():
            return {
                "heuristic": "PathAnalysis",
                "analysis": "Likely a path resolution issue",
                "suggested_fixes": ["Check file paths", "Use absolute paths", "Verify constants"],
                "confidence": 0.8
            }
        elif "overflow" in error.lower():
            return {
                "heuristic": "PathAnalysis", 
                "analysis": "Buffer or stack overflow detected",
                "suggested_fixes": ["Add bounds checking", "Use safer data structures", "Implement circuit breaker"],
                "confidence": 0.9
            }
        return {"heuristic": "PathAnalysis", "analysis": "Unknown pattern", "confidence": 0.1}

class MentalSimulationHeuristic(HumanDebuggingHeuristic):
    def analyze_error(self, error: str, context: Dict[str, Any]) -> Dict[str, Any]:
        # Simulate mental walkthrough of code execution
        code_snippet = context.get("code_snippet", "")
        if "if" in code_snippet and "else" not in code_snippet:
            return {
                "heuristic": "MentalSimulation",
                "analysis": "Missing else clause could cause unexpected behavior",
                "suggested_fixes": ["Add else clause", "Use switch statement", "Add default case"],
                "confidence": 0.7
            }
        return {"heuristic": "MentalSimulation", "analysis": "Code flow appears normal", "confidence": 0.5}

class SeniorDeveloperSimulator:
    def __init__(self):
        self.heuristics = [
            PathAnalysisHeuristic(),
            MentalSimulationHeuristic()
        ]
    
    def debug_like_human(self, error: str, context: Dict[str, Any]) -> Dict[str, Any]:
        analyses = []
        for heuristic in self.heuristics:
            analysis = heuristic.analyze_error(error, context)
            if analysis["confidence"] > 0.5:  # Only include confident analyses
                analyses.append(analysis)
        
        # Senior developer would prioritize highest confidence analysis
        if analyses:
            best_analysis = max(analyses, key=lambda x: x["confidence"])
            return {
                "human_debugging_approach": True,
                "primary_analysis": best_analysis,
                "all_analyses": analyses,
                "recommended_strategy": self._map_to_strategy(best_analysis),
                "debugging_steps": self._generate_debug_steps(best_analysis)
            }
        else:
            return {
                "human_debugging_approach": True,
                "analysis": "Unable to apply known heuristics",
                "fallback": "Use general debugging strategy"
            }
    
    def _map_to_strategy(self, analysis: Dict[str, Any]) -> str:
        if "path" in analysis["analysis"].lower():
            return "RollbackStrategy"  # Often safer for path issues
        elif "overflow" in analysis["analysis"].lower():
            return "SecurityAuditStrategy"
        else:
            return "LogAndFixStrategy"
    
    def _generate_debug_steps(self, analysis: Dict[str, Any]) -> List[str]:
        steps = ["1. Reproduce the error in isolation"]
        if "path" in analysis["analysis"].lower():
            steps.extend([
                "2. Check all file/directory paths for existence",
                "3. Verify path constants and environment variables",
                "4. Test with absolute paths as fallback"
            ])
        elif "overflow" in analysis["analysis"].lower():
            steps.extend([
                "2. Add logging for buffer sizes and indices", 
                "3. Implement bounds checking",
                "4. Consider using safer data structures"
            ])
        steps.append("5. Test fix and monitor for regressions")
        return steps

# Usage example
if __name__ == "__main__":
    simulator = SeniorDeveloperSimulator()
    
    # Simulate debugging a path error
    context = {
        "error": "Undefined path constant",
        "code_snippet": "require_once UNDEFINED_PATH . '/file.php';"
    }
    
    human_approach = simulator.debug_like_human(context["error"], context)
    print(json.dumps(human_approach, indent=2))