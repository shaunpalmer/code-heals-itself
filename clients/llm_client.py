"""
Unified LLM Client for multiple providers
Supports: OpenAI, Anthropic, LM Studio, Ollama, Meta Llama, Azure OpenAI, Google Gemini, Custom
"""

import asyncio
import json
import time
from typing import Dict, List, Optional, Any
import aiohttp
from datetime import datetime
import traceback


class LLMClient:
    """Unified interface for multiple LLM providers"""
    
    SUPPORTED_PROVIDERS = [
        "openai",
        "anthropic", 
        "lmstudio",
        "ollama",
        "llama",
        "azure",
        "gemini",
        "custom"
    ]
    
    def __init__(
        self,
        provider: str,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model_name: str = "gpt-3.5-turbo",
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: int = 30
    ):
        """
        Initialize LLM client
        
        Args:
            provider: Provider name (openai, anthropic, lmstudio, ollama, etc.)
            api_key: API key for authentication (not needed for local providers)
            base_url: Custom base URL (for LM Studio, Ollama, etc.)
            model_name: Model to use
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
            timeout: Request timeout in seconds
        """
        self.provider = provider.lower()
        if self.provider not in self.SUPPORTED_PROVIDERS:
            raise ValueError(f"Unsupported provider: {provider}. Must be one of {self.SUPPORTED_PROVIDERS}")
        
        self.api_key = api_key
        self.base_url = base_url or self._get_default_base_url()
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout
        
        self._session: Optional[aiohttp.ClientSession] = None
    
    def _get_default_base_url(self) -> str:
        """Get default base URL for provider"""
        defaults = {
            "openai": "https://api.openai.com/v1",
            "anthropic": "https://api.anthropic.com/v1",
            "lmstudio": "http://127.0.0.1:1234/v1",
            "ollama": "http://127.0.0.1:11434",
            "llama": "http://127.0.0.1:8080",
            "azure": None,  # Must be provided
            "gemini": "https://generativelanguage.googleapis.com/v1",
            "custom": None  # Must be provided
        }
        return defaults.get(self.provider, "http://127.0.0.1:8080")
    
    async def _ensure_session(self):
        """Ensure aiohttp session exists"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
    
    async def close(self):
        """Close the aiohttp session"""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send chat completion request
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Dict with response data including 'content', 'model', 'usage', etc.
        """
        await self._ensure_session()
        
        try:
            if self.provider in ["openai", "lmstudio", "azure"]:
                return await self._chat_openai_compatible(messages, **kwargs)
            elif self.provider == "anthropic":
                return await self._chat_anthropic(messages, **kwargs)
            elif self.provider == "ollama":
                return await self._chat_ollama(messages, **kwargs)
            elif self.provider in ["llama", "custom"]:
                return await self._chat_openai_compatible(messages, **kwargs)
            elif self.provider == "gemini":
                return await self._chat_gemini(messages, **kwargs)
            else:
                raise ValueError(f"Chat not implemented for provider: {self.provider}")
        except asyncio.TimeoutError:
            return {
                "error": f"Request timed out after {self.timeout} seconds",
                "error_type": "TimeoutError",
                "provider": self.provider,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            error_message = str(e) or repr(e)
            return {
                "error": error_message,
                "error_type": e.__class__.__name__,
                "provider": self.provider,
                "timestamp": datetime.now().isoformat(),
                "details": getattr(e, "args", None),
                "traceback": traceback.format_exc()
            }
    
    async def _chat_openai_compatible(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> Dict[str, Any]:
        """OpenAI-compatible chat completion (OpenAI, LM Studio, Azure, custom)"""
        url = f"{self.base_url}/chat/completions"
        
        headers = {
            "Content-Type": "application/json"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens)
        }
        
        async with self._session.post(
            url,
            headers=headers,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        ) as response:
            response.raise_for_status()
            data = await response.json()
            
            return {
                "content": data["choices"][0]["message"]["content"],
                "model": data.get("model", self.model_name),
                "usage": data.get("usage", {}),
                "provider": self.provider,
                "timestamp": datetime.now().isoformat()
            }
    
    async def _chat_anthropic(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> Dict[str, Any]:
        """Anthropic Claude chat completion"""
        url = f"{self.base_url}/messages"
        
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01"
        }
        
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens)
        }
        
        async with self._session.post(
            url,
            headers=headers,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        ) as response:
            response.raise_for_status()
            data = await response.json()
            
            return {
                "content": data["content"][0]["text"],
                "model": data.get("model", self.model_name),
                "usage": data.get("usage", {}),
                "provider": self.provider,
                "timestamp": datetime.now().isoformat()
            }
    
    async def _chat_ollama(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> Dict[str, Any]:
        """Ollama chat completion"""
        url = f"{self.base_url}/api/chat"
        
        payload = {
            "model": self.model_name,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": kwargs.get("temperature", self.temperature),
                "num_predict": kwargs.get("max_tokens", self.max_tokens)
            }
        }
        
        async with self._session.post(
            url,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        ) as response:
            response.raise_for_status()
            data = await response.json()
            
            return {
                "content": data["message"]["content"],
                "model": data.get("model", self.model_name),
                "usage": {
                    "prompt_tokens": data.get("prompt_eval_count", 0),
                    "completion_tokens": data.get("eval_count", 0)
                },
                "provider": self.provider,
                "timestamp": datetime.now().isoformat()
            }
    
    async def _chat_gemini(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> Dict[str, Any]:
        """Google Gemini chat completion"""
        url = f"{self.base_url}/models/{self.model_name}:generateContent?key={self.api_key}"
        
        # Convert OpenAI format to Gemini format
        contents = []
        for msg in messages:
            role = "user" if msg["role"] in ["user", "system"] else "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg["content"]}]
            })
        
        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": kwargs.get("temperature", self.temperature),
                "maxOutputTokens": kwargs.get("max_tokens", self.max_tokens)
            }
        }
        
        async with self._session.post(
            url,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        ) as response:
            response.raise_for_status()
            data = await response.json()
            
            return {
                "content": data["candidates"][0]["content"]["parts"][0]["text"],
                "model": self.model_name,
                "usage": data.get("usageMetadata", {}),
                "provider": self.provider,
                "timestamp": datetime.now().isoformat()
            }
    
    async def models(self) -> List[str]:
        """
        Get list of available models from provider
        
        Returns:
            List of model names/IDs
        """
        await self._ensure_session()
        
        try:
            if self.provider in ["openai", "lmstudio", "azure"]:
                return await self._models_openai_compatible()
            elif self.provider == "ollama":
                return await self._models_ollama()
            elif self.provider == "anthropic":
                # Anthropic doesn't have a models endpoint - return known models
                return [
                    "claude-3-opus-20240229",
                    "claude-3-sonnet-20240229",
                    "claude-3-haiku-20240307",
                    "claude-2.1",
                    "claude-2.0"
                ]
            else:
                return []
        except Exception as e:
            print(f"Error fetching models: {e}")
            return []
    
    async def _models_openai_compatible(self) -> List[str]:
        """Get models from OpenAI-compatible endpoint"""
        url = f"{self.base_url}/models"
        
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        async with self._session.get(
            url,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        ) as response:
            response.raise_for_status()
            data = await response.json()
            
            return [model["id"] for model in data.get("data", [])]
    
    async def _models_ollama(self) -> List[str]:
        """Get models from Ollama"""
        url = f"{self.base_url}/api/tags"
        
        async with self._session.get(
            url,
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        ) as response:
            response.raise_for_status()
            data = await response.json()
            
            return [model["name"] for model in data.get("models", [])]
    
    async def ping(self) -> Dict[str, Any]:
        """
        Ping the provider to check if it's alive
        
        Returns:
            Dict with 'ok' boolean and optional 'error' message
        """
        await self._ensure_session()
        
        try:
            # Try to get models as a health check
            if self.provider in ["openai", "lmstudio", "azure", "custom"]:
                url = f"{self.base_url}/models"
            elif self.provider == "ollama":
                url = f"{self.base_url}/api/tags"
            elif self.provider == "anthropic":
                # Anthropic doesn't have a health endpoint - just return ok
                return {"ok": True, "provider": self.provider, "timestamp": datetime.now().isoformat()}
            else:
                url = self.base_url
            
            headers = {}
            if self.api_key and self.provider != "ollama":
                if self.provider == "anthropic":
                    headers["x-api-key"] = self.api_key
                else:
                    headers["Authorization"] = f"Bearer {self.api_key}"
            
            start_time = time.time()
            async with self._session.get(
                url,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=5)  # Short timeout for ping
            ) as response:
                response.raise_for_status()
                latency_ms = (time.time() - start_time) * 1000
                
                return {
                    "ok": True,
                    "provider": self.provider,
                    "latency_ms": round(latency_ms, 2),
                    "timestamp": datetime.now().isoformat()
                }
        except Exception as e:
            return {
                "ok": False,
                "provider": self.provider,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }


# Convenience function for quick testing
async def test_client():
    """Test the LLM client with LM Studio"""
    client = LLMClient(
        provider="lmstudio",
        base_url="http://127.0.0.1:1234/v1",
        model_name="qwen3-32b"
    )
    
    try:
        # Test ping
        print("Testing ping...")
        ping_result = await client.ping()
        print(f"Ping result: {ping_result}")
        
        # Test models
        print("\nFetching models...")
        models = await client.models()
        print(f"Available models: {models}")
        
        # Test chat
        print("\nTesting chat...")
        messages = [
            {"role": "system", "content": "You are a helpful coding assistant."},
            {"role": "user", "content": "Write a Python function to reverse a string."}
        ]
        response = await client.chat(messages)
        print(f"Chat response: {response}")
        
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(test_client())
