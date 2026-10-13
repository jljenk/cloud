import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export const MAX_TITLE_LENGTH = 80;
export const MAX_TEXT_LENGTH = 80;
export const MAX_SUBMISSIONS = 1000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type Submission = {
  text: string;
  at: string;
};

export type CloudRecord = {
  id: string;
  title: string;
  adminSecretHash: string;
  revealed: boolean;
  submissionCount: number;
  submissions: Submission[];
  createdAt: string;
};

export type Store = {
  create(record: CloudRecord): Promise<void>;
  get(id: string): Promise<CloudRecord | null>;
  addSubmission(id: string, submission: Submission): Promise<'ok' | 'missing' | 'full'>;
  reveal(id: string): Promise<'ok' | 'missing'>;
  hide(id: string): Promise<'ok' | 'missing'>;
};

export type ApiResult = {
  statusCode: number;
  body: unknown;
};

export type ApiRequest = {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: string | undefined;
};

export function createMemoryStore(): Store {
  const clouds = new Map<string, CloudRecord>();

  return {
    async create(record) {
      clouds.set(record.id, structuredClone(record));
    },
    async get(id) {
      const record = clouds.get(id);
      return record ? structuredClone(record) : null;
    },
    async addSubmission(id, submission) {
      const record = clouds.get(id);
      if (!record) return 'missing';
      if (record.submissionCount >= MAX_SUBMISSIONS) return 'full';
      record.submissions.push(submission);
      record.submissionCount += 1;
      return 'ok';
    },
    async reveal(id) {
      return setStoredVisibility(clouds, id, true);
    },
    async hide(id) {
      return setStoredVisibility(clouds, id, false);
    },
  };
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function secretsMatch(provided: string, storedHash: string): boolean {
  const providedHash = hashSecret(provided);
  const actual = Buffer.from(providedHash);
  const expected = Buffer.from(storedHash);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export async function handleRequest(store: Store, request: ApiRequest): Promise<ApiResult> {
  const method = request.method.toUpperCase();
  const parts = request.path.split('/').filter(Boolean);

  if (method === 'POST' && parts.length === 1 && parts[0] === 'clouds') {
    return createCloud(store, request.body);
  }

  if (parts.length < 2 || parts[0] !== 'clouds' || !UUID_PATTERN.test(parts[1])) {
    return json(404, { error: 'Not found' });
  }

  const id = parts[1];

  if (method === 'GET' && parts.length === 2) {
    return readPublicCloud(store, id);
  }

  if (method === 'POST' && parts.length === 3 && parts[2] === 'submissions') {
    return addSubmission(store, id, request.body);
  }

  if (method === 'GET' && parts.length === 3 && parts[2] === 'admin') {
    return readAdminCloud(store, id, request.headers);
  }

  if (method === 'POST' && parts.length === 3 && parts[2] === 'reveal') {
    return setVisibility(store, id, request.headers, true);
  }

  if (method === 'POST' && parts.length === 3 && parts[2] === 'hide') {
    return setVisibility(store, id, request.headers, false);
  }

  return json(404, { error: 'Not found' });
}

async function createCloud(store: Store, rawBody: string | undefined): Promise<ApiResult> {
  const body = parseBody(rawBody);
  if (body === null) return json(400, { error: 'Enter valid JSON.' });

  const titleResult = readTitle(body.title);
  if (!titleResult.ok) return json(400, { error: titleResult.error });

  const adminSecret = randomBytes(32).toString('base64url');
  const record: CloudRecord = {
    id: randomUUID(),
    title: titleResult.title,
    adminSecretHash: hashSecret(adminSecret),
    revealed: false,
    submissionCount: 0,
    submissions: [],
    createdAt: new Date().toISOString(),
  };

  await store.create(record);
  return json(201, { id: record.id, title: record.title, adminSecret });
}

async function readPublicCloud(store: Store, id: string): Promise<ApiResult> {
  const record = await store.get(id);
  if (!record) return json(404, { error: 'Not found' });
  return json(200, { title: record.title, submissionCount: record.submissionCount });
}

async function addSubmission(store: Store, id: string, rawBody: string | undefined): Promise<ApiResult> {
  const body = parseBody(rawBody);
  if (body === null) return json(400, { error: 'Enter valid JSON.' });

  const text = cleanText(body.text);
  if (!text) return json(400, { error: 'Enter a word or short phrase.' });
  if (text.length > MAX_TEXT_LENGTH) {
    return json(400, { error: `Keep it to ${MAX_TEXT_LENGTH} characters.` });
  }

  const result = await store.addSubmission(id, { text, at: new Date().toISOString() });
  if (result === 'missing') return json(404, { error: 'Not found' });
  if (result === 'full') return json(409, { error: 'This word cloud is full.' });
  return json(200, { ok: true });
}

async function readAdminCloud(
  store: Store,
  id: string,
  headers: Record<string, string | undefined>,
): Promise<ApiResult> {
  const record = await store.get(id);
  if (!record) return json(404, { error: 'Not found' });
  if (!isAdmin(record, headers)) return json(401, { error: 'Unauthorized' });

  return json(200, {
    title: record.title,
    revealed: record.revealed,
    submissionCount: record.submissionCount,
    submissions: record.submissions.map((submission) => ({
      text: submission.text,
      at: submission.at,
    })),
  });
}

async function setVisibility(
  store: Store,
  id: string,
  headers: Record<string, string | undefined>,
  revealed: boolean,
): Promise<ApiResult> {
  const record = await store.get(id);
  if (!record) return json(404, { error: 'Not found' });
  if (!isAdmin(record, headers)) return json(401, { error: 'Unauthorized' });

  const result = revealed ? await store.reveal(id) : await store.hide(id);
  if (result === 'missing') return json(404, { error: 'Not found' });
  return json(200, { revealed });
}

function setStoredVisibility(
  clouds: Map<string, CloudRecord>,
  id: string,
  revealed: boolean,
): 'ok' | 'missing' {
  const record = clouds.get(id);
  if (!record) return 'missing';
  record.revealed = revealed;
  return 'ok';
}

function isAdmin(record: CloudRecord, headers: Record<string, string | undefined>): boolean {
  const secret = header(headers, 'x-admin-secret');
  if (!secret || secret.length > 200) return false;
  return secretsMatch(secret, record.adminSecretHash);
}

function header(headers: Record<string, string | undefined>, name: string): string {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  return typeof direct === 'string' ? direct.trim() : '';
}

function parseBody(rawBody: string | undefined): { title?: unknown; text?: unknown } | null {
  if (!rawBody) return {};
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as { title?: unknown; text?: unknown };
  } catch {
    return null;
  }
}

function readTitle(value: unknown): { ok: true; title: string } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, title: 'Word cloud' };
  }
  if (typeof value !== 'string') return { ok: false, error: 'Title must be text.' };
  const title = cleanText(value);
  if (!title) return { ok: true, title: 'Word cloud' };
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `Keep the title to ${MAX_TITLE_LENGTH} characters.` };
  }
  return { ok: true, title };
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  let cleaned = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) continue;
    cleaned += char;
  }
  return cleaned.trim();
}

function json(statusCode: number, body: unknown): ApiResult {
  return { statusCode, body };
}
