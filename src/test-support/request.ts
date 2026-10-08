type JsonRequestOptions = {
  method?: string;
  body?: unknown;
  /** Distinct per test so rate-limit buckets never collide. */
  ip?: string;
  headers?: Record<string, string>;
};

export function jsonRequest(url: string, options: JsonRequestOptions = {}): Request {
  const { method = "POST", body, ip = "203.0.113.1", headers = {} } = options;

  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** A request whose body is deliberately not valid JSON. */
export function malformedJsonRequest(url: string, ip = "203.0.113.1"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: "{not json",
  });
}

/** Next 16 route handlers receive params as a Promise. */
export function routeParams<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

export function basicAuthHeader(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}
