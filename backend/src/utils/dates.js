function formatISODate(date = new Date()) {
  return new Date(date).toISOString();
}

function getStartOfMonth(yearMonthString) {
  // expects 'YYYY-MM'
  if (!yearMonthString) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const [year, month] = yearMonthString.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function getEndOfMonth(yearMonthString) {
  if (!yearMonthString) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  const [year, month] = yearMonthString.split('-').map(Number);
  return new Date(year, month, 0, 23, 59, 59, 999);
}

module.exports = {
  formatISODate,
  getStartOfMonth,
  getEndOfMonth
};
