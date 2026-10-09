import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api.js';
import { ItemTag, TagSkeleton } from '../components/ItemTag.jsx';
import { Button, EmptyState, ErrorState } from '../components/ui.jsx';
import { useMeta } from '../context/MetaContext.jsx';

const PAGE_SIZE = 12;

export default function BoardPage() {
  const { meta } = useMeta();
  const [params, setParams] = useSearchParams();
  const type = params.get('type') === 'lost' ? 'lost' : 'found';
  const category = params.get('category') || '';
  const group = params.get('group') || '';
  const venue = params.get('venue') || '';
  const q = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [search, setSearch] = useState(q);
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [reload, setReload] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  // Debounce the search box into the URL.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== q) update({ q: search.trim() });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: null }));
    api(`/items${qs({ type, category, group, venue, q, page, pageSize: PAGE_SIZE })}`, { signal: ctrl.signal })
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', data: null, error });
      });
    return () => ctrl.abort();
  }, [type, category, group, venue, q, page, reload]);

  const counts = state.data?.counts;
  const groupVenues = meta?.venueGroups.find((g) => g.group === group)?.venues || [];
  const activeFilters = [category, group, venue, q].filter(Boolean).length;
  const totalPages = state.data ? Math.max(1, Math.ceil(state.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="board">
      <section className="board-intro">
        <h1>Lost something on campus? Found something that isn’t yours?</h1>
        <p>
          Every report here is from a signed-in VIT student. Owners prove an item is theirs by answering a question only
          they would know, and returns happen at staffed campus checkpoints.
        </p>
      </section>

      <div className="feed-switch" role="tablist" aria-label="Choose a feed">
        <button
          role="tab"
          aria-selected={type === 'found'}
          className={`feed-tab feed-found ${type === 'found' ? 'active' : ''}`}
          onClick={() => update({ type: 'found' })}
        >
          <span className="feed-name">Found on campus</span>
          <span className="feed-count">{counts ? counts.found : '–'}</span>
          <span className="feed-desc">Items students picked up. Is one of them yours?</span>
        </button>
        <button
          role="tab"
          aria-selected={type === 'lost'}
          className={`feed-tab feed-lost ${type === 'lost' ? 'active' : ''}`}
          onClick={() => update({ type: 'lost' })}
        >
          <span className="feed-name">Lost by students</span>
          <span className="feed-count">{counts ? counts.lost : '–'}</span>
          <span className="feed-desc">Things people are looking for. Seen one of them?</span>
        </button>
      </div>

      <div className="board-grid">
        <aside className={`filters ${filtersOpen ? 'open' : ''}`} aria-label="Filters">
          <button className="filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
            Filters{activeFilters ? ` (${activeFilters})` : ''}
          </button>
          <div className="filters-body">
            <div className="field">
              <label htmlFor="search">Search</label>
              <input
                id="search"
                type="search"
                placeholder="e.g. Casio, blue lanyard"
                value={search}
                maxLength={80}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <fieldset className="filter-set">
              <legend>Category</legend>
              <div className="chips">
                <button className={`chip ${!category ? 'on' : ''}`} onClick={() => update({ category: '' })}>
                  All
                </button>
                {meta?.categories.map((c) => (
                  <button key={c} className={`chip ${category === c ? 'on' : ''}`} onClick={() => update({ category: c })}>
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="field">
              <label htmlFor="group">Area</label>
              <select id="group" value={group} onChange={(e) => update({ group: e.target.value, venue: '' })}>
                <option value="">Whole campus</option>
                {meta?.venueGroups.map((g) => (
                  <option key={g.group} value={g.group}>
                    {g.group}
                  </option>
                ))}
              </select>
            </div>

            {groupVenues.length > 1 && (
              <fieldset className="filter-set">
                <legend>Block</legend>
                <div className="chips chips-tight">
                  <button className={`chip ${!venue ? 'on' : ''}`} onClick={() => update({ venue: '' })}>
                    Any
                  </button>
                  {groupVenues.map((v) => (
                    <button key={v} className={`chip ${venue === v ? 'on' : ''}`} onClick={() => update({ venue: v })}>
                      {v}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {activeFilters > 0 && (
              <button
                className="link-btn"
                onClick={() => {
                  setSearch('');
                  update({ category: '', group: '', venue: '', q: '' });
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </aside>

        <section className="feed" aria-live="polite" aria-busy={state.status === 'loading'}>
          {state.status === 'error' && <ErrorState error={state.error} onRetry={() => setReload((n) => n + 1)} />}

          {state.status === 'loading' && !state.data && (
            <div className="tags">
              {Array.from({ length: 6 }, (_, i) => (
                <TagSkeleton key={i} />
              ))}
            </div>
          )}

          {state.data && state.status !== 'error' && (
            <>
              <p className="feed-meta">
                {state.status === 'loading'
                  ? 'Updating…'
                  : `${state.data.total} ${type === 'found' ? 'found' : 'lost'} item${state.data.total === 1 ? '' : 's'}${
                      activeFilters ? ' match your filters' : ' open right now'
                    }`}
              </p>

              {state.data.items.length === 0 ? (
                <EmptyState
                  title={activeFilters ? 'Nothing matches these filters' : `No ${type} items reported yet`}
                  action={
                    activeFilters ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSearch('');
                          update({ category: '', group: '', venue: '', q: '' });
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : (
                      <Link to={`/report?type=${type}`} className="btn btn-primary">
                        Report a {type} item
                      </Link>
                    )
                  }
                >
                  {activeFilters
                    ? 'Try another block or category, or check the other feed.'
                    : type === 'found'
                      ? 'If you picked something up, post it so the owner can find it.'
                      : 'If you’ve lost something, post it so whoever finds it knows it’s yours.'}
                </EmptyState>
              ) : (
                <div className={`tags ${state.status === 'loading' ? 'is-stale' : ''}`}>
                  {state.data.items.map((item) => (
                    <ItemTag key={item.id} item={item} />
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <nav className="pager" aria-label="Pages">
                  <Button variant="secondary" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                    Previous
                  </Button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={page >= totalPages}
                    onClick={() => update({ page: String(page + 1) })}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
