import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight, FiSearch, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import './DataTable.css';

const ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50, 100];

const DataTable = ({ 
  columns, 
  data, 
  onRowClick, 
  searchPlaceholder = "Search...",
  searchKey = "", // key path to search by, e.g., "candidate.name"
  // Server-side pagination props
  serverPagination = false,
  totalRecords = 0,
  totalPages: serverTotalPages = 0,
  currentServerPage = 1,
  serverRowsPerPage = 10,
  onPageChange,        // (page) => void
  onRowsPerPageChange, // (rowsPerPage) => void
  loading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Helper to resolve nested object path values
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  // --- Client-side mode logic ---
  // 1. Search filter
  const filteredData = data.filter((row) => {
    if (!searchKey) return true;
    const value = getNestedValue(row, searchKey);
    return value ? String(value).toLowerCase().includes(searchTerm.toLowerCase()) : false;
  });

  // 2. Sorting
  const handleSort = (key, sortable) => {
    if (!sortable) return;
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    const aVal = getNestedValue(a, sortConfig.key);
    const bVal = getNestedValue(b, sortConfig.key);

    if (aVal === undefined || bVal === undefined) return 0;
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    
    if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // 3. Pagination (resolved for client vs server mode)
  const isServer = serverPagination;
  const activePage = isServer ? currentServerPage : currentPage;
  const activeRowsPerPage = isServer ? serverRowsPerPage : rowsPerPage;
  const totalPages = isServer ? serverTotalPages : Math.ceil(sortedData.length / rowsPerPage);
  const totalCount = isServer ? totalRecords : sortedData.length;

  const indexOfLastRow = activePage * activeRowsPerPage;
  const indexOfFirstRow = indexOfLastRow - activeRowsPerPage;
  const currentRows = isServer ? data : sortedData.slice(indexOfFirstRow, indexOfLastRow);

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      if (isServer) {
        onPageChange && onPageChange(pageNumber);
      } else {
        setCurrentPage(pageNumber);
      }
    }
  };

  const handleRowsPerPageChange = (newValue) => {
    const val = parseInt(newValue, 10);
    if (isServer) {
      onRowsPerPageChange && onRowsPerPageChange(val);
    } else {
      setRowsPerPage(val);
      setCurrentPage(1);
    }
  };

  // Reset client page when search changes
  useEffect(() => {
    if (!isServer) {
      setCurrentPage(1);
    }
  }, [searchTerm]);

  return (
    <div className="datatable-wrapper animate-fade">
      {/* Toolbar: Search + Rows per page */}
      <div className="table-toolbar">
        {searchKey && (
          <div className="table-search-bar">
            <FiSearch className="search-icon" />
            <input 
              type="text" 
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input table-search-input"
            />
          </div>
        )}
        <div className="rows-per-page-selector">
          <label htmlFor="rowsPerPage">Rows per page:</label>
          <select 
            id="rowsPerPage"
            value={activeRowsPerPage}
            onChange={(e) => handleRowsPerPageChange(e.target.value)}
            className="rows-per-page-select"
          >
            {ROWS_PER_PAGE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="table-container">
        {loading && (
          <div className="table-loading-overlay">
            <div className="spinner" style={{ width: 28, height: 28 }}></div>
          </div>
        )}
        <table className="custom-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th 
                  key={col.accessor}
                  onClick={() => handleSort(col.accessor, col.sortable)}
                  className={col.sortable ? 'sortable-header' : ''}
                >
                  <div className="header-cell-content">
                    {col.header}
                    {col.sortable && sortConfig.key === col.accessor && (
                      sortConfig.direction === 'asc' ? <FiArrowUp className="sort-arrow" /> : <FiArrowDown className="sort-arrow" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.length > 0 ? (
              currentRows.map((row, idx) => (
                <tr 
                  key={row.id || row.result_id || idx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={onRowClick ? 'clickable-row' : ''}
                >
                  {columns.map((col) => (
                    <td key={col.accessor}>
                      {col.cell ? col.cell(row) : String(getNestedValue(row, col.accessor) ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="empty-table-row">
                  {loading ? 'Loading...' : 'No records found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="table-pagination">
          <span className="pagination-info">
            Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, totalCount)} of {totalCount} records
          </span>
          <div className="pagination-buttons">
            <button 
              onClick={() => paginate(1)} 
              disabled={activePage === 1}
              className="btn btn-secondary btn-pagination"
              title="First Page"
            >
              <FiChevronsLeft />
            </button>
            <button 
              onClick={() => paginate(activePage - 1)} 
              disabled={activePage === 1}
              className="btn btn-secondary btn-pagination"
              title="Previous Page"
            >
              <FiChevronLeft />
            </button>
            <span className="current-page-indicator">
              Page {activePage} of {totalPages}
            </span>
            <button 
              onClick={() => paginate(activePage + 1)} 
              disabled={activePage === totalPages}
              className="btn btn-secondary btn-pagination"
              title="Next Page"
            >
              <FiChevronRight />
            </button>
            <button 
              onClick={() => paginate(totalPages)} 
              disabled={activePage === totalPages}
              className="btn btn-secondary btn-pagination"
              title="Last Page"
            >
              <FiChevronsRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
