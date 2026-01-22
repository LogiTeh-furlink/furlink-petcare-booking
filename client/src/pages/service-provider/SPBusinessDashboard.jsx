import React from 'react';
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaChartLine, FaWallet, FaUserFriends, FaStar } from 'react-icons/fa';
import './SPBusinessDashboard.css';

export default function SPBusinessDashboard() {
  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      
      <div className="sp-biz-container">
        <div className="sp-biz-header">
          <h1>Business Dashboard</h1>
          <p>Overview of your service performance and analytics</p>
        </div>

        {/* Example Stat Cards */}
        <div className="sp-biz-stats-grid">
          <div className="sp-biz-card">
            <div className="icon-wrapper blue"><FaChartLine /></div>
            <div className="stat-content">
              <h3>Total Bookings</h3>
              <p className="stat-number">0</p>
            </div>
          </div>
          
          <div className="sp-biz-card">
            <div className="icon-wrapper green"><FaWallet /></div>
            <div className="stat-content">
              <h3>Total Earnings</h3>
              <p className="stat-number">₱0.00</p>
            </div>
          </div>

          <div className="sp-biz-card">
            <div className="icon-wrapper purple"><FaUserFriends /></div>
            <div className="stat-content">
              <h3>Total Customers</h3>
              <p className="stat-number">0</p>
            </div>
          </div>

          <div className="sp-biz-card">
            <div className="icon-wrapper yellow"><FaStar /></div>
            <div className="stat-content">
              <h3>Average Rating</h3>
              <p className="stat-number">N/A</p>
            </div>
          </div>
        </div>

        {/* Example Content Section */}
        <div className="sp-biz-content-section">
          <h2>Analytics Chart</h2>
          <div className="placeholder-chart">
            <p>Chart data will appear here...</p>
          </div>
        </div>

      </div>

      <Footer />
    </div>
  );
}