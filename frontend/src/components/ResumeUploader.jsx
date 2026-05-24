import React, { useState, useRef } from 'react';
import { resumeAPI } from '../api/api';
import { FiUploadCloud, FiFile, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import './ResumeUploader.css';

const ResumeUploader = ({ onUploadSuccess }) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    setError('');
    setSuccess(false);
    
    if (selectedFile.type !== 'application/pdf') {
      setError('Only PDF resumes are supported.');
      setFile(null);
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
      setError('File size exceeds the 5MB limit.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    
    try {
      const res = await resumeAPI.upload(file);
      setSuccess(true);
      if (onUploadSuccess) {
        onUploadSuccess(res.data.resume_id, res.data.skills_analysis);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to upload and analyze resume. Please check your Groq API key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="resume-uploader glass-card">
      <div 
        className={`upload-zone ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          className="file-input-hidden" 
          accept=".pdf"
          onChange={handleChange}
        />
        
        {!file ? (
          <div className="upload-prompt" onClick={onButtonClick}>
            <FiUploadCloud className="upload-icon" />
            <h3>Drag & Drop your resume</h3>
            <p>Support PDF only (Max 5MB)</p>
            <button className="btn btn-secondary btn-sm" type="button">Browse Files</button>
          </div>
        ) : (
          <div className="file-details">
            <FiFile className="file-icon" />
            <div className="file-info">
              <span className="file-name">{file.name}</span>
              <span className="file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
            </div>
            <button className="btn-remove" onClick={() => setFile(null)} disabled={loading}>
              Change
            </button>
          </div>
        )}
      </div>

      {file && !success && (
        <button 
          onClick={handleUpload} 
          disabled={loading} 
          className="btn btn-primary btn-upload-submit"
        >
          {loading ? (
            <>
              <div className="spinner-small"></div> Analyzing Resume with AI...
            </>
          ) : 'Upload & Analyze Resume'}
        </button>
      )}

      {error && (
        <div className="upload-alert error-alert animate-fade">
          <FiAlertCircle />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="upload-alert success-alert animate-fade">
          <FiCheckCircle />
          <span>Resume uploaded and analyzed successfully!</span>
        </div>
      )}
    </div>
  );
};

export default ResumeUploader;
