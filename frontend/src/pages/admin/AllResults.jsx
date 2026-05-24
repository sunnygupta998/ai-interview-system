import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../../api/api';
import DataTable from '../../components/DataTable';
import { FiAward } from 'react-icons/fi';
import './AllResults.css';

const AllResults = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await adminAPI.getResults(1, 100); // Fetch top 100 results for simple sorting/filtering
        setResults(res.data.results);
      } catch (err) {
        console.error("Failed to load candidate results:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  const columns = [
    { 
      header: 'Candidate Name', 
      accessor: 'candidate.name',
      sortable: true
    },
    { 
      header: 'Email', 
      accessor: 'candidate.email',
      sortable: true
    },
    { 
      header: 'Resume', 
      accessor: 'resume_filename',
      sortable: true,
      cell: (row) => (
        row.resume_url ? (
          <a href={row.resume_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
            {row.resume_filename}
          </a>
        ) : (
          row.resume_filename
        )
      )
    },
    { 
      header: 'Marks', 
      accessor: 'score',
      sortable: true,
      cell: (row) => `${row.score} / ${row.total}`
    },
    { 
      header: 'Percentage', 
      accessor: 'percentage',
      sortable: true,
      cell: (row) => <strong style={{ color: 'var(--primary-light)' }}>{row.percentage}%</strong>
    },
    { 
      header: 'Verdict', 
      accessor: 'passed',
      sortable: true,
      cell: (row) => (
        <span className={`badge ${row.passed ? 'badge-success' : 'badge-error'}`}>
          {row.passed ? 'Passed' : 'Failed'}
        </span>
      )
    },
    {
      header: 'AI Interview',
      accessor: 'interview_decision',
      sortable: true,
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`badge ${row.interview_decision === 'Selected' ? 'badge-success' : row.interview_decision === 'Not Selected' ? 'badge-error' : 'badge-warning'}`}>
            {row.interview_decision || 'Pending'}
          </span>
          {(row.interview_decision === 'Selected' || row.interview_decision === 'Not Selected') && row.interview_score !== undefined && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
              {row.interview_score}/100
            </span>
          )}
        </div>
      )
    },
    { 
      header: 'Submitted At', 
      accessor: 'submitted_at',
      sortable: true,
      cell: (row) => row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : 'N/A'
    }
  ];

  const handleRowClick = (row) => {
    // Navigate to candidate detailed review
    navigate(`/candidate/results/${row.test_id}`);
  };

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner"></div>
        <p>Loading Candidate Results...</p>
      </div>
    );
  }

  return (
    <div className="admin-results-page-container animate-fade">
      <div className="results-page-header">
        <h1>All Candidate Submissions</h1>
        <p>View, search, filter, and review candidate technical assessment grades.</p>
      </div>

      <div className="results-table-card glass-card">
        <DataTable 
          columns={columns}
          data={results}
          onRowClick={handleRowClick}
          searchPlaceholder="Search candidates by name..."
          searchKey="candidate.name"
        />
      </div>
    </div>
  );
};

export default AllResults;
