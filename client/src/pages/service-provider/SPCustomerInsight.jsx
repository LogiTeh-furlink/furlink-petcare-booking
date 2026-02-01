import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCaretUp, FaCaretDown, FaMinus, FaStar } from 'react-icons/fa';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import './SPCustomerInsight.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend);

export default function SPCustomerInsight() {
  const navigate = useNavigate();
  const [activeTab] = useState('customer_insights');
  
  // Filter states
  const [activeFilter, setActiveFilter] = useState('monthly');
  const [petTypeFilter, setPetTypeFilter] = useState('both');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  
  // Data states
  const [loading, setLoading] = useState(true);
  const [rawBookings, setRawBookings] = useState([]);
  const [listingVisitors, setListingVisitors] = useState(0);
  const [providerServiceSizes, setProviderServiceSizes] = useState([]); 
  const [profilesMap, setProfilesMap] = useState({}); 

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/login");

        const { data: provider } = await supabase
          .from("service_providers")
          .select("id, click_count")
          .eq("user_id", user.id)
          .single();

        if (!provider) return;

        setListingVisitors(provider.click_count || 0);

        const { data: serviceData } = await supabase
          .from('services')
          .select(`id, service_options ( size )`)
          .eq('provider_id', provider.id);

        if (serviceData) {
          const uniqueServiceSizes = [...new Set(
            serviceData.flatMap(s => s.service_options.map(opt => opt.size))
          )];
          setProviderServiceSizes(uniqueServiceSizes);
        }

        const { data: bookings, error: bError } = await supabase
          .from('bookings')
          .select(`
            id, 
            booking_date, 
            total_estimated_price, 
            status, 
            user_id, 
            time_slot,
            booking_pets (
              id,
              pet_type,
              calculated_size
            )
          `)
          .eq('provider_id', provider.id);

        if (bError) throw bError;
        setRawBookings(bookings || []);

        if (bookings && bookings.length > 0) {
          const userIds = [...new Set(bookings.map(b => b.user_id))];
          if (userIds.length > 0) {
            const { data: profilesData, error: pError } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, display_name')
              .in('id', userIds);

            if (!pError && profilesData) {
              const map = {};
              profilesData.forEach(profile => { map[profile.id] = profile; });
              setProfilesMap(map);
            }
          }
        }
      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [navigate]);

  const analytics = useMemo(() => {
    const normalize = (str) => str?.toLowerCase().replace(/_/g, ' ').trim() || '';
    const formatLabel = (str) => {
      if (!str) return '';
      return str.replace(/_/g, ' ').toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const now = new Date();
    const getRange = (filter, isPrevious = false) => {
      if (filter === 'custom' && customDateStart && customDateEnd) {
        const start = new Date(customDateStart);
        const end = new Date(customDateEnd);
        end.setHours(23, 59, 59, 999);
        if (isPrevious) {
          const duration = end - start;
          const prevEnd = new Date(start);
          prevEnd.setDate(prevEnd.getDate() - 1);
          const prevStart = new Date(prevEnd - duration);
          return { start: prevStart, end: prevEnd };
        }
        return { start, end };
      }
      let start = new Date();
      let end = new Date();
      if (filter === 'weekly') {
        start.setDate(now.getDate() - (isPrevious ? 14 : 7));
        if (isPrevious) end.setDate(now.getDate() - 7);
      } else if (filter === 'monthly') {
        if (isPrevious) { 
          start.setMonth(now.getMonth() - 1, 1); 
          end = new Date(now.getFullYear(), now.getMonth(), 0); 
        } else { 
          start = new Date(now.getFullYear(), now.getMonth(), 1);
        }
      } else {
        start.setFullYear(now.getFullYear() - (isPrevious ? 1 : 0), 0, 1);
        if (isPrevious) end.setFullYear(now.getFullYear() - 1, 11, 31);
      }
      return { start, end };
    };

    const currentRange = getRange(activeFilter);
    const filterByRange = (list, range) => list.filter(b => {
      const d = new Date(b.booking_date);
      return d >= range.start && d <= (range.end || now);
    });

    const isBookingComplete = (b) => {
      const convertTo24Hour = (timeStr) => {
        if (!timeStr || !timeStr.includes('M')) return timeStr || "00:00";
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
        return `${hours}:${minutes}`;
      };
      if (['completed', 'to_rate', 'rated'].includes(b.status)) return true;
      if (['paid', 'confirmed'].includes(b.status)) {
        const bookingDateTime = new Date(`${b.booking_date}T${convertTo24Hour(b.time_slot)}`);
        return (now - bookingDateTime) / (1000 * 60 * 60) >= 4;
      }
      return false;
    };

    const currentBookings = filterByRange(rawBookings, currentRange);
    
    // Filter pets based on timeframe AND pet type selection
    const currentValidPets = [];
    currentBookings.forEach(b => {
      if (isBookingComplete(b) && b.booking_pets) {
        b.booking_pets.forEach(pet => {
          if (petTypeFilter === 'both' || pet.pet_type === petTypeFilter) {
            currentValidPets.push({ ...pet, user_id: b.user_id, status: b.status });
          }
        });
      }
    });

    // 1. Pet Size logic (Reactive)
    const sizeMap = {};
    const labelOverrides = { 'cat': 'Standard', 'all': 'Standard' };
    providerServiceSizes.forEach(label => {
      const normalizedLabel = normalize(label);
      const targetLabel = labelOverrides[normalizedLabel] || formatLabel(label);
      const targetKey = normalize(targetLabel);
      if (!sizeMap[targetKey]) sizeMap[targetKey] = { label: targetLabel, count: 0 };
    });
    currentValidPets.forEach(pet => {
      const petSizeNormalized = normalize(pet.calculated_size);
      if (sizeMap[petSizeNormalized]) sizeMap[petSizeNormalized].count++;
    });

    // 2. Pet Type logic (Reactive)
    let dogCount = 0; let catCount = 0;
    currentValidPets.forEach(p => p.pet_type === 'Dog' ? dogCount++ : catCount++);

    // 3. New vs Old logic (Reactive)
    let newCustomerCount = 0; let returningCustomerCount = 0;
    const uniqueUsersThisPeriod = new Set(currentValidPets.map(p => p.user_id));
    uniqueUsersThisPeriod.forEach(uid => {
      const hasPastHistory = rawBookings.some(b => b.user_id === uid && isBookingComplete(b) && new Date(b.booking_date) < currentRange.start);
      hasPastHistory ? returningCustomerCount++ : newCustomerCount++;
    });

    // --- 4. Top 5 Rebooked Customers (NOW REACTIVE TO FILTERS) ---
    const customerCounts = {};
    // Only look at currentBookings (those filtered by timeframe)
    currentBookings.forEach(b => {
      if (isBookingComplete(b)) {
        const uid = b.user_id;
        const profile = profilesMap[uid];
        
        // Ensure this booking contains the selected pet type if filter isn't 'both'
        const hasMatchingPet = b.booking_pets?.some(p => petTypeFilter === 'both' || p.pet_type === petTypeFilter);

        if (profile && hasMatchingPet) {
          if (!customerCounts[uid]) {
            const fullName = profile.display_name || (profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : profile.first_name || 'Customer');
            customerCounts[uid] = { name: fullName, count: 0 };
          }
          customerCounts[uid].count += 1;
        }
      }
    });

    const topRebookedCustomers = Object.values(customerCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { 
      revenue: currentBookings.filter(isBookingComplete).reduce((sum, b) => sum + (Number(b.total_estimated_price) || 0), 0), 
      validCount: currentBookings.filter(isBookingComplete).length, 
      cancellations: currentBookings.filter(b => b.status === 'cancelled').length, 
      avg: uniqueUsersThisPeriod.size > 0 ? Math.round(currentValidPets.length / uniqueUsersThisPeriod.size) : 0, 
      petSizeData: { labels: Object.values(sizeMap).map(v => v.label), values: Object.values(sizeMap).map(v => v.count) },
      petTypeData: { labels: ['Dogs', 'Cats'], values: [dogCount, catCount], colors: ['#1e3a8a', '#facc15'] },
      customerTypeData: { labels: ['New', 'Old'], values: [newCustomerCount, returningCustomerCount], colors: ['#1e3a8a', '#60a5fa'] },
      topRebookedCustomers,
      customerReviewData: { averageRating: 4.0, totalReviews: 127, ratings: { service: 4.0, cleanliness: 4.2, communication: 3.8, value: 4.1 } }
    };
  }, [rawBookings, providerServiceSizes, profilesMap, activeFilter, petTypeFilter, customDateStart, customDateEnd]);

  if (loading) return <div className="loading-state">Loading Dashboard...</div>;

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      <div className="sp-biz-main-layout">
        <div className="sp-biz-container">
          <aside className="sp-biz-sidebar">
            <div className="sidebar-tabs-group">
              <button className="sidebar-tab-btn" onClick={() => navigate('/service/business-dashboard')}>Business Performance</button>
              <button className="sidebar-tab-btn active">Customer Insight</button>
            </div>
            <div className="sidebar-section">
              <h3>Timeframe</h3>
              <select className="filter-dropdown" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            <div className="sidebar-section">
              <h3>Pet Type</h3>
              <select className="filter-dropdown" value={petTypeFilter} onChange={(e) => setPetTypeFilter(e.target.value)}>
                <option value="both">Both (Dog & Cat)</option>
                <option value="Dog">Dog</option>
                <option value="Cat">Cat</option>
              </select>
            </div>
          </aside>

          <main className="sp-biz-main-content">
            <div className="sp-biz-kpi-grid">
              <div className="kpi-card"><span className="kpi-label">Gross Revenue</span><div className="kpi-row"><span className="kpi-value">₱{analytics.revenue.toLocaleString()}</span></div></div>
              <div className="kpi-card"><span className="kpi-label">Total Bookings</span><div className="kpi-row"><span className="kpi-value">{analytics.validCount}</span></div></div>
              <div className="kpi-card"><span className="kpi-label">Avg/Customer</span><div className="kpi-row"><span className="kpi-value">{analytics.avg}</span></div></div>
            </div>

            <div className="insights-top-row">
              <div className="chart-box">
                <h4 className="chart-title-sm">Most Booked Pet Size</h4>
                <div className="chart-container-large">
                  <Bar data={{ labels: analytics.petSizeData.labels, datasets: [{ data: analytics.petSizeData.values, backgroundColor: '#1e3a8a', borderRadius: 4, barThickness: 20 }] }} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } }, y: { grid: { display: false } } } }} />
                </div>
              </div>
              <div className="chart-box doughnut-card">
                <h4 className="chart-title-sm">Most Booked Pet Type</h4>
                <div className="doughnut-container-large">
                  <div className="doughnut-wrapper-large">
                    <Doughnut data={{ labels: analytics.petTypeData.labels, datasets: [{ data: analytics.petTypeData.values, backgroundColor: analytics.petTypeData.colors, borderWidth: 0 }] }} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '70%' }} />
                  </div>
                </div>
              </div>
              <div className="chart-box doughnut-card">
                <h4 className="chart-title-sm">New vs Old Customers</h4>
                <div className="doughnut-container-large">
                  <div className="doughnut-wrapper-large">
                    <Doughnut data={{ labels: analytics.customerTypeData.labels, datasets: [{ data: analytics.customerTypeData.values, backgroundColor: analytics.customerTypeData.colors, borderWidth: 0 }] }} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '70%' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="insights-bottom-row">
              <div className="chart-box full-width-chart">
                <h4 className="chart-title-sm">Top 5 Rebooked Customers</h4>
                <div className="chart-container-large">
                  <Bar 
                    data={{
                      labels: analytics.topRebookedCustomers.map(c => c.name),
                      datasets: [{
                        data: analytics.topRebookedCustomers.map(c => c.count),
                        backgroundColor: '#1e3a8a',
                        borderRadius: 4,
                        barThickness: 25
                      }]
                    }}
                    options={{
                      indexAxis: 'y',
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { beginAtZero: true, ticks: { stepSize: 1 } },
                        y: { grid: { display: false } }
                      }
                    }}
                  />
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