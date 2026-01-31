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
  const [providerServiceSizes, setProviderServiceSizes] = useState([]); // Valid labels from service_options

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

        // 1. Fetch Source of Truth: Sizes from service_options for this provider
        const { data: serviceData } = await supabase
          .from('services')
          .select(`
            id,
            service_options (
              size
            )
          `)
          .eq('provider_id', provider.id);

        if (serviceData) {
          // Extract unique sizes from all services offered by this provider
          const uniqueServiceSizes = [...new Set(
            serviceData.flatMap(s => s.service_options.map(opt => opt.size))
          )];
          setProviderServiceSizes(uniqueServiceSizes);
        }

        // 2. Fetch Booking Data with calculated_size
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

      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [navigate]);

  const analytics = useMemo(() => {
    // Utility to normalize strings for comparison (removes underscores, lowercase)
    const normalize = (str) => str?.toLowerCase().replace(/_/g, ' ').trim() || '';

    // Utility to Format Labels for Display (Title Case & Remove Underscores)
    const formatLabel = (str) => {
      if (!str) return '';
      return str
        .replace(/_/g, ' ') // Replace underscores with spaces
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter
        .join(' ');
    };

    const now = new Date();
    
    const getRange = (filter, isPrevious = false) => {
      // Handle custom date range
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
      
      // Original logic for weekly, monthly, yearly
      let start = new Date();
      let end = new Date();
      if (filter === 'weekly') {
        if (isPrevious) { 
          start.setDate(now.getDate() - 14); 
          end.setDate(now.getDate() - 7); 
        } else { 
          start.setDate(now.getDate() - 7); 
        }
      } else if (filter === 'monthly') {
        if (isPrevious) { 
          start.setMonth(now.getMonth() - 1, 1); 
          end = new Date(now.getFullYear(), now.getMonth(), 0); 
        } else { 
          start = new Date(now.getFullYear(), now.getMonth(), 1);
        }
      } else {
        if (isPrevious) { 
          start.setFullYear(now.getFullYear() - 1, 0, 1); 
          end.setFullYear(now.getFullYear() - 1, 11, 31); 
        } else { 
          start = new Date(now.getFullYear(), 0, 1);
        }
      }
      return { start, end };
    };

    const currentRange = getRange(activeFilter);
    const previousRange = getRange(activeFilter, true);

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
      } catch (e) {
        return false;
      }
    };

    const isBookingComplete = (b) => {
      if (['completed', 'to_rate', 'rated'].includes(b.status)) return true;
      if (['paid', 'confirmed'].includes(b.status) && isFourHoursPast(b.booking_date, b.time_slot)) return true;
      return false;
    };

    const filterByRange = (list, range) => {
      return list.filter(b => {
        const d = new Date(b.booking_date);
        return d >= range.start && d <= (range.end || now);
      });
    };

    const currentBookings = filterByRange(rawBookings, currentRange);
    const previousBookings = filterByRange(rawBookings, previousRange);

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
      const uniqueBookings = currentBookings.filter(b => uniqueBookingIds.has(b.id));
      const rev = uniqueBookings.reduce((sum, b) => sum + (Number(b.total_estimated_price) || 0), 0);
      
      return { 
        rev, 
        count: petsList.length,
        validPets: petsList 
      };
    };

    const current = calculateMetrics(currentValidPets);
    const previous = calculateMetrics(previousValidPets);

    const getTrend = (curr, prev) => {
      if (prev === 0) return curr > 0 ? { val: 100, dir: 'up' } : { val: 0, dir: 'neutral' };
      const diff = ((curr - prev) / prev) * 100;
      return { val: Math.abs(Math.round(diff)), dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral' };
    };

    const uniqueCancelledBookings = new Set(
      currentBookings
        .filter(b => b.status === 'cancelled')
        .map(b => b.id)
    );

    const uniqueCustomers = new Set(current.validPets.map(p => p.user_id));

    // --- INTEGRATED CHART LOGIC START ---

    // 1. Map normalized keys to pretty labels from service_options (Source of Truth)
    const sizeMap = {};
    
    // Define mappings for specific service option labels to "Standard"
    const labelOverrides = {
      'cat': 'Standard',
      'all': 'Standard'
    };

    providerServiceSizes.forEach(label => {
      const normalizedLabel = normalize(label);
      
      // Check if this label should be mapped to "Standard"
      if (labelOverrides[normalizedLabel]) {
        const targetLabel = labelOverrides[normalizedLabel];
        const targetKey = normalize(targetLabel); 
        
        // Create or merge into the 'standard' entry
        if (!sizeMap[targetKey]) {
          sizeMap[targetKey] = { label: targetLabel, count: 0 };
        }
      } else {
        // Standard behavior: apply Title Case formatting
        if (!sizeMap[normalizedLabel]) {
          sizeMap[normalizedLabel] = { label: formatLabel(label), count: 0 };
        }
      }
    });

    // 2. Count ALL valid pets (Completed + To Rate + Rated)
    // Removed the .filter(p => p.status === 'rated') to match KPI logic
    currentValidPets.forEach(pet => {
      const petSizeNormalized = normalize(pet.calculated_size);
      
      // If the normalized size exists in our map, increment it
      if (sizeMap[petSizeNormalized]) {
        sizeMap[petSizeNormalized].count += 1;
      }
    });

    const petSizeData = {
      labels: Object.values(sizeMap).map(v => v.label),
      values: Object.values(sizeMap).map(v => v.count)
    };

    // --- INTEGRATED CHART LOGIC END ---

    const customerReviewData = {
      averageRating: 4.0,
      totalReviews: 127,
      ratings: {
        service: 4.0,
        cleanliness: 4.2,
        communication: 3.8,
        value: 4.1
      }
    };

    const petTypeData = {
      labels: ['Dogs', 'Cats'],
      values: [23, 23],
      colors: ['#1e3a8a', '#facc15']
    };

    const customerTypeData = {
      labels: ['New', 'Old'],
      values: [0, 23],
      colors: ['#1e3a8a', '#60a5fa']
    };

    const topRebookedCustomers = [
      { id: '353b1220-f5d7-4edd-ba3b-de7961...', bookings: 18 },
      { id: '992826f1-4a40-4ea8-b714-eb092b...', bookings: 6 },
      { id: '511ebf44-1012-4e39-afb0-987b561...', bookings: 2 },
      { id: 'cf41262b-065b-4483-af8d-a57cc09...', bookings: 2 },
      { id: '8a7d3c21-9f2e-4b81-a3c5-d4e8f91...', bookings: 1 }
    ];

    const dogBreedsData = {
      labels: ['Maltese', 'Shih Tzu', 'Golden Retriever', 'Labrador', 'Poodle', 'Beagle'],
      values: [25, 18, 12, 10, 8, 5]
    };

    return { 
      revenue: current.rev, 
      validCount: current.count, 
      cancellations: uniqueCancelledBookings.size, 
      avg: uniqueCustomers.size > 0 
        ? Math.round(current.count / uniqueCustomers.size) 
        : 0, 
      revTrend: getTrend(current.rev, previous.rev), 
      bookTrend: getTrend(current.count, previous.count),
      customerReviewData,
      petSizeData, // Updated with full count logic and formatted labels
      petTypeData,
      customerTypeData,
      topRebookedCustomers,
      dogBreedsData
    };
  }, [rawBookings, providerServiceSizes, activeFilter, petTypeFilter, customDateStart, customDateEnd]);

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

            {/* Timeframe Filter Section */}
            <div className="sidebar-section">
              <h3>Timeframe</h3>
              <select 
                className="filter-dropdown" 
                value={activeFilter} 
                onChange={(e) => setActiveFilter(e.target.value)}
              >
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

            {/* Pet Type Filter Section */}
            <div className="sidebar-section">
              <h3>Pet Type</h3>
              <select 
                className="filter-dropdown" 
                value={petTypeFilter} 
                onChange={(e) => setPetTypeFilter(e.target.value)}
              >
                <option value="both">Both (Dog & Cat)</option>
                <option value="Dog">Dog</option>
                <option value="Cat">Cat</option>
              </select>
            </div>

            {/* Customer Review Summary - Moved to Sidebar */}
            <div className="sidebar-section review-summary-sidebar">
              <h3>Customer Review Summary</h3>
              <div className="review-summary-content">
                <div className="overall-rating">
                  <div className="rating-number">{analytics.customerReviewData.averageRating.toFixed(1)}</div>
                  <div className="rating-stars">
                    {[1, 2, 3, 4, 5].map(star => (
                      <FaStar 
                        key={star} 
                        className={star <= Math.floor(analytics.customerReviewData.averageRating) ? 'star-filled' : 'star-empty'}
                      />
                    ))}
                  </div>
                  <div className="rating-count">{analytics.customerReviewData.totalReviews} reviews</div>
                </div>
                
                <div className="rating-breakdown">
                  {Object.entries(analytics.customerReviewData.ratings).map(([category, rating]) => (
                    <div key={category} className="rating-item">
                      <span className="rating-category">{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                      <div className="rating-bar-container">
                        <div 
                          className="rating-bar-fill" 
                          style={{ width: `${(rating / 5) * 100}%` }}
                        />
                      </div>
                      <span className="rating-value">{rating.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <main className="sp-biz-main-content">
            {/* KPI Cards */}
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

            {/* Top Row: Most Booked Pet Size, Pet Type, & New vs Old Customers */}
            <div className="insights-top-row">
              {/* Most Booked Pet Size */}
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
                        barThickness: 20, // Reduced from 40 to create gaps
                        barPercentage: 0.8,
                        categoryPercentage: 0.8
                      }]
                    }}
                    options={{
                      indexAxis: 'y',
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { 
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              return context.parsed.x + ' bookings';
                            }
                          }
                        }
                      },
                      scales: {
                        x: { 
                          beginAtZero: true,
                          // Dynamic max based on data, defaulting to 10 if empty
                          max: Math.max(...analytics.petSizeData.values, 10) + 2,
                          ticks: { 
                            stepSize: 1, // Changed to 1 for smaller counts
                            font: { size: 10 }
                          },
                          grid: { display: true }
                        },
                        y: {
                          ticks: { 
                            font: { size: 10 }
                          },
                          grid: { display: false }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Most Booked Pet Type */}
              <div className="chart-box doughnut-card">
                <h4 className="chart-title-sm">Most Booked Pet Type</h4>
                <div className="doughnut-container-large">
                  <div className="doughnut-wrapper-large">
                    <Doughnut 
                      data={{
                        labels: analytics.petTypeData.labels,
                        datasets: [{
                          data: analytics.petTypeData.values,
                          backgroundColor: analytics.petTypeData.colors,
                          borderWidth: 0
                        }]
                      }}
                      options={{
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                              boxWidth: 12,
                              padding: 8,
                              font: { size: 10 },
                              generateLabels: function(chart) {
                                const data = chart.data;
                                return data.labels.map((label, i) => ({
                                  text: `${label}`,
                                  fillStyle: data.datasets[0].backgroundColor[i],
                                  hidden: false,
                                  index: i
                                }));
                              }
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                              }
                            }
                          }
                        },
                        cutout: '70%'
                      }}
                    />
                    {/* Center text indicator removed */}
                  </div>
                </div>
              </div>

              {/* New vs Old Customers */}
              <div className="chart-box doughnut-card">
                <h4 className="chart-title-sm">New vs Old Customers</h4>
                <div className="doughnut-container-large">
                  <div className="doughnut-wrapper-large">
                    <Doughnut 
                      data={{
                        labels: analytics.customerTypeData.labels,
                        datasets: [{
                          data: analytics.customerTypeData.values,
                          backgroundColor: analytics.customerTypeData.colors,
                          borderWidth: 0
                        }]
                      }}
                      options={{
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                              boxWidth: 12,
                              padding: 8,
                              font: { size: 10 },
                              generateLabels: function(chart) {
                                const data = chart.data;
                                return data.labels.map((label, i) => ({
                                  text: `${label}`,
                                  fillStyle: data.datasets[0].backgroundColor[i],
                                  hidden: false,
                                  index: i
                                }));
                              }
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                              }
                            }
                          }
                        },
                        cutout: '70%'
                      }}
                    />
                    {/* Center text indicator removed */}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Top 5 Rebooked & Dog Breeds */}
            <div className="insights-bottom-row">
              {/* Top 5 Rebooked Customers */}
              <div className="chart-box">
                <h4 className="chart-title-sm">Top 5 Rebooked Customers</h4>
                <div className="chart-container-large">
                  <Bar 
                    data={{
                      labels: analytics.topRebookedCustomers.map(c => c.id),
                      datasets: [{
                        data: analytics.topRebookedCustomers.map(c => c.bookings),
                        backgroundColor: '#1e3a8a',
                        borderRadius: 4,
                        barThickness: 25
                      }]
                    }}
                    options={{
                      indexAxis: 'y',
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { 
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            title: function(context) {
                              return 'User ID: ' + context[0].label;
                            },
                            label: function(context) {
                              return 'Bookings: ' + context.parsed.x;
                            }
                          }
                        }
                      },
                      scales: {
                        x: { 
                          beginAtZero: true,
                          ticks: { 
                            stepSize: 5,
                            font: { size: 10 }
                          },
                          title: {
                            display: true,
                            text: 'Count of booking_id',
                            font: { size: 11 },
                            color: '#64748b'
                          },
                          grid: { display: true }
                        },
                        y: {
                          ticks: { 
                            font: { size: 9 },
                            callback: function(value, index) {
                              const label = this.getLabelForValue(value);
                              return label.length > 20 ? label.substring(0, 18) + '...' : label;
                            }
                          },
                          title: {
                            display: true,
                            text: 'User_id',
                            font: { size: 11 },
                            color: '#64748b'
                          },
                          grid: { display: false }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Most Booked Dog Breeds */}
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
                      plugins: { 
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              return context.parsed.x + ' bookings';
                            }
                          }
                        }
                      },
                      scales: {
                        x: { 
                          beginAtZero: true,
                          max: 30,
                          ticks: { 
                            stepSize: 5,
                            font: { size: 10 }
                          },
                          grid: { display: true }
                        },
                        y: {
                          ticks: { 
                            font: { size: 10 }
                          },
                          grid: { display: false }
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