import React from 'react';
import { FiCheck, FiX, FiAward, FiAlertCircle } from 'react-icons/fi';
import './ResultsChart.css';

const ResultsChart = ({ results }) => {
  const { score, total, percentage, passed, topic_breakdown, details } = results;

  // Compute stroke offset for circular progress bar
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="results-container animate-slide-up">
      {/* Top Summary Card */}
      <div className="results-summary-card glass-card">
        {/* Circle Chart */}
        <div className="score-circle-wrapper">
          <svg className="score-svg" width="160" height="160" viewBox="0 0 160 160">
            <circle 
              className="score-bg-circle" 
              cx="80" 
              cy="80" 
              r={radius} 
              strokeWidth="12" 
            />
            <circle 
              className={`score-fill-circle ${passed ? 'fill-passed' : 'fill-failed'}`}
              cx="80" 
              cy="80" 
              r={radius} 
              strokeWidth="12" 
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 80 80)"
            />
          </svg>
          <div className="score-text-overlay">
            <span className="score-percentage">{percentage}%</span>
            <span className="score-ratio">{score} / {total}</span>
          </div>
        </div>

        {/* Text Verdict */}
        <div className="verdict-section">
          {passed ? (
            <div className="verdict-badge verdict-pass">
              <FiAward />
              <span>Assessment Passed</span>
            </div>
          ) : (
            <div className="verdict-badge verdict-fail">
              <FiAlertCircle />
              <span>Assessment Failed</span>
            </div>
          )}
          <h2 className="verdict-title">
            {passed ? 'Congratulations!' : 'Keep Learning!'}
          </h2>
          <p className="verdict-desc">
            {passed 
              ? 'You have successfully passed the custom AI technical assessment based on your resume. Your profile is qualified.'
              : 'You did not reach the passing score threshold. We encourage you to review the topics below and try again later.'
            }
          </p>
        </div>
      </div>

      {/* Topics Breakdown */}
      <div className="topic-breakdown-section glass-card">
        <h3>Topic-wise Performance</h3>
        <div className="topics-list">
          {Object.entries(topic_breakdown).map(([topic, stats]) => {
            const topicPercent = stats.percentage;
            let barColor = 'bar-pass';
            if (topicPercent < 50) barColor = 'bar-fail';
            else if (topicPercent < 75) barColor = 'bar-medium';

            return (
              <div key={topic} className="topic-item">
                <div className="topic-header">
                  <span className="topic-name">{topic}</span>
                  <span className="topic-score">
                    {stats.correct}/{stats.total} ({topicPercent}%)
                  </span>
                </div>
                <div className="topic-bar-bg">
                  <div 
                    className={`topic-bar-fill ${barColor}`} 
                    style={{ width: `${topicPercent}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Question Review */}
      <div className="review-section">
        <h3>Question Review</h3>
        <div className="review-list">
          {details.map((item, idx) => (
            <div 
              key={idx} 
              className={`review-card glass-card ${item.is_correct ? 'card-correct' : 'card-incorrect'}`}
            >
              <div className="review-card-header">
                <span className="review-num">Question {item.question_id}</span>
                <span className="review-topic badge">{item.skill_category}</span>
                <span className={`review-status-badge ${item.is_correct ? 'status-correct' : 'status-incorrect'}`}>
                  {item.is_correct ? <FiCheck /> : <FiX />}
                  {item.is_correct ? 'Correct' : 'Incorrect'}
                </span>
              </div>

              <h4 className="review-question">{item.question}</h4>

              {/* Options */}
              <div className="review-options">
                {Object.entries(item.options).map(([key, val]) => {
                  let optClass = 'review-option';
                  const isSubmitted = item.submitted_answer === key;
                  const isCorrectAnswer = item.correct_answer === key;

                  if (isCorrectAnswer) optClass += ' opt-correct';
                  else if (isSubmitted && !item.is_correct) optClass += ' opt-selected-wrong';
                  else if (isSubmitted) optClass += ' opt-selected';

                  return (
                    <div key={key} className={optClass}>
                      <span className="opt-letter">{key}</span>
                      <span className="opt-val">{val}</span>
                      {isCorrectAnswer && <span className="opt-indicator">Correct Answer</span>}
                      {isSubmitted && !isCorrectAnswer && <span className="opt-indicator">Your Answer</span>}
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              <div className="review-explanation">
                <strong>Explanation: </strong>
                <span>{item.explanation}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResultsChart;
