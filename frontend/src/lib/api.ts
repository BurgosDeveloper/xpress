import { getApiBaseUrl } from "./apiBase";

type ApiErrorLike = {
  message?: string;
  code?: string;
  details?: unknown;
  ok?: boolean;
};

export class ApiError extends Error {
  status: number;
  data?: ApiErrorLike;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }

  static from(params: { message: string; status: number; data?: ApiErrorLike }) {
    const err = new ApiError(params.message, params.status);
    err.data = params.data;
    return err;
  }
}

async function parseErrorData(res: Response): Promise<{ message: string; data?: ApiErrorLike }> {
  try {
    const data = (await res.json()) as ApiErrorLike;
    if (data?.message && typeof data.message === "string") return { message: data.message, data };
    return { message: res.statusText || "Request failed", data };
  } catch {
    // ignore
  }

  return { message: res.statusText || "Request failed" };
}

export async function apiRequest<T>(params: {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  token?: string;
  timeoutMs?: number;
}): Promise<T> {
  const url = `${getApiBaseUrl()}${params.path.startsWith("/") ? "" : "/"}${params.path}`;

  const timeoutMs = typeof params.timeoutMs === "number" && params.timeoutMs > 0 ? params.timeoutMs : 15000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: params.method,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(params.token ? { Authorization: `Bearer ${params.token}` } : null),
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
    });
  } catch (e) {
    if (e && typeof e === "object" && (e as any).name === "AbortError") {
      throw new ApiError("Tiempo de espera agotado. Revisá tu conexión e intentá de nuevo.", 408);
    }
    throw new ApiError("No se pudo conectar con el servidor.", 0);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const parsed = await parseErrorData(res);
    throw ApiError.from({ message: parsed.message, status: res.status, data: parsed.data });
  }

  return (await res.json()) as T;
}
