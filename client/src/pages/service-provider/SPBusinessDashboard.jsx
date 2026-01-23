import React, { useState } from 'react';
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCaretUp, FaCaretDown } from 'react-icons/fa';
import './SPBusinessDashboard.css';

export default function SPBusinessDashboard() {
  const [activeTab, setActiveTab] = useState('customer_insights'); // 'business_performance' or 'customer_insights'
  const [activeFilter, setActiveFilter] = useState('monthly');

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      
      <div className="sp-biz-container">
        
        {/* --- SIDEBAR AREA (Left) --- */}
        <aside className="sp-biz-sidebar">
          
          {/* Main Tabs */}
          <div className="sidebar-tabs-group">
            <button 
              className={`sidebar-tab-btn ${activeTab === 'business_performance' ? 'active' : ''}`}
              onClick={() => setActiveTab('business_performance')}
            >
              Business Performance
            </button>
            <button 
              className={`sidebar-tab-btn ${activeTab === 'customer_insights' ? 'active' : ''}`}
              onClick={() => setActiveTab('customer_insights')}
            >
              Customer Insights
            </button>
          </div>

          {/* Filters Section */}
          <div className="sidebar-filters-section">
            <h3>Filters</h3>
            <ul>
              {['Weekly', 'Monthly', 'Yearly'].map((filter) => (
                <li 
                  key={filter} 
                  className={activeFilter === filter.toLowerCase() ? 'active' : ''}
                  onClick={() => setActiveFilter(filter.toLowerCase())}
                >
                  {filter}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* --- MAIN CONTENT AREA (Right) --- */}
        <main className="sp-biz-main-content">
          
          {/* KPI Cards Row */}
          <div className="sp-biz-kpi-grid">
            
            {/* Card 1: Gross Revenue */}
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">₱23K</div>
              <div className="kpi-label">Gross Revenue</div>
              <div className="kpi-trend positive">
                <FaCaretUp /> <span>10% Higher</span>
              </div>
            </div>

            {/* Card 2: Total Bookings */}
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">100</div>
              <div className="kpi-label">Total Bookings</div>
              <div className="kpi-trend negative">
                <FaCaretDown /> <span>10 Lesser Bookings</span>
              </div>
            </div>

            {/* Card 3: Average Booking */}
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">03</div>
              <div className="kpi-label">Average Booking <br/> per Customer</div>
            </div>

            {/* Card 4: Cancellations */}
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">05</div>
              <div className="kpi-label">Number of <br/> Cancellations</div>
            </div>

          </div>

          {/* Placeholder for Charts (Disregarded for now) */}
          <div className="charts-placeholder-area">
             {/* Charts will go here later */}
          </div>

        </main>

      </div>

      <Footer />
    </div>
  );
}