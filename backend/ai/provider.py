"""
StockOracle Pro — Unified Multi-AI Provider Engine
Supports: Google Gemini, OpenAI, Anthropic Claude, Mistral AI, Cohere, and Groq LPU.
Provides encrypted key storage, dynamic provider routing, model selection, and automatic fallback.
"""
import os
import re
import json
import time
import base64
import hashlib
import logging
from typing import Optional, Dict, Any, Tuple
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from backend.core.logging import get_logger
from backend.data.database import (
    get_active_ai_provider_from_db,
    get_all_ai_providers_from_db,
    increment_ai_provider_requests,
    update_ai_provider_test_status,
)

logger = get_logger("stockoracle.ai.provider")

# ── Encryption / Decryption Utilities ──────────────────────────────────────────

def _get_encryption_key() -> bytes:
    """Derives a stable 32-byte key for Fernet AES-128-CBC encryption."""
    secret = os.environ.get("JWT_SECRET", "stockoracle_pro_master_ai_secret_key_2026")
    salt = b"stockoracle_ai_salt_v2"
    # PBKDF2 key derivation (32 bytes)
    derived = hashlib.pbkdf2_hmac("sha256", secret.encode("utf-8"), salt, 100000, dklen=32)
    return base64.urlsafe_b64encode(derived)


