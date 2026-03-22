// Shared utility for managing admin insights filters across SP and PO pages
const FILTER_STORAGE_KEY = 'admin_insights_filters';

export const defaultFilters = {
  activeFilter:    'monthly',
  petTypeFilter:   'both',
  customDateStart: '',
  customDateEnd:   '',
  selectedYear:    new Date().getFullYear(),
  selectedCities:  [],
};

// Save filters to localStorage
export const saveFilters = (filters) => {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.error('Error saving admin insights filters:', error);
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
    console.error('Error loading admin insights filters:', error);
  }
  return { ...defaultFilters };
};

// Clear filters (reset to defaults)
export const clearFilters = () => {
  try {
    localStorage.removeItem(FILTER_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing admin insights filters:', error);
  }
};