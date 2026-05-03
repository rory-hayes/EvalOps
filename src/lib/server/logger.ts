import { getRuntimeInfo } from "./env";

type LogLevel = "info" | "warn" | "error";
type LogMetadata = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN = /(authorization|cookie|email|key|password|secret|token)/i;

export function logServerEvent(level: LogLevel, event: string, metadata: LogMetadata = {}) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...getRuntimeInfo(),
    ...sanitizeMetadata(metadata),
  };
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

function sanitizeMetadata(metadata: LogMetadata): LogMetadata {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : sanitizeValue(value),
    ]),
  );
}

function sanitizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    return sanitizeMetadata(value as LogMetadata);
  }

  return value;
}
