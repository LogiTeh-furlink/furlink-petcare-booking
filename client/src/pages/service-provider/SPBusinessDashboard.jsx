import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from "../../config/supabase"; 
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCaretUp, FaCaretDown } from 'react-icons/fa';
import './SPBusinessDashboard.css';

export default function SPBusinessDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('business_performance'); 
  const [activeFilter, setActiveFilter] = useState('monthly');
  const [loading, setLoading] = useState(true);

  // State for KPI Data
  const [stats, setStats] = useState({
    grossRevenue: 0,
    totalBookings: 0,
    avgBookingPerCustomer: 0,
    cancellations: 0
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

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, user_id, total_estimated_price, status, booking_date')
        .eq('provider_id', provider.id)
        .gte('booking_date', firstDay)
        .lte('booking_date', lastDay);

      if (error) throw error;

      calculateStats(bookings || []);

    } catch (err) {
      console.error("Error loading dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    // A. Gross Revenue
    const revenue = data
      .filter(b => ['paid', 'completed', 'rated', 'to_rate'].includes(b.status))
      .reduce((sum, b) => sum + (Number(b.total_estimated_price) || 0), 0);

    // B. Total Bookings
    const validBookings = data.filter(b => !['cancelled', 'declined', 'void'].includes(b.status));
    const totalBookingsCount = validBookings.length;

    // C. Avg Booking per Customer (Aggressive Integer Conversion)
    const uniqueCustomers = new Set(validBookings.map(b => b.user_id)).size;
    // Use Math.floor to strictly drop decimals.
    const avgBooking = uniqueCustomers > 0 ? Math.floor(totalBookingsCount / uniqueCustomers) : 0;

    // D. Number of Cancellations
    const cancelledCount = data.filter(b => b.status === 'cancelled').length;

    setStats({
      grossRevenue: revenue,
      totalBookings: totalBookingsCount,
      avgBookingPerCustomer: avgBooking,
      cancellations: cancelledCount
    });
  };

  const formatCurrency = (val) => 
    `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`;

  const formatFullCurrency = (val) => 
    `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      
      <div className="sp-biz-container">
        
        {/* --- SIDEBAR AREA --- */}
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

        {/* --- MAIN CONTENT AREA --- */}
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
              <div className="kpi-trend positive">
                <FaCaretUp /> <span>10% Higher</span>
              </div>
            </div>

            {/* Card 2: Total Bookings */}
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">{stats.totalBookings}</div>
              <div className="kpi-label">Total Bookings</div>
              <div className="kpi-trend negative">
                <FaCaretDown /> <span>10 Lesser Bookings</span>
              </div>
            </div>

            {/* Card 3: Average Booking (WHOLE NUMBER) */}
            <div className="sp-biz-kpi-card">
              <div className="kpi-value">
                {stats.avgBookingPerCustomer}
              </div>
              <div className="kpi-label">Average Booking <br/> per Customer</div>
            </div>

            {/* Card 4: Cancellations (WHOLE NUMBER) */}
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