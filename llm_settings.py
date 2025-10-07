"""
LLM Settings Storage with Encryption
Manages configuration for multiple LLM providers with secure API key storage
"""

import json
import os
import base64
from typing import Dict, Any, Optional
from datetime import datetime
from cryptography.fernet import Fernet
from pathlib import Path


# Settings file location
SETTINGS_DIR = Path(__file__).parent / "artifacts"
SETTINGS_FILE = SETTINGS_DIR / "llm_settings.json"
KEY_FILE = SETTINGS_DIR / ".llm_key"

# Default settings with LM Studio preconfigured
DEFAULT_SETTINGS = {
    "provider": "lmstudio",
    "api_key": "",  # Not needed for LM Studio
    "base_url": "http://127.0.0.1:1234/v1",
    "model_name": "qwen3-32b",
    "temperature": 0.7,
    "max_tokens": 2000,
    "keep_alive": True,
    "keep_alive_interval": 300,  # 5 minutes
    "timeout": 30,
    "enabled": True,
    "last_updated": None
}


def _get_or_create_key() -> bytes:
    """Get or create encryption key"""
    SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    
    if KEY_FILE.exists():
        with open(KEY_FILE, "rb") as f:
            return f.read()
    else:
        # Generate new key
        key = Fernet.generate_key()
        with open(KEY_FILE, "wb") as f:
            f.write(key)
        # Set restrictive permissions (owner read/write only)
        os.chmod(KEY_FILE, 0o600)
        return key


def encrypt_key(api_key: str) -> str:
    """
    Encrypt API key for storage
    
    Args:
        api_key: Plain text API key
        
    Returns:
        Encrypted key as base64 string
    """
    if not api_key:
        return ""
    
    key = _get_or_create_key()
    f = Fernet(key)
    encrypted = f.encrypt(api_key.encode())
    return base64.b64encode(encrypted).decode()


def decrypt_key(encrypted_key: str) -> str:
    """
    Decrypt API key from storage
    
    Args:
        encrypted_key: Encrypted key as base64 string
        
    Returns:
        Plain text API key
    """
    if not encrypted_key:
        return ""
    
    try:
        key = _get_or_create_key()
        f = Fernet(key)
        decoded = base64.b64decode(encrypted_key.encode())
        decrypted = f.decrypt(decoded)
        return decrypted.decode()
    except Exception as e:
        print(f"Error decrypting key: {e}")
        return ""


def load_llm_settings() -> Dict[str, Any]:
    """
    Load LLM settings from disk
    
    Returns:
        Dict with settings (API key will be encrypted)
    """
    SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    
    if not SETTINGS_FILE.exists():
        # Create default settings
        settings = DEFAULT_SETTINGS.copy()
        settings["last_updated"] = datetime.now().isoformat()
        save_llm_settings(settings)
        return settings
    
    try:
        with open(SETTINGS_FILE, "r") as f:
            settings = json.load(f)
        
        # Merge with defaults to handle new fields
        merged = DEFAULT_SETTINGS.copy()
        merged.update(settings)
        return merged
    except Exception as e:
        print(f"Error loading settings: {e}")
        return DEFAULT_SETTINGS.copy()


def save_llm_settings(settings: Dict[str, Any]) -> bool:
    """
    Save LLM settings to disk
    
    Args:
        settings: Dict with settings (API key should be plain text, will be encrypted)
        
    Returns:
        True if successful, False otherwise
    """
    try:
        SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
        
        # Make a copy to avoid modifying input
        settings_copy = settings.copy()
        
        # Encrypt API key if present
        if settings_copy.get("api_key"):
            settings_copy["api_key"] = encrypt_key(settings_copy["api_key"])
        
        # Add timestamp
        settings_copy["last_updated"] = datetime.now().isoformat()
        
        # Write to file
        with open(SETTINGS_FILE, "w") as f:
            json.dump(settings_copy, f, indent=2)
        
        # Set restrictive permissions
        os.chmod(SETTINGS_FILE, 0o600)
        
        return True
    except Exception as e:
        print(f"Error saving settings: {e}")
        return False


def get_llm_settings_for_client() -> Dict[str, Any]:
    """
    Get LLM settings with decrypted API key for use with LLMClient
    
    Returns:
        Dict with settings ready for LLMClient initialization
    """
    settings = load_llm_settings()
    
    # Decrypt API key
    if settings.get("api_key"):
        settings["api_key"] = decrypt_key(settings["api_key"])
    
    return settings


def get_llm_settings_for_api() -> Dict[str, Any]:
    """
    Get LLM settings for API response (API key masked)
    
    Returns:
        Dict with settings with API key masked
    """
    settings = load_llm_settings()
    
    # Mask API key for API response
    if settings.get("api_key"):
        # Show first 4 and last 4 characters
        key = settings["api_key"]
        if len(key) > 8:
            settings["api_key_masked"] = f"{key[:4]}...{key[-4:]}"
        else:
            settings["api_key_masked"] = "****"
        del settings["api_key"]
    
    return settings


