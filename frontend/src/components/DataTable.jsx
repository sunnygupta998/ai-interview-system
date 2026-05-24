import React, { useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight, FiSearch, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import './DataTable.css';

const DataTable = ({ 
  columns, 
  data, 
  onRowClick, 
  searchPlaceholder = "Search...",
  searchKey = "" // key path to search by, e.g., "candidate.name"
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  // Helper to resolve nested object path values
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

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

  // 3. Pagination
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = sortedData.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(sortedData.length / rowsPerPage);

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  return (
    <div className="datatable-wrapper animate-fade">
      {/* Search Bar */}
      {searchKey && (
        <div className="table-search-bar">
          <FiSearch className="search-icon" />
          <input 
            type="text" 
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset page to 1 on search
            }}
            className="form-input table-search-input"
          />
        </div>
      )}

      {/* Table Container */}
      <div className="table-container">
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
                  key={row.id || idx}
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
                  No records found.
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
            Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, sortedData.length)} of {sortedData.length} records
          </span>
          <div className="pagination-buttons">
            <button 
              onClick={() => paginate(1)} 
              disabled={currentPage === 1}
              className="btn btn-secondary btn-pagination"
              title="First Page"
            >
              <FiChevronsLeft />
            </button>
            <button 
              onClick={() => paginate(currentPage - 1)} 
              disabled={currentPage === 1}
              className="btn btn-secondary btn-pagination"
              title="Previous Page"
            >
              <FiChevronLeft />
            </button>
            <span className="current-page-indicator">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={() => paginate(currentPage + 1)} 
              disabled={currentPage === totalPages}
              className="btn btn-secondary btn-pagination"
              title="Next Page"
            >
              <FiChevronRight />
            </button>
            <button 
              onClick={() => paginate(totalPages)} 
              disabled={currentPage === totalPages}
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
