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

    const formatCleanTime = (timeStr) => {
      if (!timeStr) return null;
      const [hour, minute] = timeStr.split(':');
      const h = parseInt(hour, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h % 12 || 12;
      return `${displayHour}:${minute.substring(0,2)} ${ampm}`;
    };

    const getTrend = (curr, prev) => {
      if (prev === 0) return curr > 0 ? { val: 100, dir: 'up' } : { val: 0, dir: 'neutral' };
      const diff = ((curr - prev) / prev) * 100;
      return { val: Math.abs(Math.round(diff)), dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral' };
    };

    // --- CHART 1: Average Bookings ---
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

    // --- CHART 2: Peak Booking Days ---
    const peakDaysLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let peakDaysValues = new Array(7).fill(0);
    current.valid.forEach(b => {
      const dayIdx = (new Date(b.booking_date).getDay() + 6) % 7;
      peakDaysValues[dayIdx]++;
    });

    // --- CHART 3: Booking Hours Trend ---
    const rawSlots = [...new Set(current.valid.map(b => formatCleanTime(b.time_slot)))].filter(Boolean);
    const sortedHourLabels = rawSlots.sort((a, b) => new Date(`1970/01/01 ${a}`) - new Date(`1970/01/01 ${b}`));
    const hourValues = sortedHourLabels.map(slot => current.valid.filter(b => formatCleanTime(b.time_slot) === slot).length);

    // --- DOUGHNUT LOGIC ---
    const filteredServices = serviceStats.filter(s => {
      const b = s.booking_pets?.bookings;
      return b && validStatuses.includes(b.status) && new Date(b.booking_date) >= currentRange.start;
    });
    const serviceMap = {};
    filteredServices.forEach(s => { serviceMap[s.service_name] = (serviceMap[s.service_name] || 0) + 1; });
    const sLabels = Object.keys(serviceMap);
    const sValues = Object.values(serviceMap);
    const totalS = sValues.reduce((a, b) => a + b, 0);

    // --- DYNAMIC INSIGHT CALCULATION ---
    const getBestLabel = (labels, values) => {
      const max = Math.max(...values);
      return max > 0 ? labels[values.indexOf(max)] : "None";
    };

    const bestAvgLabel = getBestLabel(dateLabels, dateValues);
    const bestDayLabel = getBestLabel(peakDaysLabels, peakDaysValues);
    const bestTimeLabel = getBestLabel(sortedHourLabels, hourValues);
    const bestServiceLabel = getBestLabel(sLabels, sValues);

    const avgInsight = `${bestAvgLabel} is the most booked ${activeFilter === 'yearly' ? 'month' : 'day'}`;
    const peakDayInsight = `${bestDayLabel} is the most booked day`;
    const timeInsight = `${bestTimeLabel} is usually a bit busy`;
    const serviceInsight = `${bestServiceLabel} is the most booked service`;

    const uniqueCustomers = new Set(current.valid.map(b => b.user_id)).size;
    const cancellations = currentBookings.filter(b => b.status === 'cancelled').length;

    return { 
      revenue: current.rev, validCount: current.count, cancellations, 
      avg: uniqueCustomers > 0 ? Math.round(current.count / uniqueCustomers) : 0, 
      revTrend: getTrend(current.rev, previous.rev), bookTrend: getTrend(current.count, previous.count),
      dateLabels, dateValues, peakDaysLabels, peakDaysValues, sortedHourLabels, hourValues,
      sLabels, sValues, totalS, rangeText,
      avgInsight, peakDayInsight, timeInsight, serviceInsight
    };
  }, [rawBookings, serviceStats, activeFilter]);

  const integerYAxisOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 1, callback: (v) => Number.isInteger(v) ? v : null } } }
  };

  const TrendIndicator = ({ trend }) => {
    if (trend.dir === 'neutral') return <div className="kpi-trend neutral"><FaMinus /> No change</div>;
    const Icon = trend.dir === 'up' ? FaCaretUp : FaCaretDown;
    return <div className={`kpi-trend ${trend.dir === 'up' ? 'positive' : 'negative'}`}><Icon /> {trend.val}% {trend.dir === 'up' ? 'Higher' : 'Lower'}</div>;
  };

  const formatRevenue = (val) => {
    if (val >= 1000) return `₱${(val / 1000).toFixed(1)}K`;
    return `₱${Math.round(val)}`;
  };

  if (loading) return <div className="sp-biz-page-wrapper" style={{ justifyContent: 'center' }}>Loading Dashboard...</div>;

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
            <h4 className="chart-title-sm">Most Booked Services ({activeFilter})</h4>
            <div className="doughnut-container-sidebar">
              <div className="doughnut-wrapper-sidebar">
                <Doughnut data={{ labels: analytics.sLabels, datasets: [{ data: analytics.sValues, backgroundColor: ['#1e3a8a', '#3b82f6', '#93c5fd'], borderWidth: 0 }] }} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '70%' }} />
              </div>
              <div className="doughnut-labels-sidebar">
                {analytics.sLabels.slice(0, 2).map((l, i) => (
                  <span key={l}>{analytics.sValues[i]} ({Math.round((analytics.sValues[i]/analytics.totalS)*100)}% {l})</span>
                ))}
              </div>
              <p className="chart-insight-text">{analytics.serviceInsight}</p>
            </div>
          </div>
        </aside>

        <main className="sp-biz-main-content">
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
              <h3 className="chart-title">Average Bookings ({activeFilter})</h3>
              <span className="date-range-indicator">{analytics.rangeText}</span>
            </div>
            <div className="chart-h-250">
              <Bar data={{ labels: analytics.dateLabels, datasets: [{ data: analytics.dateValues, backgroundColor: '#1e3a8a', borderRadius: 6, barThickness: activeFilter === 'yearly' ? 20 : 50 }] }} options={integerYAxisOptions} />
            </div>
            <p className="chart-insight-text-main">{analytics.avgInsight}</p>
          </div>
          
          <div className="sp-biz-bottom-grid">
            <div className="bottom-card">
              <h4 className="chart-title-sm">Peak Booking Days</h4>
              <div className="chart-h-150">
                <Bar data={{ labels: analytics.peakDaysLabels, datasets: [{ data: analytics.peakDaysValues, backgroundColor: '#1e3a8a', borderRadius: 6 }] }} options={integerYAxisOptions} />
              </div>
              <p className="chart-insight-text">{analytics.peakDayInsight}</p>
            </div>
            <div className="bottom-card">
              <h4 className="chart-title-sm">Booking Hours Trend</h4>
              <div className="chart-h-150">
                <Line data={{ labels: analytics.sortedHourLabels, datasets: [{ data: analytics.hourValues, borderColor: '#1e3a8a', borderWidth: 3, tension: 0.4 }] }} options={integerYAxisOptions} />
              </div>
              <p className="chart-insight-text">{analytics.timeInsight}</p>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}