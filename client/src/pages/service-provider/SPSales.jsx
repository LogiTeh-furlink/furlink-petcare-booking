import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import './SPSales.css';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function SPSales() {
  const navigate = useNavigate();
  // Sidebar State
  const [activeTab] = useState('sales'); 
  const [activeFilter, setActiveFilter] = useState('monthly');
  const [petTypeFilter, setPetTypeFilter] = useState('both');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  
  // Data State
  const [loading, setLoading] = useState(true);
  const [serviceStats, setServiceStats] = useState([]);

  useEffect(() => {
    const fetchSidebarData = async () => {
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

        // Fetch Services for Sidebar Doughnut
        const { data: bServices, error: sError } = await supabase
          .from('booking_services')
          .select(`
            service_name,
            service_type,
            booking_pet_id,
            booking_pets!inner (
              id,
              pet_type,
              booking_id,
              bookings!inner (
                status,
                booking_date,
                time_slot
              )
            )
          `)
          .in('service_id', (
            await supabase.from('services').select('id').eq('provider_id', provider.id)
          ).data.map(s => s.id));

        if (sError) throw sError;
        setServiceStats(bServices || []);

      } catch (err) {
        console.error("Sales Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSidebarData();
  }, [navigate]);

  // Sidebar Analytics Logic 
  const analytics = useMemo(() => {
    const now = new Date();
    
    const getRange = (filter) => {
      if (filter === 'custom' && customDateStart && customDateEnd) {
        const start = new Date(customDateStart);
        const end = new Date(customDateEnd);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
      
      let start = new Date();
      let end = new Date();
      if (filter === 'weekly') {
        start.setDate(now.getDate() - 7); 
      } else if (filter === 'monthly') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else {
        start = new Date(now.getFullYear(), 0, 1);
      }
      return { start, end };
    };

    const currentRange = getRange(activeFilter);

    const convertTo24Hour = (timeStr) => {
      if (!timeStr) return "00:00";
      if (timeStr.includes('M')) {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') { hours = '00'; }
        if (modifier === 'PM') { hours = parseInt(hours, 10) + 12; }
        return `${hours}:${minutes}`;
      }
      return timeStr;
    };

    const isFourHoursPast = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return false;
      try {
        const bookingDateTime = new Date(`${dateStr}T${convertTo24Hour(timeStr)}`);
        const diffMs = now - bookingDateTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours >= 4;
      } catch (e) { return false; }
    };

    const isBookingComplete = (b) => {
      if (['completed', 'to_rate', 'rated'].includes(b.status)) return true;
      if (['paid', 'confirmed'].includes(b.status) && isFourHoursPast(b.booking_date, b.time_slot)) return true;
      return false;
    };

    // Service Stats Logic for Sidebar
    const filteredServices = serviceStats.filter(s => {
      const b = s.booking_pets?.bookings;
      if (!b) return false;
      const isComplete = isBookingComplete(b);
      const inRange = new Date(b.booking_date) >= currentRange.start;
      const matchesPet = petTypeFilter === 'both' || s.booking_pets?.pet_type === petTypeFilter;
      return isComplete && inRange && matchesPet;
    });

    const serviceNameMap = {};
    filteredServices.forEach(s => { 
      const name = s.service_name || 'Other';
      serviceNameMap[name] = (serviceNameMap[name] || 0) + 1; 
    });
    
    const sLabels = Object.keys(serviceNameMap);
    const sValues = Object.values(serviceNameMap);

    return { 
      sLabels, 
      sValues, 
      totalS: sValues.reduce((a, b) => a + b, 0)
    };
  }, [serviceStats, activeFilter, petTypeFilter, customDateStart, customDateEnd]);

  if (loading) return <div className="loading-state">Loading...</div>;

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      
      <div className="sp-biz-main-layout">
        <div className="sp-biz-container">
          
          {/* --- SIDEBAR --- */}
          <aside className="sp-biz-sidebar">
            <div className="sidebar-tabs-group">
              <button 
                className={`sidebar-tab-btn ${activeTab === 'sales' ? 'active' : ''}`} 
                onClick={() => navigate('/service/sales')}
              >
                Sales
              </button>
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
                Customer Insights
              </button>
            </div>
            
            <div className="sidebar-section">
              <h3>Timeframe</h3>
              <select className="filter-dropdown" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
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

            <div className="sidebar-section">
              <h3>Pet Type</h3>
              <select className="filter-dropdown" value={petTypeFilter} onChange={(e) => setPetTypeFilter(e.target.value)}>
                <option value="both">Both (Dog & Cat)</option>
                <option value="Dog">Dog</option>
                <option value="Cat">Cat</option>
              </select>
            </div>
            
            <div className="sidebar-section doughnut-card">
              <h4 className="chart-title-sm">Booked Services</h4>
              <div className="doughnut-container">
                <div className="doughnut-wrapper">
                  <Doughnut 
                    data={{ 
                      labels: analytics.sLabels, 
                      datasets: [{ 
                        data: analytics.sValues, 
                        backgroundColor: ['#1e3a8a', '#3b82f6', '#93c5fd', '#60a5fa', '#2563eb'], 
                        borderWidth: 0 
                      }] 
                    }} 
                    options={{ 
                      maintainAspectRatio: false, 
                      plugins: { legend: { display: false } }, 
                      cutout: '75%' 
                    }} 
                  />
                </div>
                <div className="doughnut-labels">
                  {analytics.sLabels.slice(0, 3).map((l, i) => (
                    <span key={l}>
                      {analytics.totalS > 0 ? Math.round((analytics.sValues[i]/analytics.totalS)*100) : 0}% {l}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* --- MAIN CONTENT (Empty) --- */}
          <main className="sp-biz-main-content">
             {/* Content removed as requested */}
          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}