def encrypt_api_key(raw_key: str) -> str:
    """Encrypts an API key string into a base64 encoded ciphertext."""
    if not raw_key:
        return ""
    try:
        from cryptography.fernet import Fernet
        f = Fernet(_get_encryption_key())
        return f.encrypt(raw_key.strip().encode("utf-8")).decode("utf-8")
    except Exception:
        # Fallback XOR obfuscation if cryptography package is missing
        key_bytes = _get_encryption_key()
        raw_bytes = raw_key.strip().encode("utf-8")
        xored = bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(raw_bytes))
        return "OBF:" + base64.b64encode(xored).decode("utf-8")


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypts an API key string."""
    if not encrypted_key:
        return ""
    try:
        if encrypted_key.startswith("OBF:"):
            key_bytes = _get_encryption_key()
            xored = base64.b64decode(encrypted_key[4:].encode("utf-8"))
            return bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(xored)).decode("utf-8")
        from cryptography.fernet import Fernet
        f = Fernet(_get_encryption_key())
        return f.decrypt(encrypted_key.encode("utf-8")).decode("utf-8")
    except Exception as exc:
        logger.error("Failed decrypting API key: %s", exc)
        return ""


def mask_api_key(key: str) -> str:
    """Masks an API key for safe UI display (e.g. AIza••••xyz)."""
    if not key:
        return "Not Configured"
    cleaned = key.strip()
    if len(cleaned) <= 8:
        return "••••"
    return f"{cleaned[:4]}••••{cleaned[-3:]}"


# ── AI Provider Registry & Specifications ──────────────────────────────────────

PROVIDERS: Dict[str, Dict[str, Any]] = {
    "gemini": {
        "id": "gemini",
        "name": "Google Gemini",
        "env_key": "GEMINI_API_KEY",
        "logo": "✨",
        "color": "#818CF8",
        "models": [
            {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "recommended": True, "free": True},
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "recommended": False, "free": True},
            {"id": "gemini-2.5-pro",   "name": "Gemini 2.5 Pro",   "recommended": False, "free": False},
            {"id": "gemini-pro",       "name": "Gemini 1.0 Pro",   "recommended": False, "free": True},
        ],
        "default_model": "gemini-2.5-flash",
        "key_regex": r"^AIza[A-Za-z0-9_-]{35}$",
        "free_tier": True,
        "rate_limit": "15 RPM (Free)",
        "speed": "Ultra Fast (~90ms)",
        "quality": "High",
        "pricing": "Generous Free Tier",
        "signup_url": "https://aistudio.google.com/app/apikey",
        "description": "Google's flagship multimodal model with deep technical analysis reasoning.",
    },
    "openai": {
        "id": "openai",
        "name": "OpenAI",
        "env_key": "OPENAI_API_KEY",
        "logo": "🧠",
        "color": "#10B981",
        "models": [
            {"id": "gpt-4o-mini",  "name": "GPT-4o Mini",  "recommended": True, "free": False},
            {"id": "gpt-4o",       "name": "GPT-4o",       "recommended": False, "free": False},
            {"id": "gpt-3.5-turbo","name": "GPT-3.5 Turbo","recommended": False, "free": False},
        ],
        "default_model": "gpt-4o-mini",
        "key_regex": r"^sk-[A-Za-z0-9_-]{20,}$",
        "free_tier": False,
        "rate_limit": "Pay-as-you-go",
        "speed": "Fast (~160ms)",
        "quality": "Exceptional",
        "pricing": "$0.15 / 1M tokens",
        "signup_url": "https://platform.openai.com/api-keys",
        "description": "Industry benchmark intelligence with precise JSON formatting.",
    },
    "anthropic": {
        "id": "anthropic",
        "name": "Anthropic Claude",
        "env_key": "ANTHROPIC_API_KEY",
        "logo": "🪐",
        "color": "#F97316",
        "models": [
            {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "recommended": True, "free": False},
            {"id": "claude-3-haiku-20240307",    "name": "Claude 3 Haiku",    "recommended": False, "free": False},
            {"id": "claude-3-opus-20240229",     "name": "Claude 3 Opus",     "recommended": False, "free": False},
        ],
        "default_model": "claude-3-5-sonnet-20241022",
        "key_regex": r"^sk-ant-[A-Za-z0-9_-]{20,}$",
        "free_tier": False,
        "rate_limit": "Pay-as-you-go",
        "speed": "Medium (~240ms)",
        "quality": "State-of-the-art",
        "pricing": "$3.00 / 1M tokens",
        "signup_url": "https://console.anthropic.com/settings/keys",
        "description": "Unmatched depth in fundamental financial forensic auditing.",
    },
    "mistral": {
        "id": "mistral",
        "name": "Mistral AI",
        "env_key": "MISTRAL_API_KEY",
        "logo": "🌪️",
        "color": "#F59E0B",
        "models": [
            {"id": "mistral-small-latest",  "name": "Mistral Small",  "recommended": True, "free": True},
            {"id": "mistral-medium-latest", "name": "Mistral Medium", "recommended": False, "free": False},
            {"id": "mistral-large-latest",  "name": "Mistral Large",  "recommended": False, "free": False},
            {"id": "open-mistral-7b",       "name": "Mistral 7B",     "recommended": False, "free": True},
        ],
        "default_model": "mistral-small-latest",
        "key_regex": r"^mist-[A-Za-z0-9_-]{20,}$",
        "free_tier": True,
        "rate_limit": "1 RPS (Free Tier)",
        "speed": "Fast (~140ms)",
        "quality": "Very High",
        "pricing": "Free Tier available",
        "signup_url": "https://console.mistral.ai/api-keys",
        "description": "European high-efficiency frontier models with multilingual support.",
    },
    "cohere": {
        "id": "cohere",
        "name": "Cohere",
        "env_key": "COHERE_API_KEY",
        "logo": "🌊",
        "color": "#06B6D4",
        "models": [
            {"id": "command-r-plus", "name": "Command R+",  "recommended": True, "free": True},
            {"id": "command-r",      "name": "Command R",   "recommended": False, "free": True},
            {"id": "command-light",  "name": "Command Light","recommended": False, "free": True},
        ],
        "default_model": "command-r-plus",
        "key_regex": r"^CO[A-Za-z0-9_-]{24,}$",
        "free_tier": True,
        "rate_limit": "1,000 calls/month",
        "speed": "Fast (~190ms)",
        "quality": "High (RAG-Specialized)",
        "pricing": "Trial Key available",
        "signup_url": "https://dashboard.cohere.com/api-keys",
        "description": "Enterprise-grade RAG reasoning tuned for corporate disclosures.",
    },
    "groq": {
        "id": "groq",
        "name": "Groq LPU",
        "env_key": "GROQ_API_KEY",
        "logo": "⚡",
        "color": "#EC4899",
        "models": [
            {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B", "recommended": True, "free": True},
            {"id": "llama3-70b-8192",         "name": "Llama 3 70B",   "recommended": False, "free": True},
            {"id": "llama3-8b-8192",          "name": "Llama 3 8B",    "recommended": False, "free": True},
            {"id": "mixtral-8x7b-32768",      "name": "Mixtral 8x7B",  "recommended": False, "free": True},
        ],
        "default_model": "llama-3.3-70b-versatile",
        "key_regex": r"^gsk_[A-Za-z0-9_-]{30,}$",
        "free_tier": True,
        "rate_limit": "30 RPM / Free",
        "speed": "Lightning Fast (~35ms)",
        "quality": "Very High",
        "pricing": "Free Beta",
        "signup_url": "https://console.groq.com/keys",
        "description": "Ultra low-latency LPU inference delivering instant trading insights.",
    },
}


def auto_detect_provider(api_key: str) -> Optional[str]:
    """Detects the provider name from the format of a pasted API key."""
    if not api_key:
        return None
    k = api_key.strip()
    for pid, meta in PROVIDERS.items():
        if re.match(meta["key_regex"], k):
            return pid
    # Heuristic prefix fallback
    if k.startswith("AIza"):
        return "gemini"
    if k.startswith("sk-ant-"):
        return "anthropic"
    if k.startswith("sk-"):
        return "openai"
    if k.startswith("mist-"):
        return "mistral"
    if k.startswith("CO"):
        return "cohere"
    if k.startswith("gsk_"):
        return "groq"
    return None


# ── Active Key Resolution ──────────────────────────────────────────────────────

def get_effective_provider_key(provider_id: str) -> Tuple[str, str]:
    """
    Resolves the API key and preferred model for a provider,
    checking SQLite database first, then environment variables.
    """
    db_providers = get_all_ai_providers_from_db()
    if provider_id in db_providers:
        p = db_providers[provider_id]
        key = decrypt_api_key(p.get("api_key_encrypted", ""))
        model = p.get("selected_model") or PROVIDERS.get(provider_id, {}).get("default_model", "")
        if key:
            return key, model

    # Fallback to environment
    env_name = PROVIDERS.get(provider_id, {}).get("env_key", "")
    key = os.environ.get(env_name, "").strip()
    model = PROVIDERS.get(provider_id, {}).get("default_model", "")
    return key, model


def get_active_provider_info() -> Tuple[str, str, str]:
    """
    Returns (provider_id, api_key, selected_model) for the currently active AI provider.
    """
    active_db = get_active_ai_provider_from_db()
    if active_db:
        pid = active_db.get("provider_name")
        key = decrypt_api_key(active_db.get("api_key_encrypted", ""))
        model = active_db.get("selected_model") or PROVIDERS.get(pid, {}).get("default_model", "")
        if key:
            return pid, key, model

    # Fallback: check configured DB providers
    all_db = get_all_ai_providers_from_db()
    for pid, pdata in all_db.items():
        key = decrypt_api_key(pdata.get("api_key_encrypted", ""))
        if key:
            return pid, key, pdata.get("selected_model") or PROVIDERS.get(pid, {}).get("default_model", "")

    # Fallback: check environment variables in priority order
    for pid in ["gemini", "groq", "openai", "mistral", "anthropic", "cohere"]:
        key, model = get_effective_provider_key(pid)
        if key:
            return pid, key, model

    return "gemini", "", "gemini-2.5-flash"


# ── Provider HTTP / SDK Dispatchers ───────────────────────────────────────────

def _call_gemini_api(key: str, model_name: str, prompt: str, system_prompt: str, json_mode: bool, max_tokens: int, temp: float) -> str:
    """Calls Google Gemini API via SDK or HTTP."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=key)
        model = genai.GenerativeModel(
            model_name=model_name or "gemini-2.5-flash",
            system_instruction=system_prompt or "You are a senior quantitative financial analyst specializing in Indian equities.",
        )
        gen_config = {"max_output_tokens": max_tokens, "temperature": temp}
        if json_mode:
            gen_config["response_mime_type"] = "application/json"
        response = model.generate_content(prompt, generation_config=gen_config)
        return response.text.strip()
    except Exception as sdk_err:
        # Fallback to direct REST HTTP request
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name or 'gemini-2.5-flash'}:generateContent?key={key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": max_tokens, "temperature": temp}
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}
        req = Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()


