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
import './AdminSPInsights.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement,
  Tooltip, Legend
);

// ============================================
// CONSTANTS
// ============================================
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BLUE_SHADES  = ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];
const YELLOW_SHADES = ['#854d0e', '#ca8a04', '#d97706', '#facc15', '#fde047'];
const RED_SHADES   = ['#7f1d1d', '#991b1b', '#dc2626', '#ef4444', '#f87171'];

// ============================================
// HELPERS
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

export default function AdminSPInsights() {
  const navigate = useNavigate();
  const reportRef = useRef(null);

  // ============================================
  // STATE
  // ============================================
  const [activeTab, setActiveTab]         = useState('sp_insights');
  const [activeFilter, setActiveFilter]   = useState('monthly');
  const [petTypeFilter, setPetTypeFilter] = useState('both');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd]     = useState('');
  const [selectedYear, setSelectedYear]   = useState(new Date().getFullYear());
  const [loading, setLoading]             = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [platformCreatedAt, setPlatformCreatedAt] = useState(null);
  const [rawBookings, setRawBookings]     = useState([]);
  const [rawProviders, setRawProviders]   = useState([]);
  const [selectedCities, setSelectedCities] = useState([]); // empty = all cities

  // ============================================
  // DATA FETCHING
  // ============================================
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate('/login');

        // Fetch ALL service providers (no status filter — bookings may belong to any)
        const { data: providers, error: pErr } = await supabase
          .from('service_providers')
          .select('id, business_name, created_at, city');
        if (pErr) throw pErr;
        setRawProviders(providers || []);

        // Earliest provider date → used as min for custom date picker
        if (providers && providers.length > 0) {
          const earliest = providers.reduce((a, b) =>
            new Date(a.created_at) < new Date(b.created_at) ? a : b
          );
          setPlatformCreatedAt(earliest.created_at.split('T')[0]);
        }

        // Fetch ALL bookings with pet data
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
              pet_type
            )
          `)
          .order('created_at', { ascending: false });
        if (bErr) throw bErr;
        setRawBookings(bookings || []);

      } catch (err) {
        console.error('Admin Insights Fetch Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  // ============================================
  // COMPUTED DATE RANGE
  // ============================================
  const getRange = useMemo(() => {
    const today = new Date();
    const endOfToday = endOfDayDate(today);

    if (activeFilter === 'custom' && customDateStart && customDateEnd) {
      return {
        start: parseLocalDate(customDateStart),
        end: endOfDayDate(parseLocalDate(customDateEnd))
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
        end: endOfToday
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
        end: selectedYear === today.getFullYear()
          ? endOfToday
          : new Date(selectedYear, 11, 31, 23, 59, 59, 999)
      };
    }
    return { start: new Date(0), end: endOfToday };
  }, [activeFilter, customDateStart, customDateEnd, selectedYear, platformCreatedAt]);

  // ============================================
  // ANALYTICS CALCULATIONS
  // ============================================
  const analytics = useMemo(() => {
    const { start, end } = getRange;

    // Build provider name + city lookup map
    const providerMap  = {};
    const providerCity = {};
    rawProviders.forEach(p => {
      providerMap[p.id]  = p.business_name || 'Unknown';
      providerCity[p.id] = p.city || '';
    });

    // If cities are selected, restrict to provider IDs in those cities
    const cityFilteredProviderIds =
      selectedCities.length > 0
        ? new Set(
            rawProviders
              .filter(p => selectedCities.includes(p.city))
              .map(p => p.id)
          )
        : null; // null = no restriction

    // Filter bookings by date range, optional pet type, optional city
    const filteredBookings = rawBookings.filter(b => {
      const d = parseLocalDate(b.booking_date);
      if (!d || d < start || d > end) return false;
      if (cityFilteredProviderIds && !cityFilteredProviderIds.has(b.provider_id)) return false;
      if (petTypeFilter !== 'both' && b.booking_pets && b.booking_pets.length > 0) {
        return b.booking_pets.some(p => p.pet_type === petTypeFilter);
      }
      return true;
    });

    // ---------------------------------------------------
    // 1. MOST BOOKED DAY
    //    Count completed bookings per weekday (Mon–Sun)
    // ---------------------------------------------------
    const dayCount = new Array(7).fill(0);
    filteredBookings.forEach(b => {
      if (!isCompleted(b.status)) return;
      const d = parseLocalDate(b.booking_date);
      if (d) dayCount[(d.getDay() + 6) % 7]++;
    });
    const maxDay     = Math.max(...dayCount);
    const peakDayIdx = maxDay > 0 ? dayCount.indexOf(maxDay) : -1;
    const peakDay    = peakDayIdx >= 0 ? DAY_LABELS[peakDayIdx] : 'N/A';

    // ---------------------------------------------------
    // 2. MOST BOOKED SERVICE PROVIDER
    //    Top 5 providers by completed booking count
    // ---------------------------------------------------
    const providerBookingCount = {};
    filteredBookings.forEach(b => {
      if (!isCompleted(b.status)) return;
      providerBookingCount[b.provider_id] = (providerBookingCount[b.provider_id] || 0) + 1;
    });
    const sortedByBookings = Object.entries(providerBookingCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topBookedLabels = sortedByBookings.map(([id]) => providerMap[id] || 'Unknown');
    const topBookedValues = sortedByBookings.map(([, cnt]) => cnt);

    // ---------------------------------------------------
    // 3. MOST REBOOKED SERVICE PROVIDER
    //    Provider with most returning customers
    //    (unique users who booked the same provider > once)
    // ---------------------------------------------------
    const providerUserMap = {};
    filteredBookings.forEach(b => {
      if (!isCompleted(b.status)) return;
      if (!providerUserMap[b.provider_id]) providerUserMap[b.provider_id] = {};
      providerUserMap[b.provider_id][b.user_id] =
        (providerUserMap[b.provider_id][b.user_id] || 0) + 1;
    });
    const rebookCount = {};
    Object.entries(providerUserMap).forEach(([pid, users]) => {
      const returners = Object.values(users).filter(cnt => cnt > 1).length;
      if (returners > 0) rebookCount[pid] = returners;
    });
    const sortedByRebooks = Object.entries(rebookCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topRebookLabels = sortedByRebooks.map(([id]) => providerMap[id] || 'Unknown');
    const topRebookValues = sortedByRebooks.map(([, cnt]) => cnt);

    // ---------------------------------------------------
    // 4. SERVICE PROVIDERS WITH MOST CANCELLATIONS
    //    Top 5 by cancelled booking count
    // ---------------------------------------------------
    const cancelCount = {};
    filteredBookings.forEach(b => {
      if (b.status !== 'cancelled') return;
      cancelCount[b.provider_id] = (cancelCount[b.provider_id] || 0) + 1;
    });
    const sortedByCancels = Object.entries(cancelCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const cancelLabels  = sortedByCancels.map(([id]) => providerMap[id] || 'Unknown');
    const cancelValues  = sortedByCancels.map(([, cnt]) => cnt);
    const totalCancels  = cancelValues.reduce((a, b) => a + b, 0);

    return {
      dayCount, peakDay, peakDayIdx,
      topBookedLabels, topBookedValues,
      topRebookLabels, topRebookValues,
      cancelLabels, cancelValues, totalCancels,
    };
  }, [rawBookings, rawProviders, getRange, petTypeFilter, selectedCities]);

  // ============================================
  // DERIVED CITY LIST (sorted, deduplicated)
  // ============================================
  const availableCities = useMemo(() => {
    const cities = rawProviders
      .map(p => p.city)
      .filter(Boolean)
      .map(c => c.trim());
    return [...new Set(cities)].sort((a, b) => a.localeCompare(b));
  }, [rawProviders]);

  const toggleCity = (city) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  const toggleAllCities = () => {
    setSelectedCities(prev => prev.length === availableCities.length ? [] : [...availableCities]);
  };

  // ============================================
  // RANGE TEXT HELPERS
  // ============================================
  const buildRangeText = () => {
    const today = new Date();
    const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
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
    if (activeFilter === 'yearly') return selectedYear === null ? 'All Years Summary' : `${selectedYear} Yearly Summary`;
    return `${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Summary`;
  };

  const rangeText = buildRangeText();

  // ============================================
  // CHART DATA
  // ============================================
  const mostBookedDayData = {
    labels: DAY_LABELS,
    datasets: [{
      data: analytics.dayCount,
      backgroundColor: DAY_LABELS.map((_, i) =>
        i === analytics.peakDayIdx ? '#facc15' : '#1e3a8a'
      ),
      borderRadius: 4,
      barThickness: 28,
    }]
  };

  const mostBookedSPData = {
    labels: analytics.topBookedLabels.length > 0 ? analytics.topBookedLabels : ['No data'],
    datasets: [{
      data: analytics.topBookedValues.length > 0 ? analytics.topBookedValues : [0],
      backgroundColor: BLUE_SHADES.slice(0, Math.max(analytics.topBookedValues.length, 1)),
      borderRadius: 4,
      barThickness: 16,
    }]
  };

  const mostRebookedSPData = {
    labels: analytics.topRebookLabels.length > 0 ? analytics.topRebookLabels : ['No data'],
    datasets: [{
      data: analytics.topRebookValues.length > 0 ? analytics.topRebookValues : [0],
      backgroundColor: YELLOW_SHADES.slice(0, Math.max(analytics.topRebookValues.length, 1)),
      borderRadius: 4,
      barThickness: 16,
    }]
  };

  const cancellationData = {
    labels: analytics.cancelLabels.length > 0 ? analytics.cancelLabels : ['No cancellations'],
    datasets: [{
      data: analytics.cancelValues.length > 0 ? analytics.cancelValues : [1],
      backgroundColor: analytics.cancelValues.length > 0
        ? RED_SHADES.slice(0, analytics.cancelValues.length)
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

  // Doughnut — legend hidden, tooltip only
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
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
        'position:absolute;left:-9999px;top:0;width:800px;overflow:visible;max-height:none;height:auto;padding:24px;background:#fff;';
      document.body.appendChild(clone);
      await new Promise(r => setTimeout(r, 500));

      const canvas = await html2canvas(clone, {
        scale: 2, useCORS: true, logging: false,
        backgroundColor: '#ffffff', width: clone.scrollWidth, height: clone.scrollHeight
      });
      document.body.removeChild(clone);

      const pdf    = new jsPDF('p', 'mm', 'a4');
      const margin = 10;
      const imgWidth   = pdf.internal.pageSize.getWidth() - 2 * margin;
      const pageHeight = pdf.internal.pageSize.getHeight() - 2 * margin;
      const totalPages = Math.ceil((canvas.height * imgWidth / canvas.width) / pageHeight);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();
        const sourceY = page * (pageHeight * canvas.width / imgWidth);
        const sourceH = Math.min(pageHeight * canvas.width / imgWidth, canvas.height - sourceY);
        if (sourceH > 0) {
          const pc = document.createElement('canvas');
          pc.width = canvas.width; pc.height = sourceH;
          const ctx = pc.getContext('2d');
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, pc.width, pc.height);
          ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceH, 0, 0, canvas.width, sourceH);
          pdf.addImage(
            pc.toDataURL('image/png', 1.0), 'PNG',
            margin, margin, imgWidth, sourceH * imgWidth / canvas.width, '', 'FAST'
          );
        }
      }

      const tabLabel = activeTab === 'sp_insights' ? 'SP_Insights' : 'PetOwner_Insights';
      pdf.save(`Admin_${tabLabel}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
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

            <div className="sidebar-tabs-group">
              <button
                className={`sidebar-tab-btn ${activeTab === 'sp_insights' ? 'active' : ''}`}
                onClick={() => setActiveTab('sp_insights')}
              >
                Service Provider Insights
              </button>
              <button
                className={`sidebar-tab-btn ${activeTab === 'petowner_insights' ? 'active' : ''}`}
                onClick={() => setActiveTab('petowner_insights')}
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
                  {selectedCities.length === availableCities.length || selectedCities.length === 0
                    ? 'Select All'
                    : 'Clear All'}
                </button>
                <div className="city-filter-scroll">
                  {availableCities.map(city => (
                    <label key={city} className="city-option">
                      <input
                        type="checkbox"
                        checked={selectedCities.length === 0 || selectedCities.includes(city)}
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

            {/* ===== SP INSIGHTS TAB ===== */}
            {activeTab === 'sp_insights' ? (
              <div className="insights-charts-grid">

                {/* CHART 1 — Most Booked Day (full width) */}
                <div className="chart-box chart-full-width">
                  <div className="chart-header">
                    <h3 className="chart-title">Most Booked Day</h3>
                    <span className="date-range">{rangeText}</span>
                  </div>
                  {analytics.peakDay !== 'N/A' && (
                    <p className="chart-insight-text">
                      📅 <strong>{analytics.peakDay}</strong> is the busiest day —{' '}
                      {Math.max(...analytics.dayCount)} completed booking
                      {Math.max(...analytics.dayCount) !== 1 ? 's' : ''}
                    </p>
                  )}
                  <div className="chart-container-main">
                    {Math.max(...analytics.dayCount) === 0 && <NoDataOverlay label="booking" />}
                    <Bar data={mostBookedDayData} options={barOptions} />
                  </div>
                </div>

                {/* CHART 2 — Most Booked SP (half, horizontal) */}
                <div className="chart-box chart-half">
                  <div className="chart-header">
                    <h3 className="chart-title">Most Booked Providers</h3>
                    <span className="date-range">{rangeText}</span>
                  </div>
                  {analytics.topBookedLabels.length > 0 && (
                    <p className="chart-insight-text">
                      🏆 <strong>{analytics.topBookedLabels[0]}</strong> —{' '}
                      {analytics.topBookedValues[0]} booking
                      {analytics.topBookedValues[0] !== 1 ? 's' : ''}
                    </p>
                  )}
                  <div className="chart-container-medium">
                    {analytics.topBookedLabels.length === 0 && <NoDataOverlay label="booking" />}
                    <Bar data={mostBookedSPData} options={horizontalBarOptions} />
                  </div>
                </div>

                {/* CHART 3 — Most Rebooked SP (half, horizontal) */}
                <div className="chart-box chart-half">
                  <div className="chart-header">
                    <h3 className="chart-title">Most Rebooked Providers</h3>
                    <span className="date-range">{rangeText}</span>
                  </div>
                  {analytics.topRebookLabels.length > 0 && (
                    <p className="chart-insight-text">
                      🔁 <strong>{analytics.topRebookLabels[0]}</strong> —{' '}
                      {analytics.topRebookValues[0]} returning customer
                      {analytics.topRebookValues[0] !== 1 ? 's' : ''}
                    </p>
                  )}
                  <div className="chart-container-medium">
                    {analytics.topRebookLabels.length === 0 && <NoDataOverlay label="rebook" />}
                    <Bar data={mostRebookedSPData} options={horizontalBarOptions} />
                  </div>
                </div>

                {/* CHART 4 — Most Cancellations (full width, doughnut) */}
                <div className="chart-box chart-full-width">
                  <div className="chart-header">
                    <h3 className="chart-title">Providers with Most Cancellations</h3>
                    <span className="date-range">{rangeText}</span>
                  </div>
                  {analytics.totalCancels > 0 && (
                    <p className="chart-insight-text">
                      ⚠️ <strong>{analytics.cancelLabels[0]}</strong> leads with{' '}
                      {analytics.cancelValues[0]} cancellation
                      {analytics.cancelValues[0] !== 1 ? 's' : ''} —{' '}
                      {analytics.totalCancels} total platform-wide
                    </p>
                  )}
                  {/* Doughnut + inline labels side by side */}
                  <div className="doughnut-row">
                    <div className="chart-container-doughnut">
                      {analytics.totalCancels === 0 && <NoDataOverlay label="cancellation" />}
                      <Doughnut data={cancellationData} options={doughnutOptions} />
                    </div>
                    {analytics.cancelLabels.length > 0 && (
                      <ul className="doughnut-inline-legend">
                        {analytics.cancelLabels.map((label, i) => (
                          <li key={label + i}>
                            <span
                              className="doughnut-legend-dot"
                              style={{ background: RED_SHADES[i] || '#f87171' }}
                            />
                            <span className="doughnut-legend-name">{label}</span>
                            <span className="doughnut-legend-count">{analytics.cancelValues[i]}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              /* ===== PET OWNER INSIGHTS — placeholder ===== */
              <div className="insights-content-area">
                <div className="insights-placeholder">
                  <div className="placeholder-icon">🐾</div>
                  <h3>Pet Owner Insights</h3>
                  <p>
                    Charts and analytics for pet owners will appear here.<br />
                    Use the filters on the left to adjust the timeframe and pet type.
                  </p>
                  <div className="placeholder-filter-summary">
                    <span className="filter-badge">
                      {activeFilter === 'yearly' && selectedYear === null
                        ? 'All Years'
                        : activeFilter === 'yearly'
                        ? `Year ${selectedYear}`
                        : activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}
                    </span>
                    <span className="filter-badge">
                      {petTypeFilter === 'both' ? 'Dog & Cat' : petTypeFilter}
                    </span>
                  </div>
                </div>
              </div>
            )}
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
                <h2>
                  {activeTab === 'sp_insights'
                    ? 'Service Provider Insights Report'
                    : 'Pet Owner Insights Report'}
                </h2>
              </div>
              <button className="modal-close-btn" onClick={() => setShowReportModal(false)}>
                <FaTimes />
              </button>
            </div>

            <div className="report-modal-body" ref={reportRef}>

              {/* Meta */}
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
                  <span className="report-value">
                    {activeTab === 'sp_insights' ? 'Service Provider Insights' : 'Pet Owner Insights'}
                  </span>
                </div>
                <div className="report-info-row">
                  <span className="report-label">Pet Type Filter:</span>
                  <span className="report-value">
                    {petTypeFilter === 'both' ? 'All Pets (Dog & Cat)' : petTypeFilter}
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

              {activeTab === 'sp_insights' ? (
                <>
                  {/* Peak Day */}
                  <div className="report-section">
                    <h3 className="report-section-title">Most Booked Day</h3>
                    <div className="report-insights">
                      <div className="insight-item">
                        <strong>Peak Day</strong>
                        <p>
                          {analytics.peakDay !== 'N/A'
                            ? `${analytics.peakDay} recorded the highest number of completed bookings during this period with ${Math.max(...analytics.dayCount)} booking(s).`
                            : 'No completed bookings were found for this period.'}
                        </p>
                      </div>
                      <div className="insight-item">
                        <strong>Day Breakdown</strong>
                        <p>
                          {DAY_LABELS.map((day, i) =>
                            `${day}: ${analytics.dayCount[i]}`
                          ).join(' · ')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Most Booked SP */}
                  <div className="report-section">
                    <h3 className="report-section-title">Most Booked Service Providers (Top 5)</h3>
                    {analytics.topBookedLabels.length > 0 ? (
                      <div className="report-services-list">
                        {analytics.topBookedLabels.map((name, i) => (
                          <div key={`booked-${i}`} className="service-item">
                            <div className="service-info">
                              <span className="service-rank">#{i + 1}</span>
                              <span className="service-name">{name}</span>
                            </div>
                            <div className="service-stats">
                              <span className="service-count">{analytics.topBookedValues[i]} bookings</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="report-empty-notice"><p>No booking data for this period.</p></div>
                    )}
                  </div>

                  {/* Most Rebooked SP */}
                  <div className="report-section">
                    <h3 className="report-section-title">Most Rebooked Service Providers (Top 5)</h3>
                    {analytics.topRebookLabels.length > 0 ? (
                      <div className="report-services-list">
                        {analytics.topRebookLabels.map((name, i) => (
                          <div key={`rebook-${i}`} className="service-item">
                            <div className="service-info">
                              <span className="service-rank" style={{ background: '#ca8a04' }}>#{i + 1}</span>
                              <span className="service-name">{name}</span>
                            </div>
                            <div className="service-stats">
                              <span className="service-count">
                                {analytics.topRebookValues[i]} returning customer
                                {analytics.topRebookValues[i] !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="report-empty-notice"><p>No rebooking data for this period.</p></div>
                    )}
                  </div>

                  {/* Cancellations */}
                  <div className="report-section">
                    <h3 className="report-section-title">Cancellations by Provider (Top 5)</h3>
                    {analytics.cancelLabels.length > 0 ? (
                      <div className="report-services-list">
                        {analytics.cancelLabels.map((name, i) => (
                          <div key={`cancel-${i}`} className="service-item">
                            <div className="service-info">
                              <span className="service-rank" style={{ background: '#dc2626' }}>#{i + 1}</span>
                              <span className="service-name">{name}</span>
                            </div>
                            <div className="service-stats">
                              <span className="service-count">
                                {analytics.cancelValues[i]} cancellation
                                {analytics.cancelValues[i] !== 1 ? 's' : ''}
                              </span>
                              <span className="service-percentage" style={{ background: '#fee2e2', color: '#dc2626' }}>
                                {analytics.totalCancels > 0
                                  ? Math.round((analytics.cancelValues[i] / analytics.totalCancels) * 100)
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
                </>
              ) : (
                <div className="report-section">
                  <h3 className="report-section-title">Pet Owner Summary</h3>
                  <div className="report-empty-notice">
                    <p>
                      Analytics data for <strong>{rangeText}</strong> will be displayed
                      here once charts are integrated.
                    </p>
                  </div>
                </div>
              )}
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