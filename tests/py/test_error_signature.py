"""
Test ErrorSignature consistency across languages.

These tests verify that the Python ErrorSignature implementation
produces consistent results for common error patterns.
"""

import sys
import os

# Add utils to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '../../utils/python'))

from error_signature import ErrorSignature, ErrorTracker, ErrorSignatureData


def test_normalize_basic_exceptions():
    """Test that basic Python exceptions are normalized consistently"""
    
    # Test common Python exceptions
    value_error = ValueError("invalid literal for int() with base 10: 'abc'")
    type_error = TypeError("'str' object cannot be interpreted as an integer")
    name_error = NameError("name 'x' is not defined")
    
    assert ErrorSignature.normalize(value_error) == "ValueError:invalid literal for int() with base 10: 'abc'"
    assert ErrorSignature.normalize(type_error) == "TypeError:'str' object cannot be interpreted as an integer"
    assert ErrorSignature.normalize(name_error) == "NameError:name 'x' is not defined"


def test_normalize_removes_file_paths():
    """Test that file paths and line numbers are removed from error messages"""
    
    # Simulate errors with file path references
    error_with_path = ValueError("Something went wrong in /path/to/file.py")
    normalized = ErrorSignature.normalize(error_with_path)
    assert normalized == "ValueError:Something went wrong"


def test_create_detailed_signature():
    """Test creating detailed error signature objects"""
    
    error = ValueError("test error message")
    signature = ErrorSignature.create(error)
    
    assert signature.type == "ValueError"
    assert signature.message == "test error message"
    assert signature.signature == "ValueError:test error message"
    assert len(signature.hash) == 8  # MD5 first 8 chars


def test_are_same():
    """Test error comparison functionality"""
    
    error1 = ValueError("same message")
    error2 = ValueError("same message")
    error3 = TypeError("same message")
    
    assert ErrorSignature.are_same(error1, error2) == True
    assert ErrorSignature.are_same(error1, error3) == False


def test_error_tracker():
    """Test ErrorTracker functionality"""
    
    tracker = ErrorTracker()
    error1 = ValueError("duplicate error")
    error2 = ValueError("duplicate error")
    error3 = TypeError("different error")
    
    # Initially no errors seen
    assert tracker.has_seen(error1) == False
    
    # Record first error
    sig1 = tracker.record(error1)
    assert tracker.has_seen(error1) == True
    assert sig1.type == "ValueError"
    
    # Record duplicate - should be recognized
    assert tracker.has_seen(error2) == True
    tracker.record(error2)
    
    # Record different error
    tracker.record(error3)
    
    # Check counts
    counts = tracker.get_error_counts()
    assert counts["ValueError:duplicate error"] == 2
    assert counts["TypeError:different error"] == 1
    
    # Check unique errors
    unique = tracker.get_unique_errors()
    assert len(unique) == 2
    
    # Check most frequent
    frequent = tracker.get_most_frequent_errors(1)
    assert frequent[0][1] == 2  # Count of most frequent error


def test_cross_language_consistency():
    """Test patterns that should be consistent across TypeScript/Python/PHP"""
    
    # These error patterns should normalize similarly across languages
    ref_error = NameError("x is not defined")
    type_error = TypeError("Cannot read property of undefined")
    
    # Python equivalents of common JS errors
    assert ErrorSignature.normalize(ref_error) == "NameError:x is not defined"
    assert ErrorSignature.normalize(type_error) == "TypeError:Cannot read property of undefined"


if __name__ == "__main__":
    test_normalize_basic_exceptions()
    test_normalize_removes_file_paths()
    test_create_detailed_signature()
    test_are_same()
    test_error_tracker()
    test_cross_language_consistency()
    print("All Python ErrorSignature tests passed!")