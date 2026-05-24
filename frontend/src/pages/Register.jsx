import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiUser, FiMail, FiLock, FiAlertCircle } from 'react-icons/fi';
import { GoogleLogin } from '@react-oauth/google';
import './Register.css';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('candidate');
  const [adminSecret, setAdminSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, googleLogin, user, token } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (token && user) {
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/candidate/dashboard');
      }
    }
  }, [token, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const registeredResponse = await register(name, email, password, role, adminSecret);
      if (registeredResponse.requires_verification) {
        navigate(`/verify-email?email=${encodeURIComponent(registeredResponse.email)}`);
      } else if (registeredResponse.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/candidate/dashboard');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Registration failed. Try a different email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card glass-card animate-slide-up">
        <div className="auth-header">
          <h2>Create Account</h2>
          <p>Join the AI-powered technical evaluation system</p>
        </div>

        {error && (
          <div className="upload-alert error-alert animate-fade" style={{ marginBottom: '20px' }}>
            <FiAlertCircle style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full Name</label>
            <div className="input-with-icon">
              <FiUser className="input-icon" />
              <input
                id="name"
                type="text"
                className="form-input"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div className="input-with-icon">
              <FiMail className="input-icon" />
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Register As</label>
            <div className="role-toggle-group">
              <button
                type="button"
                className={`role-toggle-btn ${role === 'candidate' ? 'active' : ''}`}
                onClick={() => setRole('candidate')}
                disabled={loading}
              >
                Candidate
              </button>
              <button
                type="button"
                className={`role-toggle-btn ${role === 'admin' ? 'active' : ''}`}
                onClick={() => setRole('admin')}
                disabled={loading}
              >
                Admin (Recruiter)
              </button>
            </div>
          </div>

          {role === 'admin' && (
            <div className="form-group animate-slide-up">
              <label className="form-label" htmlFor="adminSecret">Admin Registration Code</label>
              <div className="input-with-icon">
                <FiLock className="input-icon" />
                <input
                  id="adminSecret"
                  type="password"
                  className="form-input"
                  placeholder="Enter the secret code provided to admins"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  required={role === 'admin'}
                  disabled={loading}
                  style={{ borderColor: 'var(--warning)' }}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div className="input-with-icon">
              <FiLock className="input-icon" />
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <div className="input-with-icon">
              <FiLock className="input-icon" />
              <input
                id="confirmPassword"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-auth" 
            disabled={loading}
          >
            {loading ? <div className="spinner-small"></div> : 'Register'}
          </button>
        </form>

        <div style={{ margin: '24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          <span style={{ padding: '0 15px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              setLoading(true);
              try {
                const loggedInUser = await googleLogin(credentialResponse.credential, role);
                if (loggedInUser.role === 'admin') {
                  navigate('/admin/dashboard');
                } else {
                  navigate('/candidate/dashboard');
                }
              } catch (err) {
                console.error(err);
                setError(err.response?.data?.message || 'Google Registration failed.');
                setLoading(false);
              }
            }}
            onError={() => {
              setError('Google Registration Failed');
            }}
            useOneTap
            shape="rectangular"
            theme="filled_black"
            text="signup_with"
          />
        </div>

        <div className="auth-footer">
          <p>
            Already have an account? <Link to="/login">Login here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
