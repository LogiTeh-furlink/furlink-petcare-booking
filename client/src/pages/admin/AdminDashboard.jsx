import React, { useState, useEffect } from "react";
import { supabase } from "../../config/supabase";
import LoggedInAdmin from "../../components/Header/LoggedInAdmin";
import { FaStore, FaCheckCircle, FaTimesCircle, FaClock, FaUsers, FaArrowRight, FaFileAlt, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { loadAdminFilters, saveAdminFilters } from "../../utils/adminFilterUtils";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();

  // --- STATE ---
  const [adminName, setAdminName] = useState("Admin");
  
  // Counts
  const [pendingCount, setPendingCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [avgApprovalTime, setAvgApprovalTime] = useState("-");
  const [totalUsers, setTotalUsers] = useState(0);

  // List Data (Generic state for both Providers and Users)
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Load saved filters from localStorage
  const savedFilters = loadAdminFilters();
  
  // Filter State (Load from localStorage or default to 'pending')
  const [currentFilter, setCurrentFilter] = useState(savedFilters.currentFilter); 
  
  // User Specific Filter (Load from localStorage)
  const [userRoleFilter, setUserRoleFilter] = useState(savedFilters.userRoleFilter);

  // Single shared Date Range for all Service Provider tabs (Load from localStorage)
  const [dateRange, setDateRange] = useState(savedFilters.dateRange);

  // Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    fetchAdminProfile();
    fetchDashboardCounts();
    fetchTableData(currentFilter);
  }, []);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    saveAdminFilters({
      currentFilter,
      userRoleFilter,
      dateRange
    });
  }, [currentFilter, userRoleFilter, dateRange]);

  // Refetch when main filter or user sub-filter changes
  useEffect(() => {
    fetchTableData(currentFilter);
  }, [currentFilter, userRoleFilter]);

  // Refetch when date ranges change
  useEffect(() => {
    if (currentFilter !== 'users') {
      fetchTableData(currentFilter);
    }
  }, [dateRange]);

  // Real-time updates (Listeners)
  useEffect(() => {
    // Listener for Providers
    const providerChannel = supabase
      .channel("admin_dashboard_providers")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_providers" }, () => {
        fetchDashboardCounts();
        if (currentFilter !== 'users') fetchTableData(currentFilter);
      })
      .subscribe();

    // Listener for Users (Profiles)
    const userChannel = supabase
      .channel("admin_dashboard_users")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        fetchDashboardCounts();
        if (currentFilter === 'users') fetchTableData(currentFilter);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(providerChannel);
      supabase.removeChannel(userChannel);
    };
  }, [currentFilter, userRoleFilter]);

  // --- FETCH FUNCTIONS ---

  const fetchAdminProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("first_name").eq("id", user.id).single();
      if (data) setAdminName(data.first_name);
    }
  };

  const fetchDashboardCounts = async () => {
    try {
      // 1. Counts by Status - For Pending, we only count those with services
      const { count: pending } = await supabase
        .from("service_providers")
        .select("id, services!inner(id)", { count: "exact", head: true })
        .eq("status", "pending");

      const { count: approved } = await supabase.from("service_providers").select("*", { count: "exact", head: true }).eq("status", "approved");
      const { count: rejected } = await supabase.from("service_providers").select("*", { count: "exact", head: true }).eq("status", "rejected");

      const { count: users } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .neq("role", "admin");

      const { data: approvals } = await supabase
        .from("service_providers")
        .select("created_at, approved_at")
        .not("approved_at", "is", null);

      let avgStr = "-";
      if (approvals && approvals.length > 0) {
        const totalMs = approvals.reduce((sum, row) => {
          const start = new Date(row.created_at);
          const end = new Date(row.approved_at);
          return sum + (end - start);
        }, 0);
        const hours = totalMs / approvals.length / (1000 * 60 * 60);
        avgStr = hours < 1 ? "< 1 hr" : `${hours.toFixed(1)} hrs`;
      }

      setPendingCount(pending || 0);
      setActiveCount(approved || 0);
      setRejectedCount(rejected || 0);
      setTotalUsers(users || 0);
      setAvgApprovalTime(avgStr);

    } catch (err) {
      console.error("Error fetching counts:", err);
    }
  };

  const fetchTableData = async (filter) => {
    setLoading(true);
    setTableData([]); // Reset to prevent flickering old data

    try {
      // --- CASE 1: USERS ---
      if (filter === 'users') {
        let query = supabase
          .from("profiles")
          .select("id, first_name, last_name, display_name, email, mobile_number, role, created_at")
          .neq("role", "admin");

        // Apply Role Filter if not 'all'
        if (userRoleFilter !== 'all') {
          query = query.eq("role", userRoleFilter);
        }

        const { data, error } = await query.order("created_at", { ascending: false });
        
        if (!error) setTableData(data || []);
      } 
      
      // --- CASE 2: SERVICE PROVIDERS ---
      else {
        const dbStatus = filter === 'active' ? 'approved' : filter;
        let query = supabase.from("service_providers");

        // Requirement: If pending, user must have submitted ServiceListing (exists in 'services' table)
        if (dbStatus === 'pending') {
          query = query
            .select("id, business_name, city, province, status, created_at, updated_at, services!inner(id)")
            .eq("status", "pending");

          // Apply shared date range filter for pending (based on created_at)
          if (dateRange.start) {
            query = query.gte("created_at", dateRange.start);
          }
          if (dateRange.end) {
            const endDate = new Date(dateRange.end);
            endDate.setUTCHours(23, 59, 59, 999);
            query = query.lte("created_at", endDate.toISOString());
          }

          query = query.order("created_at", { ascending: true });
        } 
        else if (dbStatus === 'approved') {
          query = query
            .select("id, business_name, city, province, status, created_at, updated_at, approved_at")
            .eq("status", "approved");

          // Apply shared date range filter for approved (based on approved_at)
          if (dateRange.start) {
            query = query.gte("approved_at", dateRange.start);
          }
          if (dateRange.end) {
            const endDate = new Date(dateRange.end);
            endDate.setUTCHours(23, 59, 59, 999);
            query = query.lte("approved_at", endDate.toISOString());
          }

          query = query.order("approved_at", { ascending: false });
        }
        else if (dbStatus === 'rejected') {
          query = query
            .select("id, business_name, city, province, status, created_at, updated_at")
            .eq("status", "rejected");

          // Apply shared date range filter for rejected (based on updated_at)
          if (dateRange.start) {
            query = query.gte("updated_at", dateRange.start);
          }
          if (dateRange.end) {
            const endDate = new Date(dateRange.end);
            endDate.setUTCHours(23, 59, 59, 999);
            query = query.lte("updated_at", endDate.toISOString());
          }

          query = query.order("updated_at", { ascending: false });
        }

        const { data, error } = await query;
        if (!error) setTableData(data || []);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLERS ---

  const handleCardClick = (filterType) => {
    setCurrentFilter(filterType);
  };

  const handleDateRangeChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearDateRangeHandler = () => {
    setDateRange({ start: "", end: "" });
  };

  const getListTitle = () => {
    switch (currentFilter) {
      case "pending": return "Pending Approvals (Complete Applications)";
      case "active": return "Active Listings";
      case "rejected": return "Rejected Listings";
      case "users": return "Registered Users";
      default: return "Service Providers";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric"
    });
  };

  return (
    <>
      <LoggedInAdmin />
      <div className="admin-dashboard-wrapper">
        <div className="admin-header-center">
          <h1>Hi, {adminName}!</h1>
          <p>Here is your daily overview.</p>
        </div>

        {/* Generate Report Button */}
        <div className="report-button-container">
          <button className="generate-report-btn" onClick={() => setShowReportModal(true)}>
            <FaFileAlt size={16} />
            <span>Generate Admin Report</span>
          </button>
        </div>

        <div className="stats-grid">
          {/* Pending Card */}
          <div className={`stat-card ${currentFilter === 'pending' ? 'active-filter' : ''}`} onClick={() => handleCardClick('pending')}>
            <div className="stat-icon-wrapper pending"><FaStore size={24} /></div>
            <div className="stat-content">
              <h3>{pendingCount}</h3>
              <span>Pending Approvals</span>
            </div>
          </div>

          {/* Active Card */}
          <div className={`stat-card ${currentFilter === 'active' ? 'active-filter' : ''}`} onClick={() => handleCardClick('active')}>
            <div className="stat-icon-wrapper active"><FaCheckCircle size={24} /></div>
            <div className="stat-content">
              <h3>{activeCount}</h3>
              <span>Active Listings</span>
            </div>
          </div>

          {/* Rejected Card */}
          <div className={`stat-card ${currentFilter === 'rejected' ? 'active-filter' : ''}`} onClick={() => handleCardClick('rejected')}>
            <div className="stat-icon-wrapper rejected"><FaTimesCircle size={24} /></div>
            <div className="stat-content">
              <h3>{rejectedCount}</h3>
              <span>Rejected Listings</span>
            </div>
          </div>

          {/* Avg Time Card (Non-Clickable) */}
          <div className="stat-card non-clickable">
            <div className="stat-icon-wrapper info"><FaClock size={24} /></div>
            <div className="stat-content">
              <h3>{avgApprovalTime}</h3>
              <span>Avg. Approval Time</span>
            </div>
          </div>

          {/* Users Card (Tab) */}
          <div className={`stat-card ${currentFilter === 'users' ? 'active-filter' : ''}`} onClick={() => handleCardClick('users')}>
            <div className="stat-icon-wrapper users"><FaUsers size={24} /></div>
            <div className="stat-content">
              <h3>{totalUsers}</h3>
              <span>Total Users</span>
            </div>
          </div>
        </div>

        <div className="dashboard-list-container">
          <div className="list-header">
            <h2 className="list-title">{getListTitle()}</h2>
            
            {/* --- USER ROLE FILTER --- */}
            {currentFilter === 'users' && (
              <div className="user-filter-group">
                <button 
                  className={`filter-btn ${userRoleFilter === 'all' ? 'active' : ''}`} 
                  onClick={() => setUserRoleFilter('all')}
                >
                  All
                </button>
                <button 
                  className={`filter-btn ${userRoleFilter === 'pet_owner' ? 'active' : ''}`} 
                  onClick={() => setUserRoleFilter('pet_owner')}
                >
                  Pet Owner
                </button>
                <button 
                  className={`filter-btn ${userRoleFilter === 'service_provider' ? 'active' : ''}`} 
                  onClick={() => setUserRoleFilter('service_provider')}
                >
                  Service Provider
                </button>
              </div>
            )}

            {/* --- DATE RANGE FILTER FOR SERVICE PROVIDERS --- */}
            {currentFilter !== 'users' && (
              <div className="date-range-filter">
                <div className="date-inputs-group">
                  <div className="date-input-wrapper">
                    <label className="date-label">From:</label>
                    <input 
                      type="date" 
                      className="date-input" 
                      value={dateRange.start} 
                      onChange={(e) => handleDateRangeChange('start', e.target.value)}
                      max={dateRange.end || new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="date-input-wrapper">
                    <label className="date-label">To:</label>
                    <input 
                      type="date" 
                      className="date-input" 
                      value={dateRange.end} 
                      onChange={(e) => handleDateRangeChange('end', e.target.value)}
                      min={dateRange.start}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  {(dateRange.start || dateRange.end) && (
                    <button 
                      className="clear-dates-btn"
                      onClick={clearDateRangeHandler}
                      title="Clear date range"
                    >
                      Clear Dates
                    </button>
                  )}
                </div>
                {/* Show active filter indicator */}
                {(dateRange.start || dateRange.end) && (
                  <div className="active-filter-indicator">
                    <span className="filter-active-dot"></span>
                    <span className="filter-active-text">Date filter active</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="providers-table-wrapper">
            {loading ? (
              <div className="loading-state">Loading data...</div>
            ) : tableData.length === 0 ? (
              <div className="empty-state">No records found for this category.</div>
            ) : (
              <table className="providers-table">
                {/* --- TABLE HEADERS --- */}
                <thead>
                  {currentFilter === 'users' ? (
                    /* User Headers */
                    <tr>
                      <th>First Name</th>
                      <th>Last Name</th>
                      <th>Display Name</th>
                      <th>Email</th>
                      <th>Contact Number</th>
                      <th>Role</th>
                      <th>Action</th>
                    </tr>
                  ) : (
                    /* Provider Headers */
                    <tr>
                      <th>Business Name</th>
                      <th>Location</th>
                      <th>Date {currentFilter === 'pending' ? 'Submitted' : currentFilter === 'active' ? 'Approved' : 'Updated'}</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  )}
                </thead>

                {/* --- TABLE BODY --- */}
                <tbody>
                  {tableData.map((item) => (
                    <tr key={item.id}>
                      {currentFilter === 'users' ? (
                        /* User Row Data */
                        <>
                          <td className="fw-bold">{item.first_name || "-"}</td>
                          <td className="fw-bold">{item.last_name || "-"}</td>
                          <td>{item.display_name || "N/A"}</td>
                          <td>{item.email || "-"}</td>
                          <td>{item.mobile_number || "-"}</td>
                          <td style={{textTransform:'capitalize'}}>
                            {/* Normalized Role: replaces underscore with space */}
                            {item.role ? item.role.replace(/_/g, " ") : "-"}
                          </td>
                          <td>
                             <button 
                               className="btn-view-details" 
                               style={{ whiteSpace: "nowrap" }}
                               onClick={() => navigate(`/admin/user-bookings/${item.id}`)}
                             >
                               View Details <FaArrowRight size={12} style={{marginLeft: 5}} />
                             </button>
                          </td>
                        </>
                      ) : (
                        /* Provider Row Data */
                        <>
                          <td className="fw-bold">{item.business_name}</td>
                          <td>{item.city}, {item.province}</td>
                          <td>
                            {formatDate(
                              currentFilter === 'pending' 
                                ? item.created_at 
                                : currentFilter === 'active' 
                                ? item.approved_at 
                                : item.updated_at
                            )}
                          </td>
                          <td>
                            <span className={`status-pill ${item.status}`}>
                              {item.status}
                            </span>
                          </td>
                          <td>
                            <button 
                              className="btn-view-details"
                              onClick={() => navigate(`/admin/provider/${item.id}`, { 
                                state: { status: item.status } 
                              })}
                            >
                              View Details <FaArrowRight size={12} style={{marginLeft: 5}} />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* ADMIN REPORT MODAL */}
        {/* ============================================ */}
        {showReportModal && (
          <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
            <div className="report-modal-content" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="report-modal-header">
                <div className="report-header-title">
                  <FaFileAlt size={20} />
                  <h2>Admin Dashboard Report</h2>
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
                    <span className="report-label">Report Generated:</span>
                    <span className="report-value">
                      {new Date().toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {(dateRange.start || dateRange.end) && (
                    <div className="report-info-row">
                      <span className="report-label">Date Filter Applied:</span>
                      <span className="report-value">
                        {dateRange.start && dateRange.end 
                          ? `${new Date(dateRange.start).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} - ${new Date(dateRange.end).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`
                          : dateRange.start 
                          ? `From ${new Date(dateRange.start).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`
                          : `Until ${new Date(dateRange.end).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`
                        }
                      </span>
                    </div>
                  )}
                </div>

                {/* Executive Summary */}
                <div className="report-section">
                  <h3 className="report-section-title">Executive Summary</h3>
                  <div className="report-kpi-grid">
                    <div className="report-kpi-item">
                      <span className="report-kpi-label">Pending Approvals</span>
                      <span className="report-kpi-value">{pendingCount}</span>
                      <span className="report-kpi-description">
                        Complete applications awaiting review
                      </span>
                    </div>
                    <div className="report-kpi-item">
                      <span className="report-kpi-label">Active Listings</span>
                      <span className="report-kpi-value">{activeCount}</span>
                      <span className="report-kpi-description">
                        Approved service providers
                      </span>
                    </div>
                    <div className="report-kpi-item">
                      <span className="report-kpi-label">Rejected Listings</span>
                      <span className="report-kpi-value">{rejectedCount}</span>
                      <span className="report-kpi-description">
                        Applications not approved
                      </span>
                    </div>
                    <div className="report-kpi-item">
                      <span className="report-kpi-label">Total Users</span>
                      <span className="report-kpi-value">{totalUsers}</span>
                      <span className="report-kpi-description">
                        Registered platform users
                      </span>
                    </div>
                    <div className="report-kpi-item">
                      <span className="report-kpi-label">Avg Approval Time</span>
                      <span className="report-kpi-value">{avgApprovalTime}</span>
                      <span className="report-kpi-description">
                        Time to approve applications
                      </span>
                    </div>
                  </div>
                </div>

                {/* Platform Insights */}
                <div className="report-section">
                  <h3 className="report-section-title">Platform Insights</h3>
                  <div className="report-insights">
                    <div className="insight-item">
                      <strong>Application Status:</strong>
                      <p>
                        {pendingCount > 0 
                          ? `There are currently ${pendingCount} complete application${pendingCount !== 1 ? 's' : ''} pending review. ${pendingCount >= 5 ? 'Consider prioritizing these reviews to maintain platform quality.' : ''}`
                          : 'All applications have been reviewed. Great work staying on top of approvals!'
                        }
                      </p>
                    </div>
                    
                    <div className="insight-item">
                      <strong>Service Provider Network:</strong>
                      <p>
                        The platform has {activeCount} active service provider{activeCount !== 1 ? 's' : ''} available to pet owners.
                        {rejectedCount > 0 && ` ${rejectedCount} application${rejectedCount !== 1 ? 's have' : ' has'} been rejected.`}
                      </p>
                    </div>

                    <div className="insight-item">
                      <strong>User Base:</strong>
                      <p>
                        Total registered users: {totalUsers}. This includes both pet owners and service providers who are actively using the platform.
                      </p>
                    </div>

                    <div className="insight-item">
                      <strong>Approval Efficiency:</strong>
                      <p>
                        {avgApprovalTime === '-' 
                          ? 'No approval data available yet. Start reviewing applications to track approval times.'
                          : `Applications are being approved in an average of ${avgApprovalTime}. ${avgApprovalTime.includes('< 1') ? 'Excellent response time!' : 'Consider streamlining the approval process if possible.'}`
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Items */}
                <div className="report-section">
                  <h3 className="report-section-title">Recommended Actions</h3>
                  <div className="action-items-list">
                    {pendingCount > 0 && (
                      <div className="action-item">
                        <span className="action-priority pending">Pending</span>
                        <span className="action-text">
                          Review {pendingCount} pending application{pendingCount !== 1 ? 's' : ''} to maintain quality standards
                        </span>
                      </div>
                    )}
                    {pendingCount === 0 && (
                      <div className="action-item">
                        <span className="action-priority completed">Completed</span>
                        <span className="action-text">
                          All applications reviewed - No pending items
                        </span>
                      </div>
                    )}
                    {activeCount < 10 && (
                      <div className="action-item">
                        <span className="action-priority info">Info</span>
                        <span className="action-text">
                          Consider marketing initiatives to attract more service providers
                        </span>
                      </div>
                    )}
                    {rejectedCount > activeCount && (
                      <div className="action-item">
                        <span className="action-priority warning">Alert</span>
                        <span className="action-text">
                          High rejection rate detected - Review approval criteria
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="report-modal-footer">
                <button className="btn-close-report" onClick={() => setShowReportModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}