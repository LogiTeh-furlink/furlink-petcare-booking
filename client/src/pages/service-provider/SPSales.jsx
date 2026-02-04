import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCaretUp, FaCaretDown, FaMinus, FaFileAlt, FaTimes } from 'react-icons/fa';
import './SPSales.css';

export default function SPSales() {
  const navigate = useNavigate();
  
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [activeTab] = useState('sales'); 
  const [activeFilter, setActiveFilter] = useState('monthly');
  const [petTypeFilter, setPetTypeFilter] = useState('both');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [rawBookings, setRawBookings] = useState([]);
  const [listingVisitors, setListingVisitors] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);

  // ============================================
  // DATA FETCHING
  // ============================================
  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/login");

        const { data: provider } = await supabase
          .from("service_providers")
          .select("id, click_count")
          .eq("user_id", user.id)
          .single();

        if (!provider) return;

        setListingVisitors(provider.click_count || 0);

        // Fetch bookings with related data
        const { data: bookings, error: bError } = await supabase
          .from('bookings')
          .select(`
            id, 
            booking_date, 
            total_estimated_price, 
            status, 
            user_id, 
            time_slot,
            booking_pets (
              id,
              pet_type
            )
          `)
          .eq('provider_id', provider.id);

        if (bError) throw bError;
        setRawBookings(bookings || []);

      } catch (err) {
        console.error("Sales Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSalesData();
  }, [navigate]);

  // ============================================
  // ANALYTICS CALCULATIONS
  // ============================================
  const analytics = useMemo(() => {
    const now = new Date();
    
    // Helper function to get date ranges based on filter
    const getRange = (filter, isPrevious = false) => {
      if (filter === 'custom' && customDateStart && customDateEnd) {
        const start = new Date(customDateStart);
        const end = new Date(customDateEnd);
        end.setHours(23, 59, 59, 999);
        if (isPrevious) {
          const duration = end - start;
          const prevEnd = new Date(start);
          prevEnd.setDate(prevEnd.getDate() - 1);
          const prevStart = new Date(prevEnd - duration);
          return { start: prevStart, end: prevEnd };
        }
        return { start, end };
      }
      
      let start = new Date();
      let end = new Date();
      if (filter === 'weekly') {
        if (isPrevious) { 
          start.setDate(now.getDate() - 14); 
          end.setDate(now.getDate() - 7); 
        } else { 
          start.setDate(now.getDate() - 7); 
        }
      } else if (filter === 'monthly') {
        if (isPrevious) { 
          start.setMonth(now.getMonth() - 1, 1); 
          end = new Date(now.getFullYear(), now.getMonth(), 0); 
        } else { 
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
      } else {
        if (isPrevious) { 
          start.setFullYear(now.getFullYear() - 1, 0, 1); 
          end.setFullYear(now.getFullYear() - 1, 11, 31); 
        } else { 
          start = new Date(now.getFullYear(), 0, 1);
        }
      }
      return { start, end };
    };

    const currentRange = getRange(activeFilter);
    const previousRange = getRange(activeFilter, true);
    
    // Format the date range text
    const rangeText = activeFilter === 'custom' && customDateStart && customDateEnd
      ? `${new Date(customDateStart).toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} - ${new Date(customDateEnd).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`
      : `${currentRange.start.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} - ${now.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`;

    // Helper to convert 12-hour time to 24-hour format
    const convertTo24Hour = (timeStr) => {
      if (!timeStr) return "00:00";
      if (timeStr.includes('M')) {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') { hours = '00'; }
        if (modifier === 'PM') { hours = parseInt(hours, 10) + 12; }
        return `${hours}:${minutes}`;
      }
      return timeStr;
    };

    // Check if booking is 4 hours past scheduled time
    const isFourHoursPast = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return false;
      try {
        const bookingDateTime = new Date(`${dateStr}T${convertTo24Hour(timeStr)}`);
        const diffMs = now - bookingDateTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours >= 4;
      } catch (e) { return false; }
    };

    // Determine if booking is complete
    const isBookingComplete = (b) => {
      if (['completed', 'to_rate', 'rated'].includes(b.status)) return true;
      if (['paid', 'confirmed'].includes(b.status) && isFourHoursPast(b.booking_date, b.time_slot)) return true;
      return false;
    };

    // Filter bookings by date range
    const filterByRange = (list, range) => {
      return list.filter(b => {
        const d = new Date(b.booking_date);
        return d >= range.start && d <= (range.end || now);
      });
    };

    const currentBookings = filterByRange(rawBookings, currentRange);
    const previousBookings = filterByRange(rawBookings, previousRange);

    // Extract valid pets from complete bookings
    const getValidPets = (bookingsList) => {
      const validPets = [];
      bookingsList.forEach(b => {
        if (isBookingComplete(b) && b.booking_pets && Array.isArray(b.booking_pets)) {
          b.booking_pets.forEach(pet => {
            if (petTypeFilter === 'both' || pet.pet_type === petTypeFilter) {
              validPets.push({ 
                ...pet, 
                booking_date: b.booking_date, 
                time_slot: b.time_slot, 
                status: b.status, 
                user_id: b.user_id, 
                total_estimated_price: b.total_estimated_price, 
                booking_id: b.id 
              });
            }
          });
        }
      });
      return validPets;
    };

    const currentValidPets = getValidPets(currentBookings);
    const previousValidPets = getValidPets(previousBookings);

    // Calculate metrics (revenue, count)
    const calculateMetrics = (petsList, originalBookings) => {
      const uniqueBookingIds = new Set(petsList.map(p => p.booking_id));
      const uniqueBookings = originalBookings.filter(b => uniqueBookingIds.has(b.id));
      const rev = uniqueBookings.reduce((sum, b) => sum + (Number(b.total_estimated_price) || 0), 0);
      return { rev, count: petsList.length, validPets: petsList };
    };

    const current = calculateMetrics(currentValidPets, currentBookings);
    const previous = calculateMetrics(previousValidPets, previousBookings);

    // Calculate percentage trend
    const getTrend = (curr, prev) => {
      if (prev === 0) return curr > 0 ? { val: 100, dir: 'up' } : { val: 0, dir: 'neutral' };
      const diff = ((curr - prev) / prev) * 100;
      return { val: Math.abs(Math.round(diff)), dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral' };
    };

    return { 
      revenue: current.rev, 
      validCount: current.count, 
      cancellations: new Set(currentBookings.filter(b => b.status === 'cancelled').map(b => b.id)).size, 
      avg: new Set(current.validPets.map(p => p.user_id)).size > 0 
        ? Math.round(current.count / new Set(current.validPets.map(p => p.user_id)).size) 
        : 0, 
      revTrend: getTrend(current.rev, previous.rev), 
      bookTrend: getTrend(current.count, previous.count),
      rangeText
    };
  }, [rawBookings, activeFilter, petTypeFilter, customDateStart, customDateEnd]);

  // ============================================
  // HELPER COMPONENTS
  // ============================================
  const TrendIndicator = ({ trend }) => (
    <div className={`kpi-trend ${trend.dir === 'up' ? 'positive' : trend.dir === 'down' ? 'negative' : 'neutral'}`}>
      {trend.dir === 'up' ? <FaCaretUp /> : trend.dir === 'down' ? <FaCaretDown /> : <FaMinus />} {trend.val}%
    </div>
  );

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) return <div className="loading-state">Loading...</div>;

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      
      <div className="sp-biz-main-layout">
        <div className="sp-biz-container">
          
          {/* ============================================ */}
          {/* SIDEBAR - Filters */}
          {/* ============================================ */}
          <aside className="sp-biz-sidebar">
            {/* Tab Navigation */}
            <div className="sidebar-tabs-group">
              <button 
                className={`sidebar-tab-btn ${activeTab === 'sales' ? 'active' : ''}`} 
                onClick={() => navigate('/service/sales')}
              >
                Sales Performance
              </button>
              <button 
                className={`sidebar-tab-btn ${activeTab === 'business_performance' ? 'active' : ''}`} 
                onClick={() => navigate('/service/business-dashboard')}
              >
                Business Performance
              </button>
              <button 
                className={`sidebar-tab-btn ${activeTab === 'customer_insights' ? 'active' : ''}`} 
                onClick={() => navigate('/service/customer-insight')}
              >
                Customer Insights
              </button>
            </div>
            
            {/* Timeframe Filter */}
            <div className="sidebar-section">
              <h3>Timeframe</h3>
              <select className="filter-dropdown" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom Range</option>
              </select>
              
              {/* Custom Date Range Inputs */}
              {activeFilter === 'custom' && (
                <div className="custom-date-range">
                  <label className="date-label">From:</label>
                  <input 
                    type="date" 
                    className="date-input" 
                    value={customDateStart} 
                    onChange={(e) => setCustomDateStart(e.target.value)} 
                    max={customDateEnd || new Date().toISOString().split('T')[0]} 
                  />
                  <label className="date-label">To:</label>
                  <input 
                    type="date" 
                    className="date-input" 
                    value={customDateEnd} 
                    onChange={(e) => setCustomDateEnd(e.target.value)} 
                    min={customDateStart} 
                    max={new Date().toISOString().split('T')[0]} 
                  />
                </div>
              )}
            </div>

            {/* Pet Type Filter */}
            <div className="sidebar-section">
              <h3>Pet Type</h3>
              <select className="filter-dropdown" value={petTypeFilter} onChange={(e) => setPetTypeFilter(e.target.value)}>
                <option value="both">Both (Dog & Cat)</option>
                <option value="Dog">Dog</option>
                <option value="Cat">Cat</option>
              </select>
            </div>
          </aside>

          {/* ============================================ */}
          {/* MAIN CONTENT - KPIs and Report Button */}
          {/* ============================================ */}
          <main className="sp-biz-main-content">
            {/* Generate Report Button and As of Date */}
            <div className="report-button-container">
              <div className="as-of-date">
                As of {new Date().toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </div>
              <button className="generate-report-btn" onClick={() => setShowReportModal(true)}>
                <FaFileAlt size={16} />
                <span>Generate Sales Report</span>
              </button>
            </div>

            {/* KPI Cards Grid */}
            <div className="sp-biz-kpi-grid">
              {/* Gross Revenue KPI */}
              <div className="kpi-card">
                <span className="kpi-label">Gross Revenue</span>
                <div className="kpi-row">
                  <span className="kpi-value">
                    {analytics.revenue >= 1000 
                      ? `₱${(analytics.revenue / 1000).toFixed(1)}K` 
                      : `₱${Math.round(analytics.revenue)}`}
                  </span>
                  <TrendIndicator trend={analytics.revTrend} />
                </div>
              </div>
              
              {/* Total Bookings KPI */}
              <div className="kpi-card">
                <span className="kpi-label">Total Bookings</span>
                <div className="kpi-row">
                  <span className="kpi-value">{analytics.validCount}</span>
                  <TrendIndicator trend={analytics.bookTrend} />
                </div>
              </div>
              
              {/* Listing Visitors KPI */}
              <div className="kpi-card">
                <span className="kpi-label">Listing Visitors</span>
                <span className="kpi-value">{listingVisitors.toLocaleString()}</span>
              </div>
              
              {/* Average per Customer KPI */}
              <div className="kpi-card">
                <span className="kpi-label">Avg/Customer</span>
                <span className="kpi-value">{analytics.avg}</span>
              </div>
              
              {/* Cancellations KPI */}
              <div className="kpi-card">
                <span className="kpi-label">Cancellations</span>
                <span className="kpi-value">{analytics.cancellations.toString().padStart(2, '0')}</span>
              </div>
            </div>

            {/* Additional content can go here */}
          </main>
        </div>
      </div>

      {/* ============================================ */}
      {/* SALES REPORT MODAL */}
      {/* ============================================ */}
      {showReportModal && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="report-modal-header">
              <div className="report-header-title">
                <FaFileAlt size={20} />
                <h2>Sales Report</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setShowReportModal(false)}>
                <FaTimes />
              </button>
            </div>

            {/* Modal Body */}
            <div className="report-modal-body">
              {/* Report Header Info */}
              <div className="report-info-section">
                <div className="report-info-row">
                  <span className="report-label">Report Period:</span>
                  <span className="report-value">{analytics.rangeText}</span>
                </div>
                <div className="report-info-row">
                  <span className="report-label">Report Type:</span>
                  <span className="report-value">
                    {activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Sales Summary
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
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="report-section">
                <h3 className="report-section-title">Executive Summary</h3>
                <div className="report-kpi-grid">
                  <div className="report-kpi-item">
                    <span className="report-kpi-label">Gross Revenue</span>
                    <span className="report-kpi-value">
                      {analytics.revenue >= 1000 
                        ? `₱${(analytics.revenue / 1000).toFixed(1)}K` 
                        : `₱${Math.round(analytics.revenue)}`}
                    </span>
                    <div className="report-trend">
                      {analytics.revTrend.dir === 'up' ? <FaCaretUp /> : 
                       analytics.revTrend.dir === 'down' ? <FaCaretDown /> : <FaMinus />}
                      <span className={analytics.revTrend.dir}>
                        {analytics.revTrend.val}% vs previous period
                      </span>
                    </div>
                  </div>
                  <div className="report-kpi-item">
                    <span className="report-kpi-label">Total Bookings</span>
                    <span className="report-kpi-value">{analytics.validCount}</span>
                    <div className="report-trend">
                      {analytics.bookTrend.dir === 'up' ? <FaCaretUp /> : 
                       analytics.bookTrend.dir === 'down' ? <FaCaretDown /> : <FaMinus />}
                      <span className={analytics.bookTrend.dir}>
                        {analytics.bookTrend.val}% vs previous period
                      </span>
                    </div>
                  </div>
                  <div className="report-kpi-item">
                    <span className="report-kpi-label">Listing Visitors</span>
                    <span className="report-kpi-value">{listingVisitors.toLocaleString()}</span>
                  </div>
                  <div className="report-kpi-item">
                    <span className="report-kpi-label">Avg Bookings/Customer</span>
                    <span className="report-kpi-value">{analytics.avg}</span>
                  </div>
                  <div className="report-kpi-item">
                    <span className="report-kpi-label">Cancellations</span>
                    <span className="report-kpi-value">{analytics.cancellations}</span>
                  </div>
                </div>
              </div>

              {/* Performance Analysis */}
              <div className="report-section">
                <h3 className="report-section-title">Sales Analysis</h3>
                <div className="report-insights">
                  <div className="insight-item">
                    <strong>Revenue Trend:</strong>
                    <p>
                      {analytics.revTrend.dir === 'up' 
                        ? `Revenue has increased by ${analytics.revTrend.val}% compared to the previous ${activeFilter} period. Keep up the good work!`
                        : analytics.revTrend.dir === 'down'
                        ? `Revenue has decreased by ${analytics.revTrend.val}% compared to the previous ${activeFilter} period. Consider reviewing your pricing or marketing strategy.`
                        : 'Revenue has remained stable compared to the previous period.'}
                    </p>
                  </div>
                  <div className="insight-item">
                    <strong>Booking Trend:</strong>
                    <p>
                      {analytics.bookTrend.dir === 'up'
                        ? `Bookings have increased by ${analytics.bookTrend.val}%, indicating growing demand for your services.`
                        : analytics.bookTrend.dir === 'down'
                        ? `Bookings have decreased by ${analytics.bookTrend.val}%. Consider promotional campaigns to boost customer engagement.`
                        : 'Booking volume has remained consistent with the previous period.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="report-modal-footer">
              <button className="btn-download-report" disabled>
                <FaFileAlt />
                Download Report (Coming Soon)
              </button>
              <button className="btn-close-report" onClick={() => setShowReportModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}