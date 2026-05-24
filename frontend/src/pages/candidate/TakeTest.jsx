import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { testAPI } from '../../api/api';
import TestInterface from '../../components/TestInterface';
import { FiClock, FiFileText, FiAlertCircle } from 'react-icons/fi';
import './TakeTest.css';

const TakeTest = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [testInfo, setTestInfo] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState('');

  // Fetch test details on mount to see status
  useEffect(() => {
    const fetchTestDetails = async () => {
      try {
        // We get basic details from our list of tests or by trying to start
        // To be safe, let's start the test endpoints
        const res = await testAPI.getMyTests();
        const currentTest = res.data.tests.find(t => t.test_id === id);
        
        if (!currentTest) {
          setError('Assessment not found.');
          setLoading(false);
          return;
        }

        if (currentTest.status === 'completed') {
          // If already completed, redirect directly to results
          navigate(`/candidate/results/${id}`, { replace: true });
          return;
        }

        setTestInfo(currentTest);
        
        // If it was already in_progress, automatically resume the test
        if (currentTest.status === 'in_progress') {
          handleStart();
        }
      } catch (err) {
        console.error(err);
        setError('Failed to retrieve test details.');
      } finally {
        setLoading(false);
      }
    };

    fetchTestDetails();
  }, [id, navigate]);

  const handleStart = async () => {
    setStarting(true);
    setError('');
    try {
      const res = await testAPI.start(id);
      setQuestions(res.data.questions);
      setStarted(true);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to start the assessment. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const handleSubmitAnswers = async (answers, proctoringData = {}) => {
    setLoading(true);
    setError('');
    try {
      const res = await testAPI.submit(id, answers, proctoringData);
      const resultId = res.data.result_id;
      // Navigate to results view
      navigate(`/candidate/results/${id}`, { replace: true });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to submit your answers. Please contact the administrator.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="spinner-container" style={{ height: '80vh' }}>
        <div className="spinner"></div>
        <p>Loading Assessment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="take-test-error-container">
        <div className="error-card glass-card animate-slide-up">
          <FiAlertCircle className="error-icon" />
          <h3>Error Loading Assessment</h3>
          <p>{error}</p>
          <button onClick={() => navigate('/candidate/dashboard')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Active test interface
  if (started && questions.length > 0) {
    return (
      <div className="take-test-active-container">
        <TestInterface 
          questions={questions}
          timeLimitMinutes={testInfo?.time_limit_minutes || 30}
          onSubmit={handleSubmitAnswers}
        />
      </div>
    );
  }

  // Pre-test instructions screen
  return (
    <div className="take-test-instructions-container animate-fade">
      <div className="instructions-card glass-card">
        <div className="instructions-header">
          <h1>Assessment Instructions</h1>
          <p>Please read the instructions carefully before starting the assessment.</p>
        </div>

        {/* Assessment Stats */}
        <div className="assessment-stats-row">
          <div className="a-stat">
            <FiFileText />
            <div className="a-stat-details">
              <span className="a-label">Resume Checked</span>
              <span className="a-value">{testInfo?.resume_filename}</span>
            </div>
          </div>
          <div className="a-stat">
            <FiClock />
            <div className="a-stat-details">
              <span className="a-label">Time Limit</span>
              <span className="a-value">{testInfo?.time_limit_minutes} Minutes</span>
            </div>
          </div>
        </div>

        {/* Rules List */}
        <div className="rules-section">
          <h3>Important Guidelines</h3>
          <ul className="rules-list">
            <li><strong>Single Attempt:</strong> You can only take this assessment once. Multiple attempts are disabled.</li>
            <li><strong>Configured Questions:</strong> The question set is dynamically synthesized by AI to match the skills extracted from your resume.</li>
            <li><strong>Timer Details:</strong> Once you start, the countdown timer cannot be paused. Closing the browser window will NOT stop the timer.</li>
            <li><strong>Auto-Submit:</strong> When the timer expires, your answers will be automatically graded as-is.</li>
            <li><strong>Integrity:</strong> Please complete this test individually without searching for answers or using external tools.</li>
          </ul>
        </div>

        <div className="instructions-actions">
          <button 
            onClick={() => navigate('/candidate/dashboard')} 
            className="btn btn-secondary"
            disabled={starting}
          >
            Cancel
          </button>
          <button 
            onClick={handleStart} 
            className="btn btn-accent btn-start-assessment"
            disabled={starting}
          >
            {starting ? <div className="spinner-small" style={{ borderTopColor: '#080710' }}></div> : 'Start Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TakeTest;
