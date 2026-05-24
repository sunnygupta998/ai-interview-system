import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../../api/api';
import { FiUsers, FiFileText, FiAward, FiCheckCircle, FiSettings } from 'react-icons/fi';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentResults, setRecentResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await adminAPI.getDashboard();
        setStats(res.data.stats);
        setRecentResults(res.data.recent_results);
      } catch (err) {
        console.error("Error loading dashboard statistics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner"></div>
        <p>Loading Recruiter Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container animate-fade">
      <div className="admin-hero">
        <div className="hero-text">
          <h1>Recruiter Administration</h1>
          <p>Monitor candidate performance, configure question counts and adjust grading parameters.</p>
        </div>
        <button onClick={() => navigate('/admin/settings')} className="btn btn-secondary">
          <FiSettings /> System Settings
        </button>
      </div>

      {/* Stats Cards Row */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card glass-card">
            <div className="stat-icon-wrapper icon-blue">
              <FiUsers />
            </div>
            <div className="stat-details">
              <span className="stat-label">Total Candidates</span>
              <span className="stat-number">{stats.total_candidates}</span>
            </div>
          </div>

          <div className="stat-card glass-card">
            <div className="stat-icon-wrapper icon-purple">
              <FiFileText />
            </div>
            <div className="stat-details">
              <span className="stat-label">Assessments Run</span>
              <span className="stat-number">{stats.total_tests}</span>
            </div>
          </div>

          <div className="stat-card glass-card">
            <div className="stat-icon-wrapper icon-orange">
              <FiAward />
            </div>
            <div className="stat-details">
              <span className="stat-label">Average Score</span>
              <span className="stat-number">{stats.avg_score}%</span>
            </div>
          </div>

          <div className="stat-card glass-card">
            <div className="stat-icon-wrapper icon-green">
              <FiCheckCircle />
            </div>
            <div className="stat-details">
              <span className="stat-label">Qualification Rate</span>
              <span className="stat-number">{stats.pass_rate}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Table */}
      <div className="recent-results-card glass-card">
        <div className="card-header">
          <h3>Recent Candidate Submissions</h3>
          <button onClick={() => navigate('/admin/results')} className="btn btn-secondary btn-sm">
            View All Results
          </button>
        </div>

        {recentResults.length > 0 ? (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Submission Date</th>
                  <th>Percentage</th>
                  <th>Verdict</th>
                  <th>AI Interview</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentResults.map((result) => (
                  <tr key={result.result_id} className="admin-table-row">
                    <td>
                      <span className="candidate-name">{result.candidate_name}</span>
                    </td>
                    <td>
                      {result.submitted_at 
                        ? new Date(result.submitted_at).toLocaleDateString() + ' ' + new Date(result.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'N/A'
                      }
                    </td>
                    <td>
                      <span className="score-percentage-bold">{result.percentage}%</span>
                    </td>
                    <td>
                      <span className={`badge ${result.passed ? 'badge-success' : 'badge-error'}`}>
                        {result.passed ? 'Passed' : 'Failed'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={`badge ${result.interview_decision === 'Selected' ? 'badge-success' : result.interview_decision === 'Not Selected' ? 'badge-error' : 'badge-warning'}`}>
                          {result.interview_decision || 'Pending'}
                        </span>
                        {(result.interview_decision === 'Selected' || result.interview_decision === 'Not Selected') && result.interview_score !== undefined && (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                            {result.interview_score}/100
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {/* Navigate to candidate detailed review */}
                      <button 
                        onClick={() => navigate(`/candidate/results/${result.test_id}`)}
                        className="btn btn-secondary btn-xs"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-results-callout">
            <p>No test results submitted yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
