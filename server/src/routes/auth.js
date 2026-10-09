import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth, selfView, signToken } from '../auth.js';
import { ah, conflict, unauthorized } from '../errors.js';
import { generateAlias } from '../privacy.js';
import { loginSchema, parse, registerSchema } from '../validation.js';
import { nowIso } from '../db.js';

export default function authRoutes(db) {
  const r = Router();

  r.post(
    '/register',
    ah(async (req, res) => {
      const data = parse(registerSchema, req.body);

      const clash = db
        .prepare('SELECT reg_no, email FROM users WHERE reg_no = ? OR email = ?')
        .get(data.regNo, data.email);
      if (clash) {
        const fields = {};
        if (clash.reg_no === data.regNo) fields.regNo = 'An account with this registration number already exists.';
        if (clash.email === data.email) fields.email = 'An account with this email already exists.';
        throw conflict('An account already exists. Try logging in instead.', fields);
      }

      const hash = await bcrypt.hash(data.password, 10);
      const isTaken = (a) => !!db.prepare('SELECT 1 FROM users WHERE alias = ?').get(a);
      const alias = generateAlias(isTaken);
      const info = db
        .prepare(
          `INSERT INTO users (name, reg_no, email, phone, password_hash, alias, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(data.name, data.regNo, data.email, data.phone, hash, alias, nowIso());

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json({ token: signToken(user.id), user: selfView(user) });
    }),
  );

  r.post(
    '/login',
    ah(async (req, res) => {
      const { identifier, password } = parse(loginSchema, req.body);
      const id = identifier.trim();
      const user = db
        .prepare('SELECT * FROM users WHERE email = ? OR reg_no = ?')
        .get(id.toLowerCase(), id.toUpperCase());
      const ok = user && (await bcrypt.compare(password, user.password_hash));
      if (!ok) throw unauthorized('Email/registration number or password is incorrect.');
      res.json({ token: signToken(user.id), user: selfView(user) });
    }),
  );

  r.get('/me', requireAuth, (req, res) => res.json({ user: selfView(req.user) }));

  return r;
}
