import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { VENUE_GROUPS } from '../constants.js';
import { nowIso } from '../db.js';
import { ah, badRequest, conflict, forbidden, notFound } from '../errors.js';
import { claimantSelect, claimView, ITEM_SELECT, itemView } from '../views.js';
import { createClaimSchema, createItemSchema, listItemsSchema, parse } from '../validation.js';

const ACTIVE = `('open', 'in_handoff')`;
const escapeLike = (s) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export default function itemRoutes(db) {
  const r = Router();

  const getItem = (id) => {
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId < 1) throw notFound('That item doesn’t exist.');
    const row = db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(itemId);
    if (!row) throw notFound('That item doesn’t exist or was removed by the person who posted it.');
    return row;
  };

  // ---------- Public board ----------
  r.get('/', (req, res) => {
    const f = parse(listItemsSchema, req.query);

    const where = [`i.status IN ${ACTIVE}`];
    const params = [];
    if (f.category) {
      where.push('i.category = ?');
      params.push(f.category);
    }
    if (f.venue) {
      where.push('i.venue = ?');
      params.push(f.venue);
    } else if (f.group) {
      const g = VENUE_GROUPS.find((x) => x.group === f.group);
      if (!g) throw badRequest('Unknown venue group.', { group: 'Choose a listed venue group.' });
      where.push(`i.venue IN (${g.venues.map(() => '?').join(',')})`);
      params.push(...g.venues);
    }
    if (f.q) {
      const like = `%${escapeLike(f.q)}%`;
      where.push(`(i.title LIKE ? ESCAPE '\\' OR i.description LIKE ? ESCAPE '\\' OR i.venue_detail LIKE ? ESCAPE '\\')`);
      params.push(like, like, like);
    }
    const whereSql = where.join(' AND ');

    const counts = { lost: 0, found: 0 };
    for (const row of db
      .prepare(`SELECT i.type, COUNT(*) AS n FROM items i WHERE ${whereSql} GROUP BY i.type`)
      .all(...params)) {
      counts[row.type] = row.n;
    }

    const rows = db
      .prepare(
        `${ITEM_SELECT} WHERE ${whereSql} AND i.type = ?
         ORDER BY i.status = 'in_handoff', i.created_at DESC, i.id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, f.type, f.pageSize, (f.page - 1) * f.pageSize);

    res.json({
      items: rows.map((row) => itemView(row, req.user)),
      total: counts[f.type],
      page: f.page,
      pageSize: f.pageSize,
      counts,
    });
  });

  r.get('/:id', (req, res) => {
    const row = getItem(req.params.id);
    const extras = {};
    if (req.user) {
      const mine = db
        .prepare(
          `SELECT id, status FROM claims WHERE item_id = ? AND claimant_id = ?
           ORDER BY id DESC LIMIT 1`,
        )
        .get(row.id, req.user.id);
      extras.myClaim = mine || null;
      if (req.user.id === row.reporter_id) {
        extras.pendingClaims = db
          .prepare(`SELECT COUNT(*) AS n FROM claims WHERE item_id = ? AND status = 'pending'`)
          .get(row.id).n;
        const approved = db
          .prepare(`SELECT id FROM claims WHERE item_id = ? AND status = 'approved'`)
          .get(row.id);
        extras.approvedClaimId = approved?.id ?? null;
      }
    }
    res.json({ item: itemView(row, req.user, extras) });
  });

  // ---------- Reporting ----------
  r.post('/', requireAuth, (req, res) => {
    const d = parse(createItemSchema, req.body);
    const now = nowIso();
    const info = db
      .prepare(
        `INSERT INTO items (type, title, description, category, venue, venue_detail, event_date,
                            verification_question, private_answer, reporter_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        d.type, d.title, d.description, d.category, d.venue, d.venueDetail, d.eventDate,
        d.verificationQuestion, d.privateAnswer, req.user.id, now, now,
      );
    const row = getItem(info.lastInsertRowid);
    res.status(201).json({ item: itemView(row, req.user) });
  });

  r.delete('/:id', requireAuth, (req, res) => {
    const row = getItem(req.params.id);
    if (row.reporter_id !== req.user.id) throw forbidden('Only the person who posted this can remove it.');
    if (row.status === 'in_handoff') {
      throw conflict('A handoff is in progress. Cancel it or mark the item as resolved first.');
    }
    db.prepare('DELETE FROM items WHERE id = ?').run(row.id);
    res.json({ ok: true });
  });

  // ---------- Lifecycle ----------
  r.post('/:id/resolve', requireAuth, (req, res) => {
    const row = getItem(req.params.id);
    if (row.status === 'resolved') throw conflict('This item is already marked as resolved.');

    const approved = db
      .prepare(`SELECT * FROM claims WHERE item_id = ? AND status = 'approved'`)
      .get(row.id);
    const isOwner = row.reporter_id === req.user.id;
    const isApprovedClaimant = approved && approved.claimant_id === req.user.id;
    if (!isOwner && !isApprovedClaimant) {
      throw forbidden('Only the person who posted this item or the approved claimant can resolve it.');
    }

    const now = nowIso();
    db.transaction(() => {
      db.prepare(
        `UPDATE items SET status = 'resolved', resolved_at = ?, resolved_by = ?, updated_at = ? WHERE id = ?`,
      ).run(now, req.user.id, now, row.id);
      if (approved) {
        db.prepare(`UPDATE claims SET status = 'completed', updated_at = ? WHERE id = ?`).run(now, approved.id);
        db.prepare(
          `INSERT INTO messages (claim_id, sender_id, kind, body, created_at) VALUES (?, NULL, 'system', ?, ?)`,
        ).run(approved.id, `${req.user.alias} marked this item as returned. Case closed.`, now);
      }
      db.prepare(
        `UPDATE claims SET status = 'rejected', decision_note = 'Item was marked as resolved.',
                decided_at = ?, updated_at = ?
         WHERE item_id = ? AND status = 'pending'`,
      ).run(now, now, row.id);
    })();

    res.json({ item: itemView(getItem(row.id), req.user) });
  });

  // ---------- Claims on an item ----------
  r.get('/:id/claims', requireAuth, (req, res) => {
    const row = getItem(req.params.id);
    if (row.reporter_id !== req.user.id) throw forbidden('Only the person who posted this item can review its claims.');
    const claims = db
      .prepare(
        `${claimantSelect} WHERE c.item_id = ?
         ORDER BY CASE c.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, c.created_at DESC`,
      )
      .all(row.id)
      .map(claimView);
    res.json({ item: itemView(row, req.user), claims });
  });

  r.post('/:id/claims', requireAuth, (req, res) => {
    const row = getItem(req.params.id);
    if (row.reporter_id === req.user.id) throw forbidden('You can’t claim an item you posted yourself.');
    if (row.status === 'resolved') throw conflict('This item has already been returned to its owner.');
    if (row.status === 'in_handoff') {
      throw conflict('Another claim has already been approved for this item. Check back later if it falls through.');
    }
    const d = parse(createClaimSchema, req.body);

    const live = db
      .prepare(`SELECT id FROM claims WHERE item_id = ? AND claimant_id = ? AND status IN ('pending','approved')`)
      .get(row.id, req.user.id);
    if (live) throw conflict('You already have a claim on this item. Track it from your dashboard.');

    const rejectedCount = db
      .prepare(`SELECT COUNT(*) AS n FROM claims WHERE item_id = ? AND claimant_id = ? AND status = 'rejected'`)
      .get(row.id, req.user.id).n;
    if (rejectedCount >= 2) {
      throw forbidden('Your claims on this item were rejected twice, so you can’t submit another one.');
    }

    const now = nowIso();
    const info = db
      .prepare(
        `INSERT INTO claims (item_id, claimant_id, answer, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(row.id, req.user.id, d.answer, d.note, now, now);
    const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ claim: claimView(claim) });
  });

  return r;
}
