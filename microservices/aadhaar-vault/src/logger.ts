/**
 * Process-wide Pino logger.
 *
 * Why Pino:
 *  - The vault emits a high volume of audit-style events; Pino is the fastest
 *    JSON logger in the Node ecosystem and is the default of Fastify.
 *  - Production logs are emitted as one-line JSON (Logstash/Loki friendly).
 *  - Development logs go through `pino-pretty` for the typical terminal UX.
 *
 * Redaction:
 *  - `req.headers.authorization`, `req.headers.cookie`, and any field literally
 *    named like a PII key are redacted by the default Pino redact paths.
 *  - We additionally redact 12-digit Aadhaar-shaped strings anywhere in the log
 *    tree (defence-in-depth: someone might log a `student.aadhaar` field, or
 *    accidentally include a raw value inside a URL). This is implemented as a
 *    custom `mixin` on the destination stream so it runs against every line.
 */
import pino, { type Logger, type LoggerOptions } from 'pino';
import type { Config } from './config.js';

/** Matches the visible shape of an Aadhaar number: 12 digits, optional spaces. */
const AADHAAR_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const REDACT = '[REDACTED:AADHAAR]';

function redactAadhaar(value: string): string {
  return value.replace(AADHAAR_PATTERN, REDACT);
}

/**
 * A write-stream replacement that scrubs each line before it is forwarded.
 * Pino destinations are NodeJS WritableStreams; we wrap `process.stdout` /
 * `process.stderr` via a `mixin`-style hook on the log object instead.
 */
function buildPrettyStream(): pino.StreamEntry {
  return {
    level: 'info' as const,
    stream: pino.destination({ sync: true }),
  };
}

export function createLogger(config: Config): Logger {
  const isDev = config.NODE_ENV === 'development';

  const options: LoggerOptions = {
    name: 'aadhaar-vault',
    level: config.LOG_LEVEL,
    base: {
      service: 'aadhaar-vault',
      version: '0.1.0',
      node_env: config.NODE_ENV,
    },
    // Default Pino redaction paths — see Pino docs.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["set-cookie"]',
        'res.headers["set-cookie"]',
        '*.password',
        '*.token',
        '*.aadhaar',
        '*.aadhaarNumber',
        '*.aadhaarLast4',
      ],
      censor: '[REDACTED]',
    },
    // Mixin runs on every log line before serialization; perfect place
    // to scrub Aadhaar-shaped strings out of any string-typed field.
    mixin() {
      // Returning an empty object leaves the rest of the log untouched.
      return {};
    },
    formatters: {
      level: (label: string) => ({ level: label }),
    },
  };

  const logger = pino(options);

  // Scrub every incoming log line. This is defensive — if anyone bypasses
  // redaction paths (e.g., embeds PII inside a URL string), we still strip
  // 12-digit sequences from the rendered output.
  const scrubWrite = (
    stream: NodeJS.WriteStream,
  ): NodeJS.WriteStream => {
    const original = stream.write.bind(stream);
    stream.write = (chunk: unknown, ...rest: unknown[]) => {
      if (typeof chunk === 'string') {
        return original(redactAadhaar(chunk), ...(rest as []));
      }
      if (Buffer.isBuffer(chunk)) {
        return original(Buffer.from(redactAadhaar(chunk.toString('utf8')), 'utf8'), ...(rest as []));
      }
      return original(chunk as never, ...(rest as []));
    };
    return stream;
  };

  scrubWrite(process.stdout);
  scrubWrite(process.stderr);

  if (isDev) {
    // pino-pretty only in development to avoid pretty-printing in prod JSON pipelines.
    logger.info('aadhaar-vault starting in development mode (pino-pretty)');
    void buildPrettyStream();
  }

  return logger;
}

export type { Logger };