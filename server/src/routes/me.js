import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { ITEM_SELECT, itemView } from '../views.js';

export default function meRoutes(db) {
  const r = Router();
  r.use(requireAuth);

  // Items I reported, with claim counts for the review dashboard.
  r.get('/items', (req, res) => {
    const rows = db
      .prepare(
        `${ITEM_SELECT} WHERE i.reporter_id = ?
         ORDER BY CASE i.status WHEN 'in_handoff' THEN 0 WHEN 'open' THEN 1 ELSE 2 END, i.created_at DESC`,
      )
      .all(req.user.id);
    const countStmt = db.prepare(
      `SELECT
         SUM(status = 'pending')  AS pending,
         COUNT(*)                 AS total,
         MAX(CASE WHEN status IN ('approved','completed') THEN id END) AS handoff_id
       FROM claims WHERE item_id = ?`,
    );
    const items = rows.map((row) => {
      const c = countStmt.get(row.id);
      return itemView(row, req.user, {
        pendingClaims: c.pending || 0,
        totalClaims: c.total || 0,
        handoffClaimId: c.handoff_id ?? null,
      });
    });
    res.json({ items });
  });

  // Claims I submitted on other people's items.
  r.get('/claims', (req, res) => {
    const rows = db
      .prepare(
        `SELECT c.id, c.status, c.answer, c.note, c.decision_note, c.created_at, c.decided_at,
                c.meetup_checkpoint, c.meetup_time, c.meetup_confirmed,
                i.id AS item_id, i.type, i.title, i.category, i.venue, i.status AS item_status,
                u.alias AS reporter_alias
         FROM claims c
         JOIN items i ON i.id = c.item_id
         JOIN users u ON u.id = i.reporter_id
         WHERE c.claimant_id = ?
         ORDER BY CASE c.status WHEN 'approved' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, c.created_at DESC`,
      )
      .all(req.user.id);
    res.json({
      claims: rows.map((c) => ({
        id: c.id,
        status: c.status,
        answer: c.answer,
        note: c.note,
        decisionNote: c.decision_note,
        createdAt: c.created_at,
        decidedAt: c.decided_at,
        meetup: c.meetup_checkpoint
          ? { checkpoint: c.meetup_checkpoint, time: c.meetup_time, confirmed: !!c.meetup_confirmed }
          : null,
        item: {
          id: c.item_id,
          type: c.type,
          title: c.title,
          category: c.category,
          venue: c.venue,
          status: c.item_status,
          postedBy: { alias: c.reporter_alias },
        },
      })),
    });
  });

  return r;
}
