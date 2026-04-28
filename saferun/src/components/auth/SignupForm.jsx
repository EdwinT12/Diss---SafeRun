import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export default function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  // Live mismatch feedback so the user notices before they hit submit
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, displayName);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <h2 className="text-2xl font-bold text-brand mb-1">Create your account</h2>
      <p className="text-sm text-text-secondary mb-8">Start generating safer running routes</p>

      <div className="bg-accent/5 border border-accent/20 text-brand px-4 py-3 mb-6 text-xs leading-relaxed">
        SafeRun uses publicly available data to suggest safer running routes. Routes are
        suggestions only and do not guarantee safety. Always use your own judgement.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mb-5 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="displayName" className="block text-xs font-semibold text-brand mb-1.5 uppercase tracking-wider">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input-field"
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-brand mb-1.5 uppercase tracking-wider">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-brand mb-1.5 uppercase tracking-wider">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-semibold text-brand mb-1.5 uppercase tracking-wider">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`input-field ${passwordsMismatch ? 'border-red-400 focus:border-red-500' : ''}`}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            aria-invalid={passwordsMismatch}
          />
          {passwordsMismatch && (
            <p className="text-xs text-red-600 mt-1.5">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || passwordsMismatch}
          className="btn-primary w-full py-3 text-sm"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link to="/login" className="text-brand font-semibold hover:text-accent transition-colors duration-200">
          Log in
        </Link>
      </p>
    </div>
  );
}
