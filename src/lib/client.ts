import type { ErrorCode } from "@/lib/api/respond";

export type ClientErrorCode = ErrorCode | "network" | "timeout" | "http";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly issues?: { path: (string | number)[]; message: string }[],
    public readonly code: ClientErrorCode = "http",
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("network", 0, undefined, "network");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code: ClientErrorCode = typeof body?.code === "string" ? body.code : res.status === 504 || res.status === 408 ? "timeout" : "http";
    throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status, body?.issues, code);
  }
  return body as T;
}

export const postJson = <T,>(url: string, data: unknown) => api<T>(url, { method: "POST", body: JSON.stringify(data) });
