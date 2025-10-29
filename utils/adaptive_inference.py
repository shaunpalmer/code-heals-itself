"""
Adaptive Inference Fallback Utility

This module provides adaptive fallback logic for LM Studio inference.
If the primary container endpoint fails, it automatically falls back to
the local endpoint. All decisions are logged for observability.
"""

import requests
import os
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# Configuration from environment
PRIMARY_URL = os.getenv("PRIMARY_URL", "http://lmstudio:8080/v1")
FALLBACK_URL = os.getenv("FALLBACK_URL", "http://host.docker.internal:1234/v1")

# Events log
DATA_DIR = Path("/data")
DATA_DIR.mkdir(exist_ok=True)
EVENTS_LOG = DATA_DIR / "inference_events.jsonl"


class AdaptiveInference:
    """Manages adaptive fallback between primary and fallback inference endpoints"""
    
    def __init__(self, primary_url=PRIMARY_URL, fallback_url=FALLBACK_URL, timeout=2):
        self.primary_url = primary_url
        self.fallback_url = fallback_url
        self.timeout = timeout
        self.active_url = None
        self.last_check = None
        self._resolve_active_endpoint()
    
    def _health_check(self, url):
        """Check if an endpoint is healthy"""
        try:
            response = requests.get(f"{url}/models", timeout=self.timeout)
            return response.status_code == 200
        except Exception as e:
            logger.debug(f"Health check failed for {url}: {e}")
            return False
    
    def _log_event(self, event_type, message, details=None):
        """Log an inference decision event"""
        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "message": message,
            "details": details or {}
        }
        
        try:
            with open(EVENTS_LOG, "a") as f:
                import json
                f.write(json.dumps(event) + "\n")
            logger.info(f"[{event_type}] {message}")
        except Exception as e:
            logger.error(f"Failed to log event: {e}")
    
    def _resolve_active_endpoint(self):
        """Determine which endpoint is active"""
        primary_ok = self._health_check(self.primary_url)
        fallback_ok = self._health_check(self.fallback_url)
        
        if primary_ok:
            self.active_url = self.primary_url
            source = "primary"
        elif fallback_ok:
            self.active_url = self.fallback_url
            source = "fallback"
        else:
            self.active_url = self.fallback_url  # Default to fallback, will fail gracefully
            source = "none"
        
        self.last_check = {
            "primary_healthy": primary_ok,
            "fallback_healthy": fallback_ok,
            "active_source": source,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return self.active_url
    
    def get_active_url(self, refresh=False):
        """
        Get the current active inference URL.
        
        Args:
            refresh: If True, re-check endpoint health
        
        Returns:
            Active URL string or fallback URL if both endpoints unavailable
        """
        if refresh or self.active_url is None:
            self._resolve_active_endpoint()
        
        return self.active_url
    
    def get_status(self):
        """Get current inference status"""
        return {
            "active_url": self.active_url,
            "primary_url": self.primary_url,
            "fallback_url": self.fallback_url,
            "last_check": self.last_check
        }
    
    def query_model(self, prompt, model="default", **kwargs):
        """
        Query the model with adaptive fallback.
        
        Tries primary endpoint first. If it fails, automatically falls back
        and logs the decision.
        
        Args:
            prompt: The input prompt
            model: Model name (default: "default")
            **kwargs: Additional parameters to pass to the API
        
        Returns:
            Response from the model or error dict
        """
        url = self.get_active_url()
        
        payload = {
            "model": model,
            "prompt": prompt,
            **kwargs
        }
        
        try:
            response = requests.post(
                f"{url}/completions",
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                self._log_event(
                    "INFERENCE_SUCCESS",
                    f"Model query succeeded using {url}",
                    {"model": model, "url": url}
                )
                return response.json()
            else:
                # Got a response but non-200 status
                logger.warning(f"Non-200 response from {url}: {response.status_code}")
                
                # Try fallback if this was primary
                if url == self.primary_url and self.fallback_url != url:
                    self._log_event(
                        "FALLBACK_TRIGGERED",
                        f"Primary returned {response.status_code}, switching to fallback",
                        {"primary_status": response.status_code, "url": url}
                    )
                    self.active_url = self.fallback_url
                    return self.query_model(prompt, model, **kwargs)  # Recursive retry
                
                return {
                    "error": f"HTTP {response.status_code}",
                    "using": url,
                    "message": response.text[:200]
                }
        
        except requests.exceptions.Timeout:
            logger.warning(f"Timeout querying {url}")
            
            # Try fallback if this was primary
            if url == self.primary_url and self.fallback_url != url:
                self._log_event(
                    "FALLBACK_TRIGGERED",
                    "Primary endpoint timed out, switching to fallback",
                    {"reason": "timeout", "url": url}
                )
                self.active_url = self.fallback_url
                return self.query_model(prompt, model, **kwargs)  # Recursive retry
            
            return {
                "error": "timeout",
                "using": url,
                "message": f"Request timed out after {self.timeout}s"
            }
        
        except Exception as e:
            logger.error(f"Query failed: {e}")
            
            # Try fallback if this was primary
            if url == self.primary_url and self.fallback_url != url:
                self._log_event(
                    "FALLBACK_TRIGGERED",
                    f"Primary endpoint failed with exception, switching to fallback",
                    {"reason": str(e), "url": url}
                )
                self.active_url = self.fallback_url
                return self.query_model(prompt, model, **kwargs)  # Recursive retry
            
            return {
                "error": "exception",
                "using": url,
                "message": str(e)
            }


# Singleton instance
_inference_instance = None


def get_inference_client():
    """Get or create singleton adaptive inference client"""
    global _inference_instance
    if _inference_instance is None:
        _inference_instance = AdaptiveInference()
    return _inference_instance


def query_model(prompt, model="default", **kwargs):
    """Convenience function to query model with adaptive fallback"""
    client = get_inference_client()
    return client.query_model(prompt, model, **kwargs)


def get_inference_status():
    """Get current inference status"""
    client = get_inference_client()
    return client.get_status()
