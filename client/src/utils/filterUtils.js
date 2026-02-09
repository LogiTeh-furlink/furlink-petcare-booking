// Shared utility for managing dashboard filters across all pages
const FILTER_STORAGE_KEY = 'sp_dashboard_filters';

export const defaultFilters = {
  activeFilter: 'monthly',
  petTypeFilter: 'both',
  customDateStart: '',
  customDateEnd: '',
  selectedYear: null
};

// Save filters to localStorage
export const saveFilters = (filters) => {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.error('Error saving filters:', error);
  }
};

// Load filters from localStorage
export const loadFilters = () => {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (stored) {
      return { ...defaultFilters, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error loading filters:', error);
  }
  return defaultFilters;
};

// Clear filters (reset to defaults)
export const clearFilters = () => {
  try {
    localStorage.removeItem(FILTER_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing filters:', error);
  }
};