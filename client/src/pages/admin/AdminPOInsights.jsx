import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaFileAlt, FaTimes, FaDownload, FaArrowLeft } from 'react-icons/fa';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement,
  Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './AdminPOInsights.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement,
  Tooltip, Legend
);

// ============================================
// CONSTANTS
// ============================================
const DAY_LABELS    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GREEN_SHADES  = ['#14532d', '#15803d', '#16a34a', '#22c55e', '#4ade80'];
const PURPLE_SHADES = ['#3b0764', '#6d28d9', '#7c3aed', '#a78bfa', '#c4b5fd'];
const ORANGE_SHADES = ['#7c2d12', '#c2410c', '#ea580c', '#fb923c', '#fdba74'];
const TEAL_SHADES   = ['#134e4a', '#0f766e', '#0d9488', '#2dd4bf', '#99f6e4'];

// ============================================
// MODULE-LEVEL HELPERS
// ============================================
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const endOfDayDate = (d) => {
  const nd = new Date(d);
  nd.setHours(23, 59, 59, 999);
  return nd;
};

const isCompleted = (status) => ['for review', 'rated'].includes(status);

const normalizeCity = (raw) => {
  if (!raw) return '';
  const parts = raw.split(',');
  return parts[parts.length - 1].trim();
};

