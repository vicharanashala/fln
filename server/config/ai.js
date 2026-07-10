const config = {
  apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '',
  baseURL: process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  model: process.env.AI_MODEL || 'gpt-4o-mini',
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048', 10),
  timeout: parseInt(process.env.AI_TIMEOUT || '30000', 10),
};

module.exports = config;
