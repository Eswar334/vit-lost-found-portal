// Loads demo students, listings, claims and a handoff thread so the app
// has something to show right away. Safe to re-run: it clears demo data first.
//   npm run db:seed
import bcrypt from 'bcryptjs';
import { config } from '../src/config.js';
import { openDatabase } from '../src/db.js';

const DEMO_PASSWORD = 'Password123';

const users = [
  { name: 'Aarav Menon', reg_no: '24BCE1001', email: 'aarav.menon2024@vitstudent.ac.in', phone: '9876500001', alias: 'Teal Heron 42' },
  { name: 'Diya Sharma', reg_no: '23BIT0457', email: 'diya.sharma2023@vitstudent.ac.in', phone: null, alias: 'Saffron Otter 17' },
  { name: 'Karthik Raja', reg_no: '22BEC0312', email: 'karthik.raja2022@vitstudent.ac.in', phone: '9123400002', alias: 'Quiet Falcon 63' },
  { name: 'Fathima Noor', reg_no: '24BCE2210', email: 'fathima.noor2024@vitstudent.ac.in', phone: null, alias: 'Jade Puffin 28' },
];

const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
// Tomorrow at a given IST wall-clock time, as ISO.
const tomorrowAt = (h, m) => {
  const ist = new Date(Date.now() + 5.5 * 3600000 + 86400000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), h, m) - 5.5 * 3600000).toISOString();
};
const ts = (offsetHours) => new Date(Date.now() - offsetHours * 3600000).toISOString();

// [reporterIndex, type, title, description, category, venue, venueDetail, daysAgo, question, privateAnswer]
const items = [
  [0, 'found', 'VIT ID card on a bench', 'Student ID card in a blue lanyard, found on the bench outside the lift. The photo is a bit faded.', 'ID Cards', 'SJT', 'Ground floor, near lift 3', 0, 'What name and branch are printed on the ID card?', 'Name starts with R, B.Tech CSE'],
  [1, 'found', 'Casio fx-991ES Plus calculator', 'Grey Casio scientific calculator left behind after the 2 pm slot. Has a small sticker on the back.', 'Calculators', 'TT', 'Room 412', 1, 'What is the sticker on the back of the calculator?', 'A small Doraemon sticker'],
  [2, 'found', 'Bunch of two keys with a red tag', 'Two room keys on a ring with a red plastic tag. Found near the cycle stand.', 'Room Keys', 'MH-K', 'Cycle stand', 1, 'What is written on the key tag?', 'K-612'],
  [3, 'found', 'Black wired earphones', 'Black wired earphones with a 3.5 mm jack, left on a reading table.', 'Earphones', 'Central Library', 'Second floor reading hall', 2, 'What brand are the earphones and what colour is the mic?', 'boAt, black mic'],
  [0, 'found', 'Brown leather wallet', 'Brown leather wallet found under a table. Cash and cards untouched.', 'Wallets', 'Food Mall', 'Near the juice counter', 3, 'What cards are inside and roughly how much cash?', 'SBI debit card, library card, about 300 rupees'],
  [1, 'found', 'Digital multimeter', 'Yellow digital multimeter left on a workbench after the evening lab.', 'Lab Equipment', 'SMV', 'Electronics lab, bench 6', 4, 'What is written or marked on the multimeter?', 'Initials scratched near the dial'],
  [2, 'found', 'TWS earbuds case (white)', 'White wireless earbuds charging case, no earbuds inside.', 'Earphones', 'Gazebo', 'Table near the entrance', 5, 'What brand is it and is there any mark on the case?', ''],
  [1, 'lost', 'Hostel room key with blue keychain', 'Lost my room key somewhere between the mess and my block. Blue rubber keychain shaped like a fish.', 'Room Keys', 'LH-D', 'Between the mess and the block entrance', 0, 'Where exactly did you find it, and what shape is the keychain?', 'Fish-shaped blue keychain'],
  [3, 'lost', 'Casio fx-82MS calculator', 'Lost my calculator during the CAT exam. My initials are written on the cover in silver marker.', 'Calculators', 'PRP', 'Exam hall 108', 1, 'What is written on the cover?', 'FN in silver marker'],
  [2, 'lost', 'VIT ID card', 'Dropped my ID card somewhere in the sports complex after evening practice.', 'ID Cards', 'Sports Complex', 'Basketball courts', 2, 'Which department is printed on the card?', 'ECE'],
  [0, 'lost', 'Black zip wallet', 'Small black zip wallet with my bus pass and a library card. Probably left it at DC during dinner.', 'Wallets', 'DC', '', 3, 'What is inside the wallet besides cards?', 'A bus pass'],
  [3, 'lost', 'Breadboard and jumper wire kit', 'Transparent box with a breadboard and jumper wires. Needed for my lab.', 'Lab Equipment', 'MB', 'Fourth floor lab corridor', 4, 'What colour is the box lid?', 'Green'],
  [1, 'lost', 'Sony wired earphones', 'White Sony earphones, lost during the evening library session.', 'Earphones', 'Central Library', 'Ground floor', 6, 'Where did you find them and what colour are they?', ''],
];

