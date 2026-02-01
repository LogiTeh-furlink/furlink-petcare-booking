import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCaretUp, FaCaretDown, FaMinus, FaFileAlt, FaTimes } from 'react-icons/fa';
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
  const [petTypeFilter, setPetTypeFilter] = useState('both');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [rawBookings, setRawBookings] = useState([]);
  const [serviceStats, setServiceStats] = useState([]);
  const [providerHours, setProviderHours] = useState([]);
  const [listingVisitors, setListingVisitors] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);

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
              pet_type
            )
          `)
          .eq('provider_id', provider.id);

        if (bError) throw bError;
        
        console.log('Raw Bookings Fetched:', bookings?.length || 0);
        console.log('All Bookings:', bookings);
        
        setRawBookings(bookings || []);

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
        console.log('📊 Service Stats Fetched:', bServices?.length || 0);
        
        setServiceStats(bServices || []);

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
    
    console.log('Current Date:', now.toISOString());
    console.log('Active Filter:', activeFilter);
    console.log('Pet Type Filter:', petTypeFilter);
    
    const getRange = (filter, isPrevious = false) => {
      // Handle custom date range
      if (filter === 'custom' && customDateStart && customDateEnd) {
        const start = new Date(customDateStart);
        const end = new Date(customDateEnd);
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        if (isPrevious) {
          // For trend comparison, get the same duration before the custom range
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
    
    console.log('📅 Current Range:', {
      start: currentRange.start.toISOString(),
      end: currentRange.end?.toISOString() || 'now'
    });
    
    const rangeText = activeFilter === 'custom' && customDateStart && customDateEnd
      ? `${new Date(customDateStart).toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} - ${new Date(customDateEnd).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`
      : `${currentRange.start.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} - ${now.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`;

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

    // FIXED: Only use isBookingComplete to determine validity (matching SPDashboard)
    const getValidPets = (bookingsList) => {
      const validPets = [];
      bookingsList.forEach(b => {
        const isComplete = isBookingComplete(b);
        
        // Only count bookings that are actually complete
        if (isComplete && b.booking_pets && Array.isArray(b.booking_pets)) {
          b.booking_pets.forEach(pet => {
            // Apply pet type filter at the PET level
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

    console.log('Current Valid Pets:', currentValidPets.length);
    console.log('Previous Valid Pets:', previousValidPets.length);

    // Calculate metrics based on PETS, not bookings
    const calculateMetrics = (petsList) => {
      // Revenue is still at booking level, but we need unique bookings
      const uniqueBookingIds = new Set(petsList.map(p => p.booking_id));
      const uniqueBookings = currentBookings.filter(b => uniqueBookingIds.has(b.id));
      const rev = uniqueBookings.reduce((sum, b) => sum + (Number(b.total_estimated_price) || 0), 0);
      
      return { 
        rev, 
        count: petsList.length, // Count individual pets
        validPets: petsList 
      };
    };

    const current = calculateMetrics(currentValidPets);
    const previous = calculateMetrics(previousValidPets);

    const formatCleanTime = (timeStr) => {
      if (!timeStr || typeof timeStr !== 'string') return null;
      
      const trimmed = timeStr.trim();
      
      if (trimmed.toUpperCase().includes('AM') || trimmed.toUpperCase().includes('PM')) {
        const match = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (match) {
          return `${match[1]}:${match[2]} ${match[3].toUpperCase()}`;
        }
        return null;
      }
      
      const parts = trimmed.split(':');
      if (parts.length >= 2) {
        const h = parseInt(parts[0], 10);
        const m = parts[1].substring(0, 2);
        
        if (isNaN(h) || h < 0 || h > 23) return null;
        
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

    // FIXED: Count pets by type for charts
    let dateValuesDog = new Array(dateLabels.length).fill(0);
    let dateValuesCat = new Array(dateLabels.length).fill(0);
    
    current.validPets.forEach(pet => {
      const bDate = new Date(pet.booking_date);
      const idx = activeFilter === 'yearly' ? bDate.getMonth() : (bDate.getDay() + 6) % 7;
      
      if (dateValuesDog[idx] !== undefined && dateValuesCat[idx] !== undefined) {
        if (pet.pet_type === 'Dog') {
          dateValuesDog[idx]++;
        } else if (pet.pet_type === 'Cat') {
          dateValuesCat[idx]++;
        }
      }
    });

    const peakDaysLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let peakDaysValuesDog = new Array(7).fill(0);
    let peakDaysValuesCat = new Array(7).fill(0);
    
    current.validPets.forEach(pet => {
      const dayIdx = (new Date(pet.booking_date).getDay() + 6) % 7;
      if (pet.pet_type === 'Dog') {
        peakDaysValuesDog[dayIdx]++;
      } else if (pet.pet_type === 'Cat') {
        peakDaysValuesCat[dayIdx]++;
      }
    });

    const generateProviderTimeSlots = () => {
      if (!providerHours || providerHours.length === 0) {
        console.warn('No provider hours found, showing only booked times');
        const timeSlotCountsDog = {};
        const timeSlotCountsCat = {};
        
        current.validPets.forEach(pet => {
          if (pet.time_slot) {
            const formatted = formatCleanTime(pet.time_slot);
            if (formatted) {
              if (pet.pet_type === 'Dog') {
                timeSlotCountsDog[formatted] = (timeSlotCountsDog[formatted] || 0) + 1;
              } else if (pet.pet_type === 'Cat') {
                timeSlotCountsCat[formatted] = (timeSlotCountsCat[formatted] || 0) + 1;
              }
            }
          }
        });
        
        const allLabels = new Set([...Object.keys(timeSlotCountsDog), ...Object.keys(timeSlotCountsCat)]);
        const labels = Array.from(allLabels).sort((a, b) => {
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
        
        return { 
          labels, 
          valuesDog: labels.map(l => timeSlotCountsDog[l] || 0),
          valuesCat: labels.map(l => timeSlotCountsCat[l] || 0)
        };
      }

      const timeToMinutes = (timeStr) => {
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        return hours * 60 + minutes;
      };

      let earliestMinutes = Infinity;
      let latestMinutes = 0;
      let slotInterval = 60;

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

      const allTimeSlots = [];
      for (let currentMinutes = earliestMinutes; currentMinutes < latestMinutes; currentMinutes += slotInterval) {
        const hours = Math.floor(currentMinutes / 60);
        const minutes = currentMinutes % 60;
        
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12 || 12;
        const displayMin = minutes.toString().padStart(2, '0');
        allTimeSlots.push(`${displayHour}:${displayMin} ${period}`);
      }

      const timeSlotCountsDog = {};
      const timeSlotCountsCat = {};
      allTimeSlots.forEach(slot => {
        timeSlotCountsDog[slot] = 0;
        timeSlotCountsCat[slot] = 0;
      });

      current.validPets.forEach(pet => {
        if (pet.time_slot) {
          const formatted = formatCleanTime(pet.time_slot);
          if (formatted) {
            if (timeSlotCountsDog.hasOwnProperty(formatted)) {
              if (pet.pet_type === 'Dog') {
                timeSlotCountsDog[formatted]++;
              } else if (pet.pet_type === 'Cat') {
                timeSlotCountsCat[formatted]++;
              }
            } else {
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
                  if (pet.pet_type === 'Dog') {
                    timeSlotCountsDog[closestSlot]++;
                  } else if (pet.pet_type === 'Cat') {
                    timeSlotCountsCat[closestSlot]++;
                  }
                }
              }
            }
          }
        }
      });

      return {
        labels: allTimeSlots,
        valuesDog: allTimeSlots.map(slot => timeSlotCountsDog[slot]),
        valuesCat: allTimeSlots.map(slot => timeSlotCountsCat[slot])
      };
    };

    const { labels: sortedHourLabels, valuesDog: hourValuesDog, valuesCat: hourValuesCat } = generateProviderTimeSlots();

    // FIXED: Filter services using only isBookingComplete (matching SPDashboard)
    const filteredServices = serviceStats.filter(s => {
      const b = s.booking_pets?.bookings;
      if (!b) return false;
      
      // Use the same completion logic as SPDashboard
      const isComplete = ['completed', 'to_rate', 'rated'].includes(b.status) || 
                        (['paid', 'confirmed'].includes(b.status) && isFourHoursPast(b.booking_date, b.time_slot));
      
      const inDateRange = new Date(b.booking_date) >= currentRange.start;
      
      // Apply pet type filter
      let matchesPetType = true;
      if (petTypeFilter !== 'both') {
        matchesPetType = s.booking_pets?.pet_type === petTypeFilter;
      }
      
      return isComplete && inDateRange && matchesPetType;
    });
    
    console.log('🔧 Filtered Services:', filteredServices.length);
    
    const serviceNameMap = {};
    filteredServices.forEach(s => { 
      const serviceName = s.service_name || 'Other';
      serviceNameMap[serviceName] = (serviceNameMap[serviceName] || 0) + 1; 
    });
    
    const sLabels = Object.keys(serviceNameMap);
    const sValues = Object.values(serviceNameMap);
    const totalS = sValues.reduce((a, b) => a + b, 0);

    const getBusiestHour = () => {
      if (sortedHourLabels.length === 0) return "No data";
      
      const combinedValues = sortedHourLabels.map((label, idx) => ({
        label,
        total: hourValuesDog[idx] + hourValuesCat[idx]
      }));
      
      const maxBooking = combinedValues.reduce((max, curr) => 
        curr.total > max.total ? curr : max, { label: "No data", total: 0 });
      
      return maxBooking.label;
    };

    // FIXED: Calculate cancellations from filtered valid pets' bookings
    const uniqueCancelledBookings = new Set(
      currentBookings
        .filter(b => b.status === 'cancelled')
        .map(b => b.id)
    );

    // FIXED: Average should be unique customers who have valid pets in the period
    const uniqueCustomers = new Set(current.validPets.map(p => p.user_id));

    return { 
      revenue: current.rev, 
      validCount: current.count, 
      cancellations: uniqueCancelledBookings.size, 
      avg: uniqueCustomers.size > 0 
        ? Math.round(current.count / uniqueCustomers.size) 
        : 0, 
      revTrend: getTrend(current.rev, previous.rev), 
      bookTrend: getTrend(current.count, previous.count),
      dateLabels, 
      dateValuesDog, 
      dateValuesCat,
      peakDaysLabels, 
      peakDaysValuesDog, 
      peakDaysValuesCat,
      sortedHourLabels, 
      hourValuesDog, 
      hourValuesCat,
      sLabels, 
      sValues, 
      totalS, 
      rangeText,
      busiestHour: getBusiestHour()
    };
  }, [rawBookings, serviceStats, activeFilter, providerHours, petTypeFilter, customDateStart, customDateEnd]);

  const groupedChartOptions = {
    responsive: true, 
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      }
    },
    plugins: { 
      legend: { 
        display: petTypeFilter === 'both',
        position: 'top',
        labels: {
          boxWidth: 10,
          padding: 4,
          font: { size: 8 }
        }
      } 
    },
    scales: { 
      y: { 
        beginAtZero: true, 
        ticks: { stepSize: 1, font: { size: 8 }, padding: 2 },
        grid: { display: true, drawBorder: true }
      }, 
      x: { 
        ticks: { font: { size: 8 }, padding: 2 },
        grid: { display: false }
      } 
    }
  };

  const commonChartOptions = {
    responsive: true, 
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      }
    },
    plugins: { legend: { display: false } },
    scales: { 
      y: { 
        beginAtZero: true, 
        ticks: { stepSize: 1, font: { size: 8 }, padding: 2 },
        grid: { display: true, drawBorder: true }
      }, 
      x: { 
        ticks: { font: { size: 8 }, padding: 2 },
        grid: { display: false }
      } 
    }
  };

  const TrendIndicator = ({ trend }) => (
    <div className={`kpi-trend ${trend.dir === 'up' ? 'positive' : trend.dir === 'down' ? 'negative' : 'neutral'}`}>
      {trend.dir === 'up' ? <FaCaretUp /> : trend.dir === 'down' ? <FaCaretDown /> : <FaMinus />} {trend.val}%
    </div>
  );

  const getAverageBookingsChartData = () => {
    if (petTypeFilter === 'both') {
      return {
        labels: analytics.dateLabels,
        datasets: [
          {
            label: 'Dog',
            data: analytics.dateValuesDog,
            backgroundColor: '#1e3a8a',
            borderRadius: 4,
            barThickness: activeFilter === 'yearly' ? 8 : 25
          },
          {
            label: 'Cat',
            data: analytics.dateValuesCat,
            backgroundColor: '#facc15',
            borderRadius: 4,
            barThickness: activeFilter === 'yearly' ? 8 : 25
          }
        ]
      };
    } else if (petTypeFilter === 'Dog') {
      return {
        labels: analytics.dateLabels,
        datasets: [{
          data: analytics.dateValuesDog,
          backgroundColor: '#1e3a8a',
          borderRadius: 4,
          barThickness: activeFilter === 'yearly' ? 12 : 35
        }]
      };
    } else {
      return {
        labels: analytics.dateLabels,
        datasets: [{
          data: analytics.dateValuesCat,
          backgroundColor: '#facc15',
          borderRadius: 4,
          barThickness: activeFilter === 'yearly' ? 12 : 35
        }]
      };
    }
  };

  const getPeakDaysChartData = () => {
    if (petTypeFilter === 'both') {
      return {
        labels: analytics.peakDaysLabels,
        datasets: [
          {
            label: 'Dog',
            data: analytics.peakDaysValuesDog,
            backgroundColor: '#1e3a8a',
            borderRadius: 4
          },
          {
            label: 'Cat',
            data: analytics.peakDaysValuesCat,
            backgroundColor: '#facc15',
            borderRadius: 4
          }
        ]
      };
    } else if (petTypeFilter === 'Dog') {
      return {
        labels: analytics.peakDaysLabels,
        datasets: [{
          data: analytics.peakDaysValuesDog,
          backgroundColor: '#1e3a8a',
          borderRadius: 4
        }]
      };
    } else {
      return {
        labels: analytics.peakDaysLabels,
        datasets: [{
          data: analytics.peakDaysValuesCat,
          backgroundColor: '#facc15',
          borderRadius: 4
        }]
      };
    }
  };

  const getBookedHoursChartData = () => {
    if (petTypeFilter === 'both') {
      return {
        labels: analytics.sortedHourLabels,
        datasets: [
          {
            label: 'Dog',
            data: analytics.hourValuesDog,
            backgroundColor: '#1e3a8a',
            borderRadius: 4
          },
          {
            label: 'Cat',
            data: analytics.hourValuesCat,
            backgroundColor: '#facc15',
            borderRadius: 4
          }
        ]
      };
    } else if (petTypeFilter === 'Dog') {
      return {
        labels: analytics.sortedHourLabels,
        datasets: [{
          data: analytics.hourValuesDog,
          backgroundColor: '#1e3a8a',
          borderRadius: 4
        }]
      };
    } else {
      return {
        labels: analytics.sortedHourLabels,
        datasets: [{
          data: analytics.hourValuesCat,
          backgroundColor: '#facc15',
          borderRadius: 4
        }]
      };
    }
  };

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
                <option value="custom">Custom Range</option>
              </select>
              
              {/* Custom Date Range Inputs */}
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
                    <span key={l}>{analytics.totalS > 0 ? Math.round((analytics.sValues[i]/analytics.totalS)*100) : 0}% {l}</span>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <main className="sp-biz-main-content">
            <div className="report-button-container">
              <button className="generate-report-btn" onClick={() => setShowReportModal(true)}>
                <FaFileAlt size={16} />
                <span>Generate Business Report</span>
              </button>
            </div>

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

            <div className="chart-box main-chart">
              <div className="chart-header">
                <h3 className="chart-title">Average Bookings ({activeFilter})</h3>
                <span className="date-range">{analytics.rangeText}</span>
              </div>
              <div className="chart-container-large">
                <Bar 
                  data={getAverageBookingsChartData()} 
                  options={petTypeFilter === 'both' ? groupedChartOptions : commonChartOptions} 
                />
              </div>
            </div>
            
            <div className="sp-biz-bottom-grid">
              <div className="chart-box">
                <h4 className="chart-title-sm">Peak Days</h4>
                <div className="chart-container-small">
                  <Bar 
                    data={getPeakDaysChartData()} 
                    options={petTypeFilter === 'both' ? groupedChartOptions : commonChartOptions} 
                  />
                </div>
              </div>
              <div className="chart-box">
                <h4 className="chart-title-sm">Booked Hours</h4>
                <div className="chart-container-small">
                  <Bar 
                    data={getBookedHoursChartData()} 
                    options={petTypeFilter === 'both' ? groupedChartOptions : commonChartOptions} 
                  />
                </div>
                <p className="chart-insight-text">{analytics.busiestHour} is usually busy</p>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Business Report Modal */}
      {showReportModal && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-header">
              <div className="report-header-title">
                <FaFileAlt size={20} />
                <h2>Business Performance Report</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setShowReportModal(false)}>
                <FaTimes />
              </button>
            </div>

            <div className="report-modal-body">
              {/* Report Header Info */}
              <div className="report-info-section">
                <div className="report-info-row">
                  <span className="report-label">Report Period:</span>
                  <span className="report-value">{analytics.rangeText}</span>
                </div>
                <div className="report-info-row">
                  <span className="report-label">Report Type:</span>
                  <span className="report-value">{activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Summary</span>
                </div>
                <div className="report-info-row">
                  <span className="report-label">Pet Type Filter:</span>
                  <span className="report-value">{petTypeFilter === 'both' ? 'All Pets (Dog & Cat)' : petTypeFilter}</span>
                </div>
                <div className="report-info-row">
                  <span className="report-label">Generated:</span>
                  <span className="report-value">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="report-section">
                <h3 className="report-section-title">Executive Summary</h3>
                <div className="report-kpi-grid">
                  <div className="report-kpi-item">
                    <span className="report-kpi-label">Gross Revenue</span>
                    <span className="report-kpi-value">
                      {analytics.revenue >= 1000 ? `₱${(analytics.revenue / 1000).toFixed(1)}K` : `₱${Math.round(analytics.revenue)}`}
                    </span>
                    <div className="report-trend">
                      {analytics.revTrend.dir === 'up' ? <FaCaretUp /> : analytics.revTrend.dir === 'down' ? <FaCaretDown /> : <FaMinus />}
                      <span className={analytics.revTrend.dir}>{analytics.revTrend.val}% vs previous period</span>
                    </div>
                  </div>
                  <div className="report-kpi-item">
                    <span className="report-kpi-label">Total Bookings</span>
                    <span className="report-kpi-value">{analytics.validCount}</span>
                    <div className="report-trend">
                      {analytics.bookTrend.dir === 'up' ? <FaCaretUp /> : analytics.bookTrend.dir === 'down' ? <FaCaretDown /> : <FaMinus />}
                      <span className={analytics.bookTrend.dir}>{analytics.bookTrend.val}% vs previous period</span>
                    </div>
                  </div>
                  <div className="report-kpi-item">
                    <span className="report-kpi-label">Listing Visitors</span>
                    <span className="report-kpi-value">{listingVisitors.toLocaleString()}</span>
                  </div>
                  <div className="report-kpi-item">
                    <span className="report-kpi-label">Avg Bookings/Customer</span>
                    <span className="report-kpi-value">{analytics.avg}</span>
                  </div>
                  <div className="report-kpi-item">
                    <span className="report-kpi-label">Cancellations</span>
                    <span className="report-kpi-value">{analytics.cancellations}</span>
                  </div>
                </div>
              </div>

              {/* Performance Analysis */}
              <div className="report-section">
                <h3 className="report-section-title">Performance Analysis</h3>
                <div className="report-insights">
                  <div className="insight-item">
                    <strong>Peak Activity:</strong>
                    <p>Your busiest time slot is typically <strong>{analytics.busiestHour}</strong>. Consider optimizing staffing during this period.</p>
                  </div>
                  <div className="insight-item">
                    <strong>Revenue Trend:</strong>
                    <p>
                      {analytics.revTrend.dir === 'up' 
                        ? `Revenue has increased by ${analytics.revTrend.val}% compared to the previous ${activeFilter} period. Keep up the good work!`
                        : analytics.revTrend.dir === 'down'
                        ? `Revenue has decreased by ${analytics.revTrend.val}% compared to the previous ${activeFilter} period. Consider reviewing your pricing or marketing strategy.`
                        : 'Revenue has remained stable compared to the previous period.'}
                    </p>
                  </div>
                  <div className="insight-item">
                    <strong>Booking Trend:</strong>
                    <p>
                      {analytics.bookTrend.dir === 'up'
                        ? `Bookings have increased by ${analytics.bookTrend.val}%, indicating growing demand for your services.`
                        : analytics.bookTrend.dir === 'down'
                        ? `Bookings have decreased by ${analytics.bookTrend.val}%. Consider promotional campaigns to boost customer engagement.`
                        : 'Booking volume has remained consistent with the previous period.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Service Breakdown */}
              {analytics.sLabels.length > 0 && (
                <div className="report-section">
                  <h3 className="report-section-title">Top Services</h3>
                  <div className="report-services-list">
                    {analytics.sLabels.slice(0, 5).map((service, idx) => (
                      <div key={service} className="service-item">
                        <div className="service-info">
                          <span className="service-rank">#{idx + 1}</span>
                          <span className="service-name">{service}</span>
                        </div>
                        <div className="service-stats">
                          <span className="service-count">{analytics.sValues[idx]} bookings</span>
                          <span className="service-percentage">
                            {analytics.totalS > 0 ? Math.round((analytics.sValues[idx] / analytics.totalS) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pet Type Distribution (only show when "both" is selected) */}
              {petTypeFilter === 'both' && (
                <div className="report-section">
                  <h3 className="report-section-title">Pet Type Distribution</h3>
                  <div className="pet-distribution">
                    <div className="pet-dist-item">
                      <span className="pet-type">Dogs</span>
                      <span className="pet-count">{analytics.dateValuesDog.reduce((a, b) => a + b, 0)} bookings</span>
                    </div>
                    <div className="pet-dist-item">
                      <span className="pet-type">Cats</span>
                      <span className="pet-count">{analytics.dateValuesCat.reduce((a, b) => a + b, 0)} bookings</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="report-modal-footer">
              <button className="btn-download-report" disabled>
                <FaFileAlt />
                Download Report (Coming Soon)
              </button>
              <button className="btn-close-report" onClick={() => setShowReportModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}