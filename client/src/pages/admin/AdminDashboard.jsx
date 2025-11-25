// src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../config/supabase";
import LoggedInAdmin from "../../components/Header/LoggedInAdmin";
import { FaStore } from "react-icons/fa";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch initial count
  useEffect(() => {
    fetchPendingCount();
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('service_providers_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'service_providers',
        },
        (payload) => {
          // Refetch count whenever the table changes
          fetchPendingCount();
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPendingCount = async () => {
    try {
      const { count, error } = await supabase
        .from('service_providers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) {
        console.error('Error fetching pending count:', error);
      } else {
        setPendingCount(count || 0);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <LoggedInAdmin />

      <div className="admin-dashboard-container">
        <h1 className="admin-welcome">Welcome, Admin!</h1>

        {/* ==== TOP CARDS ROW ==== */}
        <div className="admin-cards-row">

          {/* Pending Approvals Card */}
          <div className="admin-card admin-card-primary">
            <div className="admin-card-icon">
              <FaStore size={32} />
            </div>

            <div className="admin-card-info">
              <h2 className="admin-card-number">
                {loading ? '...' : pendingCount}
              </h2>
              <p className="admin-card-label">Pending Approvals</p>
            </div>
          </div>

        </div>

        {/* ==== Business List Preview (not yet required but placeholder) ==== */}
        <div className="admin-business-box">
          <div className="admin-business-name">Furbnb</div>
          <button className="admin-view-btn">View Details</button>
        </div>

      </div>
    </>
  );
}