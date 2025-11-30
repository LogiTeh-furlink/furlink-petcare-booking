// src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../config/supabase";
import LoggedInAdmin from "../../components/Header/LoggedInAdmin";
import { FaStore, FaList, FaUser, FaClock, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [pendingCount, setPendingCount] = useState(0);
  const [activeListings, setActiveListings] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [averageApprovalTime, setAverageApprovalTime] = useState("-");
  const [totalUsers, setTotalUsers] = useState(0);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  /** =============================
   *  FETCH COUNTS + PROVIDERS
   * ============================== */
  useEffect(() => {
    fetchDashboardCounts();
    fetchProviders();
  }, []);

  /** LIVE updates for service provider changes */
  useEffect(() => {
    const channel = supabase
      .channel("service_providers_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_providers" },
        () => {
          fetchDashboardCounts();
          fetchProviders();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  /** ------------------------
   * Fetch Dashboard Stats
   * ------------------------ */
  const fetchDashboardCounts = async () => {
    try {
      // Pending count
      const { count: pending } = await supabase
        .from("service_providers")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Active listings count (approved)
      const { count: active } = await supabase
        .from("service_providers")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved");

      // Rejected count
      const { count: rejected } = await supabase
        .from("service_providers")
        .select("*", { count: "exact", head: true })
        .eq("status", "rejected");

      // Total users (from profiles)
      const { count: users } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Compute average approval time
      const { data: approvals } = await supabase
        .from("service_providers")
        .select("created_at, approved_at")
        .not("approved_at", "is", null);

      let avgHours = "-";
      if (approvals?.length > 0) {
        const totalMs = approvals.reduce((sum, row) => {
          const created = new Date(row.created_at);
          const approved = new Date(row.approved_at);
          return sum + (approved - created);
        }, 0);

        avgHours = (totalMs / approvals.length / (1000 * 60 * 60)).toFixed(1);
      }

      setPendingCount(pending || 0);
      setActiveListings(active || 0);
      setRejectedCount(rejected || 0);
      setAverageApprovalTime(avgHours);
      setTotalUsers(users || 0);
    } catch (err) {
      console.error(err);
    }
  };

  /** ------------------------
   * Fetch Service Providers (Pending Only)
   * ------------------------ */
  const fetchProviders = async () => {
    try {
      const { data, error } = await supabase
        .from("service_providers")
        .select("id, business_name, city, status")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!error && data) setProviders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /** ------------------------
   * VIEW DETAILS HANDLER
   * ------------------------ */
  const handleViewProvider = (providerId) => {
    navigate(`/admin/provider/${providerId}`);
  };

  /** ------------------------
   * GET STATUS BADGE CLASS
   * ------------------------ */
  const getStatusBadge = (status) => {
    switch(status) {
      case 'approved':
        return 'status-badge status-approved';
      case 'rejected':
        return 'status-badge status-rejected';
      case 'pending':
        return 'status-badge status-pending';
      default:
        return 'status-badge';
    }
  };

  return (
    <>
      <LoggedInAdmin />

      <div className="admin-dashboard-container">
        <h1 className="admin-welcome">Welcome, Admin!</h1>

        {/* ==== DASHBOARD CARDS ==== */}
        <div className="admin-cards-row">
          {/* Pending Approvals */}
          <div className="admin-card admin-card-primary">
            <FaStore className="admin-card-icon" size={32} />
            <div className="admin-card-info">
              <h2>{pendingCount}</h2>
              <p>Pending Approvals</p>
            </div>
          </div>

          {/* Active Listings */}
          <div className="admin-card admin-card-green">
            <FaList className="admin-card-icon" size={32} />
            <div className="admin-card-info">
              <h2>{activeListings}</h2>
              <p>Active Listings</p>
            </div>
          </div>

          {/* Rejected Listings */}
          <div className="admin-card admin-card-red">
            <FaTimes className="admin-card-icon" size={32} />
            <div className="admin-card-info">
              <h2>{rejectedCount}</h2>
              <p>Rejected Listings</p>
            </div>
          </div>

          {/* Average Approval Time */}
          <div className="admin-card admin-card-orange">
            <FaClock className="admin-card-icon" size={32} />
            <div className="admin-card-info">
              <h2>{averageApprovalTime} hrs</h2>
              <p>Avg. Approval Time</p>
            </div>
          </div>

          {/* Total Users */}
          <div className="admin-card admin-card-blue">
            <FaUser className="admin-card-icon" size={32} />
            <div className="admin-card-info">
              <h2>{totalUsers}</h2>
              <p>Total Users</p>
            </div>
          </div>
        </div>

        {/* ===== SERVICE PROVIDERS LIST ===== */}
        <h2 className="providers-title">Pending Service Providers</h2>

        <div className="providers-list">
          {providers.length === 0 ? (
            <p>No pending service providers.</p>
          ) : (
            providers.map((provider) => (
              <div key={provider.id} className="provider-item">
                <div>
                  <strong>{provider.business_name}</strong>
                  <p className="provider-city">{provider.city}</p>
                  <span className={getStatusBadge(provider.status)}>
                    {provider.status.charAt(0).toUpperCase() + provider.status.slice(1)}
                  </span>
                </div>

                <button
                  className="provider-view-btn"
                  onClick={() => handleViewProvider(provider.id)}
                >
                  View Details
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}