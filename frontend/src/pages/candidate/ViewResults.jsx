import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { testAPI } from '../../api/api';
import ResultsChart from '../../components/ResultsChart';
import { FiArrowLeft, FiPrinter, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import './ViewResults.css';

const ViewResults = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await testAPI.getResults(id);
        setResults(res.data.results);
      } catch (err) {
        console.error(err);
        setError('Failed to retrieve test results or assessment is not completed yet.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="spinner-container" style={{ height: '80vh' }}>
        <div className="spinner"></div>
        <p>Loading Results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="view-results-error-container">
        <div className="error-card glass-card">
          <h3>Error Loading Results</h3>
          <p>{error}</p>
          <button onClick={() => navigate('/candidate/dashboard')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view-results-page-container">
      {/* Back Header */}
      <div className="results-header-actions">
        <button onClick={() => navigate('/candidate/dashboard')} className="btn btn-secondary btn-icon-only">
          <FiArrowLeft /> Back to Dashboard
        </button>
        
        <button onClick={handlePrint} className="btn btn-secondary btn-print">
          <FiPrinter /> Print Results
        </button>
      </div>

      <div className="results-content">
        {results?.proctoring?.tab_switches > 0 && (
          <div className="upload-alert error-alert animate-fade" style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid var(--error)' }}>
            <FiAlertCircle style={{ flexShrink: 0, fontSize: '1.5rem', color: 'var(--error)' }} />
            <div>
              <h4 style={{ color: 'var(--error)', margin: '0 0 0.5rem 0' }}>Proctoring Alert: Cheating Flag</h4>
              <p style={{ margin: 0 }}>This candidate switched away from the browser tab <strong>{results.proctoring.tab_switches} times</strong> during the assessment. This is a violation of the test integrity rules.</p>
            </div>
          </div>
        )}
        <ResultsChart results={results} />
      </div>

      {results?.percentage > 50 && (
        <div className="live-interview-prompt glass-card animate-fade" style={{ marginTop: '2rem', padding: '2rem', textAlign: 'center', background: 'rgba(0, 206, 201, 0.1)', border: '1px solid var(--accent)' }}>
          {results.interview_decision === 'Selected' || results.interview_decision === 'Not Selected' ? (
            <>
              <h2 style={{ color: results.interview_decision === 'Selected' ? 'var(--success)' : 'var(--error)', marginBottom: '1rem' }}>
                AI Interview Complete
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', borderTop: '3px solid var(--accent)' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Overall Score</p>
                  <h3 style={{ fontSize: '2.5rem', color: 'var(--accent)', margin: 0 }}>{results.interview_score}/100</h3>
                </div>
                <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Technical</p>
                  <h3 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', margin: 0 }}>{results.interview_technical_score || 0}/100</h3>
                </div>
                <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Communication</p>
                  <h3 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', margin: 0 }}>{results.interview_communication_score || 0}/100</h3>
                </div>
                <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Confidence</p>
                  <h3 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', margin: 0 }}>{results.interview_confidence_score || 0}/100</h3>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', textAlign: 'left', marginBottom: '2rem' }}>
                {results.interview_strengths && results.interview_strengths.length > 0 && (
                  <div style={{ background: 'rgba(0, 184, 148, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(0, 184, 148, 0.2)' }}>
                    <h4 style={{ color: 'var(--success)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Key Strengths
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                      {results.interview_strengths.map((str, idx) => (
                        <li key={idx} style={{ marginBottom: '0.5rem' }}>{str}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {results.interview_weaknesses && results.interview_weaknesses.length > 0 && (
                  <div style={{ background: 'rgba(255, 118, 117, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255, 118, 117, 0.2)' }}>
                    <h4 style={{ color: 'var(--error)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Areas for Improvement
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                      {results.interview_weaknesses.map((wk, idx) => (
                        <li key={idx} style={{ marginBottom: '0.5rem' }}>{wk}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                <div style={{ padding: '1rem 3rem', background: 'rgba(0,0,0,0.4)', borderRadius: '100px', display: 'inline-flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Final Decision:</span>
                  <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: results.interview_decision === 'Selected' ? 'var(--success)' : 'var(--error)' }}>
                    {results.interview_decision}
                  </span>
                </div>
              </div>
              {results.interview_feedback && (
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', textAlign: 'left', marginTop: '1rem' }}>
                  <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>AI Feedback</h4>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{results.interview_feedback}</p>
                </div>
              )}
              {results?.interview_proctoring?.tab_switches > 0 && (
                <div className="upload-alert error-alert animate-fade" style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--error)', textAlign: 'left' }}>
                  <FiAlertCircle style={{ flexShrink: 0, fontSize: '1.5rem', color: 'var(--error)' }} />
                  <div>
                    <h4 style={{ color: 'var(--error)', margin: '0 0 0.5rem 0' }}>Proctoring Alert: Cheating Flag</h4>
                    <p style={{ margin: 0, color: 'var(--text-primary)' }}>This candidate switched away from the browser tab <strong>{results.interview_proctoring.tab_switches} times</strong> during the Live AI Interview.</p>
                  </div>
                </div>
              )}
            </>
          ) : user?.role === 'admin' ? (
            <>
              <h2 style={{ color: 'var(--accent)', marginBottom: '1rem' }}>Candidate Qualified for Live AI Interview</h2>
              <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>This candidate scored high enough to qualify for the voice interview stage. The interview has not been completed yet.</p>
            </>
          ) : (
            <>
              <h2 style={{ color: 'var(--accent)', marginBottom: '1rem' }}>🎉 Congratulations! You qualified for the Live AI Interview</h2>
              <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>Based on your excellent score, you have been selected for the next round. This is a conversational voice interview with our AI recruiter. Ensure your camera and microphone are working.</p>
              <button 
                onClick={() => navigate(`/candidate/interview/${id}`)}
                className="btn btn-primary"
                style={{ fontSize: '1.2rem', padding: '1rem 2rem', background: 'var(--gradient-accent)', color: '#000', fontWeight: 'bold' }}
              >
                {results.interview_decision === 'Pending' ? 'Resume Live Interview' : 'Start Live Video Interview Now'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ViewResults;
