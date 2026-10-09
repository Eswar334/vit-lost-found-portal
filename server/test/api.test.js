// End-to-end API tests: run with `npm test` inside server/.
// Uses an in-memory database, so your real data is never touched.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { openDatabase } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');

let server;
let base;

before(async () => {
  const db = openDatabase(':memory:');
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

const register = async (n, extra = {}) => {
  const r = await call('POST', '/auth/register', {
    body: {
      name: `Student ${'ABCDEFG'[n]}`,
      regNo: `24BCE10${String(n).padStart(2, '0')}`,
      email: `student${n}@vitstudent.ac.in`,
      phone: `98765432${String(n).padStart(2, '0')}`,
      password: 'Password123',
      ...extra,
    },
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data;
};

const foundItem = {
  type: 'found',
  title: 'Blue ID card',
  description: 'Found a VIT ID card on the bench near the lift.',
  category: 'ID Cards',
  venue: 'SJT',
  venueDetail: 'Ground floor',
  eventDate: new Date().toISOString().slice(0, 10),
  verificationQuestion: 'What name and branch are on the ID tag?',
  privateAnswer: 'Rohan, CSE',
};

let finder, owner, other, itemId, claimId;

test('registration validates VIT email, reg no and password', async () => {
  const r = await call('POST', '/auth/register', {
    body: { name: 'X', regNo: 'abc', email: 'a@gmail.com', password: 'short' },
  });
  assert.equal(r.status, 400);
  assert.ok(r.data.error.fields.email.includes('VIT email'));
  assert.ok(r.data.error.fields.regNo);
  assert.ok(r.data.error.fields.password);
  assert.ok(r.data.error.fields.name);
});

test('students can register and duplicate accounts are refused', async () => {
  finder = await register(1);
  owner = await register(2);
  other = await register(3);
  assert.ok(finder.token);
  assert.equal(finder.user.regNo, '24BCE1001');
  const dup = await call('POST', '/auth/register', {
    body: { name: 'Dup', regNo: '24BCE1001', email: 'new@vitstudent.ac.in', password: 'Password123' },
  });
  assert.equal(dup.status, 409);
  assert.ok(dup.data.error.fields.regNo);
});

test('login works with reg no or email', async () => {
  const a = await call('POST', '/auth/login', { body: { identifier: '24bce1001', password: 'Password123' } });
  assert.equal(a.status, 200);
  const b = await call('POST', '/auth/login', { body: { identifier: 'student1@vitstudent.ac.in', password: 'nope1234' } });
  assert.equal(b.status, 401);
});

test('reporting requires login and a valid campus venue', async () => {
  const anon = await call('POST', '/items', { body: foundItem });
  assert.equal(anon.status, 401);
  const bad = await call('POST', '/items', { token: finder.token, body: { ...foundItem, venue: 'Bangalore' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.error.fields.venue);
  const phone = await call('POST', '/items', {
    token: finder.token,
    body: { ...foundItem, description: 'Call me on 98765 43210 to collect it.' },
  });
  assert.equal(phone.status, 400);
  assert.ok(phone.data.error.fields.description.includes('phone numbers'));
});

test('public listings mask the finder’s reg no, email and phone', async () => {
  const r = await call('POST', '/items', { token: finder.token, body: foundItem });
  assert.equal(r.status, 201);
  itemId = r.data.item.id;

  const list = await call('GET', '/items?type=found');
  assert.equal(list.status, 200);
  assert.equal(list.data.counts.found, 1);
  const raw = JSON.stringify(list.data);
  assert.ok(!raw.includes('24BCE1001'), 'reg no leaked');
  assert.ok(!raw.includes('student1@'), 'email leaked');
  assert.ok(!raw.includes('9876543201'), 'phone leaked');
  assert.ok(!raw.includes('Rohan, CSE'), 'private answer leaked');
  assert.equal(list.data.items[0].postedBy.regNo, '24•••••01');

  const asOwner = await call('GET', `/items/${itemId}`, { token: finder.token });
  assert.equal(asOwner.data.item.privateAnswer, 'Rohan, CSE');
});

test('board filters by venue group, category and search', async () => {
  const g = await call('GET', `/items?type=found&group=${encodeURIComponent('Academic Blocks')}`);
  assert.equal(g.data.total, 1);
  const c = await call('GET', '/items?type=found&category=Wallets');
  assert.equal(c.data.total, 0);
  const q = await call('GET', '/items?type=found&q=lift');
  assert.equal(q.data.total, 1);
});

test('claim workflow: finder cannot claim own item, claimant cannot see finder identity', async () => {
  const own = await call('POST', `/items/${itemId}/claims`, { token: finder.token, body: { answer: 'mine' } });
  assert.equal(own.status, 403);

  const c = await call('POST', `/items/${itemId}/claims`, {
    token: owner.token,
    body: { answer: 'Rohan, B.Tech CSE', note: 'Lost it on Monday.' },
  });
  assert.equal(c.status, 201);
  claimId = c.data.claim.id;

  const again = await call('POST', `/items/${itemId}/claims`, { token: owner.token, body: { answer: 'again' } });
  assert.equal(again.status, 409);

  const wrong = await call('POST', `/items/${itemId}/claims`, { token: other.token, body: { answer: 'Some guess' } });
  assert.equal(wrong.status, 201);

  // Only the finder can see the review list.
  const peek = await call('GET', `/items/${itemId}/claims`, { token: owner.token });
  assert.equal(peek.status, 403);
  const review = await call('GET', `/items/${itemId}/claims`, { token: finder.token });
  assert.equal(review.data.claims.length, 2);
  assert.ok(!JSON.stringify(review.data).includes('24BCE1002'));

  const thread = await call('GET', `/claims/${claimId}`, { token: owner.token });
  assert.equal(thread.status, 200);
  assert.equal(thread.data.role, 'claimant');
  assert.ok(!JSON.stringify(thread.data).includes('student1@'));
});

test('approve opens a private handoff; others cannot approve or read it', async () => {
  const outsider = await call('GET', `/claims/${claimId}`, { token: (await register(4)).token });
  assert.equal(outsider.status, 403);

  const notOwner = await call('POST', `/claims/${claimId}/approve`, { token: owner.token });
  assert.equal(notOwner.status, 403);

  const ok = await call('POST', `/claims/${claimId}/approve`, { token: finder.token });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.claim.status, 'approved');
  assert.equal(ok.data.item.status, 'in_handoff');

  const late = await call('POST', `/items/${itemId}/claims`, { token: (await register(5)).token, body: { answer: 'x y' } });
  assert.equal(late.status, 409);
});

test('handoff thread: messages, contact blocking, meetup propose/confirm', async () => {
  const m = await call('POST', `/claims/${claimId}/messages`, { token: owner.token, body: { body: 'Thanks! When can we meet?' } });
  assert.equal(m.status, 201);
  const leak = await call('POST', `/claims/${claimId}/messages`, { token: owner.token, body: { body: 'my number is 9876543210' } });
  assert.equal(leak.status, 400);

  const time = new Date(Date.now() + 86400000).toISOString();
  const bad = await call('POST', `/claims/${claimId}/meetup`, { token: finder.token, body: { checkpoint: 'My room', time } });
  assert.equal(bad.status, 400);
  const p = await call('POST', `/claims/${claimId}/meetup`, {
    token: finder.token,
    body: { checkpoint: 'SJT Ground Floor Reception', time },
  });
  assert.equal(p.status, 200);
  const selfConfirm = await call('POST', `/claims/${claimId}/meetup/confirm`, { token: finder.token });
  assert.equal(selfConfirm.status, 403);
  const conf = await call('POST', `/claims/${claimId}/meetup/confirm`, { token: owner.token });
  assert.equal(conf.status, 200);
  assert.equal(conf.data.claim.meetup.confirmed, true);
});

test('either party can resolve; item leaves the active board', async () => {
  const r = await call('POST', `/items/${itemId}/resolve`, { token: owner.token });
  assert.equal(r.status, 200);
  assert.equal(r.data.item.status, 'resolved');
  const list = await call('GET', '/items?type=found');
  assert.equal(list.data.total, 0);
  const t = await call('GET', `/claims/${claimId}`, { token: finder.token });
  assert.equal(t.data.claim.status, 'completed');
  assert.equal(t.data.canMessage, false);
  const mine = await call('GET', '/me/claims', { token: other.token });
  assert.equal(mine.data.claims[0].status, 'rejected');
});

test('unknown routes and bad JSON return clear errors', async () => {
  const r = await call('GET', '/nope');
  assert.equal(r.status, 404);
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{bad',
  });
  assert.equal(res.status, 400);
});
