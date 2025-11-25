// src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../config/supabase";
import LoggedInAdmin from "../../components/Header/LoggedInAdmin";
import { FaStore, FaUsers, FaClock, FaList } from "react-icons/fa";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [pendingCount, setPendingCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [averageApprovalTime, setAverageApprovalTime] = useState(null);
  const [providers, setProviders] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Real-time updates: service providers + profiles table
  useEffect(() => {
    const channel = supabase
      .channel("dashboard_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_providers" },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => fetchDashboardData()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // ---- PENDING COUNT ----
      const { count: pending } = await supabase
        .from("service_providers")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      setPendingCount(pending || 0);

      // ---- ACTIVE COUNT ----
      const { count: active } = await supabase
        .from("service_providers")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved");

      setActiveCount(active || 0);

      // ---- TOTAL USERS ----
      const { count: users } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      setTotalUsers(users || 0);

      // ---- AVERAGE APPROVAL TIME ----
      const { data: approvals } = await supabase
        .from("service_providers")
        .select("created_at, approved_at")
        .not("approved_at", "is", null);

      if (approvals?.length > 0) {
        const durations = approvals.map((p) => {
          const created = new Date(p.created_at);
          const approved = new Date(p.approved_at);
          return (approved - created) / (1000 * 60 * 60); // hours
        });

        const avg =
          durations.reduce((acc, v) => acc + v, 0) / durations.length;
        setAverageApprovalTime(avg.toFixed(1));
      } else {
        setAverageApprovalTime("—");
      }

      // ---- SERVICE PROVIDERS LIST ----
      const { data: providerRows } = await supabase
        .from("service_providers")
        .select("id, business_name, city, status")
        .order("created_at", { ascending: false });

      setProviders(providerRows || []);
    } catch (error) {
      console.error("Dashboard data error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <LoggedInAdmin />

      <div className="admin-dashboard-container">
        <h1 className="admin-welcome">Welcome, Admin!</h1>

        {/* ==== DASHBOARD CARDS ==== */}
        <div className="admin-cards-row">

          {/* Pending */}
          <div className="admin-card admin-card-primary">
            <div className="admin-card-icon"><FaStore size={32} /></div>
            <div className="admin-card-info">
              <h2 className="admin-card-number">{loading ? "…" : pendingCount}</h2>
              <p className="admin-card-label">Pending Approvals</p>
            </div>
          </div>

          {/* Active Listings */}
          <div className="admin-card admin-card-green">
            <div className="admin-card-icon"><FaList size={32} /></div>
            <div className="admin-card-info">
              <h2 className="admin-card-number">{loading ? "…" : activeCount}</h2>
              <p className="admin-card-label">Active Listings</p>
            </div>
          </div>

          {/* Avg Approval Time */}
          <div className="admin-card admin-card-yellow">
            <div className="admin-card-icon"><FaClock size={32} /></div>
            <div className="admin-card-info">
              <h2 className="admin-card-number">
                {loading ? "…" : `${averageApprovalTime} hrs`}
              </h2>
              <p className="admin-card-label">Avg Approval Time</p>
            </div>
          </div>

          {/* Total Users */}
          <div className="admin-card admin-card-blue">
            <div className="admin-card-icon"><FaUsers size={32} /></div>
            <div className="admin-card-info">
              <h2 className="admin-card-number">
                {loading ? "…" : totalUsers}
              </h2>
              <p className="admin-card-label">Total Users</p>
            </div>
          </div>
        </div>

        {/* ======= PROVIDERS LIST ======= */}
        <h2 className="providers-title">Service Providers</h2>

        <div className="providers-list">
          {providers.length === 0 ? (
            <p className="no-providers">No service providers found.</p>
          ) : (
            providers.map((p) => (
              <div key={p.id} className="provider-item">
                <div>
                  <strong>{p.business_name}</strong>
                  <p className="provider-city">{p.city}</p>
                </div>
                <span className={`provider-status status-${p.status}`}>
                  {p.status}
                </span>
              </div>
            ))
          )}
        </div>

      </div>
    </>
  );
}