const db = openDatabase();

const run = db.transaction(() => {
  const emails = users.map((u) => u.email);
  const placeholders = emails.map(() => '?').join(',');
  db.prepare(`DELETE FROM users WHERE email IN (${placeholders})`).run(...emails);

  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const insertUser = db.prepare(
    `INSERT INTO users (name, reg_no, email, phone, password_hash, alias, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const userIds = users.map(
    (u) => insertUser.run(u.name, u.reg_no, u.email, u.phone, hash, u.alias, ts(24 * 14)).lastInsertRowid,
  );

  const insertItem = db.prepare(
    `INSERT INTO items (type, title, description, category, venue, venue_detail, event_date,
       verification_question, private_answer, reporter_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const itemIds = items.map(([r, type, title, desc, cat, venue, detail, ago, q, ans], i) => {
    const created = ts(ago * 24 + (items.length - i));
    return insertItem.run(type, title, desc, cat, venue, detail || null, day(ago), q, ans || null, userIds[r], created, created)
      .lastInsertRowid;
  });

  const insertClaim = db.prepare(
    `INSERT INTO claims (item_id, claimant_id, answer, note, status, decision_note, decided_at,
       meetup_checkpoint, meetup_time, meetup_proposed_by, meetup_confirmed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const msg = db.prepare(
    `INSERT INTO messages (claim_id, sender_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)`,
  );

  // 1. Two pending claims on Aarav's found ID card (one right, one wrong).
  insertClaim.run(itemIds[0], userIds[1], 'Rohan B, B.Tech CSE', 'It belongs to my roommate, he asked me to collect it.', 'pending', null, null, null, null, null, 0, ts(3), ts(3));
  insertClaim.run(itemIds[0], userIds[3], 'Not sure, it is a blue lanyard', null, 'pending', null, null, null, null, null, 0, ts(2), ts(2));

  // 2. Approved claim with an active handoff on Diya's found calculator.
  const handoff = insertClaim.run(
    itemIds[1], userIds[3], 'A small Doraemon sticker', 'I sat in the second row for the 2 pm class.',
    'approved', null, ts(20), 'TT Ground Floor Reception',
    tomorrowAt(12, 30), userIds[1], 0, ts(22), ts(20),
  ).lastInsertRowid;
  db.prepare(`UPDATE items SET status = 'in_handoff' WHERE id = ?`).run(itemIds[1]);
  msg.run(handoff, null, 'system', 'Claim approved. Use this private thread to agree on a campus checkpoint and time. Contact details stay hidden.', ts(20));
  msg.run(handoff, userIds[1], 'text', 'Hi! The sticker matches. When are you free tomorrow?', ts(19.5));
  msg.run(handoff, userIds[3], 'text', 'Thank you so much! Any time after 11 works for me.', ts(19));
  msg.run(handoff, null, 'system', 'Saffron Otter 17 proposed meeting at TT Ground Floor Reception.', ts(18.9));

  // 3. A rejected claim on Karthik's found keys.
  insertClaim.run(itemIds[2], userIds[0], 'MH-A 101', null, 'rejected', 'The tag shows a different room.', ts(10), null, null, null, 0, ts(12), ts(10));

  // 4. A fully resolved case (no longer on the board).
  const done = insertItem.run(
    'found', 'Blue water bottle ID tag', 'ID card found clipped to a water bottle near the courts.', 'ID Cards',
    'Sports Complex', 'Volleyball court', day(8), 'What name is on the card?', null, userIds[2], ts(24 * 8), ts(24 * 6),
  ).lastInsertRowid;
  db.prepare(`UPDATE items SET status = 'resolved', resolved_at = ?, resolved_by = ? WHERE id = ?`).run(ts(24 * 6), userIds[2], done);
  const doneClaim = insertClaim.run(done, userIds[0], 'Aarav Menon', null, 'completed', null, ts(24 * 7), 'Central Library Security Desk', ts(24 * 6), userIds[2], 1, ts(24 * 7.5), ts(24 * 6)).lastInsertRowid;
  msg.run(doneClaim, null, 'system', 'Quiet Falcon 63 marked this item as returned. Case closed.', ts(24 * 6));
});

run();
const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
console.log(`Seeded ${config.dbFile}`);
console.log(`  users: ${count('users')}, items: ${count('items')}, claims: ${count('claims')}, messages: ${count('messages')}`);
console.log(`\nDemo logins (password for all: ${DEMO_PASSWORD})`);
for (const u of users) console.log(`  ${u.email.padEnd(36)} ${u.reg_no}  shown as "${u.alias}"`);
db.close();
