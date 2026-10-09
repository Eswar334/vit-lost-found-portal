import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Field, FormError } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const REG_RE = /^\d{2}[A-Z]{3}\d{4}$/;
const EMAIL_RE = /^[a-z0-9._%+-]+@(vitstudent\.ac\.in|vit\.ac\.in)$/i;
const PHONE_RE = /^[6-9]\d{9}$/;

export function LoginPage() {
  const { user, login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from || '/';
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.identifier.trim()) errs.identifier = 'Enter your VIT email or registration number.';
    if (!form.password) errs.password = 'Enter your password.';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const u = await login(form.identifier, form.password);
      toast(`Logged in as ${u.alias}.`);
      nav(from, { replace: true });
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <h1>Log in</h1>
      <p className="lede">Use your VIT student account to post items and respond to claims.</p>
      <form className="form-card" onSubmit={submit} noValidate>
        <FormError error={formError} />
        <Field label="VIT email or registration number" error={errors.identifier}>
          {(p) => (
            <input
              {...p}
              autoComplete="username"
              value={form.identifier}
              placeholder="24BCE2353"
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
            />
          )}
        </Field>
        <Field label="Password" error={errors.password}>
          {(p) => (
            <input
              {...p}
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          )}
        </Field>
        <Button type="submit" loading={busy} className="btn-block">
          Log in
        </Button>
        <p className="form-foot">
          New here? <Link to="/register" state={loc.state}>Create an account</Link>
        </p>
      </form>
    </div>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from || '/';
  const [form, setForm] = useState({ name: '', regNo: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Enter your full name.';
    if (!REG_RE.test(form.regNo.trim().toUpperCase())) e.regNo = 'Enter your VIT registration number, e.g. 24BCE2353.';
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Use your VIT email address (ending in @vitstudent.ac.in).';
    const phone = form.phone.replace(/[\s-]/g, '').replace(/^\+?91/, '');
    if (phone && !PHONE_RE.test(phone)) e.phone = 'Enter a 10-digit Indian mobile number, or leave it blank.';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
      e.password = 'Use at least 8 characters with a letter and a number.';
    if (form.confirm !== form.password) e.confirm = 'Passwords don’t match.';
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const errs = validate();
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setBusy(true);
    try {
      const { confirm: _c, ...body } = form;
      const u = await register({ ...body, phone: body.phone || null });
      toast(`Account created. Other students will see you as ${u.alias}.`);
      nav(from, { replace: true });
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <h1>Create your account</h1>
      <p className="lede">
        Only VIT students can post. You’ll get a random pseudonym, and that’s all other students ever see.
      </p>
      <form className="form-card" onSubmit={submit} noValidate>
        <FormError error={formError} />
        <Field label="Full name" error={errors.name}>
          {(p) => <input {...p} autoComplete="name" value={form.name} maxLength={80} onChange={set('name')} />}
        </Field>
        <div className="grid-2">
          <Field label="Registration number" error={errors.regNo}>
            {(p) => (
              <input
                {...p}
                value={form.regNo}
                placeholder="24BCE2353"
                maxLength={9}
                style={{ textTransform: 'uppercase' }}
                onChange={set('regNo')}
              />
            )}
          </Field>
          <Field label="Mobile number" optional hint="Kept private. Never shown to anyone." error={errors.phone}>
            {(p) => <input {...p} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />}
          </Field>
        </div>
        <Field label="VIT email" error={errors.email}>
          {(p) => (
            <input
              {...p}
              type="email"
              autoComplete="email"
              placeholder="firstname.lastname2024@vitstudent.ac.in"
              value={form.email}
              onChange={set('email')}
            />
          )}
        </Field>
        <div className="grid-2">
          <Field label="Password" hint="8+ characters, with a letter and a number." error={errors.password}>
            {(p) => <input {...p} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />}
          </Field>
          <Field label="Confirm password" error={errors.confirm}>
            {(p) => <input {...p} type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />}
          </Field>
        </div>
        <Button type="submit" loading={busy} className="btn-block">
          Create account
        </Button>
        <p className="form-foot">
          Already registered? <Link to="/login" state={loc.state}>Log in</Link>
        </p>
      </form>
    </div>
  );
}
