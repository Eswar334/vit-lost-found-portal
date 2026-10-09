import { Link } from 'react-router-dom';
import { relativeDay } from '../format.js';
import { Stamp } from './ui.jsx';

/**
 * A listing drawn as a lost-property luggage tag. Found items use manila
 * stock; lost items use the pale blue "missing" slip.
 */
export function ItemTag({ item }) {
  const verb = item.type === 'found' ? 'Found' : 'Lost';
  return (
    <Link to={`/items/${item.id}`} className={`tag tag-${item.type}`}>
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
        <h3 className="tag-title">{item.title}</h3>
        <div className="tag-where">
          <PinIcon />
          <span>
            <strong>{item.venue}</strong>
            {item.venueDetail ? `, ${item.venueDetail}` : ''}
          </span>
        </div>
        <div className="tag-foot">
          <span>
            {verb} {relativeDay(item.eventDate)}
          </span>
          <span className="tag-by">by {item.postedBy.alias}</span>
        </div>
      </div>
      </div>
    </Link>
  );
}

export function TagSkeleton() {
  return (
    <div className="tag tag-skeleton" aria-hidden="true">
      <div className="tag-shape">
        <span className="tag-hole" />
        <div className="tag-body">
          <div className="sk sk-sm" />
          <div className="sk sk-lg" />
          <div className="sk sk-md" />
          <div className="sk sk-sm" />
        </div>
      </div>
    </div>
  );
}

export function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="pin">
      <path d="M8 15s5-4.6 5-8.5A5 5 0 003 6.5C3 10.4 8 15 8 15z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="6.5" r="1.8" fill="currentColor" />
    </svg>
  );
}