// ============================================
// COMPONENT
// ============================================
export default function AdminPOInsights() {
  const navigate  = useNavigate();
  const reportRef = useRef(null);

  // ---- state ----
  const [activeFilter,      setActiveFilter]      = useState('monthly');
  const [petTypeFilter,     setPetTypeFilter]     = useState('both');
  const [customDateStart,   setCustomDateStart]   = useState('');
  const [customDateEnd,     setCustomDateEnd]     = useState('');
  const [selectedYear,      setSelectedYear]      = useState(new Date().getFullYear());
  const [loading,           setLoading]           = useState(true);
  const [showReportModal,   setShowReportModal]   = useState(false);
  const [isGeneratingPDF,   setIsGeneratingPDF]   = useState(false);
  const [platformCreatedAt, setPlatformCreatedAt] = useState(null);
  const [rawBookings,       setRawBookings]       = useState([]);
  const [rawUsers,          setRawUsers]          = useState([]);
  const [rawProviders,      setRawProviders]      = useState([]);
  const [selectedCities,    setSelectedCities]    = useState([]);

  // ============================================
  // DATA FETCHING
  // ============================================
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate('/login');

        // Fetch service providers (for city filter + earliest date)
        const { data: providers, error: pErr } = await supabase
          .from('service_providers')
          .select('id, user_id, business_name, business_email, created_at, city');
        if (pErr) throw pErr;
        setRawProviders(providers || []);

        if (providers && providers.length > 0) {
          const earliest = providers.reduce((a, b) =>
            new Date(a.created_at) < new Date(b.created_at) ? a : b
          );
          setPlatformCreatedAt(earliest.created_at.split('T')[0]);
        }

        // Fetch users (pet owners) — public.profiles, role = pet_owner
        const { data: users, error: uErr } = await supabase
          .from('profiles')
          .select('id, email, created_at')
        if (uErr) throw uErr;
        setRawUsers(users || []);

        // Fetch all bookings with pet data — include breed field
        const { data: bookings, error: bErr } = await supabase
          .from('bookings')
          .select(`
            id,
            provider_id,
            user_id,
            booking_date,
            status,
            total_estimated_price,
            created_at,
            booking_pets (
              id,
              pet_type,
              breed
            )
          `)
          .order('created_at', { ascending: false });
        if (bErr) throw bErr;
        setRawBookings(bookings || []);

      } catch (err) {
        console.error('Admin PO Insights Fetch Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  // ============================================
  // DERIVED CITY LIST
  // ============================================
  const availableCities = useMemo(() => {
    const cities = rawProviders
      .map(p => normalizeCity(p.city))
      .filter(Boolean);
    return [...new Set(cities)].sort((a, b) => a.localeCompare(b));
  }, [rawProviders]);

  useEffect(() => {
    if (availableCities.length > 0 && selectedCities.length === 0) {
      setSelectedCities([...availableCities]);
    }
  }, [availableCities]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCity = (city) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  const toggleAllCities = () => {
    if (selectedCities.length === availableCities.length) {
      setSelectedCities([]);
    } else {
      setSelectedCities([...availableCities]);
    }
  };

  // ============================================
  // COMPUTED DATE RANGE
  // ============================================
  const getRange = useMemo(() => {
    const today      = new Date();
    const endOfToday = endOfDayDate(today);

    if (activeFilter === 'custom' && customDateStart && customDateEnd) {
      return {
        start: parseLocalDate(customDateStart),
        end:   endOfDayDate(parseLocalDate(customDateEnd))
      };
    }
    if (activeFilter === 'weekly') {
      const start = new Date(today);
      start.setDate(today.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start, end: endOfToday };
    }
    if (activeFilter === 'monthly') {
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end:   endOfToday
      };
    }
    if (activeFilter === 'yearly') {
      if (selectedYear === null) {
        const startYear = platformCreatedAt
          ? new Date(platformCreatedAt).getFullYear()
          : today.getFullYear();
        return { start: new Date(startYear, 0, 1), end: endOfToday };
      }
      return {
        start: new Date(selectedYear, 0, 1),
        end:   selectedYear === today.getFullYear()
          ? endOfToday
          : new Date(selectedYear, 11, 31, 23, 59, 59, 999)
      };
    }
    return { start: new Date(0), end: endOfToday };
  }, [activeFilter, customDateStart, customDateEnd, selectedYear, platformCreatedAt]);

  // ============================================
  // ANALYTICS
  // ============================================
  const analytics = useMemo(() => {
    const { start, end } = getRange;

    // Build SP user_id → business_email map for fallback
    const spEmailMap = {};
    rawProviders.forEach(p => {
      if (p.user_id) spEmailMap[p.user_id] = p.business_email || null;
    });

    // User email lookup: profiles.email → SP business_email → 'Unknown'
    const userMap = {};
    rawUsers.forEach(u => {
      userMap[u.id] = u.email || spEmailMap[u.id] || null;
    });
    // Also ensure SP users who may not have a profiles row are covered
    rawProviders.forEach(p => {
      if (p.user_id && !userMap[p.user_id]) {
        userMap[p.user_id] = p.business_email || null;
      }
    });

    // Provider city lookup
    const providerCityMap = {};
    rawProviders.forEach(p => {
      providerCityMap[p.id] = normalizeCity(p.city);
    });

    const allSelected =
      availableCities.length === 0 ||
      availableCities.every(c => selectedCities.includes(c));

    const cityFilteredProviderIds = !allSelected
      ? new Set(
          rawProviders
            .filter(p => selectedCities.includes(normalizeCity(p.city)))
            .map(p => p.id)
        )
      : null;

    // Filter bookings by date range + city
    // For submission-day chart we filter by created_at; for others by booking_date
    const filterByCreatedAt = (b) => {
      const d = b.created_at ? new Date(b.created_at) : null;
      if (!d || d < start || d > end) return false;
      if (cityFilteredProviderIds && !cityFilteredProviderIds.has(b.provider_id)) return false;
      if (petTypeFilter !== 'both' && b.booking_pets && b.booking_pets.length > 0) {
        return b.booking_pets.some(p => p.pet_type === petTypeFilter);
      }
      return true;
    };

    const filterByBookingDate = (b) => {
      const d = parseLocalDate(b.booking_date);
      if (!d || d < start || d > end) return false;
      if (cityFilteredProviderIds && !cityFilteredProviderIds.has(b.provider_id)) return false;
      if (petTypeFilter !== 'both' && b.booking_pets && b.booking_pets.length > 0) {
        return b.booking_pets.some(p => p.pet_type === petTypeFilter);
      }
      return true;
    };

    const filteredByDate     = rawBookings.filter(filterByBookingDate);
    const filteredByCreated  = rawBookings.filter(filterByCreatedAt);

    // --------------------------------------------------
    // 1. CUSTOMERS WITH MOST BOOKINGS (top 5, completed)
    // --------------------------------------------------
    const ownerBookingCount = {};
    filteredByDate.forEach(b => {
      if (!isCompleted(b.status)) return;
      ownerBookingCount[b.user_id] = (ownerBookingCount[b.user_id] || 0) + 1;
    });
    const sortedOwners    = Object.entries(ownerBookingCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topOwnerLabels  = sortedOwners.map(([id]) => userMap[id] || 'Unknown');
    const topOwnerValues  = sortedOwners.map(([, cnt]) => cnt);

    // --------------------------------------------------
    // 2. MOST BOOKED PET BREED (top 7, completed bookings)
    // --------------------------------------------------
    const breedCount = {};
    filteredByDate.forEach(b => {
      if (!isCompleted(b.status)) return;
      (b.booking_pets || []).forEach(p => {
        const breedKey = (p.breed || '').trim();
        if (!breedKey) return;
        breedCount[breedKey] = (breedCount[breedKey] || 0) + 1;
      });
    });
    const sortedBreeds  = Object.entries(breedCount).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const breedLabels   = sortedBreeds.map(([breed]) => breed);
    const breedValues   = sortedBreeds.map(([, cnt]) => cnt);

    // --------------------------------------------------
    // 3. DAY PET OWNERS SUBMIT BOOKINGS (by created_at)
    // --------------------------------------------------
    const submissionDayCount = new Array(7).fill(0);
    filteredByCreated.forEach(b => {
      const d = b.created_at ? new Date(b.created_at) : null;
      if (d) submissionDayCount[(d.getDay() + 6) % 7]++;
    });
    const maxSubmit        = Math.max(...submissionDayCount);
    const peakSubmitIdx    = maxSubmit > 0 ? submissionDayCount.indexOf(maxSubmit) : -1;
    const peakSubmitDay    = peakSubmitIdx >= 0 ? DAY_LABELS[peakSubmitIdx] : 'N/A';

    // --------------------------------------------------
    // 4. REPEAT BOOKERS (completed, booked > 1 time)
    // --------------------------------------------------
    const ownerTotalBookings = {};
    filteredByDate.forEach(b => {
      if (!isCompleted(b.status)) return;
      ownerTotalBookings[b.user_id] = (ownerTotalBookings[b.user_id] || 0) + 1;
    });
    const repeatOwners = Object.entries(ownerTotalBookings)
      .filter(([, cnt]) => cnt > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const repeatOwnerLabels = repeatOwners.map(([id]) => userMap[id] || 'Unknown');
    const repeatOwnerValues = repeatOwners.map(([, cnt]) => cnt);

    // --------------------------------------------------
    // 5. PET OWNERS WITH MOST CANCELLATIONS (top 5)
    // --------------------------------------------------
    const ownerCancelCount = {};
    filteredByDate.forEach(b => {
      if (b.status !== 'cancelled') return;
      ownerCancelCount[b.user_id] = (ownerCancelCount[b.user_id] || 0) + 1;
    });
    const sortedCancels     = Object.entries(ownerCancelCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const cancelOwnerLabels = sortedCancels.map(([id]) => userMap[id] || 'Unknown');
    const cancelOwnerValues = sortedCancels.map(([, cnt]) => cnt);
    const totalCancels      = cancelOwnerValues.reduce((a, b) => a + b, 0);

    return {
      // Chart 1
      topOwnerLabels, topOwnerValues,
      // Chart 2
      breedLabels, breedValues,
      // Chart 3
      submissionDayCount, peakSubmitDay, peakSubmitIdx,
      // Chart 4
      repeatOwnerLabels, repeatOwnerValues,
      // Chart 5
      cancelOwnerLabels, cancelOwnerValues, totalCancels,
    };
  }, [rawBookings, rawUsers, rawProviders, getRange, petTypeFilter, selectedCities, availableCities]);

  // ============================================
  // RANGE TEXT
  // ============================================
  const buildRangeText = () => {
    const today = new Date();
    const fmt   = (d) => d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
    if (activeFilter === 'custom' && customDateStart && customDateEnd) {
      return `${fmt(parseLocalDate(customDateStart))} - ${fmt(parseLocalDate(customDateEnd))}`;
    }
    if (activeFilter === 'weekly') {
      const start = new Date(today); start.setDate(today.getDate() - 7);
      return `${fmt(start)} - ${fmt(today)}`;
    }
    if (activeFilter === 'monthly') {
      return `${fmt(new Date(today.getFullYear(), today.getMonth(), 1))} - ${fmt(today)}`;
    }
    if (activeFilter === 'yearly') {
      if (selectedYear === null) return `All Years to ${fmt(today)}`;
      return `Jan 01, ${selectedYear} - Dec 31, ${selectedYear}`;
    }
    return '';
  };

  const buildReportTypeLabel = () => {
    if (activeFilter === 'yearly')
      return selectedYear === null ? 'All Years Summary' : `${selectedYear} Yearly Summary`;
    return `${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Summary`;
  };

  const rangeText = buildRangeText();

  // ============================================
  // CHART DATA
  // ============================================

  // Chart 1 — Customers with Most Bookings (horizontal bar)
  const topOwnersData = {
    labels: analytics.topOwnerLabels.length ? analytics.topOwnerLabels : ['No data'],
    datasets: [{
      label: 'Completed Bookings',
      data: analytics.topOwnerValues.length ? analytics.topOwnerValues : [0],
      backgroundColor: GREEN_SHADES.slice(0, Math.max(analytics.topOwnerValues.length, 1)),
      borderRadius: 5,
      barThickness: 18,
    }]
  };

  // Chart 2 — Most Booked Pet Breed (vertical bar)
  const breedPalette = ['#1e3a8a','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#dbeafe'];
  const breedData = {
    labels: analytics.breedLabels.length ? analytics.breedLabels : ['No data'],
    datasets: [{
      label: 'Bookings',
      data: analytics.breedValues.length ? analytics.breedValues : [0],
      backgroundColor: breedPalette.slice(0, Math.max(analytics.breedValues.length, 1)),
      borderRadius: 5,
      barThickness: 28,
    }]
  };

  // Chart 3 — Submission Day (vertical bar)
  const submissionDayData = {
    labels: DAY_LABELS,
    datasets: [{
      data: analytics.submissionDayCount,
      backgroundColor: DAY_LABELS.map((_, i) =>
        i === analytics.peakSubmitIdx ? '#0d9488' : '#134e4a'
      ),
      borderRadius: 5,
      barThickness: 28,
    }]
  };

  // Chart 4 — Repeat Bookers (horizontal bar)
  const repeatOwnersData = {
    labels: analytics.repeatOwnerLabels.length ? analytics.repeatOwnerLabels : ['No data'],
    datasets: [{
      label: 'Completed Bookings',
      data: analytics.repeatOwnerValues.length ? analytics.repeatOwnerValues : [0],
      backgroundColor: PURPLE_SHADES.slice(0, Math.max(analytics.repeatOwnerValues.length, 1)),
      borderRadius: 5,
      barThickness: 18,
    }]
  };

  // Chart 5 — Pet Owners with Most Cancellations (doughnut)
  const cancellationData = {
    labels: analytics.cancelOwnerLabels.length ? analytics.cancelOwnerLabels : ['No cancellations'],
    datasets: [{
      data: analytics.cancelOwnerValues.length ? analytics.cancelOwnerValues : [1],
      backgroundColor: analytics.cancelOwnerValues.length
        ? ORANGE_SHADES.slice(0, analytics.cancelOwnerValues.length)
        : ['#e2e8f0'],
      borderWidth: 0,
    }]
  };

  // ============================================
  // CHART OPTIONS
  // ============================================
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 9 } }, grid: { display: true } },
      x: { ticks: { font: { size: 9 } }, grid: { display: false } }
    }
  };

  const horizontalBarOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 9 } }, grid: { display: true } },
      y: { ticks: { font: { size: 9 }, maxRotation: 0 }, grid: { display: false } }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend:  { display: false },
      tooltip: { enabled: true }
    }
  };

  // ============================================
  // PDF DOWNLOAD
  // ============================================
  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const element = reportRef.current;
      if (!element) { setIsGeneratingPDF(false); return; }

      const clone = element.cloneNode(true);
      clone.style.cssText =
        'position:absolute;left:-9999px;top:0;width:800px;overflow:visible;' +
        'max-height:none;height:auto;padding:24px;background:#fff;';
      document.body.appendChild(clone);
      await new Promise(r => setTimeout(r, 500));

      const canvas = await html2canvas(clone, {
        scale: 2, useCORS: true, logging: false,
        backgroundColor: '#ffffff', width: clone.scrollWidth, height: clone.scrollHeight
      });
      document.body.removeChild(clone);

      const pdf        = new jsPDF('p', 'mm', 'a4');
      const margin     = 10;
      const imgWidth   = pdf.internal.pageSize.getWidth() - 2 * margin;
      const pageHeight = pdf.internal.pageSize.getHeight() - 2 * margin;
      const totalPages = Math.ceil((canvas.height * imgWidth / canvas.width) / pageHeight);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();
        const sourceY = page * (pageHeight * canvas.width / imgWidth);
        const sourceH = Math.min(pageHeight * canvas.width / imgWidth, canvas.height - sourceY);
        if (sourceH > 0) {
          const pc  = document.createElement('canvas');
          pc.width  = canvas.width;
          pc.height = sourceH;
          const ctx = pc.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pc.width, pc.height);
          ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceH, 0, 0, canvas.width, sourceH);
          pdf.addImage(
            pc.toDataURL('image/png', 1.0), 'PNG',
            margin, margin, imgWidth, sourceH * imgWidth / canvas.width, '', 'FAST'
          );
        }
      }

      pdf.save(`Admin_PetOwner_Insights_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ============================================
  // NO DATA OVERLAY
  // ============================================
  const NoDataOverlay = ({ label }) => (
    <div className="no-data-overlay">
      <span>No {label} data for this period</span>
    </div>
  );

  // ============================================
  // LOADING
  // ============================================
  if (loading) return <div className="admin-insights-loading">Loading Insights...</div>;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="admin-insights-page-wrapper">
      <LoggedInNavbar />

      <div className="admin-insights-main-layout">
        <div className="admin-insights-container">

          {/* ========== SIDEBAR ========== */}
          <aside className="admin-insights-sidebar">

            <button
              className="back-to-dashboard-btn"
              onClick={() => navigate('/admin/dashboard')}
              title="Back to Dashboard"
            >
              <FaArrowLeft size={18} />
            </button>

            {/* Tab switcher */}
            <div className="sidebar-tabs-group">
              <button
                className="sidebar-tab-btn"
                onClick={() => navigate('/admin/service-provider-insights')}
              >
                Service Provider Insights
              </button>
              <button
                className="sidebar-tab-btn active"
                onClick={() => navigate('/admin/pet-owner-insights')}
              >
                Pet Owner Insights
              </button>
            </div>

            {/* Timeframe */}
            <div className="sidebar-section">
              <h3>Timeframe</h3>
              <select
                className="filter-dropdown"
                value={activeFilter}
                onChange={(e) => {
                  setActiveFilter(e.target.value);
                  setSelectedYear(new Date().getFullYear());
                }}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom Range</option>
              </select>

              {activeFilter === 'yearly' && (
                <div className="custom-date-range">
                  <label className="date-label">Year:</label>
                  <select
                    className="filter-dropdown"
                    value={selectedYear === null ? '' : selectedYear}
                    onChange={(e) =>
                      setSelectedYear(e.target.value === '' ? null : Number(e.target.value))
                    }
                  >
                    <option value="">All Years</option>
                    {(() => {
                      const startYear = platformCreatedAt
                        ? new Date(platformCreatedAt).getFullYear()
                        : new Date().getFullYear();
                      const endYear = new Date().getFullYear();
                      return Array.from(
                        { length: endYear - startYear + 1 },
                        (_, i) => endYear - i
                      ).map(y => <option key={y} value={y}>{y}</option>);
                    })()}
                  </select>
                </div>
              )}

              {activeFilter === 'custom' && (
                <div className="custom-date-range">
                  <label className="date-label">From:</label>
                  <input
                    type="date" className="date-input" value={customDateStart}
                    onChange={(e) => setCustomDateStart(e.target.value)}
                    max={customDateEnd || new Date().toISOString().split('T')[0]}
                    min={platformCreatedAt}
                  />
                  <label className="date-label">To:</label>
                  <input
                    type="date" className="date-input" value={customDateEnd}
                    onChange={(e) => setCustomDateEnd(e.target.value)}
                    min={platformCreatedAt || customDateStart}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}
            </div>

            {/* Pet Type */}
            <div className="sidebar-section">
              <h3>Pet Type</h3>
              <select
                className="filter-dropdown"
                value={petTypeFilter}
                onChange={(e) => setPetTypeFilter(e.target.value)}
              >
                <option value="both">Both (Dog & Cat)</option>
                <option value="Dog">Dog</option>
                <option value="Cat">Cat</option>
              </select>
            </div>

            {/* City Filter */}
            {availableCities.length > 0 && (
              <div className="sidebar-section">
                <h3>City</h3>
                <button className="city-select-all" onClick={toggleAllCities}>
                  {selectedCities.length === availableCities.length ? 'Clear All' : 'Select All'}
                </button>
                <div className="city-filter-scroll">
                  {availableCities.map(city => (
                    <label key={city} className="city-option">
                      <input
                        type="checkbox"
                        checked={selectedCities.includes(city)}
                        onChange={() => toggleCity(city)}
                      />
                      <span className="city-option-label">{city}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

          </aside>

          {/* ========== MAIN CONTENT ========== */}
          <main className="admin-insights-main-content">

            {/* Header */}
            <div className="report-button-container">
              <div className="as-of-date">
                As of {new Date().toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric'
                })}
              </div>
              <button className="generate-report-btn" onClick={() => setShowReportModal(true)}>
                <FaFileAlt size={16} />
                <span>Generate Insights Report</span>
              </button>
            </div>

            {/* ===== PET OWNER INSIGHTS CHARTS ===== */}
            <div className="insights-charts-grid">

              {/* CHART 1 — Customers with Most Bookings */}
              <div className="chart-box chart-half">
                <div className="chart-header">
                  <h3 className="chart-title">Customers with Most Bookings</h3>
                  <span className="date-range">{rangeText}</span>
                </div>
                {analytics.topOwnerLabels.length > 0 && (
                  <p className="chart-insight-text">
                    🏆 <strong>{analytics.topOwnerLabels[0]}</strong> leads with{' '}
                    {analytics.topOwnerValues[0]} completed booking{analytics.topOwnerValues[0] !== 1 ? 's' : ''}
                  </p>
                )}
                <div className="chart-container-medium">
                  {analytics.topOwnerLabels.length === 0 && <NoDataOverlay label="booking" />}
                  <Bar data={topOwnersData} options={horizontalBarOptions} />
                </div>
              </div>

              {/* CHART 2 — Most Booked Pet Breed */}
              <div className="chart-box chart-half">
                <div className="chart-header">
                  <h3 className="chart-title">Most Booked Pet Breed</h3>
                  <span className="date-range">{rangeText}</span>
                </div>
                {analytics.breedLabels.length > 0 && (
                  <p className="chart-insight-text">
                    🐾 <strong>{analytics.breedLabels[0]}</strong> is the most booked breed with{' '}
                    {analytics.breedValues[0]} booking{analytics.breedValues[0] !== 1 ? 's' : ''}
                  </p>
                )}
                <div className="chart-container-medium">
                  {analytics.breedLabels.length === 0 && <NoDataOverlay label="breed" />}
                  <Bar data={breedData} options={barOptions} />
                </div>
              </div>

              {/* CHART 3 — Day Pet Owners Submit Bookings (full width) */}
              <div className="chart-box chart-full-width">
                <div className="chart-header">
                  <h3 className="chart-title">Day Pet Owners Submit Bookings</h3>
                  <span className="date-range">{rangeText}</span>
                </div>
                {analytics.peakSubmitDay !== 'N/A' && (
                  <p className="chart-insight-text">
                    📅 Most bookings are submitted on{' '}
                    <strong>{analytics.peakSubmitDay}</strong> —{' '}
                    {Math.max(...analytics.submissionDayCount)} submission{Math.max(...analytics.submissionDayCount) !== 1 ? 's' : ''}
                  </p>
                )}
                <div className="chart-container-main">
                  {Math.max(...analytics.submissionDayCount) === 0 && <NoDataOverlay label="submission" />}
                  <Bar data={submissionDayData} options={barOptions} />
                </div>
              </div>

              {/* CHART 4 — Repeat Bookers */}
              <div className="chart-box chart-half">
                <div className="chart-header">
                  <h3 className="chart-title">Repeat Bookers</h3>
                  <span className="date-range">{rangeText}</span>
                </div>
                {analytics.repeatOwnerLabels.length > 0 && (
                  <p className="chart-insight-text">
                    🔁 <strong>{analytics.repeatOwnerLabels[0]}</strong> —{' '}
                    {analytics.repeatOwnerValues[0]} booking{analytics.repeatOwnerValues[0] !== 1 ? 's' : ''}
                  </p>
                )}
                <div className="chart-container-medium">
                  {analytics.repeatOwnerLabels.length === 0 && <NoDataOverlay label="repeat booking" />}
                  <Bar data={repeatOwnersData} options={horizontalBarOptions} />
                </div>
              </div>

              {/* CHART 5 — Pet Owners with Most Cancellations */}
              <div className="chart-box chart-half">
                <div className="chart-header">
                  <h3 className="chart-title">Pet Owners with Most Cancellations</h3>
                  <span className="date-range">{rangeText}</span>
                </div>
                {analytics.totalCancels > 0 && (
                  <p className="chart-insight-text">
                    ⚠️ <strong>{analytics.cancelOwnerLabels[0]}</strong> leads with{' '}
                    {analytics.cancelOwnerValues[0]} cancellation{analytics.cancelOwnerValues[0] !== 1 ? 's' : ''} —{' '}
                    {analytics.totalCancels} total
                  </p>
                )}
                <div className="doughnut-row">
                  <div className="chart-container-doughnut" style={{ width: 140, height: 140 }}>
                    {analytics.totalCancels === 0 && <NoDataOverlay label="cancellation" />}
                    <Doughnut data={cancellationData} options={doughnutOptions} />
                  </div>
                  {analytics.cancelOwnerLabels.length > 0 && (
                    <ul className="doughnut-inline-legend">
                      {analytics.cancelOwnerLabels.map((label, i) => (
                        <li key={label + i}>
                          <span
                            className="doughnut-legend-dot"
                            style={{ background: ORANGE_SHADES[i] || '#fb923c' }}
                          />
                          <span className="doughnut-legend-name">{label}</span>
                          <span className="doughnut-legend-count" style={{ color: '#ea580c' }}>
                            {analytics.cancelOwnerValues[i]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

            </div>
          </main>
        </div>
      </div>

      {/* ========== REPORT MODAL ========== */}
      {showReportModal && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal-content" onClick={(e) => e.stopPropagation()}>

            <div className="report-modal-header">
              <div className="report-header-title">
                <FaFileAlt size={20} />
                <h2>Pet Owner Insights Report</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setShowReportModal(false)}>
                <FaTimes />
              </button>
            </div>

            <div className="report-modal-body" ref={reportRef}>

              <div className="report-info-section">
                <div className="report-info-row">
                  <span className="report-label">Report Period:</span>
                  <span className="report-value">{rangeText}</span>
                </div>
                <div className="report-info-row">
                  <span className="report-label">Report Type:</span>
                  <span className="report-value">{buildReportTypeLabel()}</span>
                </div>
                <div className="report-info-row">
                  <span className="report-label">Insights Category:</span>
                  <span className="report-value">Pet Owner Insights</span>
                </div>
                <div className="report-info-row">
                  <span className="report-label">Pet Type Filter:</span>
                  <span className="report-value">
                    {petTypeFilter === 'both' ? 'All Pets (Dog & Cat)' : petTypeFilter}
                  </span>
                </div>
                <div className="report-info-row">
                  <span className="report-label">City Filter:</span>
                  <span className="report-value">
                    {selectedCities.length === availableCities.length || selectedCities.length === 0
                      ? 'All Cities'
                      : selectedCities.join(', ')}
                  </span>
                </div>
                <div className="report-info-row">
                  <span className="report-label">Generated:</span>
                  <span className="report-value">
                    {new Date().toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              {/* 1. Customers with Most Bookings */}
              <div className="report-section">
                <h3 className="report-section-title">Customers with Most Bookings (Top 5)</h3>
                {analytics.topOwnerLabels.length > 0 ? (
                  <div className="report-services-list">
                    {analytics.topOwnerLabels.map((name, i) => (
                      <div key={`owner-${i}`} className="service-item">
                        <div className="service-info">
                          <span className="service-rank" style={{ background: '#15803d' }}>#{i + 1}</span>
                          <span className="service-name">{name}</span>
                        </div>
                        <div className="service-stats">
                          <span className="service-count">{analytics.topOwnerValues[i]} bookings</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="report-empty-notice"><p>No booking data for this period.</p></div>
                )}
              </div>

              {/* 2. Most Booked Pet Breed */}
              <div className="report-section">
                <h3 className="report-section-title">Most Booked Pet Breed (Top 7)</h3>
                {analytics.breedLabels.length > 0 ? (
                  <div className="report-services-list">
                    {analytics.breedLabels.map((breed, i) => (
                      <div key={`breed-${i}`} className="service-item">
                        <div className="service-info">
                          <span className="service-rank" style={{ background: '#1e3a8a' }}>#{i + 1}</span>
                          <span className="service-name">{breed}</span>
                        </div>
                        <div className="service-stats">
                          <span className="service-count">{analytics.breedValues[i]} booking{analytics.breedValues[i] !== 1 ? 's' : ''}</span>
                          <span className="service-percentage" style={{ background: '#eff6ff', color: '#1e3a8a' }}>
                            {analytics.breedValues.reduce((a, b) => a + b, 0) > 0
                              ? Math.round((analytics.breedValues[i] / analytics.breedValues.reduce((a, b) => a + b, 0)) * 100)
                              : 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="report-empty-notice"><p>No breed data for this period.</p></div>
                )}
              </div>

              {/* 3. Submission Day Breakdown */}
              <div className="report-section">
                <h3 className="report-section-title">Booking Submission Day Breakdown</h3>
                <div className="report-insights">
                  <div className="insight-item" style={{ borderLeftColor: '#0d9488' }}>
                    <strong>Peak Submission Day</strong>
                    <p>
                      {analytics.peakSubmitDay !== 'N/A'
                        ? `${analytics.peakSubmitDay} had the most booking submissions with ${Math.max(...analytics.submissionDayCount)} submission(s).`
                        : 'No bookings were submitted during this period.'}
                    </p>
                  </div>
                  <div className="insight-item" style={{ borderLeftColor: '#0d9488' }}>
                    <strong>Day-by-Day Breakdown</strong>
                    <p>{DAY_LABELS.map((day, i) => `${day}: ${analytics.submissionDayCount[i]}`).join(' · ')}</p>
                  </div>
                </div>
              </div>

              {/* 4. Repeat Bookers */}
              <div className="report-section">
                <h3 className="report-section-title">Repeat Bookers (Top 5)</h3>
                {analytics.repeatOwnerLabels.length > 0 ? (
                  <div className="report-services-list">
                    {analytics.repeatOwnerLabels.map((name, i) => (
                      <div key={`repeat-${i}`} className="service-item">
                        <div className="service-info">
                          <span className="service-rank" style={{ background: '#7c3aed' }}>#{i + 1}</span>
                          <span className="service-name">{name}</span>
                        </div>
                        <div className="service-stats">
                          <span className="service-count">
                            {analytics.repeatOwnerValues[i]} booking{analytics.repeatOwnerValues[i] !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="report-empty-notice"><p>No repeat booking data for this period.</p></div>
                )}
              </div>

              {/* 5. Cancellations */}
              <div className="report-section">
                <h3 className="report-section-title">Cancellations by Pet Owner (Top 5)</h3>
                {analytics.cancelOwnerLabels.length > 0 ? (
                  <div className="report-services-list">
                    {analytics.cancelOwnerLabels.map((name, i) => (
                      <div key={`cancel-${i}`} className="service-item">
                        <div className="service-info">
                          <span className="service-rank" style={{ background: '#ea580c' }}>#{i + 1}</span>
                          <span className="service-name">{name}</span>
                        </div>
                        <div className="service-stats">
                          <span className="service-count">
                            {analytics.cancelOwnerValues[i]} cancellation{analytics.cancelOwnerValues[i] !== 1 ? 's' : ''}
                          </span>
                          <span className="service-percentage" style={{ background: '#fff7ed', color: '#ea580c' }}>
                            {analytics.totalCancels > 0
                              ? Math.round((analytics.cancelOwnerValues[i] / analytics.totalCancels) * 100)
                              : 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="report-empty-notice"><p>No cancellations recorded for this period.</p></div>
                )}
              </div>

            </div>

            <div className="report-modal-footer">
              <button
                className="btn-download-report"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
              >
                {isGeneratingPDF
                  ? <><FaDownload /> Generating PDF...</>
                  : <><FaDownload /> Download as PDF</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}