import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from "../../config/supabase"; 
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCaretUp, FaCaretDown, FaMinus } from 'react-icons/fa';
import './SPBusinessDashboard.css';

export default function SPBusinessDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('business_performance'); 
  const [activeFilter, setActiveFilter] = useState('monthly');
  const [loading, setLoading] = useState(true);

  // State for KPI Data & Trends
  const [stats, setStats] = useState({
    grossRevenue: 0,
    totalBookings: 0,
    avgBookingPerCustomer: 0,
    cancellations: 0,
    // Trends
    revenueTrendValue: 0, // % difference
    revenueTrendDirection: 'neutral', // 'up', 'down', 'neutral'
    bookingsTrendValue: 0, // Absolute count difference
    bookingsTrendDirection: 'neutral' // 'up', 'down', 'neutral'
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

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

      // --- DATE LOGIC ---
      const now = new Date();
      
      // Current Month Range
      const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Previous Month Range
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Fetch ALL bookings from Previous Month Start to Current Month End
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, user_id, total_estimated_price, status, booking_date')
        .eq('provider_id', provider.id)
        .gte('booking_date', prevStart.toISOString())
        .lte('booking_date', currentEnd.toISOString());

      if (error) throw error;

      calculateStats(bookings || [], currentStart, prevStart, prevEnd);

    } catch (err) {
      console.error("Error loading dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (allBookings, currentStart, prevStart, prevEnd) => {
    // 1. Split Data into Current vs Previous Month
    const currentMonthData = allBookings.filter(b => new Date(b.booking_date) >= currentStart);
    const prevMonthData = allBookings.filter(b => {
      const d = new Date(b.booking_date);
      return d >= prevStart && d <= prevEnd;
    });

    // --- HELPER: Calculate Metrics for a specific dataset ---
    const getMetrics = (data) => {
      const revenue = data
        .filter(b => ['paid', 'completed', 'rated', 'to_rate'].includes(b.status))
        .reduce((sum, b) => sum + (Number(b.total_estimated_price) || 0), 0);
      
      const validBookings = data.filter(b => !['cancelled', 'declined', 'void'].includes(b.status));
      
      return { revenue, validBookingsCount: validBookings.length, rawData: data, validBookings };
    };

    const current = getMetrics(currentMonthData);
    const previous = getMetrics(prevMonthData);

    // --- MAIN KPI VALUES (Current Month) ---
    const uniqueCustomers = new Set(current.validBookings.map(b => b.user_id)).size;
    const avgBooking = uniqueCustomers > 0 ? Math.floor(current.validBookingsCount / uniqueCustomers) : 0;
    const cancellations = current.rawData.filter(b => b.status === 'cancelled').length;


    // --- TREND CALCULATIONS ---
    
    // 1. Revenue Trend (Percentage)
    let revTrendVal = 0;
    let revTrendDir = 'neutral';
    
    if (previous.revenue === 0) {
      // If previous month was 0, and current is > 0, it's technically 100% increase (or infinite). We cap/handle it.
      revTrendVal = current.revenue > 0 ? 100 : 0;
      revTrendDir = current.revenue > 0 ? 'up' : 'neutral';
    } else {
      const diff = current.revenue - previous.revenue;
      revTrendVal = Math.round((diff / previous.revenue) * 100);
      revTrendDir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral';
    }

    // 2. Bookings Trend (Absolute Count Difference) -> "10 Lesser Bookings"
    const bookDiff = current.validBookingsCount - previous.validBookingsCount;
    const bookTrendDir = bookDiff > 0 ? 'up' : bookDiff < 0 ? 'down' : 'neutral';


    setStats({
      grossRevenue: current.revenue,
      totalBookings: current.validBookingsCount,
      avgBookingPerCustomer: avgBooking,
      cancellations: cancellations,
      
      revenueTrendValue: Math.abs(revTrendVal),
      revenueTrendDirection: revTrendDir,
      
      bookingsTrendValue: Math.abs(bookDiff),
      bookingsTrendDirection: bookTrendDir
    });
  };

  const formatCurrency = (val) => 
    `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`;

  const formatFullCurrency = (val) => 
    `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  // Helper component for Trend UI
  const TrendIndicator = ({ direction, value, suffix }) => {
    if (direction === 'neutral') {
      return <div className="kpi-trend neutral"><FaMinus size={10} /> <span>No Change</span></div>;
    }
    const isPositive = direction === 'up';
    // Revenue logic: Up is good (Green). 
    // Cancellation logic: Up is bad (Red). But here we are doing Bookings & Revenue where Up is generally Good.
    
    // HOWEVER: For "Bookings", if it's "Lesser", text color is Red. If "More", Green.
    // For Revenue: "Higher" is Green, "Lower" is Red.
    
    const colorClass = isPositive ? 'positive' : 'negative';
    const Icon = isPositive ? FaCaretUp : FaCaretDown;
    const text = isPositive ? `${value} ${suffix || 'Higher'}` : `${value} ${suffix === '%' ? 'Lower' : 'Lesser Bookings'}`;

    // Override for Bookings specific text matching the image ("Lesser Bookings")
    let displayText = "";
    if (suffix === '%') {
       displayText = `${value}% ${isPositive ? 'Higher' : 'Lower'}`;
    } else {
       displayText = `${value} ${isPositive ? 'More Bookings' : 'Lesser Bookings'}`;
    }

    return (
      <div className={`kpi-trend ${colorClass}`}>
        <Icon /> <span>{displayText}</span>
      </div>
    );
  };

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      
      <div className="sp-biz-container">
        
        {/* --- SIDEBAR --- */}
        <aside className="sp-biz-sidebar">
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

        {/* --- MAIN CONTENT --- */}
        <main className="sp-biz-main-content">
          
          <div className="sp-biz-kpi-grid">
            
            {/* Card 1: Gross Revenue */}
            <div className="sp-biz-kpi-card" title={formatFullCurrency(stats.grossRevenue)}>
              <div className="kpi-value">
                {stats.grossRevenue > 1000 
                  ? formatCurrency(stats.grossRevenue / 1000) 
                  : `₱${stats.grossRevenue}`}
              </div>
              <div className="kpi-label">Gross Revenue</div>
              
              {/* Dynamic Revenue Trend */}
              <TrendIndicator 
                direction={stats.revenueTrendDirection} 
                value={stats.revenueTrendValue} 
                suffix="%" 
              />
            </div>

            {/* Card 2: Total Bookings */}
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">{stats.totalBookings}</div>
              <div className="kpi-label">Total Bookings</div>
              
              {/* Dynamic Bookings Trend */}
              <TrendIndicator 
                direction={stats.bookingsTrendDirection} 
                value={stats.bookingsTrendValue} 
                suffix="Bookings" 
              />
            </div>

            {/* Card 3: Average Booking */}
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">
                {stats.avgBookingPerCustomer}
              </div>
              <div className="kpi-label">Average Booking <br/> per Customer</div>
            </div>

            {/* Card 4: Cancellations */}
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">
                {stats.cancellations}
              </div>
              <div className="kpi-label">Number of <br/> Cancellations</div>
            </div>

          </div>

          <div className="charts-placeholder-area">
             <div className="placeholder-chart-text">
               Charts will be integrated here later based on {activeFilter} filter.
             </div>
          </div>

        </main>

      </div>

      <Footer />
    </div>
  );
}