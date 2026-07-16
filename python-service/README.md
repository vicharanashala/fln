# FLN Python AI Service

This service handles PDF/image processing and utilizes Vision-Language Models (VLMs) to extract structured assessment questions and generate answer keys.

## 🚀 Running the FastAPI Server

1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
2. **Start the Uvicorn server**:
   ```bash
   python3 -m uvicorn main:app --host 127.0.0.1 --port 5051 --reload
   ```

---

## 🤖 AI Model Configuration

By default, this service is configured to use the local **`qwen2.5vl:7b`** model running on Ollama.

### Option A: Local Ollama (Default Setup)
To run the AI extraction locally on your machine:
1. **Download and Install Ollama**: [https://ollama.com](https://ollama.com)
2. **Pull the Qwen 2.5 Vision model**:
   ```bash
   ollama pull qwen2.5vl:7b
   ```
3. Make sure the Ollama application is running (it runs on port `11434` by default).

### Option B: Cloud Groq API (Alternative)
If you prefer not to run the model locally, create a `.env` file in this directory (`python-service/.env`) and add your cloud credentials:
```env
LLM_API_BASE_URL=https://api.groq.com/openai/v1
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```