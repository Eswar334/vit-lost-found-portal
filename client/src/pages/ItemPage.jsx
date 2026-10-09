import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { PinIcon } from '../components/ItemTag.jsx';
import {
  BackLink,
  Button,
  ErrorState,
  Field,
  FormError,
  MaskedIdentity,
  PageLoader,
  Stamp,
  StatusPill,
} from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { CLAIM_STATUS, relativeDay } from '../format.js';

export default function ItemPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState({ status: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setState({ status: 'loading' });
    api(`/items/${id}`)
      .then((d) => setState({ status: 'ready', item: d.item }))
      .catch((error) => setState({ status: 'error', error }));
  }, [id, user?.id, reload]);

  if (state.status === 'loading') return <PageLoader />;
  if (state.status === 'error')
    return (
      <div className="narrow">
        <BackLink to="/">Back to the board</BackLink>
        <ErrorState error={state.error} onRetry={state.error.status === 404 ? null : () => setReload((n) => n + 1)} />
      </div>
    );

  const { item } = state;
  const verb = item.type === 'found' ? 'Found' : 'Lost';

  return (
    <div className="item-page">
      <BackLink to={`/?type=${item.type}`}>{item.type === 'found' ? 'Found items' : 'Lost items'}</BackLink>

      <div className="item-layout">
        <article className={`tag tag-${item.type} tag-large`}>
          <div className="tag-shape">
          <span className="tag-hole" aria-hidden="true" />
          <div className="tag-body">
            {item.status === 'in_handoff' && (
              <Stamp tone="navy" className="tag-stamp-inline">
                Being returned
              </Stamp>
            )}
            {item.status === 'resolved' && (
              <Stamp tone="green" className="tag-stamp-inline">
                Returned
              </Stamp>
            )}
            <div className="tag-cat">{item.category}</div>
            <h1 className="tag-title">{item.title}</h1>
            <div className="tag-where">
              <PinIcon />
              <span>
                <strong>{item.venue}</strong>
                {item.venueGroup && !item.venue.includes(item.venueGroup.split(' ')[0]) ? ` (${item.venueGroup})` : ''}
                {item.venueDetail ? `, ${item.venueDetail}` : ''}
              </span>
            </div>
            <p className="item-desc">{item.description}</p>
            <div className="tag-foot">
              <span>
                {verb} {relativeDay(item.eventDate)} ({item.eventDate})
              </span>
            </div>
          </div>
          </div>
        </article>

        <aside className="item-side">
          <MaskedIdentity person={item.postedBy} role={item.type === 'found' ? 'Found by' : 'Posted by'} />
          <ActionPanel item={item} user={user} onChange={() => setReload((n) => n + 1)} />
        </aside>
      </div>
    </div>
  );
}

function ActionPanel({ item, user, onChange }) {
  const loc = useLocation();

  if (item.status === 'resolved') {
    return (
      <div className="panel">
        <h2>This item has been returned</h2>
        <p>It’s no longer on the active board.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="panel">
        <h2>{item.type === 'found' ? 'Is this yours?' : 'Have you found this?'}</h2>
        <p>Log in with your VIT account to answer the verification question.</p>
        <Link to="/login" state={{ from: loc.pathname }} className="btn btn-primary btn-block">
          Log in to respond
        </Link>
      </div>
    );
  }

  if (item.isOwner) return <OwnerPanel item={item} onChange={onChange} />;

  if (item.myClaim && ['pending', 'approved'].includes(item.myClaim.status)) {
    return (
      <div className="panel">
        <h2>Your response</h2>
        <p>
          <StatusPill tone={item.myClaim.status === 'approved' ? 'green' : 'amber'}>
            {CLAIM_STATUS[item.myClaim.status]}
          </StatusPill>
        </p>
        {item.myClaim.status === 'approved' ? (
          <Link to={`/handoff/${item.myClaim.id}`} className="btn btn-primary btn-block">
            Open handoff thread
          </Link>
        ) : (
          <p className="muted">You’ll see the decision on your dashboard as soon as it’s reviewed.</p>
        )}
      </div>
    );
  }

  if (item.status === 'in_handoff') {
    return (
      <div className="panel">
        <h2>A return is being arranged</h2>
        <p>Another student’s claim was approved. If the handoff falls through, the item will come back on the board.</p>
      </div>
    );
  }

  return <ClaimForm item={item} previous={item.myClaim} onDone={onChange} />;
}

