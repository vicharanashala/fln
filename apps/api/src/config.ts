/**
 * Every setting and every resource limit of the API, read once from the environment and checked on start.
 * Nothing else reads `process.env`, so what a server is allowed to use is visible in one place.
 */
export interface Config {
  port: number;
  jwtSecret: string;
  tokenHours: number;
  bcryptCost: number;
  version: string;
  mongo: { uri?: string; db: string; /** Most connections the driver may open; a small server needs few. */ maxPoolSize: number };
  limits: {
    /** Largest ordinary request body, in megabytes. */
    jsonBodyMb: number;
    /** Largest body for the photo route, in megabytes (a phone photo, resized by the app first). */
    scanBodyMb: number;
    /** Login attempts per person per 15 minutes. */
    loginPer15Min: number;
    /** Photos a teacher may send per hour. */
    scanPerHour: number;
  };
  ollama?: { host: string; apiKey?: string; model: string; timeoutMs: number; /** Photos read at the same moment. */ concurrent: number; /** Photos allowed to wait. */ queue: number };
  questionBankPath?: string;
  demoPassword?: string;
}

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): Config {
  const problems: string[] = [];
  const int = (name: string, fallback: number, min: number, max: number): number => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) { problems.push(`${name} must be a whole number from ${min} to ${max}.`); return fallback; }
    return n;
  };
  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < 32) problems.push('JWT_SECRET must be a random value of at least 32 characters.');
  const config: Config = {
    port: int('PORT', 3100, 1, 65535),
    jwtSecret,
    tokenHours: int('TOKEN_HOURS', 12, 1, 168),
    bcryptCost: int('BCRYPT_COST', 10, 4, 14),
    version: env.APP_VERSION ?? 'dev',
    mongo: { uri: env.MONGODB_URI || undefined, db: env.MONGODB_DB ?? 'fln_v2', maxPoolSize: int('MONGODB_MAX_POOL', 10, 1, 100) },
    limits: {
      jsonBodyMb: int('JSON_BODY_MB', 1, 1, 10),
      scanBodyMb: int('SCAN_BODY_MB', 9, 1, 20),
      loginPer15Min: int('LOGIN_PER_15_MIN', 20, 1, 1000),
      scanPerHour: int('SCAN_PER_HOUR', 120, 1, 10000),
    },
    questionBankPath: env.QUESTION_BANK_PATH || undefined,
    demoPassword: env.DEMO_PASSWORD || undefined,
  };
  if (env.OLLAMA_MODEL) {
    config.ollama = {
      host: env.OLLAMA_HOST ?? 'https://ollama.com', apiKey: env.OLLAMA_API_KEY || undefined, model: env.OLLAMA_MODEL,
      timeoutMs: int('OLLAMA_TIMEOUT_MS', 60_000, 1000, 300_000), concurrent: int('OLLAMA_CONCURRENT', 1, 1, 8), queue: int('OLLAMA_QUEUE', 10, 0, 200),
    };
  }
  if (problems.length) throw new Error(`Invalid configuration:\n- ${problems.join('\n- ')}`);
  return config;
}
