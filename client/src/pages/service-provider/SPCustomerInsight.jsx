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
import { Bar } from 'react-chartjs-2';
import './SPBusinessDashboard.css'; 

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend);

export default function SPCustomerInsight() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [rawBookings, setRawBookings] = useState([]);
  const [activeTab] = useState('customer_insights'); 

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
    const rangeText = `${currentRange.start.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })} - ${now.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`;

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

    const getTrend = (curr, prev) => {
      if (prev === 0) return curr > 0 ? { val: 100, dir: 'up' } : { val: 0, dir: 'neutral' };
      const diff = ((curr - prev) / prev) * 100;
      return { val: Math.abs(Math.round(diff)), dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral' };
    };

    return { 
      revenue: current.rev, 
      validCount: current.count, 
      cancellations: currentBookings.filter(b => b.status === 'cancelled').length, 
      avg: new Set(current.valid.map(b => b.user_id)).size > 0 ? Math.round(current.count / new Set(current.valid.map(b => b.user_id)).size) : 0, 
      revTrend: getTrend(current.rev, previous.rev), 
      bookTrend: getTrend(current.count, previous.count),
      rangeText
    };
  }, [rawBookings, activeFilter]);

  const TrendIndicator = ({ trend }) => {
    if (trend.dir === 'neutral') return <div className="kpi-trend neutral"><FaMinus /> No change</div>;
    const Icon = trend.dir === 'up' ? FaCaretUp : FaCaretDown;
    return <div className={`kpi-trend ${trend.dir === 'up' ? 'positive' : 'negative'}`}><Icon /> {trend.val}% {trend.dir === 'up' ? 'Higher' : 'Lower'}</div>;
  };

  const formatRevenue = (val) => {
    if (val >= 1000) return `₱${(val / 1000).toFixed(1)}K`;
    return `₱${Math.round(val)}`;
  };

  if (loading) return <div className="sp-biz-page-wrapper loading-state">Loading Insights...</div>;

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      <div className="sp-biz-main-layout">
        <div className="sp-biz-container">
          <aside className="sp-biz-sidebar">
            <div className="sidebar-tabs-group">
              <button className="sidebar-tab-btn" onClick={() => navigate('/service/business-dashboard')}>Business Performance</button>
              <button className="sidebar-tab-btn active" onClick={() => navigate('/service/customer-insight')}>Customer Insight</button>
            </div>
            <div className="sidebar-filters-section">
              <h3>Filters</h3>
              <ul className="filter-list">
                {['Weekly', 'Monthly', 'Yearly'].map((f) => (
                  <li key={f} className={activeFilter === f.toLowerCase() ? 'active' : ''} onClick={() => setActiveFilter(f.toLowerCase())}>{f}</li>
                ))}
              </ul>
            </div>
          </aside>

          <main className="sp-biz-main-content">
            {/* KPI GRID - EXACT COPY FROM SPBusinessDashboard.jsx */}
            <div className="sp-biz-kpi-grid">
              <div className="sp-biz-kpi-card">
                <div className="kpi-value">{formatRevenue(analytics.revenue)}</div>
                <div className="kpi-label">Gross Revenue</div>
                <TrendIndicator trend={analytics.revTrend} />
              </div>
              <div className="sp-biz-kpi-card">
                <div className="kpi-value">{analytics.validCount}</div>
                <div className="kpi-label">Total Bookings</div>
                <TrendIndicator trend={analytics.bookTrend} />
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
              <div className="chart-header-flex">
                <h3 className="chart-title">Customer Engagement Analytics ({activeFilter})</h3>
                <span className="date-range-indicator">{analytics.rangeText}</span>
              </div>
              <div className="chart-h-250" style={{display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b'}}>
                <p>Acquisition and retention data visualization...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}