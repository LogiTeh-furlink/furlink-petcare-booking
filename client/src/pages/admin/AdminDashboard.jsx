// src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../config/supabase";
import LoggedInAdmin from "../../components/Header/LoggedInAdmin";
import { FaStore, FaCheckCircle, FaTimesCircle, FaClock, FaUsers } from "react-icons/fa";
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

  // Effect to re-fetch providers when filter changes
  useEffect(() => {
    fetchProviders(currentFilter);
  }, [currentFilter]);

  // Real-time updates
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
      // 1. Counts by Status
      const { count: pending } = await supabase.from("service_providers").select("*", { count: "exact", head: true }).eq("status", "pending");
      const { count: approved } = await supabase.from("service_providers").select("*", { count: "exact", head: true }).eq("status", "approved");
      const { count: rejected } = await supabase.from("service_providers").select("*", { count: "exact", head: true }).eq("status", "rejected");

      // 2. Total Users (Exclude Admins if 'role' column exists, assuming simple count for now based on your prompt)
      // "from profiles table count the number of users excluding the admin"
      const { count: users } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .neq("role", "admin"); // Assuming 'role' distinguishes them

      // 3. Avg Approval Time (Static logic based on prompt requirements, can be expanded later)
      // Re-using your logic roughly:
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
      // Map 'active' filter to 'approved' status in DB
      const dbStatus = statusFilter === 'active' ? 'approved' : statusFilter;

      let query = supabase
        .from("service_providers")
        .select("id, business_name, city, province, status, created_at, updated_at")
        .eq("status", dbStatus);

      // Order logic: Pending = oldest first? Approved/Rejected = newest first?
      // "make the list by order based on the user submitted their application"
      if (dbStatus === 'pending') {
        query = query.order("created_at", { ascending: true }); // Oldest pending first
      } else {
        query = query.order("updated_at", { ascending: false }); // Recently approved/rejected first
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
      case "pending": return "Pending Approvals";
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
        
        {/* CENTERED GREETING */}
        <div className="admin-header-center">
          <h1>Hi, {adminName}!</h1>
          <p>Here is your daily overview.</p>
        </div>

        {/* DASHBOARD STATS ROW */}
        <div className="stats-grid">
          
          {/* 1. Pending (Clickable) */}
          <div 
            className={`stat-card ${currentFilter === 'pending' ? 'active-filter' : ''}`}
            onClick={() => handleCardClick('pending')}
          >
            <div className="stat-icon-wrapper pending">
              <FaStore size={24} />
            </div>
            <div className="stat-content">
              <h3>{pendingCount}</h3>
              <span>Pending Approvals</span>
            </div>
          </div>

          {/* 2. Active (Clickable) */}
          <div 
            className={`stat-card ${currentFilter === 'active' ? 'active-filter' : ''}`}
            onClick={() => handleCardClick('active')}
          >
            <div className="stat-icon-wrapper active">
              <FaCheckCircle size={24} />
            </div>
            <div className="stat-content">
              <h3>{activeCount}</h3>
              <span>Active Listings</span>
            </div>
          </div>

          {/* 3. Rejected (Clickable) */}
          <div 
            className={`stat-card ${currentFilter === 'rejected' ? 'active-filter' : ''}`}
            onClick={() => handleCardClick('rejected')}
          >
            <div className="stat-icon-wrapper rejected">
              <FaTimesCircle size={24} />
            </div>
            <div className="stat-content">
              <h3>{rejectedCount}</h3>
              <span>Rejected Listings</span>
            </div>
          </div>

          {/* 4. Avg Time (Non-clickable) */}
          <div className="stat-card non-clickable">
            <div className="stat-icon-wrapper info">
              <FaClock size={24} />
            </div>
            <div className="stat-content">
              <h3>{avgApprovalTime}</h3>
              <span>Avg. Approval Time</span>
            </div>
          </div>

          {/* 5. Total Users (Non-clickable) */}
          <div className="stat-card non-clickable">
            <div className="stat-icon-wrapper users">
              <FaUsers size={24} />
            </div>
            <div className="stat-content">
              <h3>{totalUsers}</h3>
              <span>Total Users</span>
            </div>
          </div>

        </div>

        {/* DYNAMIC LIST SECTION */}
        <div className="dashboard-list-container">
          <h2 className="list-title">{getListTitle()}</h2>
          
          <div className="providers-table-wrapper">
            {loading ? (
              <div className="loading-state">Loading data...</div>
            ) : providers.length === 0 ? (
              <div className="empty-state">No records found for this category.</div>
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
                          onClick={() => navigate(`/admin/provider/${provider.id}`)}
                        >
                          View Details
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