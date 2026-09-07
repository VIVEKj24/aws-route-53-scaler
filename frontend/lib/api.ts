export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | Record<string, any> | null;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const normalizedPath = path.startsWith("/api")
    ? path
    : `/api${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers(options.headers);

  let requestBody: BodyInit | null | undefined;
  if (options.body !== undefined && options.body !== null) {
    const isPlainObject =
      typeof options.body === "object" &&
      !(options.body instanceof FormData) &&
      !(options.body instanceof Blob) &&
      !(options.body instanceof ArrayBuffer);

    if (isPlainObject) {
      requestBody = JSON.stringify(options.body);
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    } else if (typeof options.body === "string") {
      requestBody = options.body;
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    } else {
      requestBody = options.body as BodyInit;
    }
  }

  const res = await fetch(normalizedPath, {
    ...options,
    body: requestBody,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    let message = res.statusText || "Request failed";
    try {
      const data = await res.json();
      if (data && data.detail !== undefined) {
        if (typeof data.detail === "string") {
          message = data.detail;
        } else if (Array.isArray(data.detail)) {
          message = data.detail
            .map((item: any) => item.msg || JSON.stringify(item))
            .join(", ");
        } else {
          message = JSON.stringify(data.detail);
        }
      }
    } catch {
      // Non-JSON response body, fall back to statusText
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const text = await res.text();
  if (!text) {
    return undefined as unknown as T;
  }

  return JSON.parse(text) as T;
}
