import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { testAPI, resumeAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { FiUploadCloud, FiFileText, FiAward, FiArrowRight, FiPlay, FiTrash2, FiX } from 'react-icons/fi';
import SkillsRadar from '../../components/SkillsRadar';
import './Dashboard.css';

const CandidateDashboard = () => {
  const [tests, setTests] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedResume, setSelectedResume] = useState(null);
  const [generatingTest, setGeneratingTest] = useState(false);
  const [enablePracticeInterview, setEnablePracticeInterview] = useState(true);

  const handleGenerateTest = async (resumeId) => {
    setGeneratingTest(true);
    try {
      const res = await testAPI.generate(resumeId);
      const testId = res.data.test_id;
      navigate(`/candidate/test/${testId}`);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to generate assessment. You may have already generated a test for this resume.');
    } finally {
      setGeneratingTest(false);
    }
  };

  const handleDelete = async (resumeId) => {
    if (window.confirm('Are you sure you want to delete this resume?')) {
      try {
        await resumeAPI.delete(resumeId);
        setResumes(resumes.filter(r => r._id !== resumeId));
      } catch (err) {
        console.error("Error deleting resume:", err);
        alert("Failed to delete resume");
      }
    }
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [testsRes, resumesRes] = await Promise.all([
          testAPI.getMyTests(),
          resumeAPI.getMyResumes()
        ]);
        setTests(testsRes.data.tests);
        setResumes(resumesRes.data.resumes);
        if (resumesRes.data.enable_practice_interview !== undefined) {
          setEnablePracticeInterview(resumesRes.data.enable_practice_interview);
        }
      } catch (error) {
        console.error("Error loading dashboard details:", error);
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  const getCompletedTestsCount = () => tests.filter(t => t.status === 'completed').length;
  
  const getAverageScore = () => {
    const completed = tests.filter(t => t.status === 'completed' && t.results);
    if (completed.length === 0) return '0%';
    const totalPercentage = completed.reduce((sum, t) => sum + t.results.percentage, 0);
    return `${Math.round(totalPercentage / completed.length)}%`;
  };

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner"></div>
        <p>Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="candidate-dashboard-container animate-fade">
      {/* Welcome Hero */}
      <div className="dashboard-hero glass-card">
        <div className="hero-content">
          <h1>Hello, {user.name}!</h1>
          <p>Analyze your resume skills and complete your customized interview assessments.</p>
        </div>
        <div className="hero-actions">
          {enablePracticeInterview && resumes.length > 0 && (
            <button 
              onClick={() => {
                const latestResume = [...resumes].sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))[0];
                navigate(`/candidate/interview/practice/${latestResume._id}`);
              }}
              className="btn btn-primary hero-btn"
            >
              Practice AI Interview
            </button>
          )}
          <Link to="/candidate/upload" className="btn btn-secondary hero-btn">
            <FiUploadCloud /> Upload Resume
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-card glass-card">
          <div className="stat-icon-wrapper icon-blue">
            <FiFileText />
          </div>
          <div className="stat-details">
            <span className="stat-label">Uploaded Resumes</span>
            <span className="stat-number">{resumes.length}</span>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon-wrapper icon-purple">
            <FiPlay />
          </div>
          <div className="stat-details">
            <span className="stat-label">Tests Triggered</span>
            <span className="stat-number">{tests.length}</span>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon-wrapper icon-green">
            <FiAward />
          </div>
          <div className="stat-details">
            <span className="stat-label">Average Score</span>
            <span className="stat-number">{getAverageScore()}</span>
          </div>
        </div>
      </div>

      {/* Main layout splits: Resumes List & Assessments List */}
      <div className="dashboard-lists-layout">
        
        {/* Left column: Resumes */}
        <div className="dashboard-column glass-card">
          <div className="column-header">
            <h3>My Resumes</h3>
            <Link to="/candidate/upload" className="header-link">
              Upload <FiArrowRight />
            </Link>
          </div>
          
          {resumes.length > 0 ? (
            <div className="dashboard-list" >
              {resumes.map((res) => (
                <div key={res._id} className="list-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <FiFileText className="list-item-icon" style={{ marginTop: '4px' }} />
                  <div className="list-item-details" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div className="item-title">{res.filename}</div>
                      <div className="item-subtitle">
                        Domain: {res.skills_analysis?.domain || 'Software Development'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => handleGenerateTest(res._id)} 
                        className="btn btn-accent btn-sm"
                        disabled={generatingTest}
                      >
                        {generatingTest ? 'Loading...' : 'Generate Test'}
                      </button>
                      <button onClick={() => setSelectedResume(res)} className="btn btn-secondary btn-sm">
                        View Skills
                      </button>
                      <button onClick={() => handleDelete(res._id)} className="btn btn-secondary btn-sm" style={{ color: 'var(--error)', borderColor: 'var(--error)' }}>
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-list-callout">
              <p>No resumes uploaded yet.</p>
              <Link to="/candidate/upload" className="btn btn-secondary btn-sm">
                Upload First Resume
              </Link>
            </div>
          )}
        </div>

        {/* Right column: Tests */}
        <div className="dashboard-column glass-card">
          <div className="column-header">
            <h3>My Assessments</h3>
          </div>
          
          {tests.length > 0 ? (
            <div className="dashboard-list">
              {tests.map((test) => {
                const isCompleted = test.status === 'completed';
                const isInProgress = test.status === 'in_progress';
                
                return (
                  <div key={test.test_id} className="list-item">
                    <div className="list-item-details">
                      <span className="item-title">{test.resume_filename}</span>
                      <div className="item-sub-row">
                        <span className={`status-badge-inline status-${test.status}`}>
                          {test.status.replace('_', ' ')}
                        </span>
                        {isCompleted && test.results && (
                          <span className="score-badge-inline">
                            Score: {test.results.percentage}% ({test.results.passed ? 'Passed' : 'Failed'})
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {isCompleted ? (
                      <button 
                        onClick={() => navigate(`/candidate/results/${test.test_id}`)}
                        className="btn btn-secondary btn-sm"
                      >
                        View Results
                      </button>
                    ) : (
                      <button 
                        onClick={() => navigate(`/candidate/test/${test.test_id}`)}
                        className="btn btn-accent btn-sm"
                      >
                        {isInProgress ? 'Resume Test' : 'Start Test'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-list-callout">
              <p>No assessments generated yet.</p>
              <span className="empty-hint">Assessments will appear here once you upload a resume and click 'Generate Test'.</span>
            </div>
          )}
        </div>

      </div>

      {/* Skills Modal */}
      {selectedResume && (
        <div className="modal-overlay" onClick={() => setSelectedResume(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', padding: '2rem' }}>
            <button onClick={() => setSelectedResume(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>
              <FiX />
            </button>
            <h2 style={{ marginBottom: '1.5rem' }}>Resume Analysis: {selectedResume.filename}</h2>
            <SkillsRadar skillsAnalysis={selectedResume.skills_analysis} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateDashboard;
