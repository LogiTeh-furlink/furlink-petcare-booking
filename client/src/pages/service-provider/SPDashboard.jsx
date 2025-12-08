// src/pages/service-provider/SPDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaStore, FaCalendarCheck, FaStar, FaEdit, FaEye } from "react-icons/fa"; // Added FaEye
import "./SPDashboard.css";

export default function SPDashboard() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProviderDetails = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/login");

        // Fetch provider details associated with the logged-in user
        // Ensure click_count is selected (it is by default with "*")
        const { data, error } = await supabase
          .from("service_providers")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (error) throw error;
        setProvider(data);
      } catch (err) {
        console.error("Error fetching provider details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProviderDetails();
  }, [navigate]);

  if (loading) return <div className="sp-loading">Loading Dashboard...</div>;

  return (
    <>
      <LoggedInNavbar />
      <div className="sp-dashboard-container">
        
        {/* Header Section */}
        <div className="sp-header">
          <div className="sp-welcome">
            <h1>{provider?.business_name || "My Business"}</h1>
            <p>Provider Dashboard</p>
          </div>
          <div className="sp-status">
            <span className={`status-badge ${provider?.status}`}>
              {provider?.status?.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="sp-stats-grid">
          
          {/* Service Listing Status */}
          <div className="sp-stat-card">
            <div className="icon-wrapper blue"><FaStore /></div>
            <div className="stat-info">
              <h3>Service Listing</h3>
              <p>Active</p>
            </div>
          </div>

          {/* NEW: Profile Views / Click Counter */}
          <div className="sp-stat-card">
            <div className="icon-wrapper purple" style={{ backgroundColor: '#f3e8ff', color: '#9333ea' }}>
                <FaEye />
            </div>
            <div className="stat-info">
              {/* Ensure this matches your DB column name exactly */}
              <h3>{provider?.click_count || 0}</h3> 
              <p>Profile Views</p>
            </div>
          </div>

          {/* Bookings (Placeholder) */}
          <div className="sp-stat-card">
            <div className="icon-wrapper green"><FaCalendarCheck /></div>
            <div className="stat-info">
              <h3>0 Bookings</h3>
              <p>Upcoming</p>
            </div>
          </div>

          {/* Rating (Placeholder) */}
          <div className="sp-stat-card">
            <div className="icon-wrapper yellow"><FaStar /></div>
            <div className="stat-info">
              <h3>0.0</h3>
              <p>Rating</p>
            </div>
          </div>

        </div>

        {/* Quick Actions */}
        <div className="sp-actions-section">
          <h2>Quick Actions</h2>
          <div className="action-buttons-row">
            <button 
              className="sp-action-btn primary"
              onClick={() => navigate("/service/manage-listing")}
            >
              <FaEdit /> Edit / Manage Listing
            </button>
            {/* You can add 'View Booking History' etc here later */}
          </div>
        </div>

      </div>
      <Footer />
    </>
  );
}