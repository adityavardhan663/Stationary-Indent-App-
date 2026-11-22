import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, LogIn, Loader2, AlertCircle, Building2 } from 'lucide-react';

export default function LoginPage({ onLoginSuccess }) {
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedStaffId = staffId.trim().toUpperCase();
    if (!trimmedStaffId) {
      setError('Please enter your Staff ID.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: trimmedStaffId,
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid Staff ID or password. Please try again.');
      }

      if (!data.data?.token || !data.data?.user) {
        throw new Error('Authentication failed: Malformed server response.');
      }

      // Pass token and user object to parent handler
      onLoginSuccess({
        token: data.data.token,
        user: data.data.user
      });
    } catch (err) {
      setError(err.message || 'Unable to connect to the authentication service.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (id) => {
    setStaffId(id);
    setPassword('Password@123');
    setError('');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Institutional Branding Header */}
        <div className="login-header">
          <div className="login-icon-circle">
            <Building2 size={32} color="#1e40af" />
          </div>
          <h1 className="login-title">Stationery Indent Management System</h1>
          <p className="login-subtitle">Institutional Store & Inventory Access Portal</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="login-error-alert" role="alert">
            <AlertCircle size={18} className="login-error-icon" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="staffId" className="form-label">
              Staff ID / Employee Code
            </label>
            <div className="input-with-icon">
              <User size={18} className="field-icon" />
              <input
                id="staffId"
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value.toUpperCase())}
                placeholder="e.g. SK001, EMP001, HOD01, FAC101"
                autoComplete="username"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="input-with-icon">
              <Lock size={18} className="field-icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter account password"
                autoComplete="current-password"
                disabled={loading}
                required
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Authenticating Credentials...</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Sign In to System</span>
              </>
            )}
          </button>
        </form>

        {/* Institutional Demo Credentials Reference */}
        <div className="demo-credentials-box">
          <div className="demo-title">Institutional Demo Accounts:</div>
          <div className="demo-roles-grid">
            <button
              type="button"
              className="demo-pill"
              onClick={() => handleFillDemo('SK001')}
              title="Central Storekeeper"
            >
              <strong>SK001</strong> &bull; Storekeeper
            </button>
            <button
              type="button"
              className="demo-pill"
              onClick={() => handleFillDemo('EMP001')}
              title="System Administrator"
            >
              <strong>EMP001</strong> &bull; Admin
            </button>
            <button
              type="button"
              className="demo-pill"
              onClick={() => handleFillDemo('HOD01')}
              title="Department Head (CSE)"
            >
              <strong>HOD01</strong> &bull; HOD
            </button>
            <button
              type="button"
              className="demo-pill"
              onClick={() => handleFillDemo('FAC101')}
              title="Department Faculty"
            >
              <strong>FAC101</strong> &bull; Faculty
            </button>
          </div>
          <div className="demo-note">Click any account to pre-fill credentials (Password: <code>Password@123</code>).</div>
        </div>
      </div>
    </div>
  );
}
