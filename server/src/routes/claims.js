import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { nowIso } from '../db.js';
import { conflict, forbidden, notFound } from '../errors.js';
import { claimView, ITEM_SELECT, itemView } from '../views.js';
import { meetupSchema, messageSchema, parse, rejectSchema } from '../validation.js';

const fmtTime = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function claimRoutes(db) {
  const r = Router();
  r.use(requireAuth);

  /** Load claim + item and work out the caller's role. */
  const load = (id, userId) => {
    const claimId = Number(id);
    const claim = Number.isInteger(claimId) ? db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId) : null;
    if (!claim) throw notFound('That claim doesn’t exist.');
    const item = db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(claim.item_id);
    if (!item) throw notFound('The item for this claim was removed.');
    const role =
      item.reporter_id === userId ? 'reporter' : claim.claimant_id === userId ? 'claimant' : null;
    if (!role) throw forbidden('This conversation is private to the reporter and the claimant.');
    return { claim, item, role };
  };

  const system = (claimId, body, at = nowIso()) =>
    db
      .prepare(`INSERT INTO messages (claim_id, sender_id, kind, body, created_at) VALUES (?, NULL, 'system', ?, ?)`)
      .run(claimId, body, at);

  const threadView = (claimId, user) => {
    const { claim, item, role } = load(claimId, user.id);
    const counterpartId = role === 'reporter' ? claim.claimant_id : item.reporter_id;
    const counterpart = db.prepare('SELECT alias FROM users WHERE id = ?').get(counterpartId);
    const messages = db
      .prepare(
        `SELECT m.id, m.kind, m.body, m.created_at, m.sender_id, u.alias
         FROM messages m LEFT JOIN users u ON u.id = m.sender_id
         WHERE m.claim_id = ? ORDER BY m.id`,
      )
      .all(claim.id)
      .map((m) => ({
        id: m.id,
        kind: m.kind,
        body: m.body,
        createdAt: m.created_at,
        mine: m.sender_id === user.id,
        sender: m.kind === 'system' ? null : m.alias,
      }));
    const view = claimView(claim);
    if (view.meetup) view.meetup.proposedByMe = claim.meetup_proposed_by === user.id;
    return {
      claim: view,
      item: itemView(item, user),
      role,
      counterpart: { alias: counterpart?.alias ?? 'Former student' },
      messages,
      canMessage: claim.status === 'approved',
    };
  };

  r.get('/:id', (req, res) => res.json(threadView(req.params.id, req.user)));

  // ---------- Reporter decisions ----------
  r.post('/:id/approve', (req, res) => {
    const { claim, item, role } = load(req.params.id, req.user.id);
    if (role !== 'reporter') throw forbidden('Only the person who posted the item can approve claims.');
    if (claim.status !== 'pending') throw conflict(`This claim is already ${claim.status}.`);
    if (item.status !== 'open') {
      throw conflict(
        item.status === 'resolved'
          ? 'This item is already resolved.'
          : 'You already approved another claim. Cancel that handoff before approving a different one.',
      );
    }
    const now = nowIso();
    db.transaction(() => {
      db.prepare(
        `UPDATE claims SET status = 'approved', decided_at = ?, updated_at = ? WHERE id = ?`,
      ).run(now, now, claim.id);
      db.prepare(`UPDATE items SET status = 'in_handoff', updated_at = ? WHERE id = ?`).run(now, item.id);
      system(
        claim.id,
        'Claim approved. Use this private thread to agree on a campus checkpoint and time. Contact details stay hidden.',
        now,
      );
    })();
    res.json(threadView(claim.id, req.user));
  });

  r.post('/:id/reject', (req, res) => {
    const { claim, role } = load(req.params.id, req.user.id);
    if (role !== 'reporter') throw forbidden('Only the person who posted the item can reject claims.');
    if (claim.status !== 'pending') throw conflict(`This claim is already ${claim.status}.`);
    const { reason } = parse(rejectSchema, req.body);
    const now = nowIso();
    db.prepare(
      `UPDATE claims SET status = 'rejected', decision_note = ?, decided_at = ?, updated_at = ? WHERE id = ?`,
    ).run(reason, now, now, claim.id);
    res.json({ claim: claimView(db.prepare('SELECT * FROM claims WHERE id = ?').get(claim.id)) });
  });

  // ---------- Claimant actions ----------
  r.post('/:id/withdraw', (req, res) => {
    const { claim, role } = load(req.params.id, req.user.id);
    if (role !== 'claimant') throw forbidden('Only the claimant can withdraw this claim.');
    if (claim.status !== 'pending') throw conflict('Only pending claims can be withdrawn.');
    const now = nowIso();
    db.prepare(`UPDATE claims SET status = 'withdrawn', updated_at = ? WHERE id = ?`).run(now, claim.id);
    res.json({ claim: claimView(db.prepare('SELECT * FROM claims WHERE id = ?').get(claim.id)) });
  });

  // ---------- Handoff (either party) ----------
  r.post('/:id/cancel', (req, res) => {
    const { claim, item } = load(req.params.id, req.user.id);
    if (claim.status !== 'approved') throw conflict('Only an active handoff can be cancelled.');
    const now = nowIso();
    db.transaction(() => {
      db.prepare(`UPDATE claims SET status = 'cancelled', updated_at = ? WHERE id = ?`).run(now, claim.id);
      db.prepare(`UPDATE items SET status = 'open', updated_at = ? WHERE id = ?`).run(now, item.id);
      system(claim.id, `${req.user.alias} cancelled the handoff. The item is back on the board.`, now);
    })();
    res.json(threadView(claim.id, req.user));
  });

  r.post('/:id/messages', (req, res) => {
    const { claim } = load(req.params.id, req.user.id);
    if (claim.status !== 'approved') throw conflict('Messaging is only open while a handoff is in progress.');
    const { body } = parse(messageSchema, req.body);
    db.prepare(
      `INSERT INTO messages (claim_id, sender_id, kind, body, created_at) VALUES (?, ?, 'text', ?, ?)`,
    ).run(claim.id, req.user.id, body, nowIso());
    res.status(201).json(threadView(claim.id, req.user));
  });

  r.post('/:id/meetup', (req, res) => {
    const { claim } = load(req.params.id, req.user.id);
    if (claim.status !== 'approved') throw conflict('Meetups can only be planned while a handoff is in progress.');
    const { checkpoint, time } = parse(meetupSchema, req.body);
    const iso = new Date(time).toISOString();
    const now = nowIso();
    db.transaction(() => {
      db.prepare(
        `UPDATE claims SET meetup_checkpoint = ?, meetup_time = ?, meetup_proposed_by = ?,
                meetup_confirmed = 0, updated_at = ? WHERE id = ?`,
      ).run(checkpoint, iso, req.user.id, now, claim.id);
      system(claim.id, `${req.user.alias} proposed meeting at ${checkpoint}, ${fmtTime(iso)}.`, now);
    })();
    res.json(threadView(claim.id, req.user));
  });

  r.post('/:id/meetup/confirm', (req, res) => {
    const { claim } = load(req.params.id, req.user.id);
    if (claim.status !== 'approved') throw conflict('This handoff is no longer active.');
    if (!claim.meetup_checkpoint) throw conflict('No meetup has been proposed yet.');
    if (claim.meetup_proposed_by === req.user.id) {
      throw forbidden('The other person needs to confirm the meetup you proposed.');
    }
    if (claim.meetup_confirmed) throw conflict('This meetup is already confirmed.');
    const now = nowIso();
    db.transaction(() => {
      db.prepare(`UPDATE claims SET meetup_confirmed = 1, updated_at = ? WHERE id = ?`).run(now, claim.id);
      system(
        claim.id,
        `${req.user.alias} confirmed: ${claim.meetup_checkpoint}, ${fmtTime(claim.meetup_time)}. Bring your VIT ID card.`,
        now,
      );
    })();
    res.json(threadView(claim.id, req.user));
  });

  return r;
}