function ClaimForm({ item, previous, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ answer: '', note: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const isFound = item.type === 'found';

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.answer.trim().length < 2) errs.answer = 'Answer the question so the poster can check it.';
    if (form.note.length > 500) errs.note = 'Keep this under 500 characters.';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      await api(`/items/${item.id}/claims`, { method: 'POST', body: { answer: form.answer, note: form.note || null } });
      setSent(true);
      toast(isFound ? 'Claim sent.' : 'Response sent.');
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="panel panel-success" role="status">
        <h2>{isFound ? 'Claim sent' : 'Response sent'}</h2>
        <p>
          {isFound
            ? 'The finder will compare your answer with what’s on the item. If it matches, a private handoff thread opens on your dashboard.'
            : 'The owner will check your answer. If they approve it, a private handoff thread opens on your dashboard.'}
        </p>
        <Link to="/dashboard?tab=claims" className="btn btn-secondary btn-block" onClick={onDone}>
          Track it on my dashboard
        </Link>
      </div>
    );
  }

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>{isFound ? 'Is this yours? Claim it' : 'Found it? Let the owner know'}</h2>
      <p className="muted">
        {isFound
          ? 'Answer the finder’s question. They can’t see who you are, and you can’t see who they are.'
          : 'Answer the owner’s question so they know you really have it.'}
      </p>
      {previous && ['rejected', 'withdrawn', 'cancelled'].includes(previous.status) && (
        <p className="note">Your earlier response was {CLAIM_STATUS[previous.status].toLowerCase()}. You can try once more.</p>
      )}
      <div className="challenge">
        <span>Verification question</span>
        <p>{item.verificationQuestion}</p>
      </div>
      <FormError error={formError} />
      <Field label="Your answer" error={errors.answer}>
        {(p) => (
          <input
            {...p}
            value={form.answer}
            maxLength={300}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
          />
        )}
      </Field>
      <Field
        label={isFound ? 'Anything else that proves it’s yours' : 'Where you found it'}
        optional
        hint="Don’t include phone numbers or emails. They’re blocked for your safety."
        error={errors.note}
      >
        {(p) => (
          <textarea
            {...p}
            rows={3}
            value={form.note}
            maxLength={500}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        )}
      </Field>
      <Button type="submit" loading={busy} className="btn-block">
        {isFound ? 'Send claim' : 'Send response'}
      </Button>
    </form>
  );
}

function OwnerPanel({ item, onChange }) {
  const toast = useToast();
  const nav = useNavigate();
  const [busy, setBusy] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const act = async (kind) => {
    setBusy(kind);
    setError('');
    try {
      if (kind === 'resolve') {
        await api(`/items/${item.id}/resolve`, { method: 'POST' });
        toast('Marked as resolved. It’s off the board now.');
        onChange();
      } else {
        await api(`/items/${item.id}`, { method: 'DELETE' });
        toast('Post removed.');
        nav('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="panel">
      <h2>You posted this</h2>
      {item.privateAnswer && (
        <div className="private-note">
          <span>Your private answer (only you see this)</span>
          <p>{item.privateAnswer}</p>
        </div>
      )}
      <FormError error={error} />
      <div className="stack">
        {item.approvedClaimId ? (
          <Link to={`/handoff/${item.approvedClaimId}`} className="btn btn-primary btn-block">
            Open handoff thread
          </Link>
        ) : (
          <Link to={`/my/items/${item.id}/claims`} className="btn btn-primary btn-block">
            Review claims{item.pendingClaims ? ` (${item.pendingClaims} waiting)` : ''}
          </Link>
        )}
        <Button variant="secondary" className="btn-block" loading={busy === 'resolve'} onClick={() => act('resolve')}>
          Mark as resolved
        </Button>
        {item.status === 'open' &&
          (confirmDelete ? (
            <div className="confirm">
              <p>Remove this post and all its claims?</p>
              <div className="row">
                <Button variant="danger" loading={busy === 'delete'} onClick={() => act('delete')}>
                  Remove post
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <button className="link-btn danger" onClick={() => setConfirmDelete(true)}>
              Remove this post
            </button>
          ))}
      </div>
    </div>
  );
}
