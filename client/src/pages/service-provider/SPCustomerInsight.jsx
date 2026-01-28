import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import './SPBusinessDashboard.css'; // Reusing your existing CSS

export default function SPCustomerInsight() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/login");

        // Logic to fetch unique customers who have booked with this provider
        // This is a placeholder for your specific customer query
        setLoading(false);
      } catch (err) {
        console.error("Error fetching customer insights:", err);
        setLoading(false);
      }
    };
    fetchCustomerData();
  }, [navigate]);

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      <div className="sp-biz-main-layout">
        <div className="sp-biz-container">
          
          {/* Sidebar - Matches Dashboard for consistency */}
          <aside className="sp-biz-sidebar">
            <div className="sidebar-tabs-group">
              <button 
                className="sidebar-tab-btn" 
                onClick={() => navigate('/service/business-dashboard')}
              >
                Business Performance
              </button>
              <button 
                className="sidebar-tab-btn active" 
                onClick={() => navigate('/service/customer-insight')}
              >
                Customer Insight
              </button>
            </div>
            
            <div className="sidebar-filters-section">
              <h3>Customer Filters</h3>
              <p style={{fontSize: '0.8rem', color: '#666'}}>Filter by loyalty or frequency.</p>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="sp-biz-main-content">
            <div className="chart-main-box">
              <div className="chart-header-flex">
                <h3 className="chart-title">Customer Analytics</h3>
              </div>
              
              {loading ? (
                <p>Loading insights...</p>
              ) : (
                <div className="insight-placeholder-content">
                  <div style={{ padding: '20px', textAlign: 'center', border: '2px dashed #ccc', borderRadius: '8px' }}>
                    <h4>Customer Database & Retention</h4>
                    <p>This section will display your top clients, returning customer rate, and pet owner demographics.</p>
                  </div>
                </div>
              )}
            </div>
          </main>

        </div>
      </div>
      <Footer />
    </div>
  );
}