def validate_settings(settings: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    """
    Validate LLM settings with automatic URL normalization
    
    Args:
        settings: Dict with settings to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    required_fields = ["provider", "base_url", "model_name"]
    
    for field in required_fields:
        if field not in settings or not settings[field]:
            return False, f"Missing required field: {field}"
    
    # Validate provider
    valid_providers = ["openai", "anthropic", "lmstudio", "ollama", "llama", "azure", "gemini", "custom"]
    if settings["provider"] not in valid_providers:
        return False, f"Invalid provider: {settings['provider']}. Must be one of {valid_providers}"
    
    # Validate and normalize base_url
    base_url = settings["base_url"].strip()
    if not base_url.startswith(("http://", "https://")):
        return False, "base_url must start with http:// or https://"
    
    # Remove trailing slashes for consistency
    base_url = base_url.rstrip('/')
    
    # Auto-append /v1 for certain providers if missing (except Ollama which uses different endpoints)
    providers_needing_v1 = ["openai", "lmstudio", "llama", "azure", "gemini", "custom"]
    if settings["provider"] in providers_needing_v1:
        # Check if URL already has /v1, /api, or version suffix
        if not any(base_url.endswith(suffix) for suffix in ['/v1', '/api', '/v2', '/v3']):
            # For local providers, accept URLs without /v1 (they might be using base URL)
            local_providers = ["lmstudio", "llama"]
            if settings["provider"] in local_providers:
                # Accept as-is for local providers - let them specify exact URL
                pass
            else:
                # For cloud providers, suggest adding /v1
                pass
    
    # Update the base_url in settings with normalized version
    settings["base_url"] = base_url
    
    # API key is optional for local providers
    local_providers = ["lmstudio", "ollama", "llama"]
    if settings["provider"] not in local_providers:
        # For cloud providers, API key is required
        if "api_key" not in settings or not settings.get("api_key", "").strip():
            return False, f"API key is required for provider: {settings['provider']}"
    
    # Validate numeric fields
    if "temperature" in settings:
        try:
            temp = float(settings["temperature"])
            if not (0 <= temp <= 2):
                return False, "Temperature must be between 0 and 2"
        except (ValueError, TypeError):
            return False, "Temperature must be a number"
    
    if "max_tokens" in settings:
        try:
            tokens = int(settings["max_tokens"])
            if tokens <= 0:
                return False, "max_tokens must be positive"
        except (ValueError, TypeError):
            return False, "max_tokens must be an integer"
    
    if "timeout" in settings:
        try:
            timeout = int(settings["timeout"])
            if timeout <= 0:
                return False, "timeout must be positive"
        except (ValueError, TypeError):
            return False, "timeout must be an integer"
    
    if "keep_alive_interval" in settings:
        try:
            interval = int(settings["keep_alive_interval"])
            if interval < 60:
                return False, "keep_alive_interval must be at least 60 seconds"
        except (ValueError, TypeError):
            return False, "keep_alive_interval must be an integer"
    
    return True, None


# LM Studio model presets with tiers
LM_STUDIO_MODELS = [
    {"name": "Qwen 3 32B (Premium)", "value": "qwen3-32b", "tier": "premium", "size": "17.33GB"},
    {"name": "Qwen 2 33B (Premium)", "value": "qwen2-33b", "tier": "premium", "size": "17.25GB"},
    {"name": "GPT-OSS 20B (Premium)", "value": "gpt-oss-20b", "tier": "premium", "size": "12.11GB"},
    {"name": "Llama 13B (Standard)", "value": "llama-13b", "tier": "standard", "size": "7.41GB"},
    {"name": "Llama 12B (Standard)", "value": "llama-12b", "tier": "standard", "size": "7.48GB"},
    {"name": "Gemma2 9.2B (Standard)", "value": "gemma2-9.2b", "tier": "standard", "size": "5.76GB"},
    {"name": "Llama 8B (Fast)", "value": "llama-8b", "tier": "fast", "size": "4.92GB"},
    {"name": "Qwen 2 7B (Fast)", "value": "qwen2-7b", "tier": "fast", "size": "4.68GB"},
    {"name": "Llama 7B (Fast)", "value": "llama-7b", "tier": "fast", "size": "4.08GB"}
]


if __name__ == "__main__":
    # Test encryption/decryption
    print("Testing encryption...")
    test_key = "sk-test-1234567890abcdef"
    encrypted = encrypt_key(test_key)
    print(f"Encrypted: {encrypted}")
    decrypted = decrypt_key(encrypted)
    print(f"Decrypted: {decrypted}")
    print(f"Match: {test_key == decrypted}")
    
    print("\nTesting settings...")
    settings = load_llm_settings()
    print(f"Loaded settings: {json.dumps(settings, indent=2)}")
    
    print("\nTesting validation...")
    valid, error = validate_settings(settings)
    print(f"Valid: {valid}, Error: {error}")