def _call_openai_api(key: str, model_name: str, prompt: str, system_prompt: str, json_mode: bool, max_tokens: int, temp: float) -> str:
    """Calls OpenAI API via HTTP REST."""
    url = "https://api.openai.com/v1/chat/completions"
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model_name or "gpt-4o-mini",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temp,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    req = Request(url, data=json.dumps(payload).encode("utf-8"), headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {key}"
    })
    with urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"].strip()


def _call_anthropic_api(key: str, model_name: str, prompt: str, system_prompt: str, json_mode: bool, max_tokens: int, temp: float) -> str:
    """Calls Anthropic Claude API via HTTP REST."""
    url = "https://api.anthropic.com/v1/messages"
    payload = {
        "model": model_name or "claude-3-5-sonnet-20241022",
        "max_tokens": max_tokens,
        "temperature": temp,
        "messages": [{"role": "user", "content": prompt}]
    }
    if system_prompt:
        payload["system"] = system_prompt

    req = Request(url, data=json.dumps(payload).encode("utf-8"), headers={
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
    })
    with urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["content"][0]["text"].strip()


def _call_mistral_api(key: str, model_name: str, prompt: str, system_prompt: str, json_mode: bool, max_tokens: int, temp: float) -> str:
    """Calls Mistral AI API via HTTP REST."""
    url = "https://api.mistral.ai/v1/chat/completions"
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model_name or "mistral-small-latest",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temp,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    req = Request(url, data=json.dumps(payload).encode("utf-8"), headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {key}"
    })
    with urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"].strip()


