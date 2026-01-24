import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCaretUp, FaCaretDown } from 'react-icons/fa';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Tooltip, Legend
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import './SPBusinessDashboard.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, 
  LineElement, ArcElement, Tooltip, Legend
);

export default function SPBusinessDashboard() {
  const [activeTab, setActiveTab] = useState('business_performance'); 
  const [activeFilter, setActiveFilter] = useState('monthly');

  // Chart Configuration
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { 
        beginAtZero: true, 
        grid: { drawBorder: false, color: '#f0f0f0' }, 
        ticks: { 
          font: { size: 10 },
          stepSize: 1, // Forces steps to be whole numbers
          callback: function(value) {
            if (value % 1 === 0) { return value; } // Only show if it's an integer
          }
        } 
      },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } }
    }
  };

  const doughnutOptions = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    cutout: '70%'
  };

  // Dynamic Data Logic based on activeFilter
  const filterData = {
    weekly: {
      avgBookings: [2, 3, 1, 4, 2, 5, 3],
      avgLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      peakDays: [2, 5, 3, 4, 1],
      peakHours: [1, 3, 5, 2, 4],
      serviceData: [10, 5],
      serviceLabels: ['Grooming', 'Sitting']
    },
    monthly: {
      avgBookings: [4, 5, 1, 5, 7],
      avgLabels: ['Monday', 'Saturday', 'Sunday', 'Tuesday', 'Wednesday'],
      peakDays: [4, 5, 1, 5, 7],
      peakHours: [5, 4, 1, 4, 1],
      serviceData: [23, 23],
      serviceLabels: ['Service A', 'Service B']
    },
    yearly: {
      avgBookings: [50, 65, 40, 80, 95, 70, 85, 90, 100, 110, 95, 120],
      avgLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      peakDays: [20, 25, 15, 30, 28],
      peakHours: [15, 12, 8, 14, 10],
      serviceData: [300, 150],
      serviceLabels: ['Long-term Care', 'Vaccination']
    }
  };

  const currentData = filterData[activeFilter];

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      
      <div className="sp-biz-container">
        <aside className="sp-biz-sidebar">
          <div className="sidebar-tabs-group">
            <button className={`sidebar-tab-btn ${activeTab === 'business_performance' ? 'active' : ''}`} onClick={() => setActiveTab('business_performance')}>
              Business Performance
            </button>
            <button className={`sidebar-tab-btn ${activeTab === 'customer_insights' ? 'active' : ''}`} onClick={() => setActiveTab('customer_insights')}>
              Customer Insights
            </button>
          </div>

          <div className="sidebar-filters-section">
            <h3>Filters</h3>
            <ul className="filter-list">
              {['Weekly', 'Monthly', 'Yearly'].map((f) => (
                <li 
                  key={f} 
                  className={activeFilter === f.toLowerCase() ? 'active' : ''} 
                  onClick={() => setActiveFilter(f.toLowerCase())}
                >
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="sidebar-doughnut-card">
            <h4 className="chart-title-sm">Most Booked Service ({activeFilter})</h4>
            <div className="doughnut-container-sidebar">
              <div className="doughnut-wrapper-sidebar">
                <Doughnut data={{
                  labels: currentData.serviceLabels,
                  datasets: [{ 
                    data: currentData.serviceData, 
                    backgroundColor: ['#1e3a8a', '#3b82f6'], 
                    borderWidth: 0 
                  }]
                }} options={doughnutOptions} />
              </div>
              <div className="doughnut-labels-sidebar">
                <span>{currentData.serviceData[0]} ({Math.round(currentData.serviceData[0]/(currentData.serviceData[0]+currentData.serviceData[1])*100)}%)</span>
                <span>{currentData.serviceData[1]} ({Math.round(currentData.serviceData[1]/(currentData.serviceData[0]+currentData.serviceData[1])*100)}%)</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="sp-biz-main-content">
          <div className="sp-biz-kpi-grid">
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">₱23K</div>
              <div className="kpi-label">Gross Revenue</div>
              <div className="kpi-trend positive"><FaCaretUp /> 10% Higher</div>
            </div>
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">100</div>
              <div className="kpi-label">Total Bookings</div>
              <div className="kpi-trend negative"><FaCaretDown /> 10 Lesser Bookings</div>
            </div>
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">03</div>
              <div className="kpi-label">Average Booking per Customer</div>
            </div>
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">05</div>
              <div className="kpi-label">Number of Cancellations</div>
            </div>
          </div>

          <div className="chart-main-box">
            <h3 className="chart-title">Average Number of Bookings ({activeFilter})</h3>
            <div className="chart-h-250">
              <Bar 
                data={{
                  labels: currentData.avgLabels,
                  datasets: [{ 
                    data: currentData.avgBookings, 
                    backgroundColor: '#1e3a8a', 
                    borderRadius: 6, 
                    barThickness: activeFilter === 'yearly' ? 25 : 55 
                  }]
                }} 
                options={baseOptions} 
              />
            </div>
          </div>

          <div className="sp-biz-bottom-grid">
            <div className="bottom-card">
              <h4 className="chart-title-sm">Peak booking days this {activeFilter.replace('ly', '')}</h4>
              <div className="chart-h-150">
                <Bar 
                  data={{
                    labels: ['Mon', 'Sat', 'Sun', 'Tue', 'Wed'],
                    datasets: [{ 
                        data: currentData.peakDays, 
                        backgroundColor: '#1e3a8a', 
                        borderRadius: 6, 
                        barThickness: 40 
                    }]
                  }} 
                  options={baseOptions} 
                />
              </div>
            </div>
            <div className="bottom-card">
              <h4 className="chart-title-sm">Peak booking hours this {activeFilter.replace('ly', '')}</h4>
              <div className="chart-h-150">
                <Line 
                  data={{
                    labels: ['10am', '12pm', '2pm', '4pm', '6pm'],
                    datasets: [{ data: currentData.peakHours, borderColor: '#1e3a8a', borderWidth: 3, pointRadius: 2, tension: 0.4 }]
                  }} 
                  options={baseOptions} 
                />
              </div>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}