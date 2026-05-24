import React from 'react';
import { FiTrendingUp, FiCpu, FiAward, FiStar } from 'react-icons/fi';
import './SkillsRadar.css';

const SkillsRadar = ({ skillsAnalysis }) => {
  const { name, domain, experience_years, skills = [], summary } = skillsAnalysis;

  // Group skills by category
  const skillsByCategory = skills.reduce((acc, skill) => {
    const category = skill.category || 'Other Skills';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(skill);
    return acc;
  }, {});

  const getProficiencyIcon = (prof) => {
    switch(prof.toLowerCase()) {
      case 'advanced': return <FiAward />;
      case 'intermediate': return <FiTrendingUp />;
      default: return <FiStar />;
    }
  };

  return (
    <div className="skills-analysis-container animate-fade">
      {/* Overview stats */}
      <div className="skills-summary-header glass-card">
        <div className="candidate-meta-grid">
          <div className="meta-item">
            <span className="meta-label">Domain Expertise</span>
            <span className="meta-value value-domain"><FiCpu /> {domain || 'Software Development'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Years of Experience</span>
            <span className="meta-value value-exp">{experience_years} Years</span>
          </div>
        </div>
        {summary && (
          <div className="candidate-summary">
            <h4>Professional Profile Summary</h4>
            <p>{summary}</p>
          </div>
        )}
      </div>

      {/* Skills Grid */}
      <div className="skills-grid">
        {Object.entries(skillsByCategory).map(([category, items]) => (
          <div key={category} className="skills-category-card glass-card">
            <h4>{category}</h4>
            <div className="skills-tags">
              {items.map((skill, idx) => (
                <div 
                  key={idx} 
                  className={`skill-tag proficiency-${skill.proficiency?.toLowerCase() || 'intermediate'}`}
                >
                  <span className="prof-icon">
                    {getProficiencyIcon(skill.proficiency || 'intermediate')}
                  </span>
                  <span className="skill-name">{skill.name}</span>
                  <span className="proficiency-level">{skill.proficiency || 'intermediate'}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkillsRadar;