def _call_cohere_api(key: str, model_name: str, prompt: str, system_prompt: str, json_mode: bool, max_tokens: int, temp: float) -> str:
    """Calls Cohere Chat API via HTTP REST."""
    url = "https://api.cohere.com/v1/chat"
    payload = {
        "model": model_name or "command-r-plus",
        "message": prompt,
        "max_tokens": max_tokens,
        "temperature": temp,
    }
    if system_prompt:
        payload["preamble"] = system_prompt

    req = Request(url, data=json.dumps(payload).encode("utf-8"), headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {key}"
    })
    with urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data.get("text", "").strip()


def _call_groq_api(key: str, model_name: str, prompt: str, system_prompt: str, json_mode: bool, max_tokens: int, temp: float) -> str:
    """Calls Groq LPU API via OpenAI-compatible endpoint."""
    url = "https://api.groq.com/openai/v1/chat/completions"
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model_name or "llama-3.3-70b-versatile",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temp,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    req = Request(url, data=json.dumps(payload).encode("utf-8"), headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {key}"
    })
    with urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"].strip()


# ── Live Probe Testing ─────────────────────────────────────────────────────────

def test_ai_provider(provider_name: str, api_key: str, model: Optional[str] = None) -> Tuple[bool, str, float]:
    """
    Sends a test probe to the designated provider and measures latency in milliseconds.
    Returns: (success: bool, message: str, latency_ms: float)
    """
    pid = provider_name.lower().strip()
    if pid not in PROVIDERS:
        return False, f"Unknown AI provider: {provider_name}", 0.0

    key = api_key.strip()
    if not key:
        return False, "API key cannot be empty.", 0.0

    model_name = model or PROVIDERS[pid]["default_model"]
    probe_prompt = "Say hello to StockOracle Pro in exactly 5 words."

    t0 = time.perf_counter()
    try:
        if pid == "gemini":
            ans = _call_gemini_api(key, model_name, probe_prompt, "", False, 40, 0.1)
        elif pid == "openai":
            ans = _call_openai_api(key, model_name, probe_prompt, "", False, 40, 0.1)
        elif pid == "anthropic":
            ans = _call_anthropic_api(key, model_name, probe_prompt, "", False, 40, 0.1)
        elif pid == "mistral":
            ans = _call_mistral_api(key, model_name, probe_prompt, "", False, 40, 0.1)
        elif pid == "cohere":
            ans = _call_cohere_api(key, model_name, probe_prompt, "", False, 40, 0.1)
        elif pid == "groq":
            ans = _call_groq_api(key, model_name, probe_prompt, "", False, 40, 0.1)
        else:
            return False, "Unsupported provider", 0.0

        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        update_ai_provider_test_status(pid, "Connected", latency_ms)
        return True, f"Connected ({latency_ms}ms): {ans[:60]}", latency_ms

    except HTTPError as http_err:
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        err_msg = f"HTTP {http_err.code}: {http_err.reason}"
        try:
            body = json.loads(http_err.read().decode("utf-8"))
            if "error" in body:
                err_msg = body["error"].get("message", err_msg)
        except Exception:
            pass
        update_ai_provider_test_status(pid, f"Failed: {err_msg[:40]}", latency_ms)
        return False, f"Authentication/API Error: {err_msg}", latency_ms

    except Exception as exc:
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        err_str = str(exc)
        update_ai_provider_test_status(pid, f"Error: {err_str[:40]}", latency_ms)
        return False, f"Connection Failed: {err_str}", latency_ms


