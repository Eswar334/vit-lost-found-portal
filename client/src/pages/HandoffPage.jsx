import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { BackLink, Button, ErrorState, Field, FormError, PageLoader, StatusPill } from '../components/ui.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { CLAIM_STATUS, dateTime, timeAgo } from '../format.js';

const POLL_MS = 5000;
const CONTACT_RE = /(?:\+?91[\s-]?)?(?:\d[\s-]?){10}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export default function HandoffPage() {
  const { claimId } = useParams();
  const [state, setState] = useState({ status: 'loading' });

  const load = useCallback(
    (quiet) =>
      api(`/claims/${claimId}`)
        .then((data) => setState({ status: 'ready', data }))
        .catch((error) => {
          if (!quiet) setState({ status: 'error', error });
        }),
    [claimId],
  );

  useEffect(() => {
    setState({ status: 'loading' });
    load(false);
  }, [load]);

  // Poll for new messages while the handoff is active.
  const active = state.data?.claim.status === 'approved';
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [active, load]);

  if (state.status === 'loading') return <PageLoader />;
  if (state.status === 'error')
    return (
      <div className="narrow">
        <BackLink to="/dashboard">My dashboard</BackLink>
        <ErrorState error={state.error} onRetry={() => load(false)} />
      </div>
    );

  const { claim, item, role, counterpart, messages, canMessage } = state.data;
  const setData = (data) => setState({ status: 'ready', data });

  return (
    <div className="handoff">
      <BackLink to={role === 'reporter' ? '/dashboard' : '/dashboard?tab=claims'}>My dashboard</BackLink>
      <div className="handoff-head">
        <div>
          <h1>Return of “{item.title}”</h1>
          <p className="muted">
            Private thread between you and <strong>{counterpart.alias}</strong>
            {role === 'reporter' ? ` (the ${item.type === 'found' ? 'owner' : 'finder'})` : ` (who posted the item)`}.
            Nobody else can read it.
          </p>
        </div>
        <StatusPill tone={claim.status === 'approved' ? 'green' : claim.status === 'completed' ? 'navy' : 'neutral'}>
          {claim.status === 'pending' ? 'Waiting for review' : CLAIM_STATUS[claim.status]}
        </StatusPill>
      </div>

      {claim.status === 'pending' && (
        <p className="note">This thread opens once the poster approves your answer.</p>
      )}

      <div className="handoff-grid">
        <section className="thread" aria-label="Messages">
          <Messages messages={messages} />
          {canMessage ? (
            <Composer claimId={claim.id} onSent={setData} />
          ) : (
            claim.status !== 'pending' && <p className="thread-closed">This thread is closed. Messages are kept for your records.</p>
          )}
        </section>

        <aside className="handoff-side">
          <MeetupPanel claim={claim} canEdit={canMessage} onChange={setData} />
          {canMessage && <LifecyclePanel claim={claim} item={item} onChange={setData} />}
          {claim.status === 'completed' && (
            <div className="panel panel-success">
              <h2>Returned</h2>
              <p>This item is resolved and has been taken off the campus board.</p>
              <Link to="/" className="btn btn-secondary btn-block">
                Back to the board
              </Link>
            </div>
          )}
          <div className="panel safety">
            <h2>Staying safe</h2>
            <ul>
              <li>Meet only at a staffed checkpoint during the day.</li>
              <li>Check the owner’s VIT ID card before handing over.</li>
              <li>Phone numbers and emails are blocked in this chat. You don’t need them.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Messages({ messages }) {
  const end = useRef(null);
  const count = messages.length;
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [count]);

  if (!messages.length) return <p className="muted thread-empty">No messages yet.</p>;
  return (
    <ol className="messages">
      {messages.map((m) =>
        m.kind === 'system' ? (
          <li key={m.id} className="msg-system">
            <span>{m.body}</span>
            <time dateTime={m.createdAt}>{timeAgo(m.createdAt)}</time>
          </li>
        ) : (
          <li key={m.id} className={`msg ${m.mine ? 'msg-mine' : 'msg-theirs'}`}>
            <div className="msg-meta">
              {m.mine ? 'You' : m.sender} <time dateTime={m.createdAt}>{timeAgo(m.createdAt)}</time>
            </div>
            <div className="msg-body">{m.body}</div>
          </li>
        ),
      )}
      <li ref={end} aria-hidden="true" />
    </ol>
  );
}

