import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../api/api';
import { FiSave, FiRefreshCw, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import './Settings.css';

const Settings = () => {
  const [questionsPerTest, setQuestionsPerTest] = useState(15);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(25);
  const [passPercentage, setPassPercentage] = useState(60);
  const [difficultyMix, setDifficultyMix] = useState({
    easy: 30,
    medium: 50,
    hard: 20
  });
  const [interviewQuestionCount, setInterviewQuestionCount] = useState(3);
  const [interviewLanguage, setInterviewLanguage] = useState('English');
  const [enablePracticeInterview, setEnablePracticeInterview] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await adminAPI.getSettings();
        const settings = res.data.settings;
        setQuestionsPerTest(settings.questions_per_test);
        setTimeLimitMinutes(settings.time_limit_minutes);
        setPassPercentage(settings.pass_percentage);
        if (settings.difficulty_mix) {
          setDifficultyMix(settings.difficulty_mix);
        }
        if (settings.interview_question_count) {
          setInterviewQuestionCount(settings.interview_question_count);
        }
        if (settings.interview_language) {
          setInterviewLanguage(settings.interview_language);
        }
        if (settings.enable_practice_interview !== undefined) {
          setEnablePracticeInterview(settings.enable_practice_interview);
        }
      } catch (err) {
        console.error("Failed to load settings details:", err);
        setErrorMsg("Failed to retrieve system settings from server.");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const getSum = () => Number(difficultyMix.easy) + Number(difficultyMix.medium) + Number(difficultyMix.hard);

  const handleSave = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    const totalMix = getSum();
    if (totalMix !== 100) {
      setErrorMsg(`Difficulty mix percentages must sum to exactly 100%. Current sum: ${totalMix}%`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        questions_per_test: Number(questionsPerTest),
        time_limit_minutes: Number(timeLimitMinutes),
        pass_percentage: Number(passPercentage),
        difficulty_mix: {
          easy: Number(difficultyMix.easy),
          medium: Number(difficultyMix.medium),
          hard: Number(difficultyMix.hard)
        },
        interview_question_count: Number(interviewQuestionCount),
        interview_language: String(interviewLanguage),
        enable_practice_interview: Boolean(enablePracticeInterview)
      };
      const res = await adminAPI.updateSettings(payload);
      setSuccessMsg("System configuration settings updated successfully!");
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to update system settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setQuestionsPerTest(15);
    setTimeLimitMinutes(25);
    setPassPercentage(60);
    setDifficultyMix({ easy: 30, medium: 50, hard: 20 });
    setInterviewQuestionCount(3);
    setInterviewLanguage('English');
    setEnablePracticeInterview(true);
    setSuccessMsg('');
    setErrorMsg('');
  };

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner"></div>
        <p>Loading System Configuration...</p>
      </div>
    );
  }

  const mixSum = getSum();
  const isMixValid = mixSum === 100;

  return (
    <div className="admin-settings-container animate-fade">
      <div className="settings-header">
        <h1>Assessment System Settings</h1>
        <p>Configure dynamic MCQ question counts, test timers, difficulty limits, and threshold weights.</p>
      </div>

      {successMsg && (
        <div className="upload-alert success-alert animate-fade">
          <FiCheckCircle />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="upload-alert error-alert animate-fade">
          <FiAlertCircle />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="settings-form glass-card">
        {/* Core Controls */}
        <div className="settings-section">
          <h3>Assessment Parameters</h3>
          <div className="settings-grid-layout">
            <div className="form-group">
              <label className="form-label">
                Questions per Test: <strong>{questionsPerTest}</strong>
              </label>
              <input 
                type="range" 
                min="5" 
                max="50" 
                value={questionsPerTest}
                onChange={(e) => setQuestionsPerTest(e.target.value)}
                className="range-slider"
              />
              <span className="slider-hint">Defines how many multiple-choice questions AI generates.</span>
            </div>

            <div className="form-group">
              <label className="form-label">
                Time Limit: <strong>{timeLimitMinutes} minutes</strong>
              </label>
              <input 
                type="range" 
                min="5" 
                max="120" 
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(e.target.value)}
                className="range-slider"
              />
              <span className="slider-hint">Total test countdown duration.</span>
            </div>

            <div className="form-group">
              <label className="form-label">
                Passing Grade Weight: <strong>{passPercentage}%</strong>
              </label>
              <input 
                type="range" 
                min="30" 
                max="90" 
                value={passPercentage}
                onChange={(e) => setPassPercentage(e.target.value)}
                className="range-slider"
              />
              <span className="slider-hint">Percentage required to pass candidate profile.</span>
            </div>
          </div>
        </div>

        {/* Difficulty Mix Controls */}
        <div className="settings-section divider-top">
          <div className="section-title-with-badge">
            <h3>Difficulty Distribution Mix</h3>
            <span className={`badge ${isMixValid ? 'badge-success' : 'badge-error'}`}>
              Sum: {mixSum}% {isMixValid ? '(Valid)' : '(Must equal 100%)'}
            </span>
          </div>
          
          <div className="difficulty-inputs-grid">
            <div className="form-group">
              <label className="form-label">Easy Questions (%)</label>
              <input 
                type="number" 
                min="0" 
                max="100" 
                value={difficultyMix.easy} 
                onChange={(e) => setDifficultyMix({...difficultyMix, easy: e.target.value})}
                className="form-input text-center"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Medium Questions (%)</label>
              <input 
                type="number" 
                min="0" 
                max="100" 
                value={difficultyMix.medium} 
                onChange={(e) => setDifficultyMix({...difficultyMix, medium: e.target.value})}
                className="form-input text-center"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hard Questions (%)</label>
              <input 
                type="number" 
                min="0" 
                max="100" 
                value={difficultyMix.hard} 
                onChange={(e) => setDifficultyMix({...difficultyMix, hard: e.target.value})}
                className="form-input text-center"
                required
              />
            </div>
          </div>
        </div>

        {/* Live Interview Controls */}
        <div className="settings-section divider-top">
          <h3>Live Interview Configuration</h3>
          <div className="settings-grid-layout">
            <div className="form-group">
              <label className="form-label">
                Number of AI Questions: <strong>{interviewQuestionCount}</strong>
              </label>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={interviewQuestionCount}
                onChange={(e) => setInterviewQuestionCount(e.target.value)}
                className="range-slider"
              />
              <span className="slider-hint">How many questions the AI should ask in the live interview.</span>
            </div>

            <div className="form-group">
              <label className="form-label">
                Interview Language
              </label>
              <select
                value={interviewLanguage}
                onChange={(e) => setInterviewLanguage(e.target.value)}
                className="form-input"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white' }}
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Both">Both (Hinglish)</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
              </select>
            </div>
            
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', gridColumn: '1 / -1', marginTop: '1rem' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
                <div style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                  <input 
                    type="checkbox" 
                    checked={enablePracticeInterview}
                    onChange={(e) => setEnablePracticeInterview(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: enablePracticeInterview ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                    transition: '.4s', borderRadius: '34px'
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', left: '4px', bottom: '4px',
                      backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                      transform: enablePracticeInterview ? 'translateX(24px)' : 'translateX(0)'
                    }}></span>
                  </span>
                </div>
                <strong>Enable Practice AI Interview Button</strong>
              </label>
              <span className="slider-hint">If enabled, candidates can start an unrecorded practice voice interview from their dashboard.</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="settings-actions">
          <button 
            type="button" 
            onClick={handleResetDefaults} 
            className="btn btn-secondary"
            disabled={saving}
          >
            <FiRefreshCw /> Reset Defaults
          </button>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={saving || !isMixValid}
          >
            <FiSave /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
