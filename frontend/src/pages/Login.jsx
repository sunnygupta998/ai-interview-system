import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiAlertCircle } from 'react-icons/fi';
import { GoogleLogin } from '@react-oauth/google';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, googleLogin, user, token } = useAuth();
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
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/candidate/dashboard');
      }
    } catch (err) {
      console.error(err);
      if (err.response?.data?.requires_verification) {
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        setError(err.response?.data?.message || 'Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card glass-card animate-slide-up">
        <div className="auth-header">
          <h2>Welcome Back</h2>
          <p>Login to access your AI Interview portal</p>
        </div>

        {error && (
          <div className="upload-alert error-alert animate-fade" style={{ marginBottom: '20px' }}>
            <FiAlertCircle style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div className="input-with-icon">
              <FiMail className="input-icon" />
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

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

          <button 
            type="submit" 
            className="btn btn-primary btn-auth" 
            disabled={loading}
          >
            {loading ? <div className="spinner-small"></div> : 'Login'}
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
                const loggedInUser = await googleLogin(credentialResponse.credential);
                if (loggedInUser.role === 'admin') {
                  navigate('/admin/dashboard');
                } else {
                  navigate('/candidate/dashboard');
                }
              } catch (err) {
                console.error(err);
                setError(err.response?.data?.message || 'Google Login failed.');
                setLoading(false);
              }
            }}
            onError={() => {
              setError('Google Login Failed');
            }}
            useOneTap
            shape="rectangular"
            theme="filled_black"
            text="signin_with"
          />
        </div>

        <div className="auth-footer">
          <p>
            Don't have an account? <Link to="/register">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
