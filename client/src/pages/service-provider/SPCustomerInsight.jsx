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
  const [rawReviews, setRawReviews] = useState([]); 
  const [listingVisitors, setListingVisitors] = useState(0);
  const [providerServiceSizes, setProviderServiceSizes] = useState([]); 
  const [profilesMap, setProfilesMap] = useState({}); // Stores { userId: profileData }

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

        // 1. Fetch Source of Truth: Sizes from service_options
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

        // 2. Fetch Booking Data
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
              calculated_size,
              breed
            )
          `)
          .eq('provider_id', provider.id);

        if (bError) throw bError;
        setRawBookings(bookings || []);

        // 3. Fetch Reviews Data (Includes comment and user_id)
        const { data: reviews, error: rError } = await supabase
          .from('reviews')
          .select(`
            id,
            booking_id,
            user_id,
            rating_overall,
            rating_staff,
            comment,
            created_at
          `)
          .eq('provider_id', provider.id);

        if (rError) throw rError;
        setRawReviews(reviews || []);

        // 4. Fetch Profiles Separately
        // We collect user IDs from both bookings and reviews to be safe
        if (bookings && bookings.length > 0) {
          const bookingUserIds = bookings.map(b => b.user_id);
          const reviewUserIds = reviews ? reviews.map(r => r.user_id) : [];
          const allUserIds = [...new Set([...bookingUserIds, ...reviewUserIds])];
          
          if (allUserIds.length > 0) {
            const { data: profilesData, error: pError } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, display_name')
              .in('id', allUserIds);

            if (!pError && profilesData) {
              const map = {};
              profilesData.forEach(profile => {
                map[profile.id] = profile;
              });
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
    // Utility to normalize strings for comparison 
    const normalize = (str) => str?.toLowerCase().replace(/_/g, ' ').trim() || '';

    // Utility to Format Labels for Display
    const formatLabel = (str) => {
      if (!str) return '';
      return str
        .replace(/_/g, ' ') 
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)) 
        .join(' ');
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
    const filterByRange = (list, range) => {
      return list.filter(b => {
        const d = new Date(b.booking_date);
        return d >= range.start && d <= (range.end || now);
      });
    };

    const currentBookings = filterByRange(rawBookings, currentRange);
    const previousRange = getRange(activeFilter, true);
    const previousBookings = filterByRange(rawBookings, previousRange);

    const convertTo24Hour = (timeStr) => {
      if (!timeStr || !timeStr.includes('M')) return timeStr || "00:00";
      const [time, modifier] = timeStr.split(' ');
      let [hours, minutes] = time.split(':');
      if (hours === '12') hours = '00';
      if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
      return `${hours}:${minutes}`;
    };

    const isFourHoursPast = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return false;
      try {
        const bookingDateTime = new Date(`${dateStr}T${convertTo24Hour(timeStr)}`);
        const diffMs = now - bookingDateTime;
        return diffMs / (1000 * 60 * 60) >= 4;
      } catch (e) {
        return false;
      }
    };

    const isBookingComplete = (b) => {
      if (['completed', 'to_rate', 'rated'].includes(b.status)) return true;
      if (['paid', 'confirmed'].includes(b.status) && isFourHoursPast(b.booking_date, b.time_slot)) return true;
      return false;
    };

    const getValidPets = (bookingsList) => {
      const validPets = [];
      bookingsList.forEach(b => {
        const isComplete = isBookingComplete(b);
        if (isComplete && b.booking_pets && Array.isArray(b.booking_pets)) {
          b.booking_pets.forEach(pet => {
            if (petTypeFilter === 'both' || pet.pet_type === petTypeFilter) {
              validPets.push({
                ...pet,
                booking_date: b.booking_date,
                time_slot: b.time_slot,
                status: b.status,
                user_id: b.user_id,
                total_estimated_price: b.total_estimated_price,
                booking_id: b.id
              });
            }
          });
        }
      });
      return validPets;
    };

    const currentValidPets = getValidPets(currentBookings);
    const previousValidPets = getValidPets(previousBookings);

    const calculateMetrics = (petsList) => {
      const uniqueBookingIds = new Set(petsList.map(p => p.booking_id));
      const filteredBookings = rawBookings.filter(b => uniqueBookingIds.has(b.id)); 
      const rev = filteredBookings.reduce((sum, b) => sum + (Number(b.total_estimated_price) || 0), 0);
      return { rev, count: petsList.length, validPets: petsList };
    };

    const current = calculateMetrics(currentValidPets);
    const previous = calculateMetrics(previousValidPets);

    const getTrend = (curr, prev) => {
      if (prev === 0) return curr > 0 ? { val: 100, dir: 'up' } : { val: 0, dir: 'neutral' };
      const diff = ((curr - prev) / prev) * 100;
      return { val: Math.abs(Math.round(diff)), dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral' };
    };

    const uniqueCancelledBookings = new Set(
      currentBookings.filter(b => b.status === 'cancelled').map(b => b.id)
    );

    const uniqueCustomers = new Set(current.validPets.map(p => p.user_id));

    // --- CHART LOGIC 1: Most Booked Pet Size ---
    const sizeMap = {};
    const labelOverrides = { 'cat': 'Standard', 'all': 'Standard' };

    providerServiceSizes.forEach(label => {
      const normalizedLabel = normalize(label);
      if (labelOverrides[normalizedLabel]) {
        const targetLabel = labelOverrides[normalizedLabel];
        const targetKey = normalize(targetLabel); 
        if (!sizeMap[targetKey]) sizeMap[targetKey] = { label: targetLabel, count: 0 };
      } else {
        if (!sizeMap[normalizedLabel]) sizeMap[normalizedLabel] = { label: formatLabel(label), count: 0 };
      }
    });

    currentValidPets.forEach(pet => {
      const petSizeNormalized = normalize(pet.calculated_size);
      if (sizeMap[petSizeNormalized]) {
        sizeMap[petSizeNormalized].count += 1;
      }
    });

    const petSizeData = {
      labels: Object.values(sizeMap).map(v => v.label),
      values: Object.values(sizeMap).map(v => v.count)
    };

    // --- CHART LOGIC 2: Most Booked Pet Type ---
    let dogCount = 0;
    let catCount = 0;
    currentValidPets.forEach(pet => {
      if (pet.pet_type === 'Dog') dogCount++;
      else if (pet.pet_type === 'Cat') catCount++;
    });

    const petTypeData = {
      labels: ['Dogs', 'Cats'],
      values: [dogCount, catCount],
      colors: ['#1e3a8a', '#facc15']
    };

    // --- CHART LOGIC 3: New vs Old Customers ---
    let newCustomerCount = 0;
    let returningCustomerCount = 0;
    const uniqueCurrentUsers = new Set(currentBookings.filter(b => isBookingComplete(b)).map(b => b.user_id));

    uniqueCurrentUsers.forEach(userId => {
      const hasHistory = rawBookings.some(b => 
        b.user_id === userId &&
        isBookingComplete(b) &&
        new Date(b.booking_date) < currentRange.start &&
        (petTypeFilter === 'both' ? true : b.booking_pets?.some(p => p.pet_type === petTypeFilter))
      );

      const currentHasMatchingPet = currentBookings.some(b => 
        b.user_id === userId && 
        (petTypeFilter === 'both' || b.booking_pets?.some(p => p.pet_type === petTypeFilter))
      );

      if (currentHasMatchingPet) {
        if (hasHistory) returningCustomerCount++;
        else newCustomerCount++;
      }
    });

    const customerTypeData = {
      labels: ['New', 'Old'],
      values: [newCustomerCount, returningCustomerCount],
      colors: ['#1e3a8a', '#60a5fa']
    };

    // --- CHART LOGIC 4: Top 5 Rebooked Customers ---
    const customerCounts = {};
    currentBookings.forEach(b => {
      if (isBookingComplete(b)) {
        const hasMatchingPet = b.booking_pets?.some(p => petTypeFilter === 'both' || p.pet_type === petTypeFilter);
        
        if (hasMatchingPet) {
          const uid = b.user_id;
          const profile = profilesMap[uid];

          let fullName = 'User'; 
          if (profile) {
            if (profile.display_name) fullName = profile.display_name;
            else if (profile.first_name && profile.last_name) fullName = `${profile.first_name} ${profile.last_name}`;
            else if (profile.first_name) fullName = profile.first_name;
          }

          if (!customerCounts[uid]) {
            customerCounts[uid] = { name: fullName, count: 0 };
          }
          customerCounts[uid].count += 1;
        }
      }
    });

    const topRebookedCustomers = Object.values(customerCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // --- CHART LOGIC 5: Most Booked Dog Breeds ---
    const breedCounts = {};
    currentValidPets.forEach(pet => {
      if (pet.pet_type === 'Dog' && pet.breed) {
        const normalizedBreed = formatLabel(pet.breed);
        if (!breedCounts[normalizedBreed]) {
          breedCounts[normalizedBreed] = 0;
        }
        breedCounts[normalizedBreed] += 1;
      }
    });

    const sortedBreeds = Object.entries(breedCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 6);

    const dogBreedsData = {
      labels: sortedBreeds.map(([breed]) => breed),
      values: sortedBreeds.map(([, count]) => count)
    };

    // --- CHART LOGIC 6: Customer Review Summary & Comments ---
    const validBookingIdsForReviews = new Set();
    
    currentBookings.forEach(b => {
      const matchesPetFilter = petTypeFilter === 'both' 
        ? true 
        : b.booking_pets?.some(p => p.pet_type === petTypeFilter);

      if (matchesPetFilter) {
        validBookingIdsForReviews.add(b.id);
      }
    });

    const validReviews = rawReviews.filter(r => validBookingIdsForReviews.has(r.booking_id));

    // Calculate Ratings
    let totalOverall = 0;
    let totalStaff = 0;
    const reviewCount = validReviews.length;

    validReviews.forEach(r => {
      totalOverall += r.rating_overall;
      totalStaff += r.rating_staff;
    });

    const avgOverall = reviewCount > 0 ? totalOverall / reviewCount : 0;
    const avgStaff = reviewCount > 0 ? totalStaff / reviewCount : 0;

    // Process Recent Comments (Last 3)
    const recentReviews = validReviews
      .filter(r => r.comment && r.comment.trim() !== '')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 3)
      .map(r => {
        const profile = profilesMap[r.user_id];
        let name = 'Anonymous';
        if (profile) {
          if (profile.display_name) name = profile.display_name;
          else if (profile.first_name) name = profile.first_name;
        }
        return {
          id: r.id,
          name,
          rating: r.rating_overall,
          comment: r.comment,
          date: new Date(r.created_at).toLocaleDateString()
        };
      });

    const customerReviewData = {
      averageRating: avgOverall,
      totalReviews: reviewCount,
      ratings: { 
        overall: avgOverall, 
        staff: avgStaff 
      },
      recentReviews
    };

    return { 
      revenue: current.rev, 
      validCount: current.count, 
      cancellations: uniqueCancelledBookings.size, 
      avg: uniqueCustomers.size > 0 ? Math.round(current.count / uniqueCustomers.size) : 0, 
      revTrend: getTrend(current.rev, previous.rev), 
      bookTrend: getTrend(current.count, previous.count),
      customerReviewData,
      petSizeData, 
      petTypeData,
      customerTypeData,
      topRebookedCustomers, 
      dogBreedsData
    };
  }, [rawBookings, rawReviews, providerServiceSizes, profilesMap, activeFilter, petTypeFilter, customDateStart, customDateEnd]);

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
                Customer Insight
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
                  <input type="date" className="date-input" value={customDateStart} onChange={(e) => setCustomDateStart(e.target.value)} max={customDateEnd} />
                  <label className="date-label">To:</label>
                  <input type="date" className="date-input" value={customDateEnd} onChange={(e) => setCustomDateEnd(e.target.value)} min={customDateStart} />
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

            <div className="sidebar-section review-summary-sidebar">
              <h3>Customer Review Summary</h3>
              <div className="review-summary-content">
                <div className="overall-rating">
                  <div className="rating-number">{analytics.customerReviewData.averageRating.toFixed(1)}</div>
                  <div className="rating-stars">
                    {[1, 2, 3, 4, 5].map(star => (
                      <FaStar key={star} className={star <= Math.floor(analytics.customerReviewData.averageRating) ? 'star-filled' : 'star-empty'} />
                    ))}
                  </div>
                  <div className="rating-count">{analytics.customerReviewData.totalReviews} reviews</div>
                </div>
                
                <div className="rating-breakdown">
                  {Object.entries(analytics.customerReviewData.ratings).map(([category, rating]) => (
                    <div key={category} className="rating-item">
                      <span className="rating-category">{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                      <div className="rating-bar-container">
                        <div className="rating-bar-fill" style={{ width: `${(rating / 5) * 100}%` }} />
                      </div>
                      <span className="rating-value">{rating.toFixed(1)}</span>
                    </div>
                  ))}
                </div>

                {/* New Comments Section */}
                <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                  <h4 style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 600 }}>Recent Comments</h4>
                  {analytics.customerReviewData.recentReviews.length === 0 ? (
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>No comments found.</div>
                  ) : (
                    analytics.customerReviewData.recentReviews.map(review => (
                      <div key={review.id} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#1e3a8a', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '80px' }}>
                            {review.name}
                          </span>
                          <div style={{ display: 'flex', gap: '1px' }}>
                            {[1, 2, 3, 4, 5].map(star => (
                              <FaStar key={star} style={{ fontSize: '0.5rem', color: star <= review.rating ? '#facc15' : '#e2e8f0' }} />
                            ))}
                          </div>
                        </div>
                        <p style={{ fontSize: '0.65rem', color: '#334155', lineHeight: '1.3', margin: '0 0 2px 0', fontStyle: 'italic' }}>
                          "{review.comment.length > 50 ? review.comment.substring(0, 50) + '...' : review.comment}"
                        </p>
                        <div style={{ fontSize: '0.6rem', color: '#94a3b8', textAlign: 'right' }}>
                          {review.date}
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>
          </aside>

          <main className="sp-biz-main-content">
            <div className="sp-biz-kpi-grid">
              <div className="kpi-card">
                <span className="kpi-label">Gross Revenue</span>
                <div className="kpi-row">
                  <span className="kpi-value">
                    {analytics.revenue >= 1000 
                      ? `₱${(analytics.revenue / 1000).toFixed(1)}K` 
                      : `₱${Math.round(analytics.revenue)}`}
                  </span>
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
                <span className="kpi-label">Listing Visitors</span>
                <span className="kpi-value">{listingVisitors.toLocaleString()}</span>
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

            <div className="insights-top-row">
              <div className="chart-box">
                <h4 className="chart-title-sm">Most Booked Pet Size</h4>
                <div className="chart-container-large">
                  <Bar 
                    data={{
                      labels: analytics.petSizeData.labels,
                      datasets: [{
                        data: analytics.petSizeData.values,
                        backgroundColor: '#1e3a8a',
                        borderRadius: 4,
                        barThickness: 20
                      }]
                    }}
                    options={{
                      indexAxis: 'y',
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { 
                          beginAtZero: true, 
                          ticks: { stepSize: 1 },
                          title: { display: true, text: 'Number of Bookings', font: { size: 11 }, color: '#64748b' }
                        },
                        y: { 
                          grid: { display: false },
                          title: { display: true, text: 'Pet Size', font: { size: 11 }, color: '#64748b' }
                        }
                      }
                    }}
                  />
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
              <div className="chart-box">
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
                        x: { 
                          beginAtZero: true, 
                          ticks: { stepSize: 1 },
                          title: { display: true, text: 'Number of Bookings', font: { size: 11 }, color: '#64748b' }
                        },
                        y: { 
                          grid: { display: false },
                          ticks: { 
                            callback: function(val, index) {
                              const label = this.getLabelForValue(val);
                              return label.length > 15 ? label.substr(0, 15) + '...' : label;
                            }
                          },
                          title: { display: true, text: 'Customer Name', font: { size: 11 }, color: '#64748b' }
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <div className="chart-box">
                <h4 className="chart-title-sm">Most Booked Dog Breeds</h4>
                <div className="chart-container-large">
                  <Bar 
                    data={{ 
                      labels: analytics.dogBreedsData.labels, 
                      datasets: [{ 
                        data: analytics.dogBreedsData.values, 
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
                        x: { 
                          beginAtZero: true, 
                          ticks: { stepSize: 1 },
                          title: { display: true, text: 'Number of Bookings', font: { size: 11 }, color: '#64748b' }
                        }, 
                        y: { 
                          grid: { display: false },
                          title: { display: true, text: 'Dog Breed', font: { size: 11 }, color: '#64748b' }
                        } 
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