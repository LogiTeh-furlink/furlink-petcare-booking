// src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../config/supabase";
import LoggedInAdmin from "../../components/Header/LoggedInAdmin";
import { FaStore, FaCheckCircle, FaTimesCircle, FaClock, FaUsers, FaArrowRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
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

  // List Data
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter State (Default: 'pending')
  const [currentFilter, setCurrentFilter] = useState("pending"); 

  useEffect(() => {
    fetchAdminProfile();
    fetchDashboardCounts();
    fetchProviders(currentFilter);
  }, []);

  useEffect(() => {
    fetchProviders(currentFilter);
  }, [currentFilter]);

  useEffect(() => {
    const channel = supabase
      .channel("admin_dashboard_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_providers" }, () => {
        fetchDashboardCounts();
        fetchProviders(currentFilter);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentFilter]);

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
      // Inner join in Supabase: select(..., { inner: true })
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

  const fetchProviders = async (statusFilter) => {
    setLoading(true);
    try {
      const dbStatus = statusFilter === 'active' ? 'approved' : statusFilter;

      let query = supabase.from("service_providers");

      // Requirement: If pending, user must have submitted ServiceListing (exists in 'services' table)
      if (dbStatus === 'pending') {
        query = query
          .select("id, business_name, city, province, status, created_at, updated_at, services!inner(id)")
          .eq("status", "pending")
          .order("created_at", { ascending: true });
      } else {
        query = query
          .select("id, business_name, city, province, status, created_at, updated_at")
          .eq("status", dbStatus)
          .order("updated_at", { ascending: false });
      }

      const { data, error } = await query;
      if (!error) setProviders(data || []);

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

  const getListTitle = () => {
    switch (currentFilter) {
      case "pending": return "Pending Approvals (Complete Applications)";
      case "active": return "Active Listings";
      case "rejected": return "Rejected Listings";
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

        <div className="stats-grid">
          <div className={`stat-card ${currentFilter === 'pending' ? 'active-filter' : ''}`} onClick={() => handleCardClick('pending')}>
            <div className="stat-icon-wrapper pending"><FaStore size={24} /></div>
            <div className="stat-content">
              <h3>{pendingCount}</h3>
              <span>Pending Approvals</span>
            </div>
          </div>

          <div className={`stat-card ${currentFilter === 'active' ? 'active-filter' : ''}`} onClick={() => handleCardClick('active')}>
            <div className="stat-icon-wrapper active"><FaCheckCircle size={24} /></div>
            <div className="stat-content">
              <h3>{activeCount}</h3>
              <span>Active Listings</span>
            </div>
          </div>

          <div className={`stat-card ${currentFilter === 'rejected' ? 'active-filter' : ''}`} onClick={() => handleCardClick('rejected')}>
            <div className="stat-icon-wrapper rejected"><FaTimesCircle size={24} /></div>
            <div className="stat-content">
              <h3>{rejectedCount}</h3>
              <span>Rejected Listings</span>
            </div>
          </div>

          <div className="stat-card non-clickable">
            <div className="stat-icon-wrapper info"><FaClock size={24} /></div>
            <div className="stat-content">
              <h3>{avgApprovalTime}</h3>
              <span>Avg. Approval Time</span>
            </div>
          </div>

          <div className="stat-card non-clickable">
            <div className="stat-icon-wrapper users"><FaUsers size={24} /></div>
            <div className="stat-content">
              <h3>{totalUsers}</h3>
              <span>Total Users</span>
            </div>
          </div>
        </div>

        <div className="dashboard-list-container">
          <h2 className="list-title">{getListTitle()}</h2>
          <div className="providers-table-wrapper">
            {loading ? (
              <div className="loading-state">Loading data...</div>
            ) : providers.length === 0 ? (
              <div className="empty-state">No complete applications found for this category.</div>
            ) : (
              <table className="providers-table">
                <thead>
                  <tr>
                    <th>Business Name</th>
                    <th>Location</th>
                    <th>Date {currentFilter === 'pending' ? 'Submitted' : 'Updated'}</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((provider) => (
                    <tr key={provider.id}>
                      <td className="fw-bold">{provider.business_name}</td>
                      <td>{provider.city}, {provider.province}</td>
                      <td>{formatDate(currentFilter === 'pending' ? provider.created_at : provider.updated_at)}</td>
                      <td>
                        <span className={`status-pill ${provider.status}`}>
                          {provider.status}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn-view-details"
                          onClick={() => navigate(`/admin/provider/${provider.id}`, { 
                            state: { status: provider.status } 
                          })}
                        >
                          View Details <FaArrowRight size={12} style={{marginLeft: 5}} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}