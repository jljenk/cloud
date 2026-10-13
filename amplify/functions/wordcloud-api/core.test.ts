import assert from 'node:assert/strict';
import { createMemoryStore, handleRequest, type ApiRequest } from './core.ts';

const store = createMemoryStore();

const created = await handleRequest(store, call('POST', '/clouds', { title: 'Retreat' }));
assert.equal(created.statusCode, 201);
const createdBody = created.body as { id: string; title: string; adminSecret: string };
assert.equal(createdBody.title, 'Retreat');
assert.equal(typeof createdBody.adminSecret, 'string');
assert.equal('adminSecretHash' in (created.body as object), false);
assert.equal('submissions' in (created.body as object), false);

const submitted = await handleRequest(
  store,
  call('POST', `/clouds/${createdBody.id}/submissions`, { text: '  teamwork  ' }),
);
assert.equal(submitted.statusCode, 200);
assert.deepEqual(submitted.body, { ok: true });

const pub = await handleRequest(store, call('GET', `/clouds/${createdBody.id}`));
assert.equal(pub.statusCode, 200);
assert.deepEqual(pub.body, { title: 'Retreat', submissionCount: 1 });

const missingSecret = await handleRequest(store, call('GET', `/clouds/${createdBody.id}/admin`));
assert.equal(missingSecret.statusCode, 401);

const wrongSecret = await handleRequest(
  store,
  call('GET', `/clouds/${createdBody.id}/admin`, undefined, { 'x-admin-secret': 'nope' }),
);
assert.equal(wrongSecret.statusCode, 401);

const admin = await handleRequest(
  store,
  call('GET', `/clouds/${createdBody.id}/admin`, undefined, {
    'x-admin-secret': createdBody.adminSecret,
  }),
);
assert.equal(admin.statusCode, 200);
const adminBody = admin.body as { revealed: boolean; submissions: { text: string }[] };
assert.equal(adminBody.revealed, false);
assert.deepEqual(
  adminBody.submissions.map((submission) => submission.text),
  ['teamwork'],
);

const revealed = await handleRequest(
  store,
  call('POST', `/clouds/${createdBody.id}/reveal`, undefined, {
    'x-admin-secret': createdBody.adminSecret,
  }),
);
assert.equal(revealed.statusCode, 200);
assert.equal((revealed.body as { revealed: boolean }).revealed, true);

const hidden = await handleRequest(
  store,
  call('POST', `/clouds/${createdBody.id}/hide`, undefined, {
    'x-admin-secret': createdBody.adminSecret,
  }),
);
assert.equal(hidden.statusCode, 200);
assert.equal((hidden.body as { revealed: boolean }).revealed, false);

const hiddenDenied = await handleRequest(store, call('POST', `/clouds/${createdBody.id}/hide`));
assert.equal(hiddenDenied.statusCode, 401);

const afterHide = await handleRequest(
  store,
  call('GET', `/clouds/${createdBody.id}/admin`, undefined, {
    'x-admin-secret': createdBody.adminSecret,
  }),
);
assert.equal((afterHide.body as { revealed: boolean }).revealed, false);

const tooLong = await handleRequest(
  store,
  call('POST', `/clouds/${createdBody.id}/submissions`, { text: 'x'.repeat(81) }),
);
assert.equal(tooLong.statusCode, 400);

console.log('core tests passed');

function call(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string | undefined> = {},
): ApiRequest {
  return {
    method,
    path,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}
