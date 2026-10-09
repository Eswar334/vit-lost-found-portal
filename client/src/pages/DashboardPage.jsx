import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { EmptyState, ErrorState, Spinner, StatusPill } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { CLAIM_STATUS, dateTime, ITEM_STATUS, relativeDay, timeAgo } from '../format.js';

const claimTone = { pending: 'amber', approved: 'green', completed: 'navy', rejected: 'red', withdrawn: 'neutral', cancelled: 'neutral' };
const itemTone = { open: 'neutral', in_handoff: 'green', resolved: 'navy' };

function useLoad(path) {
  const [state, setState] = useState({ status: 'loading' });
  const [n, setN] = useState(0);
  useEffect(() => {
    setState({ status: 'loading' });
    api(path)
      .then((data) => setState({ status: 'ready', data }))
      .catch((error) => setState({ status: 'error', error }));
  }, [path, n]);
  return [state, () => setN((x) => x + 1)];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'claims' ? 'claims' : 'posts';

  return (
    <div className="dashboard">
      <div className="dash-head">
        <div>
          <h1>My dashboard</h1>
          <p className="muted">
            Other students see you as <strong>{user.alias}</strong>. Your name ({user.name}), {user.regNo} and contact
            details are never shown.
          </p>
        </div>
        <Link to="/report" className="btn btn-primary">
          Report an item
        </Link>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'posts'} className={tab === 'posts' ? 'on' : ''} onClick={() => setParams({})}>
          My posts
        </button>
        <button
          role="tab"
          aria-selected={tab === 'claims'}
          className={tab === 'claims' ? 'on' : ''}
          onClick={() => setParams({ tab: 'claims' })}
        >
          My claims and responses
        </button>
      </div>

      {tab === 'posts' ? <MyPosts /> : <MyClaims />}
    </div>
  );
}

function MyPosts() {
  const [state, retry] = useLoad('/me/items');
  if (state.status === 'loading') return <ListLoading />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={retry} />;
  const { items } = state.data;
  if (!items.length)
    return (
      <EmptyState
        title="You haven’t posted anything yet"
        action={
          <Link to="/report" className="btn btn-primary">
            Report an item
          </Link>
        }
      >
        Found something on campus, or lost something? Post it and manage claims from here.
      </EmptyState>
    );

  return (
    <ul className="rows">
      {items.map((it) => (
        <li key={it.id} className={`row-card row-${it.type}`}>
          <div className="row-main">
            <div className="row-top">
              <span className={`type-dot type-dot-${it.type}`}>{it.type === 'found' ? 'Found' : 'Lost'}</span>
              <StatusPill tone={itemTone[it.status]}>{ITEM_STATUS[it.status]}</StatusPill>
            </div>
            <Link to={`/items/${it.id}`} className="row-title">
              {it.title}
            </Link>
            <p className="row-sub">
              {it.category}, {it.venue}. Posted {relativeDay(it.createdAt.slice(0, 10))}.
            </p>
          </div>
          <div className="row-actions">
            {it.status === 'in_handoff' && it.handoffClaimId ? (
              <Link to={`/handoff/${it.handoffClaimId}`} className="btn btn-primary">
                Open handoff
              </Link>
            ) : it.status === 'open' ? (
              <Link to={`/my/items/${it.id}/claims`} className={`btn ${it.pendingClaims ? 'btn-primary' : 'btn-secondary'}`}>
                {it.pendingClaims ? `Review ${it.pendingClaims} claim${it.pendingClaims > 1 ? 's' : ''}` : 'View claims'}
              </Link>
            ) : it.handoffClaimId ? (
              <Link to={`/handoff/${it.handoffClaimId}`} className="btn btn-ghost">
                View thread
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function MyClaims() {
  const [state, retry] = useLoad('/me/claims');
  if (state.status === 'loading') return <ListLoading />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={retry} />;
  const { claims } = state.data;
  if (!claims.length)
    return (
      <EmptyState
        title="No claims yet"
        action={
          <Link to="/" className="btn btn-primary">
            Browse found items
          </Link>
        }
      >
        When you claim a found item or tell someone you found their lost item, it shows up here.
      </EmptyState>
    );

  return (
    <ul className="rows">
      {claims.map((c) => (
        <li key={c.id} className={`row-card row-${c.item.type}`}>
          <div className="row-main">
            <div className="row-top">
              <span className={`type-dot type-dot-${c.item.type}`}>
                {c.item.type === 'found' ? 'Claim' : 'Found response'}
              </span>
              <StatusPill tone={claimTone[c.status]}>{CLAIM_STATUS[c.status]}</StatusPill>
            </div>
            <Link to={`/items/${c.item.id}`} className="row-title">
              {c.item.title}
            </Link>
            <p className="row-sub">
              Your answer: “{c.answer}”. Sent {timeAgo(c.createdAt)} to {c.item.postedBy.alias}.
            </p>
            {c.status === 'rejected' && c.decisionNote && <p className="row-note">Reason: {c.decisionNote}</p>}
            {c.meetup && c.status === 'approved' && (
              <p className="row-note">
                Meetup {c.meetup.confirmed ? 'confirmed' : 'proposed'}: {c.meetup.checkpoint}, {dateTime(c.meetup.time)}
              </p>
            )}
          </div>
          <div className="row-actions">
            {['approved', 'completed', 'cancelled'].includes(c.status) && (
              <Link to={`/handoff/${c.id}`} className={`btn ${c.status === 'approved' ? 'btn-primary' : 'btn-ghost'}`}>
                {c.status === 'approved' ? 'Open handoff' : 'View thread'}
              </Link>
            )}
            {c.status === 'pending' && <WithdrawButton id={c.id} onDone={retry} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

function WithdrawButton({ id, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="stack-sm">
      <button
        className="btn btn-ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/claims/${id}/withdraw`, { method: 'POST' });
            onDone();
          } catch (e) {
            setErr(e.message);
            setBusy(false);
          }
        }}
      >
        {busy ? 'Withdrawing…' : 'Withdraw'}
      </button>
      {err && <span className="error-text">{err}</span>}
    </div>
  );
}

function ListLoading() {
  return (
    <div className="page-loader">
      <Spinner />
      <span>Loading…</span>
    </div>
  );
}