function Composer({ claimId, onSent }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return setError('Type a message first.');
    if (CONTACT_RE.test(text)) return setError('Phone numbers and email addresses can’t be shared here. Agree on a checkpoint instead.');
    setBusy(true);
    setError('');
    try {
      const data = await api(`/claims/${claimId}/messages`, { method: 'POST', body: { body: text } });
      setBody('');
      onSent(data);
    } catch (err) {
      setError(err.fields?.body || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="composer" onSubmit={send} noValidate>
      <label htmlFor="msg" className="sr-only">
        Message
      </label>
      <textarea
        id="msg"
        rows={2}
        maxLength={1000}
        value={body}
        aria-invalid={error ? true : undefined}
        placeholder="Write a message…"
        onChange={(e) => {
          setBody(e.target.value);
          if (error) setError('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) send(e);
        }}
      />
      <Button type="submit" loading={busy}>
        Send
      </Button>
      {error && <p className="error-text composer-error">{error}</p>}
    </form>
  );
}

const toLocalInput = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

function MeetupPanel({ claim, canEdit, onChange }) {
  const { meta } = useMeta();
  const toast = useToast();
  const m = claim.meetup;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ checkpoint: '', time: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const startEdit = () => {
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(12, 0, 0, 0);
    setForm({ checkpoint: m?.checkpoint || meta?.checkpoints[0] || '', time: toLocalInput(m?.time || tomorrow) });
    setErrors({});
    setError('');
    setEditing(true);
  };

  const propose = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.checkpoint) errs.checkpoint = 'Choose a checkpoint.';
    if (!form.time) errs.time = 'Pick a date and time.';
    else if (new Date(form.time) < new Date()) errs.time = 'Pick a time in the future.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy('propose');
    try {
      const data = await api(`/claims/${claim.id}/meetup`, {
        method: 'POST',
        body: { checkpoint: form.checkpoint, time: new Date(form.time).toISOString() },
      });
      setEditing(false);
      toast('Meetup proposed.');
      onChange(data);
    } catch (err) {
      setErrors(err.fields || {});
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const confirm = async () => {
    setBusy('confirm');
    setError('');
    try {
      const data = await api(`/claims/${claim.id}/meetup/confirm`, { method: 'POST' });
      toast('Meetup confirmed.');
      onChange(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="panel meetup">
      <h2>Meetup checkpoint</h2>
      {m && !editing && (
        <div className={`meetup-card ${m.confirmed ? 'confirmed' : ''}`}>
          <div className="meetup-place">{m.checkpoint}</div>
          <div className="meetup-time">{dateTime(m.time)}</div>
          <div className="meetup-state">
            {m.confirmed ? 'Confirmed by both of you' : m.proposedByMe ? 'Waiting for them to confirm' : 'They proposed this'}
          </div>
        </div>
      )}
      {!m && !editing && <p className="muted">No meetup planned yet. Pick a staffed checkpoint and a time.</p>}
      <FormError error={error} />
      {canEdit && !editing && (
        <div className="stack">
          {m && !m.confirmed && !m.proposedByMe && (
            <Button loading={busy === 'confirm'} className="btn-block" onClick={confirm}>
              Confirm this meetup
            </Button>
          )}
          <Button variant={m ? 'secondary' : 'primary'} className="btn-block" onClick={startEdit}>
            {m ? 'Suggest a different time or place' : 'Propose a meetup'}
          </Button>
        </div>
      )}
      {editing && (
        <form onSubmit={propose} noValidate>
          <Field label="Checkpoint" error={errors.checkpoint}>
            {(p) => (
              <select {...p} value={form.checkpoint} onChange={(e) => setForm({ ...form, checkpoint: e.target.value })}>
                {meta?.checkpoints.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Date and time" error={errors.time}>
            {(p) => (
              <input
                {...p}
                type="datetime-local"
                min={toLocalInput(new Date())}
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            )}
          </Field>
          <div className="row">
            <Button type="submit" loading={busy === 'propose'}>
              Propose meetup
            </Button>
            <Button variant="ghost" type="button" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function LifecyclePanel({ claim, item, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState('');

  const resolve = async () => {
    setBusy('resolve');
    setError('');
    try {
      await api(`/items/${item.id}/resolve`, { method: 'POST' });
      toast('Marked as returned. The item is off the board.');
      onChange(await api(`/claims/${claim.id}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const cancel = async () => {
    setBusy('cancel');
    setError('');
    try {
      const data = await api(`/claims/${claim.id}/cancel`, { method: 'POST' });
      toast('Handoff cancelled. The item is back on the board.');
      onChange(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="panel">
      <h2>After the handoff</h2>
      <p className="muted">Once the item is back with its owner, either of you can close the case.</p>
      <FormError error={error} />
      <div className="stack">
        <Button loading={busy === 'resolve'} className="btn-block" onClick={resolve}>
          Mark as returned
        </Button>
        {confirmCancel ? (
          <div className="confirm">
            <p>Cancel this handoff? The item goes back on the board for other claims.</p>
            <div className="row">
              <Button variant="danger" loading={busy === 'cancel'} onClick={cancel}>
                Cancel handoff
              </Button>
              <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <button className="link-btn danger" onClick={() => setConfirmCancel(true)}>
            The handoff isn’t going to happen
          </button>
        )}
      </div>
    </div>
  );
}
