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
  const [providerHours, setProviderHours] = useState([]);

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
        
        console.log('Raw Bookings Fetched:', bookings?.length || 0);
        console.log('All Bookings:', bookings);
        
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
        console.log('📊 Service Stats Fetched:', bServices?.length || 0);
        
        setServiceStats(bServices || []);

        // Fetch service provider hours
        const { data: providerHours, error: hError } = await supabase
          .from('service_provider_hours')
          .select('start_time, end_time, slot_interval_minutes')
          .eq('provider_id', provider.id);

        if (hError) throw hError;
        console.log('Provider Hours Fetched:', providerHours);
        
        setProviderHours(providerHours || []);

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
    
    console.log('Current Date:', now.toISOString());
    console.log('Active Filter:', activeFilter);
    
    const getRange = (filter, isPrevious = false) => {
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
    
    console.log('📅 Current Range:', {
      start: currentRange.start.toISOString(),
      end: currentRange.end?.toISOString() || 'now'
    });
    
    const rangeText = `${currentRange.start.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} - ${now.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`;

    const filterByRange = (list, range) => {
      const filtered = list.filter(b => {
        const d = new Date(b.booking_date);
        const inRange = d >= range.start && d <= (range.end || now);
        return inRange;
      });
      return filtered;
    };

    const currentBookings = filterByRange(rawBookings, currentRange);
    const previousBookings = filterByRange(rawBookings, previousRange);
    
    console.log('Current Period Bookings:', currentBookings.length);
    console.log('Current Bookings:', currentBookings);

    const calculateMetrics = (list) => {
      const valid = list.filter(b => validStatuses.includes(b.status));
      const rev = valid.reduce((sum, b) => sum + (Number(b.total_estimated_price) || 0), 0);
      
      console.log('Valid Bookings:', valid.length, valid.map(b => ({ 
        id: b.id, 
        status: b.status, 
        date: b.booking_date,
        time: b.time_slot 
      })));
      
      return { rev, count: valid.length, valid };
    };

    const current = calculateMetrics(currentBookings);
    const previous = calculateMetrics(previousBookings);

    // FIXED: Handle BOTH 24-hour (14:00:00) and 12-hour (3:00 PM) formats
    const formatCleanTime = (timeStr) => {
      if (!timeStr || typeof timeStr !== 'string') return null;
      
      const trimmed = timeStr.trim();
      
      // Check if already in 12-hour format (contains AM/PM)
      if (trimmed.toUpperCase().includes('AM') || trimmed.toUpperCase().includes('PM')) {
        const match = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (match) {
          return `${match[1]}:${match[2]} ${match[3].toUpperCase()}`;
        }
        return null;
      }
      
      // Must be 24-hour format (e.g., "14:00" or "14:00:00")
      const parts = trimmed.split(':');
      if (parts.length >= 2) {
        const h = parseInt(parts[0], 10);
        const m = parts[1].substring(0, 2);
        
        // Validate hour range
        if (isNaN(h) || h < 0 || h > 23) return null;
        
        // Convert to 12-hour format
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHour = h % 12 || 12;
        return `${displayHour}:${m} ${period}`;
      }
      
      return null;
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

    // Time slot processing - Generate all slots based on provider hours across ALL days
    const generateProviderTimeSlots = () => {
      if (!providerHours || providerHours.length === 0) {
        // Fallback: if no provider hours, just show booked times
        console.warn('No provider hours found, showing only booked times');
        const timeSlotCounts = {};
        current.valid.forEach(b => {
          if (b.time_slot) {
            const formatted = formatCleanTime(b.time_slot);
            if (formatted) {
              timeSlotCounts[formatted] = (timeSlotCounts[formatted] || 0) + 1;
            }
          }
        });
        const labels = Object.keys(timeSlotCounts).sort((a, b) => {
          const parseTime = (t) => {
            const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            if (!m) return 0;
            let h = parseInt(m[1], 10);
            const period = m[3].toUpperCase();
            if (period === 'PM' && h !== 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            return h * 60 + parseInt(m[2], 10);
          };
          return parseTime(a) - parseTime(b);
        });
        return { labels, values: labels.map(l => timeSlotCounts[l]) };
      }

      // Parse time string (HH:MM:SS or HH:MM) to minutes from midnight
      const timeToMinutes = (timeStr) => {
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        return hours * 60 + minutes;
      };

      // Find the earliest start time and latest end time across ALL days
      let earliestMinutes = Infinity;
      let latestMinutes = 0;
      let slotInterval = 60; // default 60 minutes

      providerHours.forEach(ph => {
        if (ph.start_time) {
          const startMinutes = timeToMinutes(ph.start_time);
          if (startMinutes < earliestMinutes) earliestMinutes = startMinutes;
        }
        if (ph.end_time) {
          const endMinutes = timeToMinutes(ph.end_time);
          if (endMinutes > latestMinutes) latestMinutes = endMinutes;
        }
        if (ph.slot_interval_minutes) {
          slotInterval = ph.slot_interval_minutes;
        }
      });

      console.log('Provider Hours Analysis:', {
        earliestMinutes,
        latestMinutes,
        earliestTime: `${Math.floor(earliestMinutes / 60)}:${(earliestMinutes % 60).toString().padStart(2, '0')}`,
        latestTime: `${Math.floor(latestMinutes / 60)}:${(latestMinutes % 60).toString().padStart(2, '0')}`,
        slotInterval
      });

      // Generate all time slots from earliest to latest using the slot interval
      const allTimeSlots = [];
      for (let currentMinutes = earliestMinutes; currentMinutes < latestMinutes; currentMinutes += slotInterval) {
        const hours = Math.floor(currentMinutes / 60);
        const minutes = currentMinutes % 60;
        
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12 || 12;
        const displayMin = minutes.toString().padStart(2, '0');
        allTimeSlots.push(`${displayHour}:${displayMin} ${period}`);
      }

      console.log('All Generated Time Slots:', allTimeSlots);

      // Count bookings for each time slot
      const timeSlotCounts = {};
      allTimeSlots.forEach(slot => {
        timeSlotCounts[slot] = 0; // Initialize all slots to 0
      });

      // Fill in actual booking counts
      current.valid.forEach(b => {
        if (b.time_slot) {
          const formatted = formatCleanTime(b.time_slot);
          if (formatted) {
            if (timeSlotCounts.hasOwnProperty(formatted)) {
              timeSlotCounts[formatted]++;
            } else {
              // If booking time doesn't match exactly, find closest slot
              const bookingMinutes = (() => {
                const m = formatted.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                if (!m) return null;
                let h = parseInt(m[1], 10);
                const min = parseInt(m[2], 10);
                const period = m[3].toUpperCase();
                if (period === 'PM' && h !== 12) h += 12;
                if (period === 'AM' && h === 12) h = 0;
                return h * 60 + min;
              })();

              if (bookingMinutes !== null) {
                // Find the closest slot
                let closestSlot = null;
                let minDiff = Infinity;
                allTimeSlots.forEach(slot => {
                  const m = slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                  if (m) {
                    let h = parseInt(m[1], 10);
                    const min = parseInt(m[2], 10);
                    const period = m[3].toUpperCase();
                    if (period === 'PM' && h !== 12) h += 12;
                    if (period === 'AM' && h === 12) h = 0;
                    const slotMinutes = h * 60 + min;
                    const diff = Math.abs(slotMinutes - bookingMinutes);
                    if (diff < minDiff) {
                      minDiff = diff;
                      closestSlot = slot;
                    }
                  }
                });
                if (closestSlot) {
                  timeSlotCounts[closestSlot]++;
                  console.log(`📌 Mapped ${formatted} to closest slot ${closestSlot}`);
                }
              }
            }
          }
        }
      });

      console.log('⏰ Time Slot Counts (All Slots):', timeSlotCounts);

      return {
        labels: allTimeSlots,
        values: allTimeSlots.map(slot => timeSlotCounts[slot])
      };
    };

    const { labels: sortedHourLabels, values: hourValues } = generateProviderTimeSlots();

    const serviceMap = {};
    const filteredServices = serviceStats.filter(s => {
      const b = s.booking_pets?.bookings;
      if (!b) return false;
      const hasValidStatus = validStatuses.includes(b.status);
      const inDateRange = new Date(b.booking_date) >= currentRange.start;
      return hasValidStatus && inDateRange;
    });
    
    console.log('🔧 Filtered Services:', filteredServices.length);
    
    filteredServices.forEach(s => { 
      serviceMap[s.service_name] = (serviceMap[s.service_name] || 0) + 1; 
    });
    
    const sLabels = Object.keys(serviceMap);
    const sValues = Object.values(serviceMap);
    const totalS = sValues.reduce((a, b) => a + b, 0);

    // Get busiest hour for insight
    const getBusiestHour = () => {
      if (hourValues.length === 0) return "No data";
      const maxBookings = Math.max(...hourValues);
      const maxIndex = hourValues.indexOf(maxBookings);
      return sortedHourLabels[maxIndex] || "No data";
    };

    return { 
      revenue: current.rev, 
      validCount: current.count, 
      cancellations: currentBookings.filter(b => b.status === 'cancelled').length, 
      avg: new Set(current.valid.map(b => b.user_id)).size > 0 
        ? Math.round(current.count / new Set(current.valid.map(b => b.user_id)).size) 
        : 0, 
      revTrend: getTrend(current.rev, previous.rev), 
      bookTrend: getTrend(current.count, previous.count),
      dateLabels, dateValues, peakDaysLabels, peakDaysValues, sortedHourLabels, hourValues,
      sLabels, sValues, totalS, rangeText,
      busiestHour: getBusiestHour()
    };
  }, [rawBookings, serviceStats, activeFilter, providerHours]);

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
              <button className={`sidebar-tab-btn ${activeTab === 'business_performance' ? 'active' : ''}`} onClick={() => navigate('/service/business-dashboard')}>Business Performance</button>
              <button className={`sidebar-tab-btn ${activeTab === 'customer_insights' ? 'active' : ''}`} onClick={() => navigate('/service/customer-insight')}>Customer Insights</button>
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
              <h4 className="chart-title-sm">Booked Services</h4>
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
                <h4 className="chart-title-sm">Booked Hours</h4>
                <div className="chart-container-small">
                  <Bar data={{ labels: analytics.sortedHourLabels, datasets: [{ data: analytics.hourValues, backgroundColor: '#1e3a8a', borderRadius: 4 }] }} options={commonChartOptions} />
                </div>
                <p className="chart-insight-text">{analytics.busiestHour} is usually busy</p>
              </div>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
