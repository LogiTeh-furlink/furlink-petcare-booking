import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import './SPCustomerInsight.css';

export default function SPCustomerInsight() {
  const navigate = useNavigate();
  const [activeTab] = useState('customer_insights');
  
  // States copied from SPBusinessDashboard
  const [activeFilter, setActiveFilter] = useState('monthly');
  const [petTypeFilter, setPetTypeFilter] = useState('both');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      
      <div className="sp-biz-main-layout">
        <div className="sp-biz-container">
          
          <aside className="sp-biz-sidebar">
            <div className="sidebar-tabs-group">
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
                Customer Insight
              </button>
            </div>

            {/* Exact Copy of Timeframe Filter Section */}
            <div className="sidebar-section">
              <h3>Timeframe</h3>
              <select 
                className="filter-dropdown" 
                value={activeFilter} 
                onChange={(e) => setActiveFilter(e.target.value)}
              >
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

            {/* Exact Copy of Pet Type Filter Section */}
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

          <main className="sp-biz-main-content">
            {/* Content area remains clear as requested previously */}
          </main>

        </div>
      </div>

      <Footer />
    </div>
  );
}