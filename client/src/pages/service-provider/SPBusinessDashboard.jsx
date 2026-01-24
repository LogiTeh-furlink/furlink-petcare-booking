import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCaretUp, FaCaretDown } from 'react-icons/fa';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Tooltip, Legend
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import './SPBusinessDashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend);

export default function SPBusinessDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('business_performance'); 
  const [activeFilter, setActiveFilter] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [rawBookings, setRawBookings] = useState([]);
  const [serviceStats, setServiceStats] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
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

        // Fetch bookings including the time_slot column
        const { data: bookings, error: bError } = await supabase
          .from('bookings')
          .select('booking_date, total_estimated_price, status, user_id, time_slot')
          .eq('provider_id', provider.id);

        if (bError) throw bError;
        setRawBookings(bookings || []);

        const { data: bServices, error: sError } = await supabase
          .from('booking_services')
          .select('service_name, price')
          .in('service_id', (
            await supabase.from('services').select('id').eq('provider_id', provider.id)
          ).data.map(s => s.id));

        if (sError) throw sError;
        setServiceStats(bServices || []);

      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  const analytics = useMemo(() => {
    const now = new Date();
    const filtered = rawBookings.filter(b => {
      const bDate = new Date(b.booking_date);
      if (activeFilter === 'weekly') {
        const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
        return bDate >= weekAgo;
      } else if (activeFilter === 'monthly') {
        return bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear();
      }
      return bDate.getFullYear() === now.getFullYear();
    });

    // KPI Logic
    const revenue = filtered
      .filter(b => ['paid', 'completed', 'rated', 'to_rate'].includes(b.status))
      .reduce((sum, b) => sum + (Number(b.total_estimated_price) || 0), 0);
    
    const validBookings = filtered.filter(b => !['cancelled', 'declined'].includes(b.status));
    const cancellations = filtered.filter(b => b.status === 'cancelled').length;
    const uniqueCustomers = new Set(filtered.map(b => b.user_id)).size;

    // Service Distribution
    const serviceMap = {};
    serviceStats.forEach(s => {
      serviceMap[s.service_name] = (serviceMap[s.service_name] || 0) + 1;
    });

    // --- TIME DATA LOGIC (HOURS TREND) ---
    // Extract unique time slots from provider's bookings and count them
    const hourMap = {};
    validBookings.forEach(b => {
      if (b.time_slot) {
        hourMap[b.time_slot] = (hourMap[b.time_slot] || 0) + 1;
      }
    });

    // Sort time slots (e.g., "09:00 AM", "02:00 PM") chronologically
    const sortedHours = Object.keys(hourMap).sort((a, b) => {
      return new Date(`1970/01/01 ${a}`) - new Date(`1970/01/01 ${b}`);
    });
    const hourValues = sortedHours.map(h => hourMap[h]);

    // --- DAY/MONTH DATA LOGIC ---
    let timeLabels = activeFilter === 'yearly' 
      ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] 
      : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    let timeValues = new Array(timeLabels.length).fill(0);

    validBookings.forEach(b => {
      const bDate = new Date(b.booking_date);
      const idx = activeFilter === 'yearly' ? bDate.getMonth() : (bDate.getDay() + 6) % 7;
      if(timeValues[idx] !== undefined) timeValues[idx]++;
    });

    return { 
      revenue, 
      validCount: validBookings.length, 
      cancellations, 
      avg: uniqueCustomers > 0 ? (validBookings.length / uniqueCustomers).toFixed(1) : 0, 
      timeLabels, 
      timeValues, 
      sLabels: Object.keys(serviceMap), 
      sValues: Object.values(serviceMap),
      hourLabels: sortedHours,
      hourValues: hourValues
    };
  }, [rawBookings, serviceStats, activeFilter]);

  // Shared options to force WHOLE NUMBERS on Y-Axis
  const integerYAxisOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          callback: (value) => (Number.isInteger(value) ? value : null),
        }
      }
    }
  };

  if (loading) return <div className="sp-biz-page-wrapper" style={{justifyContent: 'center'}}>Loading Dashboard...</div>;

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      <div className="sp-biz-container">
        <aside className="sp-biz-sidebar">
          <div className="sidebar-tabs-group">
            <button className={`sidebar-tab-btn ${activeTab === 'business_performance' ? 'active' : ''}`} onClick={() => setActiveTab('business_performance')}>Business Performance</button>
            <button className={`sidebar-tab-btn ${activeTab === 'customer_insights' ? 'active' : ''}`} onClick={() => setActiveTab('customer_insights')}>Customer Insights</button>
          </div>
          <div className="sidebar-filters-section">
            <h3>Filters</h3>
            <ul className="filter-list">
              {['Weekly', 'Monthly', 'Yearly'].map(f => (
                <li key={f} className={activeFilter === f.toLowerCase() ? 'active' : ''} onClick={() => setActiveFilter(f.toLowerCase())}>{f}</li>
              ))}
            </ul>
          </div>
          <div className="sidebar-doughnut-card">
            <h4 className="chart-title-sm">Most Booked Services</h4>
            <div className="doughnut-container-sidebar">
              <div className="doughnut-wrapper-sidebar">
                <Doughnut data={{ labels: analytics.sLabels, datasets: [{ data: analytics.sValues, backgroundColor: ['#1e3a8a', '#3b82f6', '#93c5fd'], borderWidth: 0 }] }} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '70%' }} />
              </div>
              <div className="doughnut-labels-sidebar">
                {analytics.sLabels.slice(0, 2).map((l, i) => <span key={l}>{analytics.sValues[i]} ({l})</span>)}
              </div>
            </div>
          </div>
        </aside>

        <main className="sp-biz-main-content">
          <div className="sp-biz-kpi-grid">
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">₱{(analytics.revenue / 1000).toFixed(1)}K</div>
              <div className="kpi-label">Gross Revenue</div>
              <div className="kpi-trend positive"><FaCaretUp /> 10% Higher</div>
            </div>
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">{analytics.validCount}</div>
              <div className="kpi-label">Total Bookings</div>
            </div>
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">{analytics.avg}</div>
              <div className="kpi-label">Avg Booking per Customer</div>
            </div>
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">{analytics.cancellations.toString().padStart(2, '0')}</div>
              <div className="kpi-label">Cancellations</div>
            </div>
          </div>

          <div className="chart-main-box">
            <h3 className="chart-title">Average Bookings ({activeFilter})</h3>
            <div className="chart-h-250">
              <Bar 
                data={{ 
                  labels: analytics.timeLabels, 
                  datasets: [{ 
                    data: analytics.timeValues, 
                    backgroundColor: '#1e3a8a', 
                    borderRadius: 6, 
                    barThickness: activeFilter === 'yearly' ? 20 : 50 
                  }] 
                }} 
                options={integerYAxisOptions} 
              />
            </div>
          </div>
          
          <div className="sp-biz-bottom-grid">
            <div className="bottom-card">
              <h4 className="chart-title-sm">Booking Days</h4>
              <div className="chart-h-150">
                <Bar 
                  data={{ 
                    labels: analytics.timeLabels.slice(0, 7), 
                    datasets: [{ 
                      data: analytics.timeValues.slice(0, 7), 
                      backgroundColor: '#1e3a8a', 
                      borderRadius: 6 
                    }] 
                  }} 
                  options={integerYAxisOptions} 
                />
              </div>
            </div>
            <div className="bottom-card">
              <h4 className="chart-title-sm">Booking Hours Trend</h4>
              <div className="chart-h-150">
                <Line 
                  data={{ 
                    labels: analytics.hourLabels, 
                    datasets: [{ 
                      data: analytics.hourValues, 
                      borderColor: '#1e3a8a', 
                      borderWidth: 3, 
                      tension: 0.4 
                    }] 
                  }} 
                  options={integerYAxisOptions} 
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