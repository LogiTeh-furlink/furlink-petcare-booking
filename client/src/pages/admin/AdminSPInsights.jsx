import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaFileAlt, FaTimes, FaDownload, FaArrowLeft } from 'react-icons/fa';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './AdminSPInsights.css';

export default function AdminSPInsights() {
  const navigate = useNavigate();
  const reportRef = useRef(null);

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [activeTab, setActiveTab] = useState('sp_insights');
  const [activeFilter, setActiveFilter] = useState('monthly');
  const [petTypeFilter, setPetTypeFilter] = useState('both');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [platformCreatedAt, setPlatformCreatedAt] = useState(null);

  // ============================================
  // DATA FETCHING
  // ============================================
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/login");

        // Fetch earliest record date to set as min date
        const { data: earliest } = await supabase
          .from('service_providers')
          .select('created_at')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (earliest?.created_at) {
          setPlatformCreatedAt(earliest.created_at.split('T')[0]);
        }

      } catch (err) {
        console.error("Admin Insights Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  // ============================================
  // PDF DOWNLOAD FUNCTION
  // ============================================
  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const element = reportRef.current;
      if (!element) {
        setIsGeneratingPDF(false);
        return;
      }

      const clone = element.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.width = '800px';
      clone.style.overflow = 'visible';
      clone.style.maxHeight = 'none';
      clone.style.height = 'auto';
      clone.style.padding = '24px';
      clone.style.backgroundColor = '#ffffff';

      document.body.appendChild(clone);
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: clone.scrollWidth,
        height: clone.scrollHeight
      });

      document.body.removeChild(clone);

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pdfWidth - (2 * margin);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageHeight = pdfHeight - (2 * margin);
      const totalPages = Math.ceil(imgHeight / pageHeight);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();
        const sourceY = page * (pageHeight * canvas.width / imgWidth);
        const sourceHeight = Math.min(pageHeight * canvas.width / imgWidth, canvas.height - sourceY);
        if (sourceHeight > 0) {
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sourceHeight;
          const pageCtx = pageCanvas.getContext('2d');
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
          const pageImgData = pageCanvas.toDataURL('image/png', 1.0);
          const pageImgHeight = (sourceHeight * imgWidth) / canvas.width;
          pdf.addImage(pageImgData, 'PNG', margin, margin, imgWidth, pageImgHeight, '', 'FAST');
        }
      }

      const tabLabel = activeTab === 'sp_insights' ? 'SP_Insights' : 'PetOwner_Insights';
      const fileName = `Admin_${tabLabel}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ============================================
  // HELPER: Build range text for report
  // ============================================
  const buildRangeText = () => {
    const today = new Date();
    if (activeFilter === 'custom' && customDateStart && customDateEnd) {
      const [sy, sm, sd] = customDateStart.split('-').map(Number);
      const [ey, em, ed] = customDateEnd.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);
      return `${start.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`;
    }
    if (activeFilter === 'weekly') {
      const start = new Date(today);
      start.setDate(today.getDate() - 7);
      return `${start.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })} - ${today.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`;
    }
    if (activeFilter === 'monthly') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return `${start.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })} - ${today.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`;
    }
    if (activeFilter === 'yearly') {
      if (selectedYear === null) return `All Years - ${today.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`;
      return `Jan 01, ${selectedYear} - Dec 31, ${selectedYear}`;
    }
    return '';
  };

  const buildReportTypeLabel = () => {
    if (activeFilter === 'yearly') return selectedYear === null ? 'All Years Summary' : `${selectedYear} Yearly Summary`;
    return `${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Summary`;
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) return <div className="admin-insights-loading">Loading Insights...</div>;

  const rangeText = buildRangeText();

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="admin-insights-page-wrapper">
      <LoggedInNavbar />

      <div className="admin-insights-main-layout">
        <div className="admin-insights-container">

          {/* ============================================ */}
          {/* SIDEBAR */}
          {/* ============================================ */}
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

            {/* Timeframe Filter */}
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
                    onChange={(e) => setSelectedYear(e.target.value === '' ? null : Number(e.target.value))}
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
                      ).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ));
                    })()}
                  </select>
                </div>
              )}

              {activeFilter === 'custom' && (
                <div className="custom-date-range">
                  <label className="date-label">From:</label>
                  <input
                    type="date"
                    className="date-input"
                    value={customDateStart}
                    onChange={(e) => setCustomDateStart(e.target.value)}
                    max={customDateEnd || new Date().toISOString().split('T')[0]}
                    min={platformCreatedAt}
                  />
                  <label className="date-label">To:</label>
                  <input
                    type="date"
                    className="date-input"
                    value={customDateEnd}
                    onChange={(e) => setCustomDateEnd(e.target.value)}
                    min={platformCreatedAt || customDateStart}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}
            </div>

            {/* Pet Type Filter */}
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
          </aside>

          {/* ============================================ */}
          {/* MAIN CONTENT */}
          {/* ============================================ */}
          <main className="admin-insights-main-content">

            {/* Header Row */}
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
                <span>Generate Insights Report</span>
              </button>
            </div>

            {/* Tab Content Area */}
            <div className="insights-content-area">
              {activeTab === 'sp_insights' ? (
                <div className="insights-placeholder">
                  <div className="placeholder-icon">📊</div>
                  <h3>Service Provider Insights</h3>
                  <p>
                    Charts and analytics for service providers will appear here.<br />
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
              ) : (
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
              )}
            </div>
          </main>
        </div>
      </div>

      {/* ============================================ */}
      {/* INSIGHTS REPORT MODAL */}
      {/* ============================================ */}
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
              {/* Report Info */}
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
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              {/* Report placeholder content */}
              <div className="report-section">
                <h3 className="report-section-title">
                  {activeTab === 'sp_insights'
                    ? 'Service Provider Summary'
                    : 'Pet Owner Summary'}
                </h3>
                <div className="report-empty-notice">
                  <p>
                    Analytics data for <strong>{rangeText}</strong> will be displayed here
                    once charts are integrated.
                  </p>
                </div>
              </div>
            </div>

            <div className="report-modal-footer">
              <button
                className="btn-download-report"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
              >
                {isGeneratingPDF ? (
                  <><FaDownload /> Generating PDF...</>
                ) : (
                  <><FaDownload /> Download as PDF</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}