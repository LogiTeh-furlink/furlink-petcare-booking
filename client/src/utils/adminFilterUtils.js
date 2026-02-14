// Shared utility for managing admin dashboard filters
const ADMIN_FILTER_STORAGE_KEY = 'admin_dashboard_filters';

export const defaultAdminFilters = {
  currentFilter: 'pending',
  userRoleFilter: 'all',
  // Single shared date range for all provider tabs
  dateRange: { start: '', end: '' }
};

// Save admin filters to localStorage
export const saveAdminFilters = (filters) => {
  try {
    localStorage.setItem(ADMIN_FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.error('Error saving admin filters:', error);
  }
};

// Load admin filters from localStorage
export const loadAdminFilters = () => {
  try {
    const stored = localStorage.getItem(ADMIN_FILTER_STORAGE_KEY);
    if (stored) {
      return { ...defaultAdminFilters, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error loading admin filters:', error);
  }
  return defaultAdminFilters;
};

// Clear admin filters (reset to defaults)
export const clearAdminFilters = () => {
  try {
    localStorage.removeItem(ADMIN_FILTER_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing admin filters:', error);
  }
};

// Save date range (convenience function)
export const saveDateRange = (start, end) => {
  const currentFilters = loadAdminFilters();
  currentFilters.dateRange = { start, end };
  saveAdminFilters(currentFilters);
};

// Clear date range (convenience function)
export const clearDateRange = () => {
  const currentFilters = loadAdminFilters();
  currentFilters.dateRange = { start: '', end: '' };
  saveAdminFilters(currentFilters);
};