import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const signOut = () => {
    logout();
    setOpen(false);
    toast('Logged out.');
    nav('/');
  };

  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <header className="site-header">
        <div className="wrap header-row">
          <Link to="/" className="wordmark" onClick={() => setOpen(false)}>
            <img src="/tag.svg" alt="" width="28" height="28" />
            <span className="wm-text">
              <span className="wm-main">Lost &amp; Found</span>
              <span className="wm-sub">VIT Vellore campus</span>
            </span>
          </Link>
          <button
            className="menu-btn"
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen((o) => !o)}
          >
            Menu
          </button>
          <nav id="site-nav" className={`site-nav ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
            <NavLink to="/" end>
              Board
            </NavLink>
            {user && <NavLink to="/dashboard">My dashboard</NavLink>}
            {user ? (
              <>
                <span className="nav-user" title="This is how other students see you">
                  {user.alias}
                </span>
                <button className="link-btn" onClick={signOut}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Log in</NavLink>
                <NavLink to="/register">Sign up</NavLink>
              </>
            )}
            <Link to="/report" className="btn btn-primary nav-cta">
              Report an item
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" className="wrap main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <p>
            Hand over items only at staffed checkpoints such as the SJT Ground Floor Reception or the Central Library
            Security Desk. Never share your phone number to arrange a return.
          </p>
        </div>
      </footer>
    </>
  );
}
