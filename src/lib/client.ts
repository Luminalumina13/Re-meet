export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly issues?: { path: (string | number)[]; message: string }[],
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.issues?.[0]?.message ? `${body.issues[0].path?.join(".") ?? ""}: ${body.issues[0].message}` : body?.error ?? `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, body?.issues);
  }
  return body as T;
}

export const postJson = <T,>(url: string, data: unknown) => api<T>(url, { method: "POST", body: JSON.stringify(data) });