# ── Unified AI Query Execution & Fallback ──────────────────────────────────────

def ask_ai(
    question: str,
    context: str = "",
    provider: Optional[str] = None,
    model: Optional[str] = None,
    json_mode: bool = False,
    system_instruction: Optional[str] = None,
    max_tokens: int = 1000,
    temperature: float = 0.2
) -> str:
    """
    Main unified entry point for all AI capabilities in StockOracle Pro.
    Routes queries to the active provider with automatic fallback if primary is unavailable.
    """
    active_pid, active_key, active_model = get_active_provider_info()
    target_pid = (provider or active_pid).lower().strip()
    target_model = model or active_model

    # Determine execution order with fallback
    providers_order = [target_pid]
    for alt in ["gemini", "groq", "openai", "mistral", "anthropic", "cohere"]:
        if alt not in providers_order:
            providers_order.append(alt)

    combined_prompt = f"{context}\n\n{question}" if context else question
    system_prompt = system_instruction or (
        "You are an institutional quantitative equity research analyst specializing in the Indian stock market (NSE/BSE). "
        "Provide factual, risk-managed, and data-grounded insights without generic filler."
    )

    last_error = ""

    for pid in providers_order:
        key, mdl = get_effective_provider_key(pid)
        if not key:
            continue
        cur_model = target_model if pid == target_pid else PROVIDERS[pid]["default_model"]

        try:
            logger.info("Executing AI request using provider: %s (model: %s)", pid, cur_model)
            if pid == "gemini":
                ans = _call_gemini_api(key, cur_model, combined_prompt, system_prompt, json_mode, max_tokens, temperature)
            elif pid == "openai":
                ans = _call_openai_api(key, cur_model, combined_prompt, system_prompt, json_mode, max_tokens, temperature)
            elif pid == "anthropic":
                ans = _call_anthropic_api(key, cur_model, combined_prompt, system_prompt, json_mode, max_tokens, temperature)
            elif pid == "mistral":
                ans = _call_mistral_api(key, cur_model, combined_prompt, system_prompt, json_mode, max_tokens, temperature)
            elif pid == "cohere":
                ans = _call_cohere_api(key, cur_model, combined_prompt, system_prompt, json_mode, max_tokens, temperature)
            elif pid == "groq":
                ans = _call_groq_api(key, cur_model, combined_prompt, system_prompt, json_mode, max_tokens, temperature)
            else:
                continue

            increment_ai_provider_requests(pid)
            return ans

        except Exception as exc:
            last_error = f"{pid}: {str(exc)}"
            logger.warning("Provider %s failed, attempting next fallback: %s", pid, exc)
            continue

    # If all configured providers fail or no key is present
    return (
        "AI engine not configured or all providers temporarily unavailable. "
        "Please configure your API key in Broker & AI Settings (supports Gemini, OpenAI, Claude, Mistral, Cohere, Groq)."
    )
