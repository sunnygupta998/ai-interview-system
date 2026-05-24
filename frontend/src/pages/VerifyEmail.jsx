import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const VerifyEmail = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyLogin } = useAuth();
  
  // Extract email from query params
  const queryParams = new URLSearchParams(location.search);
  const email = queryParams.get('email');

  useEffect(() => {
    if (!email) {
      navigate('/login');
    }
  }, [email, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      setLoading(false);
      return;
    }

    try {
      const res = await authAPI.verifyEmail(email, code);
      // Log the user in with the received token and user details
      verifyLogin(res.data.token, res.data.user);
      
      // Navigate to dashboard
      if (res.data.user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/candidate/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setError('');
    setResendSuccess('');
    
    try {
      const res = await authAPI.resendVerification(email);
      setResendSuccess(res.data.message || 'A new code has been sent.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="auth-page-container animate-fade">
      <div className="auth-card glass-card">
        <h2>Verify Your Email</h2>
        <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-secondary)' }}>
          We've sent a 6-digit verification code to <strong>{email}</strong>. Please enter it below to complete your registration.
        </p>
        
        {error && <div className="auth-error">{error}</div>}
        {resendSuccess && <div className="auth-error" style={{ background: 'rgba(0, 184, 148, 0.1)', color: 'var(--success)', borderLeft: '4px solid var(--success)' }}>{resendSuccess}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>6-Digit Verification Code</label>
            <input 
              type="text" 
              value={code} 
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              style={{ fontSize: '2rem', textAlign: 'center', letterSpacing: '0.5rem' }}
              required 
            />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>
        
        <div className="auth-footer" style={{ marginTop: '2rem' }}>
          <p>
            Didn't receive the code?{' '}
            <button 
              onClick={handleResend} 
              disabled={resendLoading} 
              style={{ background: 'none', border: 'none', color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
            >
              {resendLoading ? 'Sending...' : 'Resend Code'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
