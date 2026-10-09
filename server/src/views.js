import { VENUE_TO_GROUP } from './constants.js';
import { publicPerson } from './privacy.js';

/** SELECT list joining an item with its (masked) reporter. */
export const ITEM_SELECT = `
  SELECT i.*, u.alias AS r_alias, u.reg_no AS r_reg_no, u.email AS r_email, u.phone AS r_phone
  FROM items i JOIN users u ON u.id = i.reporter_id`;

export function itemView(row, viewer = null, extras = {}) {
  const isOwner = !!viewer && viewer.id === row.reporter_id;
  const view = {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    category: row.category,
    venue: row.venue,
    venueGroup: VENUE_TO_GROUP[row.venue] || null,
    venueDetail: row.venue_detail,
    eventDate: row.event_date,
    verificationQuestion: row.verification_question,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    postedBy: publicPerson(row, 'r_'),
    isOwner,
    ...extras,
  };
  if (isOwner) view.privateAnswer = row.private_answer;
  return view;
}

export const claimantSelect = `
  SELECT c.*, u.alias AS c_alias, u.reg_no AS c_reg_no, u.email AS c_email, u.phone AS c_phone
  FROM claims c JOIN users u ON u.id = c.claimant_id`;

export const claimView = (c) => ({
  id: c.id,
  itemId: c.item_id,
  status: c.status,
  answer: c.answer,
  note: c.note,
  decisionNote: c.decision_note,
  createdAt: c.created_at,
  decidedAt: c.decided_at,
  meetup: c.meetup_checkpoint
    ? {
        checkpoint: c.meetup_checkpoint,
        time: c.meetup_time,
        proposedByMe: undefined,
        confirmed: !!c.meetup_confirmed,
      }
    : null,
  claimant: c.c_alias ? publicPerson(c, 'c_') : undefined,
});
