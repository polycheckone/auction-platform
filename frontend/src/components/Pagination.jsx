import { useMemo } from 'react';

/**
 * Reusable pagination component
 * @param {Object} props
 * @param {number} props.page - Current page number
 * @param {number} props.totalPages - Total number of pages
 * @param {number} props.total - Total number of items
 * @param {number} props.limit - Items per page
 * @param {Function} props.onPageChange - Callback when page changes
 * @param {boolean} props.loading - Loading state
 */
function Pagination({ page, totalPages, total, limit, onPageChange, loading = false }) {
  // Generate page numbers to show
  const pageNumbers = useMemo(() => {
    const pages = [];
    const showPages = 5; // Max pages to show

    let startPage = Math.max(1, page - Math.floor(showPages / 2));
    let endPage = Math.min(totalPages, startPage + showPages - 1);

    // Adjust start if we're near the end
    if (endPage - startPage < showPages - 1) {
      startPage = Math.max(1, endPage - showPages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }, [page, totalPages]);

  if (totalPages <= 1) {
    return null;
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page && !loading) {
      onPageChange(newPage);
    }
  };

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <div className="pagination-info">
        Wyświetlono {startItem}-{endItem} z {total}
      </div>

      <div className="pagination-controls">
        <button
          className="pagination-btn"
          onClick={() => handlePageChange(1)}
          disabled={page === 1 || loading}
          title="Pierwsza strona"
        >
          «
        </button>

        <button
          className="pagination-btn"
          onClick={() => handlePageChange(page - 1)}
          disabled={page === 1 || loading}
          title="Poprzednia strona"
        >
          ‹
        </button>

        {pageNumbers[0] > 1 && (
          <>
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(1)}
              disabled={loading}
            >
              1
            </button>
            {pageNumbers[0] > 2 && <span className="pagination-ellipsis">...</span>}
          </>
        )}

        {pageNumbers.map(num => (
          <button
            key={num}
            className={`pagination-btn ${num === page ? 'active' : ''}`}
            onClick={() => handlePageChange(num)}
            disabled={loading}
          >
            {num}
          </button>
        ))}

        {pageNumbers[pageNumbers.length - 1] < totalPages && (
          <>
            {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
              <span className="pagination-ellipsis">...</span>
            )}
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(totalPages)}
              disabled={loading}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          className="pagination-btn"
          onClick={() => handlePageChange(page + 1)}
          disabled={page === totalPages || loading}
          title="Następna strona"
        >
          ›
        </button>

        <button
          className="pagination-btn"
          onClick={() => handlePageChange(totalPages)}
          disabled={page === totalPages || loading}
          title="Ostatnia strona"
        >
          »
        </button>
      </div>
    </div>
  );
}

export default Pagination;
