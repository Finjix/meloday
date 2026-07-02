const sensitiveKeyPattern = /(api[_-]?key|authorization|token|secret|password)/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactString(value: string) {
  if (value.length <= 8) return "[redacted]";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (sensitiveKeyPattern.test(key)) {
        return [key, typeof entry === "string" ? redactString(entry) : "[redacted]"];
      }

      return [key, redactSensitive(entry)];
    }),
  );
}

function serialize(value: unknown) {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(redactSensitive(value), null, 2);
  } catch {
    return String(value);
  }
}

export function agentDebugLog(label: string, value?: unknown) {
  const timestamp = new Date().toISOString();
  const prefix = `[agent-debug ${timestamp}] ${label}`;

  if (value === undefined) {
    console.log(prefix);
    return;
  }

  console.log(`${prefix}\n${serialize(value)}`);
}

export function agentDebugError(label: string, error: unknown) {
  const detail =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
  agentDebugLog(label, detail);
}
