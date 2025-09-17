"""
ErrorSignature - Language-agnostic error fingerprinting for Python

Normalizes Python exceptions into consistent signatures
to prevent duplicate retry attempts on identical failures.
"""

import hashlib
import traceback
from typing import Dict, List, Set, Any, Optional
from dataclasses import dataclass


@dataclass
class ErrorSignatureData:
    """Detailed error signature with metadata"""
    signature: str
    type: str
    message: str
    hash: str


class ErrorSignature:
    """
    Normalizes Python exceptions into consistent signatures
    for cross-language error deduplication.
    """
    
    @staticmethod
    def normalize(err: Exception) -> str:
        """
        Normalize a Python Exception into a consistent signature
        
        Args:
            err: The Exception object to normalize
            
        Returns:
            Normalized error signature string
        """
        error_type = type(err).__name__
        message = str(err).splitlines()[0].strip() if str(err) else ""
        
        # Remove file paths and line numbers to focus on error content
        import re
        clean_message = re.sub(r'\s+at\s+.*:\d+', '', message)  # Remove "at file:line"
        clean_message = re.sub(r'\s+in\s+/.+$', '', clean_message)  # Remove file paths
        clean_message = re.sub(r'File\s+"[^"]+",\s+line\s+\d+', '', clean_message)  # Remove Python traceback refs
        clean_message = clean_message.strip()
        
        return f"{error_type}:{clean_message}"
    
    @staticmethod
    def create(err: Exception) -> ErrorSignatureData:
        """
        Create a detailed error signature object
        
        Args:
            err: The Exception object to analyze
            
        Returns:
            Detailed error signature with metadata
        """
        error_type = type(err).__name__
        message = str(err).splitlines()[0].strip() if str(err) else ""
        signature = ErrorSignature.normalize(err)
        
        # Simple hash for deduplication
        hash_value = ErrorSignature._simple_hash(signature)
        
        return ErrorSignatureData(
            signature=signature,
            type=error_type,
            message=message,
            hash=hash_value
        )
    
    @staticmethod
    def are_same(err1: Exception, err2: Exception) -> bool:
        """
        Check if two exceptions have the same signature
        
        Args:
            err1: First exception
            err2: Second exception
            
        Returns:
            True if exceptions have identical signatures
        """
        return ErrorSignature.normalize(err1) == ErrorSignature.normalize(err2)
    
    @staticmethod
    def _simple_hash(text: str) -> str:
        """
        Simple string hash function for error deduplication
        
        Args:
            text: String to hash
            
        Returns:
            Simple hash value as hex string
        """
        return hashlib.md5(text.encode('utf-8')).hexdigest()[:8]


class ErrorTracker:
    """
    Tracks seen error signatures to prevent duplicate retries
    """
    
    def __init__(self):
        self.seen_errors: Set[str] = set()
        self.error_history: List[ErrorSignatureData] = []
    
    def has_seen(self, err: Exception) -> bool:
        """
        Check if an exception has been seen before
        
        Args:
            err: Exception to check
            
        Returns:
            True if this error signature was already seen
        """
        signature = ErrorSignature.normalize(err)
        return signature in self.seen_errors
    
    def record(self, err: Exception) -> ErrorSignatureData:
        """
        Record a new error occurrence
        
        Args:
            err: Exception to record
            
        Returns:
            The error signature that was recorded
        """
        error_sig = ErrorSignature.create(err)
        self.seen_errors.add(error_sig.signature)
        self.error_history.append(error_sig)
        return error_sig
    
    def get_unique_errors(self) -> List[ErrorSignatureData]:
        """
        Get all unique error signatures seen so far
        
        Returns:
            List of unique error signatures
        """
        unique = {}
        for err in self.error_history:
            if err.signature not in unique:
                unique[err.signature] = err
        return list(unique.values())
    
    def clear(self) -> None:
        """Clear all tracked errors"""
        self.seen_errors.clear()
        self.error_history.clear()
    
    def get_error_counts(self) -> Dict[str, int]:
        """
        Get count of how many times each error was seen
        
        Returns:
            Dictionary mapping error signature to count
        """
        counts = {}
        for err in self.error_history:
            counts[err.signature] = counts.get(err.signature, 0) + 1
        return counts
    
    def get_most_frequent_errors(self, limit: int = 5) -> List[tuple]:
        """
        Get the most frequently occurring errors
        
        Args:
            limit: Maximum number of errors to return
            
        Returns:
            List of (error_signature, count) tuples sorted by frequency
        """
        counts = self.get_error_counts()
        return sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit]