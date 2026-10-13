const apiUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type CreatedCloud = {
  id: string;
  title: string;
  adminSecret: string;
};

export type PublicCloud = {
  title: string;
  submissionCount: number;
};

export type AdminCloud = {
  title: string;
  revealed: boolean;
  submissionCount: number;
  submissions: { text: string; at: string }[];
};

export function createCloud(title: string): Promise<CreatedCloud> {
  return request('/clouds', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export function getCloud(id: string): Promise<PublicCloud> {
  return request(`/clouds/${id}`);
}

export function submitText(id: string, text: string): Promise<{ ok: true }> {
  return request(`/clouds/${id}/submissions`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function getAdminCloud(id: string, secret: string): Promise<AdminCloud> {
  return request(`/clouds/${id}/admin`, {
    headers: { 'x-admin-secret': secret },
  });
}

export function revealCloud(id: string, secret: string): Promise<{ revealed: true }> {
  return request(`/clouds/${id}/reveal`, {
    method: 'POST',
    headers: { 'x-admin-secret': secret },
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiUrl) {
    throw new ApiError(0, 'The API URL is not configured.');
  }

  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Request failed';
    throw new ApiError(response.status, message);
  }

  return body as T;
}
