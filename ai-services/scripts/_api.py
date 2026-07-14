import json
import os
import time
import random
import requests
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

def _load_env():
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
    root_env = BASE_DIR.parent / ".env"
    if root_env.exists():
        for line in root_env.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                # Parse double quotes or single quotes from value if present
                val = v.strip().strip('"').strip("'")
                os.environ.setdefault(k.strip(), val)

_load_env()


def _call_gemini_fallback(messages, temperature, max_tokens, timeout):
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        return None
    contents = []
    system_instruction = ""
    for msg in messages:
        if msg["role"] == "system":
            system_instruction = msg["content"]
        else:
            role = "model" if msg["role"] == "assistant" else "user"
            contents.append({
                "role": role,
                "parts": [{"text": msg["content"]}]
            })
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max(8000, max_tokens),
            "thinkingConfig": {
                "thinkingBudget": 0
            }
        }
    }
    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction}]
        }
    
    is_json = False
    for msg in messages:
        if "json" in msg["content"].lower():
            is_json = True
            break
    if is_json:
        payload["generationConfig"]["responseMimeType"] = "application/json"

    for model_name in ["gemini-2.0-flash", "gemini-2.5-flash"]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
        try:
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=timeout)
            if res.status_code == 200:
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return {
                    "choices": [
                        {
                            "message": {
                                "content": text
                            }
                        }
                    ]
                }
            else:
                print(f"  Gemini model {model_name} failed with status {res.status_code}: {res.text[:150]}")
        except Exception as e:
            print(f"  Gemini model {model_name} request failed: {e}")
    return None


def groq_api_call(
    model,
    messages,
    temperature=0.1,
    max_tokens=5000,
    timeout=300,
    api_key=None,
    max_retries=5,
    base_delay=2,
   stream=False
):
    api_key = api_key or os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        res = _call_gemini_fallback(messages, temperature, max_tokens, timeout)
        if res:
            return res
        print("  Neither GROQ_API_KEY nor GEMINI_API_KEY found in environment or .env")
        return None

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": stream
    }

    last_error = None

    for attempt in range(max_retries):
        try:
            response = requests.post(
                'https://api.groq.com/openai/v1/chat/completions',
                headers=headers,
                json=payload,
                timeout=timeout
            )

            if response.status_code == 200:
                return response.json()

            if response.status_code == 413:
                try:
                    err_body = response.json()
                    err_msg = err_body.get("error", {}).get("message", "")
                except Exception:
                    err_msg = response.text[:200]
                print(f"  413 error: {err_msg}", flush=True)

                if "TPM" in err_msg or "tokens per minute" in err_msg:
                    if max_tokens > 200:
                        reduced = max_tokens // 2
                        print(f"  Reducing max_tokens from {max_tokens} to {reduced}...", flush=True)
                        payload["max_tokens"] = reduced
                        max_tokens = reduced
                        continue
                    wait = 65 + random.uniform(0, 5)
                    print(f"  Waiting {wait:.0f}s for TPM reset...", flush=True)
                    time.sleep(wait)
                    continue
                else:
                    if max_tokens > 200:
                        reduced = max_tokens // 2
                        print(f"  Reducing max_tokens from {max_tokens} to {reduced}...", flush=True)
                        payload["max_tokens"] = reduced
                        max_tokens = reduced
                        continue
                    print(f"  Request too large even at minimum, cannot recover")
                    return None

            if response.status_code == 429:
                wait = (base_delay ** (attempt + 1)) + random.uniform(0, 1)
                print(f"  Rate limited (429), retry {attempt + 1}/{max_retries} in {wait:.0f}s...", flush=True)
                time.sleep(wait)
                continue

            if response.status_code in (500, 502, 503):
                wait = (base_delay ** (attempt + 1)) + random.uniform(0, 1)
                print(f"  Server error ({response.status_code}), retry {attempt + 1}/{max_retries} in {wait:.0f}s...", flush=True)
                time.sleep(wait)
                continue

            if response.status_code == 400:
                try:
                    err_body = response.json()
                    err_msg = err_body.get("error", {}).get("message", "")
                except Exception:
                    err_msg = response.text

                if "context_length_exceeded" in err_msg or "too many tokens" in err_msg.lower() or "maximum context length" in err_msg:
                    if max_tokens > 1000:
                        reduced = max_tokens // 2
                        print(f"  Token limit exceeded, reducing max_tokens from {max_tokens} to {reduced}...", flush=True)
                        payload["max_tokens"] = reduced
                        continue
                    else:
                        print(f"  Token limit exceeded even at max_tokens={max_tokens}, cannot reduce further")
                        print(f"  Error: {err_msg}")
                        return None

                print(f"  Bad request (400): {err_msg}")
                return None

            if response.status_code == 401:
                print(f"  Auth error (401): Invalid GROQ_API_KEY. Attempting Gemini fallback...")
                res = _call_gemini_fallback(messages, temperature, max_tokens, timeout)
                if res:
                    return res
                return None

            print(f"  API error {response.status_code}: {response.text[:300]}")
            return None

        except requests.exceptions.Timeout:
            wait = (base_delay ** (attempt + 1)) + random.uniform(0, 1)
            print(f"  Timeout (>{timeout}s), retry {attempt + 1}/{max_retries} in {wait:.0f}s...", flush=True)
            time.sleep(wait)
            last_error = "timeout"

        except requests.exceptions.ConnectionError as e:
            wait = (base_delay ** (attempt + 1)) + random.uniform(0, 1)
            print(f"  Connection error, retry {attempt + 1}/{max_retries} in {wait:.0f}s...", flush=True)
            time.sleep(wait)
            last_error = str(e)

        except requests.exceptions.RequestException as e:
            wait = (base_delay ** (attempt + 1)) + random.uniform(0, 1)
            print(f"  Request error: {e}, retry {attempt + 1}/{max_retries} in {wait:.0f}s...", flush=True)
            time.sleep(wait)
            last_error = str(e)

    print(f"  Failed after {max_retries} retries" + (f": {last_error}" if last_error else ""))
    return None
