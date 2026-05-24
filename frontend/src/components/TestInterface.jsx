import React, { useState, useEffect } from 'react';
import Timer from './Timer';
import { FiChevronLeft, FiChevronRight, FiCheckCircle } from 'react-icons/fi';
import './TestInterface.css';

const TestInterface = ({ questions, timeLimitMinutes, onSubmit }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (tabSwitches === 1 || tabSwitches === 2) {
      alert(`WARNING: You are not allowed to switch tabs during the assessment. This is strike ${tabSwitches} of 3. On the 3rd strike, your assessment will be instantly terminated.`);
    } else if (tabSwitches >= 3) {
      alert("You have switched tabs too many times. Your assessment is being terminated and a score of 0 will be recorded.");
      onSubmit(answers, { tab_switches: tabSwitches, cheating_detected: true });
    }
  }, [tabSwitches]);

  const handleSelectOption = (qId, optionKey) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: optionKey
    }));
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1);
    }
  };

  const handleQuestionClick = (idx) => {
    setCurrentIdx(idx);
  };

  const getAnsweredCount = () => {
    return Object.keys(answers).length;
  };

  const getProgressPercentage = () => {
    return (getAnsweredCount() / questions.length) * 100;
  };

  const handleFormSubmit = () => {
    onSubmit(answers, { tab_switches: tabSwitches });
  };

  const currentQuestion = questions[currentIdx];
  const isAnswered = (qId) => answers[qId] !== undefined;

  return (
    <div 
      className="test-interface-container animate-slide-up"
      onCopy={(e) => { e.preventDefault(); alert('Copying is disabled during the assessment.'); }}
      onCut={(e) => { e.preventDefault(); alert('Cutting is disabled during the assessment.'); }}
      onPaste={(e) => { e.preventDefault(); alert('Pasting is disabled during the assessment.'); }}
      onContextMenu={(e) => { e.preventDefault(); alert('Right-click is disabled during the assessment.'); }}
      style={{ userSelect: 'none' }}
    >
      {/* Top Test Bar */}
      <div className="test-header glass-card">
        <div className="test-title-section">
          <h2>Technical MCQ Assessment</h2>
          <span className="question-progress-text">
            Answered {getAnsweredCount()} of {questions.length} questions
          </span>
        </div>
        
        <Timer 
          totalSeconds={timeLimitMinutes * 60} 
          onTimeUp={handleFormSubmit} 
        />
      </div>

      {/* Progress Bar */}
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${getProgressPercentage()}%` }}
        ></div>
      </div>

      <div className="test-layout">
        {/* Main Question Panel */}
        <div className="question-panel glass-card">
          <div className="question-info">
            <span className="question-number">Question {currentIdx + 1} of {questions.length}</span>
            <div className="question-meta">
              <span className={`difficulty-badge difficulty-${currentQuestion.difficulty}`}>
                {currentQuestion.difficulty}
              </span>
              <span className="category-badge">{currentQuestion.skill_category}</span>
            </div>
          </div>

          <h3 className="question-text">{currentQuestion.question}</h3>

          <div className="options-grid">
            {Object.entries(currentQuestion.options).map(([key, value]) => {
              const isSelected = answers[currentQuestion.id] === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSelectOption(currentQuestion.id, key)}
                  className={`option-button ${isSelected ? 'selected' : ''}`}
                >
                  <span className="option-letter">{key}</span>
                  <span className="option-value">{value}</span>
                </button>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div className="navigation-controls">
            <button 
              onClick={handlePrev} 
              disabled={currentIdx === 0} 
              className="btn btn-secondary"
            >
              <FiChevronLeft /> Previous
            </button>

            {currentIdx < questions.length - 1 ? (
              <button onClick={handleNext} className="btn btn-secondary">
                Next <FiChevronRight />
              </button>
            ) : (
              <button 
                onClick={() => setShowConfirmModal(true)} 
                className="btn btn-primary"
              >
                <FiCheckCircle /> Finish & Submit
              </button>
            )}
          </div>
        </div>

        {/* Right Sidebar - Question Grid Navigator */}
        <div className="navigation-sidebar glass-card">
          <h4>Test Navigator</h4>
          <div className="navigator-grid">
            {questions.map((q, idx) => {
              let btnClass = 'nav-grid-btn';
              if (idx === currentIdx) btnClass += ' active';
              else if (isAnswered(q.id)) btnClass += ' answered';
              
              return (
                <button
                  key={q.id}
                  onClick={() => handleQuestionClick(idx)}
                  className={btnClass}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          
          <div className="navigator-legend">
            <div className="legend-item">
              <span className="legend-dot legend-current"></span>
              <span>Current</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot legend-answered"></span>
              <span>Answered</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot legend-unanswered"></span>
              <span>Unanswered</span>
            </div>
          </div>

          <button 
            onClick={() => setShowConfirmModal(true)} 
            className="btn btn-primary btn-submit-sidebar"
          >
            Submit Assessment
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-slide-up">
            <h3>Submit Assessment?</h3>
            <p>You have answered <strong>{getAnsweredCount()}</strong> out of <strong>{questions.length}</strong> questions.</p>
            <p className="modal-warning">Once submitted, you will not be able to change your answers or retake this test!</p>
            
            <div className="modal-actions">
              <button 
                onClick={() => setShowConfirmModal(false)} 
                className="btn btn-secondary"
              >
                Go Back
              </button>
              <button 
                onClick={handleFormSubmit} 
                className="btn btn-primary"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestInterface;
