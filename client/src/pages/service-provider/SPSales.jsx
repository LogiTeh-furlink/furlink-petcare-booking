import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import './SPSales.css';

export default function SPSales() {
  const navigate = useNavigate();
  // Sidebar State
  const [activeTab] = useState('sales'); 
  const [activeFilter, setActiveFilter] = useState('monthly');
  const [petTypeFilter, setPetTypeFilter] = useState('both');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  
  // Data State
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/login");

        const { data: provider } = await supabase
          .from("service_providers")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!provider) return;

        // Chart data fetching removed as requested

      } catch (err) {
        console.error("Sales Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSidebarData();
  }, [navigate]);

  if (loading) return <div className="loading-state">Loading...</div>;

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      
      <div className="sp-biz-main-layout">
        <div className="sp-biz-container">
          
          {/* --- SIDEBAR --- */}
          <aside className="sp-biz-sidebar">
            <div className="sidebar-tabs-group">
              <button 
                className={`sidebar-tab-btn ${activeTab === 'sales' ? 'active' : ''}`} 
                onClick={() => navigate('/service/sales')}
              >
                Sales
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
            
            <div className="sidebar-section">
              <h3>Timeframe</h3>
              <select className="filter-dropdown" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom Range</option>
              </select>
              
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

            <div className="sidebar-section">
              <h3>Pet Type</h3>
              <select className="filter-dropdown" value={petTypeFilter} onChange={(e) => setPetTypeFilter(e.target.value)}>
                <option value="both">Both (Dog & Cat)</option>
                <option value="Dog">Dog</option>
                <option value="Cat">Cat</option>
              </select>
            </div>
            
            {/* Booked Services Donut Chart Removed */}
          </aside>

          {/* --- MAIN CONTENT (Empty) --- */}
          <main className="sp-biz-main-content">
             {/* Content removed as requested */}
          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}