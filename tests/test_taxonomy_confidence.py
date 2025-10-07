"""
Test taxonomy-aware confidence scoring.

Validates that:
1. Taxonomy difficulty is used for complexity penalty when available
2. Fallback to historical complexity_score works when taxonomy is absent
3. Confidence calculations are consistent across Python/TypeScript/JavaScript/PHP
4. Higher difficulty scores reduce confidence appropriately
"""

import pytest
import math
from utils.python.confidence_scoring import (
    UnifiedConfidenceScorer,
    ErrorType,
    ConfidenceScore
)


class TestTaxonomyAwareConfidence:
    """Test suite for taxonomy-aware confidence scoring"""

    @pytest.fixture
    def scorer(self):
        """Create a fresh confidence scorer for each test"""
        return UnifiedConfidenceScorer(temperature=1.0, calibration_samples=1000)

    @pytest.fixture
    def sample_logits(self):
        """Sample logits for testing"""
        return [2.5, 1.8, 0.3, 0.1]

    def test_confidence_with_taxonomy_difficulty_easy(self, scorer, sample_logits):
        """Test that easy errors (low difficulty) have higher confidence"""
        # Easy error: difficulty = 0.1
        conf_easy = scorer.calculate_confidence(
            logits=sample_logits,
            error_type=ErrorType.SYNTAX,
            historical_data=None,
            taxonomy_difficulty=0.1
        )
        
        # Hard error: difficulty = 0.9
        conf_hard = scorer.calculate_confidence(
            logits=sample_logits,
            error_type=ErrorType.SYNTAX,
            historical_data=None,
            taxonomy_difficulty=0.9
        )
        
        # Easy errors should have higher confidence than hard errors
        assert conf_easy.overall_confidence > conf_hard.overall_confidence
        assert conf_easy.components.code_complexity_penalty > conf_hard.components.code_complexity_penalty
        
        # Easy error should have minimal penalty (close to 1.0)
        assert conf_easy.components.code_complexity_penalty > 0.9
        
        # Hard error should have significant penalty
        assert conf_hard.components.code_complexity_penalty < 0.7

    def test_confidence_with_taxonomy_difficulty_moderate(self, scorer, sample_logits):
        """Test moderate difficulty errors"""
        conf = scorer.calculate_confidence(
            logits=sample_logits,
            error_type=ErrorType.LOGIC,
            historical_data=None,
            taxonomy_difficulty=0.5
        )
        
        # Moderate difficulty should have moderate penalty
        # taxonomy_difficulty=0.5 -> penalty = max(0.1, 1.0 - 0.5 * 0.5) = 0.75
        assert 0.6 < conf.components.code_complexity_penalty < 0.9
        
        # Overall confidence will be lower due to default historical factors (0.5 each)
        # Base confidence * 0.5 (historical) * 0.5 (pattern) * 0.75 (complexity) * 0.75 (test coverage)
        # Just verify it's within reasonable bounds
        assert 0.0 < conf.overall_confidence < 0.5

    def test_confidence_fallback_to_historical(self, scorer, sample_logits):
        """Test that confidence falls back to historical complexity when taxonomy is absent"""
        historical_data = {
            "success_rate": 0.8,
            "pattern_similarity": 0.7,
            "complexity_score": 2.0,  # This should be used for penalty
            "test_coverage": 0.6
        }
        
        conf = scorer.calculate_confidence(
            logits=sample_logits,
            error_type=ErrorType.RUNTIME,
            historical_data=historical_data,
            taxonomy_difficulty=None  # No taxonomy data
        )
        
        # Should use historical complexity_score for penalty
        # complexity_score=2.0 -> penalty = max(0.1, 1.0 - (2.0 - 1.0) * 0.1) = 0.9
        expected_penalty = max(0.1, 1.0 - (2.0 - 1.0) * 0.1)
        assert abs(conf.components.code_complexity_penalty - expected_penalty) < 0.01

    def test_confidence_taxonomy_overrides_historical(self, scorer, sample_logits):
        """Test that taxonomy difficulty takes precedence over historical complexity"""
        historical_data = {
            "success_rate": 0.8,
            "pattern_similarity": 0.7,
            "complexity_score": 5.0,  # High historical complexity
            "test_coverage": 0.6
        }
        
        # Provide low taxonomy difficulty - should override high historical complexity
        conf = scorer.calculate_confidence(
            logits=sample_logits,
            error_type=ErrorType.SYNTAX,
            historical_data=historical_data,
            taxonomy_difficulty=0.2  # Easy error
        )
        
        # Taxonomy difficulty should be used, not historical complexity
        # taxonomy_difficulty=0.2 -> penalty = max(0.1, 1.0 - 0.2 * 0.5) = 0.9
        expected_penalty = max(0.1, 1.0 - 0.2 * 0.5)
        assert abs(conf.components.code_complexity_penalty - expected_penalty) < 0.01

    def test_confidence_without_any_complexity_data(self, scorer, sample_logits):
        """Test confidence scoring when no complexity data is available"""
        conf = scorer.calculate_confidence(
            logits=sample_logits,
            error_type=ErrorType.PERFORMANCE,
            historical_data=None,
            taxonomy_difficulty=None
        )
        
        # Should use default complexity penalty of 1.0 (no penalty)
        assert conf.components.code_complexity_penalty == 1.0

    def test_confidence_extreme_difficulties(self, scorer, sample_logits):
        """Test extreme difficulty values (0.0 and 1.0)"""
        # Minimum difficulty (easiest possible)
        conf_min = scorer.calculate_confidence(
            logits=sample_logits,
            error_type=ErrorType.SYNTAX,
            historical_data=None,
            taxonomy_difficulty=0.0
        )
        
        # Maximum difficulty (hardest possible)
        conf_max = scorer.calculate_confidence(
            logits=sample_logits,
            error_type=ErrorType.SYNTAX,
            historical_data=None,
            taxonomy_difficulty=1.0
        )
        
        # Min difficulty: penalty = max(0.1, 1.0 - 0.0 * 0.5) = 1.0
        assert conf_min.components.code_complexity_penalty == 1.0
        
        # Max difficulty: penalty = max(0.1, 1.0 - 1.0 * 0.5) = 0.5
        assert conf_max.components.code_complexity_penalty == 0.5
        
        # Min difficulty should have higher overall confidence
        assert conf_min.overall_confidence > conf_max.overall_confidence

    def test_confidence_error_type_consistency(self, scorer, sample_logits):
        """Test that taxonomy difficulty works consistently across error types"""
        difficulty = 0.6
        
        conf_syntax = scorer.calculate_confidence(
            logits=sample_logits,
            error_type=ErrorType.SYNTAX,
            historical_data=None,
            taxonomy_difficulty=difficulty
        )
        
        conf_logic = scorer.calculate_confidence(
            logits=sample_logits,
            error_type=ErrorType.LOGIC,
            historical_data=None,
            taxonomy_difficulty=difficulty
        )
        
        conf_runtime = scorer.calculate_confidence(
            logits=sample_logits,
            error_type=ErrorType.RUNTIME,
            historical_data=None,
            taxonomy_difficulty=difficulty
        )
        
        # All should have the same complexity penalty from taxonomy
        assert conf_syntax.components.code_complexity_penalty == conf_logic.components.code_complexity_penalty
        assert conf_logic.components.code_complexity_penalty == conf_runtime.components.code_complexity_penalty

    def test_confidence_penalty_bounds(self, scorer, sample_logits):
        """Test that complexity penalty stays within valid bounds"""
        # Test various difficulty values
        for difficulty in [0.0, 0.1, 0.3, 0.5, 0.7, 0.9, 1.0]:
            conf = scorer.calculate_confidence(
                logits=sample_logits,
                error_type=ErrorType.SYNTAX,
                historical_data=None,
                taxonomy_difficulty=difficulty
            )
            
            # Penalty should always be between 0.1 and 1.0
            assert 0.1 <= conf.components.code_complexity_penalty <= 1.0
            
            # Overall confidence should be between 0.0 and 1.0
            assert 0.0 <= conf.overall_confidence <= 1.0

    def test_confidence_with_full_historical_and_taxonomy(self, scorer, sample_logits):
        """Test confidence with both taxonomy difficulty and full historical data"""
        historical_data = {
            "success_rate": 0.85,
            "pattern_similarity": 0.75,
            "complexity_score": 3.0,  # Should be ignored
            "test_coverage": 0.8
        }
        
        conf = scorer.calculate_confidence(
            logits=sample_logits,
            error_type=ErrorType.LOGIC,
            historical_data=historical_data,
            taxonomy_difficulty=0.4  # Should override complexity_score
        )
        
        # Taxonomy difficulty should be used for penalty
        expected_penalty = max(0.1, 1.0 - 0.4 * 0.5)
        assert abs(conf.components.code_complexity_penalty - expected_penalty) < 0.01
        
        # Historical factors should still be applied
        assert conf.components.historical_success_rate == 0.85
        assert conf.components.pattern_similarity == 0.75
        assert conf.components.test_coverage == 0.8


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
