import { useId } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function Spinner({ label = 'Loading' }) {
  return <span className="spinner" role="progressbar" aria-label={label} />;
}

export function Button({ loading, children, variant = 'primary', className = '', ...rest }) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      disabled={loading || rest.disabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner label="Working" />}
      <span>{children}</span>
    </button>
  );
}

/** Label + control + hint + error, wired up for screen readers. */
export function Field({ label, hint, error, children, optional }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const control = children({
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined,
  });
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="optional"> (optional)</span>}
      </label>
      {control}
      {hint && !error && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="error-text" id={errId}>
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ error }) {
  if (!error) return null;
  return (
    <div className="form-error" role="alert">
      {error}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <svg className="empty-art" viewBox="0 0 120 80" aria-hidden="true">
        <path d="M38 10h70v60H38L18 52V28z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 5" strokeLinejoin="round" />
        <circle cx="36" cy="40" r="6" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M30 40C18 40 8 30 4 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="error-state" role="alert">
      <h3>Couldn’t load this</h3>
      <p>{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <Spinner />
      <span>Loading…</span>
    </div>
  );
}

/** Rubber-stamp style status mark. */
export function Stamp({ tone = 'navy', children, className = '' }) {
  return <span className={`stamp stamp-${tone} ${className}`}>{children}</span>;
}

export function StatusPill({ tone = 'neutral', children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return children;
}

export function BackLink({ to, children }) {
  return (
    <Link to={to} className="back-link">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </Link>
  );
}

/** Masked contact block shown on every public listing. */
export function MaskedIdentity({ person, role }) {
  return (
    <div className="masked">
      <div className="masked-head">
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <rect x="4" y="9" width="12" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M7 9V6.5a3 3 0 016 0V9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        <span>
          {role} <strong>{person.alias}</strong>
        </span>
      </div>
      <dl>
        <dt>Reg. no.</dt>
        <dd>{person.regNo}</dd>
        <dt>Email</dt>
        <dd>{person.email}</dd>
        <dt>Phone</dt>
        <dd>{person.phone || 'Not shared'}</dd>
      </dl>
      <p>Contact details stay hidden. Returns are arranged in a private thread after a claim is approved.</p>
    </div>
  );
}
