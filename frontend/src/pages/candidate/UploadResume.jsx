import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { testAPI } from '../../api/api';
import ResumeUploader from '../../components/ResumeUploader';
import SkillsRadar from '../../components/SkillsRadar';
import { FiAward, FiArrowRight } from 'react-icons/fi';
import './UploadResume.css';

const UploadResume = () => {
  const [resumeId, setResumeId] = useState(null);
  const [skillsAnalysis, setSkillsAnalysis] = useState(null);
  const [generatingTest, setGeneratingTest] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleUploadSuccess = (id, analysis) => {
    setResumeId(id);
    setSkillsAnalysis(analysis);
    setError('');
  };

  const handleGenerateTest = async () => {
    if (!resumeId) return;
    setGeneratingTest(true);
    setError('');
    
    try {
      const res = await testAPI.generate(resumeId);
      const testId = res.data.test_id;
      // Navigate to TakeTest instructions page
      navigate(`/candidate/test/${testId}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to generate assessment. Please try again.');
    } finally {
      setGeneratingTest(false);
    }
  };

  return (
    <div className="upload-resume-page-container">
      <div className="page-header">
        <h1>Upload Your Resume</h1>
        <p>AI will scan your resume, extract key technical competencies, and generate a customized test.</p>
      </div>

      {!skillsAnalysis ? (
        <div className="uploader-section">
          <ResumeUploader onUploadSuccess={handleUploadSuccess} />
        </div>
      ) : (
        <div className="analysis-results-section animate-slide-up">
          <div className="analysis-alert glass-card">
            <div className="alert-content">
              <h3>AI Resume Analysis Complete</h3>
              <p>We've analyzed your resume and mapped out your technical skillset. Click below to generate your MCQ assessment.</p>
            </div>
            <button 
              onClick={handleGenerateTest} 
              disabled={generatingTest}
              className="btn btn-accent btn-generate-test"
            >
              {generatingTest ? (
                <>
                  <div className="spinner-small" style={{ borderTopColor: '#080710' }}></div> Generating Test...
                </>
              ) : (
                <>
                  Generate Assessment <FiArrowRight />
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="upload-alert error-alert animate-fade" style={{ marginBottom: '20px' }}>
              <span>{error}</span>
            </div>
          )}

          <div className="analysis-details-grid">
            <div className="skills-view">
              <h3 className="section-title"><FiAward /> Extracted Technical Profile</h3>
              <SkillsRadar skillsAnalysis={skillsAnalysis} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadResume;
