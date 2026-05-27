const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERN =
  /authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|token|secret|password|cookie|session/i;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const QUERY_TOKEN_PATTERN =
  /([?&](?:access_token|token|id_token|refresh_token|client_secret)=)[^&#\s]+/gi;

const redactString = (value) =>
  value
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(QUERY_TOKEN_PATTERN, `$1${REDACTED}`);

const redactError = (error, seen) => ({
  name: redactForLogs(error.name, seen),
  message: redactForLogs(error.message, seen),
  code: redactForLogs(error.code, seen),
  status: redactForLogs(error.status || error.statusCode, seen),
  stack: redactForLogs(error.stack, seen),
  response: redactForLogs(
    error.response && {
      status: error.response.status,
      data: error.response.data,
      headers: error.response.headers,
    },
    seen
  ),
  config: redactForLogs(
    error.config && {
      method: error.config.method,
      url: error.config.url,
      headers: error.config.headers,
      data: error.config.data,
    },
    seen
  ),
});

const redactForLogs = (value, seen = new WeakSet()) => {
  if (typeof value === 'string') return redactString(value);
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (value instanceof Error) {
    return redactError(value, seen);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactForLogs(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactForLogs(item, seen),
    ])
  );
};

module.exports = {
  REDACTED,
  redactForLogs,
};
