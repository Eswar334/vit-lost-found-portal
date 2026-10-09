import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { BackLink, Button, EmptyState, ErrorState, FormError, PageLoader, StatusPill } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { CLAIM_STATUS, timeAgo } from '../format.js';

const tone = { pending: 'amber', approved: 'green', completed: 'navy', rejected: 'red', withdrawn: 'neutral', cancelled: 'neutral' };

export default function ReviewClaimsPage() {
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading' });
  const [n, setN] = useState(0);

  useEffect(() => {
    api(`/items/${id}/claims`)
      .then((data) => setState({ status: 'ready', data }))
      .catch((error) => setState({ status: 'error', error }));
  }, [id, n]);

  if (state.status === 'loading') return <PageLoader />;
  if (state.status === 'error')
    return (
      <div className="narrow">
        <BackLink to="/dashboard">My dashboard</BackLink>
        <ErrorState error={state.error} onRetry={() => setN((x) => x + 1)} />
      </div>
    );

  const { item, claims } = state.data;
  const pending = claims.filter((c) => c.status === 'pending');
  const others = claims.filter((c) => c.status !== 'pending');
  const locked = item.status !== 'open';

  return (
    <div className="review">
      <BackLink to="/dashboard">My dashboard</BackLink>
      <h1>Review claims</h1>
      <p className="lede">
        <Link to={`/items/${item.id}`}>{item.title}</Link>, {item.venue}. Claimants can’t see who you are, and you only see
        their pseudonym.
      </p>

      <div className="compare">
        <div className="challenge">
          <span>Your question</span>
          <p>{item.verificationQuestion}</p>
        </div>
        <div className="private-note">
          <span>Your expected answer</span>
          <p>{item.privateAnswer || 'You didn’t save one. Compare answers against the item itself.'}</p>
        </div>
      </div>

      {locked && (
        <p className="note">
          {item.status === 'in_handoff'
            ? 'You’ve approved a claim for this item. Cancel that handoff first if you need to approve someone else.'
            : 'This item is resolved.'}
        </p>
      )}

      <h2 className="section-title">Waiting for your decision ({pending.length})</h2>
      {pending.length === 0 ? (
        <EmptyState title="No claims waiting">New claims will appear here. Nobody can see the item’s owner details until you approve them.</EmptyState>
      ) : (
        <ul className="claims">
          {pending.map((c) => (
            <ClaimCard key={c.id} claim={c} locked={locked} onChange={() => setN((x) => x + 1)} />
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <>
          <h2 className="section-title">Earlier decisions</h2>
          <ul className="claims">
            {others.map((c) => (
              <ClaimCard key={c.id} claim={c} locked />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ClaimCard({ claim, locked, onChange }) {
  const toast = useToast();
  const nav = useNavigate();
  const [busy, setBusy] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const approve = async () => {
    setBusy('approve');
    setError('');
    try {
      await api(`/claims/${claim.id}/approve`, { method: 'POST' });
      toast('Claim approved. Arrange the handoff in the private thread.');
      nav(`/handoff/${claim.id}`);
    } catch (e) {
      setError(e.message);
      setBusy('');
    }
  };

  const reject = async () => {
    setBusy('reject');
    setError('');
    try {
      await api(`/claims/${claim.id}/reject`, { method: 'POST', body: { reason: reason || null } });
      toast('Claim rejected.');
      onChange();
    } catch (e) {
      setError(e.fields?.reason || e.message);
      setBusy('');
    }
  };

  return (
    <li className="claim-card">
      <div className="claim-head">
        <strong>{claim.claimant.alias}</strong>
        <span className="muted">{timeAgo(claim.createdAt)}</span>
        <StatusPill tone={tone[claim.status]}>{CLAIM_STATUS[claim.status]}</StatusPill>
      </div>
      <blockquote className="answer">{claim.answer}</blockquote>
      {claim.note && <p className="claim-note">{claim.note}</p>}
      {claim.decisionNote && <p className="muted">Reason given: {claim.decisionNote}</p>}
      {['approved', 'completed', 'cancelled'].includes(claim.status) && (
        <Link to={`/handoff/${claim.id}`} className="link-btn">
          {claim.status === 'approved' ? 'Open handoff thread' : 'View thread'}
        </Link>
      )}
      <FormError error={error} />
      {claim.status === 'pending' && !locked && (
        rejecting ? (
          <div className="reject-box">
            <label htmlFor={`r-${claim.id}`}>Reason (optional, shown to the claimant)</label>
            <input
              id={`r-${claim.id}`}
              value={reason}
              maxLength={200}
              placeholder="e.g. The name on the card doesn’t match."
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="row">
              <Button variant="danger" loading={busy === 'reject'} onClick={reject}>
                Reject claim
              </Button>
              <Button variant="ghost" onClick={() => setRejecting(false)}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div className="row">
            <Button loading={busy === 'approve'} disabled={!!busy} onClick={approve}>
              Approve
            </Button>
            <Button variant="secondary" disabled={!!busy} onClick={() => setRejecting(true)}>
              Reject
            </Button>
          </div>
        )
      )}
    </li>
  );
}
