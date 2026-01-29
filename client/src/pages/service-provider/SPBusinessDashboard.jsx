import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCaretUp, FaCaretDown, FaMinus } from 'react-icons/fa';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Tooltip, Legend
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import './SPBusinessDashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend);

export default function SPBusinessDashboard() {
  const navigate = useNavigate();
  const [activeTab] = useState('business_performance'); 
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

        const { data: bookings, error: bError } = await supabase
          .from('bookings')
          .select('id, booking_date, total_estimated_price, status, user_id, time_slot')
          .eq('provider_id', provider.id);

        if (bError) throw bError;
        setRawBookings(bookings || []);

        const { data: bServices, error: sError } = await supabase
          .from('booking_services')
          .select(`
            service_name,
            booking_pets!inner (
              booking_id,
              bookings!inner (
                status,
                booking_date
              )
            )
          `)
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
    const validStatuses = ['paid', 'completed', 'rated', 'to_rate'];
    
    const getRange = (filter, isPrevious = false) => {
      let start = new Date();
      let end = new Date();
      if (filter === 'weekly') {
        if (isPrevious) { start.setDate(now.getDate() - 14); end.setDate(now.getDate() - 7); }
        else { start.setDate(now.getDate() - 7); }
      } else if (filter === 'monthly') {
        if (isPrevious) { start.setMonth(now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); }
        else { start.setDate(1); }
      } else {
        if (isPrevious) { start.setFullYear(now.getFullYear() - 1, 0, 1); end.setFullYear(now.getFullYear() - 1, 11, 31); }
        else { start.setFullYear(now.getFullYear(), 0, 1); }
      }
      return { start, end };
    };

    const currentRange = getRange(activeFilter);
    const previousRange = getRange(activeFilter, true);
    const rangeText = `${currentRange.start.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} - ${now.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`;

    const filterByRange = (list, range) => list.filter(b => {
      const d = new Date(b.booking_date);
      return d >= range.start && d <= (range.end || now);
    });

    const currentBookings = filterByRange(rawBookings, currentRange);
    const previousBookings = filterByRange(rawBookings, previousRange);

    const calculateMetrics = (list) => {
      const valid = list.filter(b => validStatuses.includes(b.status));
      const rev = valid.reduce((sum, b) => sum + (Number(b.total_estimated_price) || 0), 0);
      return { rev, count: valid.length, valid };
    };

    const current = calculateMetrics(currentBookings);
    const previous = calculateMetrics(previousBookings);

    const formatCleanTime = (timeStr) => {
      if (!timeStr || typeof timeStr !== 'string') return null;
      const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      return match ? `${match[1]}:${match[2]} ${match[3].toUpperCase()}` : null;
    };

    const getTrend = (curr, prev) => {
      if (prev === 0) return curr > 0 ? { val: 100, dir: 'up' } : { val: 0, dir: 'neutral' };
      const diff = ((curr - prev) / prev) * 100;
      return { val: Math.abs(Math.round(diff)), dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral' };
    };

    let dateLabels = [];
    if (activeFilter === 'yearly') {
      const year = currentRange.start.getFullYear();
      dateLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => `${m} ${year}`);
    } else {
      dateLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    }

    let dateValues = new Array(dateLabels.length).fill(0);
    current.valid.forEach(b => {
      const bDate = new Date(b.booking_date);
      const idx = activeFilter === 'yearly' ? bDate.getMonth() : (bDate.getDay() + 6) % 7;
      if(dateValues[idx] !== undefined) dateValues[idx]++;
    });

    const peakDaysLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let peakDaysValues = new Array(7).fill(0);
    current.valid.forEach(b => {
      const dayIdx = (new Date(b.booking_date).getDay() + 6) % 7;
      peakDaysValues[dayIdx]++;
    });

    const timeSlotCounts = {};
    current.valid.forEach(b => {
      if (b.time_slot) {
        const formatted = formatCleanTime(b.time_slot);
        if (formatted) timeSlotCounts[formatted] = (timeSlotCounts[formatted] || 0) + 1;
      }
    });
    
    const sortedHourLabels = Object.keys(timeSlotCounts).sort((a, b) => {
      const parseTime = (t) => {
        const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        let h = parseInt(m[1]);
        if (m[3] === 'PM' && h !== 12) h += 12;
        if (m[3] === 'AM' && h === 12) h = 0;
        return h * 60 + parseInt(m[2]);
      };
      return parseTime(a) - parseTime(b);
    });
    const hourValues = sortedHourLabels.map(slot => timeSlotCounts[slot]);

    const serviceMap = {};
    serviceStats.filter(s => {
      const b = s.booking_pets?.bookings;
      return b && validStatuses.includes(b.status) && new Date(b.booking_date) >= currentRange.start;
    }).forEach(s => { serviceMap[s.service_name] = (serviceMap[s.service_name] || 0) + 1; });
    
    const sLabels = Object.keys(serviceMap);
    const sValues = Object.values(serviceMap);
    const totalS = sValues.reduce((a, b) => a + b, 0);

    return { 
      revenue: current.rev, validCount: current.count, cancellations: currentBookings.filter(b => b.status === 'cancelled').length, 
      avg: new Set(current.valid.map(b => b.user_id)).size > 0 ? Math.round(current.count / new Set(current.valid.map(b => b.user_id)).size) : 0, 
      revTrend: getTrend(current.rev, previous.rev), bookTrend: getTrend(current.count, previous.count),
      dateLabels, dateValues, peakDaysLabels, peakDaysValues, sortedHourLabels, hourValues,
      sLabels, sValues, totalS, rangeText
    };
  }, [rawBookings, serviceStats, activeFilter]);

  const commonChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 9 } } }, x: { ticks: { font: { size: 9 } } } }
  };

  const TrendIndicator = ({ trend }) => (
    <div className={`kpi-trend ${trend.dir === 'up' ? 'positive' : trend.dir === 'down' ? 'negative' : 'neutral'}`}>
      {trend.dir === 'up' ? <FaCaretUp /> : trend.dir === 'down' ? <FaCaretDown /> : <FaMinus />} {trend.val}%
    </div>
  );

  if (loading) return <div className="loading-state">Loading Dashboard...</div>;

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      
      <div className="sp-biz-main-layout">
        <div className="sp-biz-container">
          <aside className="sp-biz-sidebar">
            <div className="sidebar-tabs-group">
              <button className={`sidebar-tab-btn ${activeTab === 'business_performance' ? 'active' : ''}`} onClick={() => navigate('/service/business-dashboard')}>Performance</button>
              <button className={`sidebar-tab-btn ${activeTab === 'customer_insights' ? 'active' : ''}`} onClick={() => navigate('/service/customer-insight')}>Insights</button>
            </div>
            
            <div className="sidebar-section">
              <h3>Timeframe</h3>
              <select className="filter-dropdown" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            
            <div className="sidebar-section doughnut-card">
              <h4 className="chart-title-sm">Services Mix</h4>
              <div className="doughnut-container">
                <div className="doughnut-wrapper">
                  <Doughnut data={{ labels: analytics.sLabels, datasets: [{ data: analytics.sValues, backgroundColor: ['#1e3a8a', '#3b82f6', '#93c5fd'], borderWidth: 0 }] }} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '75%' }} />
                </div>
                <div className="doughnut-labels">
                  {analytics.sLabels.slice(0, 2).map((l, i) => (
                    <span key={l}>{Math.round((analytics.sValues[i]/analytics.totalS)*100)}% {l}</span>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <main className="sp-biz-main-content">
            <div className="sp-biz-kpi-grid">
              <div className="kpi-card">
                <span className="kpi-label">Gross Revenue</span>
                <div className="kpi-row">
                  <span className="kpi-value">{analytics.revenue >= 1000 ? `₱${(analytics.revenue / 1000).toFixed(1)}K` : `₱${Math.round(analytics.revenue)}`}</span>
                  <TrendIndicator trend={analytics.revTrend} />
                </div>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Total Bookings</span>
                <div className="kpi-row">
                  <span className="kpi-value">{analytics.validCount}</span>
                  <TrendIndicator trend={analytics.bookTrend} />
                </div>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Avg/Customer</span>
                <span className="kpi-value">{analytics.avg}</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Cancellations</span>
                <span className="kpi-value">{analytics.cancellations.toString().padStart(2, '0')}</span>
              </div>
            </div>

            <div className="chart-box main-chart">
              <div className="chart-header">
                <h3 className="chart-title">Average Bookings ({activeFilter})</h3>
                <span className="date-range">{analytics.rangeText}</span>
              </div>
              <div className="chart-container-large">
                <Bar data={{ labels: analytics.dateLabels, datasets: [{ data: analytics.dateValues, backgroundColor: '#1e3a8a', borderRadius: 4, barThickness: activeFilter === 'yearly' ? 12 : 35 }] }} options={commonChartOptions} />
              </div>
            </div>
            
            <div className="sp-biz-bottom-grid">
              <div className="chart-box">
                <h4 className="chart-title-sm">Peak Days</h4>
                <div className="chart-container-small">
                  <Bar data={{ labels: analytics.peakDaysLabels, datasets: [{ data: analytics.peakDaysValues, backgroundColor: '#1e3a8a', borderRadius: 4 }] }} options={commonChartOptions} />
                </div>
              </div>
              <div className="chart-box">
                <h4 className="chart-title-sm">Hourly Trend</h4>
                <div className="chart-container-small">
                  <Line data={{ labels: analytics.sortedHourLabels, datasets: [{ data: analytics.hourValues, borderColor: '#1e3a8a', borderWidth: 2, tension: 0.4, pointRadius: 2 }] }} options={commonChartOptions} />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}