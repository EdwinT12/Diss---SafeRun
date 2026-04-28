import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/');
    setMobileOpen(false);
  }

  function isActive(path) {
    return location.pathname === path;
  }

  return (
    <nav className="bg-brand text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center">
            <span className="text-base font-bold tracking-tight">SAFERUN</span>
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink to="/" active={isActive('/')}>Home</NavLink>
            {user ? (
              <>
                <NavLink to="/dashboard" active={isActive('/dashboard')}>Dashboard</NavLink>
                <NavLink to="/history" active={isActive('/history')}>History</NavLink>
                <div className="ml-4 pl-4 border-l border-white/20 flex items-center gap-3">
                  <span className="text-xs text-white/60 font-medium">
                    {user.user_metadata?.display_name || user.email}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="text-xs text-white/60 hover:text-white bg-transparent border-none transition-colors duration-200"
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <>
                <NavLink to="/login" active={isActive('/login')}>Log in</NavLink>
                <Link
                  to="/signup"
                  className="ml-3 text-sm font-semibold bg-accent text-white px-5 py-2 hover:bg-accent-light transition-all duration-200"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-white/80 hover:text-white bg-transparent border-none"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 px-4 py-3 space-y-1">
          <MobileLink to="/" onClick={() => setMobileOpen(false)}>Home</MobileLink>
          {user ? (
            <>
              <MobileLink to="/dashboard" onClick={() => setMobileOpen(false)}>Dashboard</MobileLink>
              <MobileLink to="/history" onClick={() => setMobileOpen(false)}>History</MobileLink>
              <button onClick={handleSignOut} className="block w-full text-left text-sm text-white/60 py-2 bg-transparent border-none hover:text-white">
                Sign out
              </button>
            </>
          ) : (
            <>
              <MobileLink to="/login" onClick={() => setMobileOpen(false)}>Log in</MobileLink>
              <MobileLink to="/signup" onClick={() => setMobileOpen(false)}>Sign up</MobileLink>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`text-sm font-medium px-3 py-1.5 transition-colors duration-200 ${
        active ? 'text-accent' : 'text-white/70 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}

function MobileLink({ to, onClick, children }) {
  return (
    <Link to={to} onClick={onClick} className="block text-sm text-white/70 py-2 hover:text-white">
      {children}
    </Link>
  );
}
