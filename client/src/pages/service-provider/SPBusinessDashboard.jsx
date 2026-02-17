import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCaretUp, FaCaretDown, FaMinus, FaFileAlt, FaTimes, FaDownload, FaArrowLeft } from 'react-icons/fa';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Tooltip, Legend
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { loadFilters, saveFilters } from '../../utils/filterUtils';
import './SPBusinessDashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend);

// Helper: Format currency with 2 decimal places
const formatCurrency = (value) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SPBusinessDashboard() {
  const navigate = useNavigate();
  const reportRef = useRef(null);
  
  // ============================================
  // STATE MANAGEMENT - Load from localStorage
  // ============================================
  const [activeTab] = useState('business_performance'); 
  const savedFilters = loadFilters();
  const [activeFilter, setActiveFilter] = useState(savedFilters.activeFilter);
  const [petTypeFilter, setPetTypeFilter] = useState(savedFilters.petTypeFilter);
  const [customDateStart, setCustomDateStart] = useState(savedFilters.customDateStart);
  const [customDateEnd, setCustomDateEnd] = useState(savedFilters.customDateEnd);
  const [loading, setLoading] = useState(true);
  const [rawBookings, setRawBookings] = useState([]);
  const [serviceStats, setServiceStats] = useState([]);
  const [providerHours, setProviderHours] = useState([]);
  const [listingVisitors, setListingVisitors] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(savedFilters.selectedYear || new Date().getFullYear());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [listingApprovedDate, setListingApprovedDate] = useState(null);

  // ============================================
  // SAVE FILTERS TO LOCALSTORAGE ON CHANGE
  // ============================================
  useEffect(() => {
    saveFilters({
      activeFilter,
      petTypeFilter,
      customDateStart,
      customDateEnd,
      selectedYear
    });
  }, [activeFilter, petTypeFilter, customDateStart, customDateEnd, selectedYear]);

  // ============================================
  // DATA FETCHING
  // ============================================
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/login");

        const { data: provider } = await supabase
          .from("service_providers")
          .select("id, click_count, created_at")
          .eq("user_id", user.id)
          .single();

        if (!provider) return;

        setListingVisitors(provider.click_count || 0);

        if (provider.created_at) {
          setListingApprovedDate(provider.created_at.split('T')[0]);
        }

        // Fetch bookings with related data
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
        setRawBookings(bookings || []);

        // Fetch booking services for service breakdown
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

        // Fetch provider hours for time slot generation
        const { data: phours, error: hError } = await supabase
          .from('service_provider_hours')
          .select('start_time, end_time, slot_interval_minutes')
          .eq('provider_id', provider.id);

        if (hError) throw hError;
        setProviderHours(phours || []);

      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [navigate]);

  // ============================================
  // PDF DOWNLOAD FUNCTION
  // ============================================
  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    
    try {
      const element = reportRef.current;
      
      if (!element) {
        console.error('Report element not found');
        setIsGeneratingPDF(false);
        return;
      }

      const clone = element.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.width = '800px';
      clone.style.overflow = 'visible';
      clone.style.maxHeight = 'none';
      clone.style.height = 'auto';
      clone.style.padding = '24px';
      clone.style.backgroundColor = '#ffffff';
      
      document.body.appendChild(clone);
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: clone.scrollWidth,
        height: clone.scrollHeight
      });

      document.body.removeChild(clone);

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 10;
      const imgWidth = pdfWidth - (2 * margin);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageHeight = pdfHeight - (2 * margin);
      const totalPages = Math.ceil(imgHeight / pageHeight);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();
        
        const sourceY = page * (pageHeight * canvas.width / imgWidth);
        const sourceHeight = Math.min(pageHeight * canvas.width / imgWidth, canvas.height - sourceY);
        
        if (sourceHeight > 0) {
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sourceHeight;
          const pageCtx = pageCanvas.getContext('2d');
          
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
          
          const pageImgData = pageCanvas.toDataURL('image/png', 1.0);
          const pageImgHeight = (sourceHeight * imgWidth) / canvas.width;
          pdf.addImage(pageImgData, 'PNG', margin, margin, imgWidth, pageImgHeight, '', 'FAST');
        }
      }

      const fileName = `Business_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ============================================
  // ANALYTICS CALCULATIONS
  // ============================================
  const analytics = useMemo(() => {
    const now = new Date();

    // ============================================
    // FIX: Parse booking_date as LOCAL midnight, not UTC.
    // new Date('2025-02-17') parses as UTC midnight which shifts the date
    // in timezones offset from UTC. Splitting into parts and constructing
    // with new Date(y, m-1, d) always uses local midnight.
    // This single helper replaces ALL instances of new Date(booking_date_string)
    // throughout this file.
    // ============================================
    const parseLocalDate = (dateStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    // ============================================
    // FIX: Cap the end of all non-custom ranges to end-of-today.
    // Without this, future-dated bookings leak into the current range,
    // causing inconsistent counts across weekly/monthly/yearly filters.
    // ============================================
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Helper to format a local date as "Mon D" label (used for custom range labels)
    const formatLabel = (dateInput) => {
      const d = new Date(dateInput);
      return d.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        timeZone: 'UTC' 
      });
    };
    
    // Helper function to get date ranges based on filter
    const getRange = (filter, isPrevious = false) => {
      const today = new Date();

      // Custom filter
      if (filter === 'custom' && customDateStart && customDateEnd) {
        const start = parseLocalDate(customDateStart);
        const end = parseLocalDate(customDateEnd);
        end.setHours(23, 59, 59, 999);
        
        if (isPrevious) {
          const duration = end - start;
          const prevEnd = new Date(start);
          prevEnd.setDate(prevEnd.getDate() - 1);
          prevEnd.setHours(23, 59, 59, 999);
          const prevStart = new Date(prevEnd - duration);
          return { start: prevStart, end: prevEnd };
        }
        return { start, end };
      }
      
      let start = new Date();
      let end = new Date();

      // Weekly filter
      if (filter === 'weekly') {
        if (isPrevious) { 
          start.setDate(today.getDate() - 14); 
          end.setDate(today.getDate() - 7); 
          end.setHours(23, 59, 59, 999);
        } else { 
          start.setDate(today.getDate() - 7);
          // FIX: explicitly cap to end of today
          end = new Date(endOfToday);
        }

      // Monthly filter
      } else if (filter === 'monthly') {
        if (isPrevious) { 
          start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const daysInPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
          const targetDay = Math.min(today.getDate(), daysInPrevMonth);
          end = new Date(today.getFullYear(), today.getMonth() - 1, targetDay);
          end.setHours(23, 59, 59, 999);
        } else { 
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          end = new Date(endOfToday);
        }

      // Yearly filter
      } else if (filter === 'yearly') {
        if (selectedYear === null) {
          // All Years: span from listing approval to today
          const listingYear = listingApprovedDate
            ? new Date(listingApprovedDate).getFullYear()
            : today.getFullYear();
          if (isPrevious) {
            start = new Date(listingYear, 0, 1);
            end = new Date(listingYear, 0, 1);
          } else {
            start = new Date(listingYear, 0, 1);
            end = new Date(endOfToday);
          }
        } else {
          const targetYear = selectedYear;
          if (isPrevious) {
            start = new Date(targetYear - 1, 0, 1);
            end = new Date(targetYear - 1, 11, 31, 23, 59, 59, 999);
          } else {
            start = new Date(targetYear, 0, 1);
            end = targetYear === today.getFullYear()
              ? new Date(endOfToday)
              : new Date(targetYear, 11, 31, 23, 59, 59, 999);
          }
        }
      }

      return { start, end };
    };

    const currentRange = getRange(activeFilter);
    const previousRange = getRange(activeFilter, true);
    
    // Format the date range text
    const rangeText = activeFilter === 'custom' && customDateStart && customDateEnd
      ? `${parseLocalDate(customDateStart).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })} - ${parseLocalDate(customDateEnd).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`
      : `${currentRange.start.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })} - ${now.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`;

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

    const isBookingComplete = (b) => {
      return ['for review', 'rated'].includes(b.status);
    };

    // ============================================
    // FIX: filterByRange now uses parseLocalDate so booking_date strings
    // are always compared in local time, not UTC.
    // ============================================
    const filterByRange = (list, range) => {
      return list.filter(b => {
        const d = parseLocalDate(b.booking_date);
        return d >= range.start && d <= range.end;
      });
    };

    const currentBookings = filterByRange(rawBookings, currentRange);
    const previousBookings = filterByRange(rawBookings, previousRange);

    const getValidPets = (bookingsList) => {
      const validPets = [];
      bookingsList.forEach(b => {
        if (isBookingComplete(b) && b.booking_pets && Array.isArray(b.booking_pets)) {
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

    const calculateMetrics = (petsList, originalBookings) => {
      const uniqueBookingIds = new Set(petsList.map(p => p.booking_id));
      const uniqueBookings = originalBookings.filter(b => uniqueBookingIds.has(b.id));
      const rev = uniqueBookings.reduce((sum, b) => sum + (Number(b.total_estimated_price) || 0), 0);
      return { rev, count: petsList.length, validPets: petsList };
    };

    const current = calculateMetrics(currentValidPets, currentBookings);
    const previous = calculateMetrics(previousValidPets, previousBookings);

    const getTrend = (curr, prev) => {
      if (prev === 0) return curr > 0 ? { val: 100, dir: 'up' } : { val: 0, dir: 'neutral' };
      const diff = ((curr - prev) / prev) * 100;
      return { val: Math.abs(Math.round(diff)), dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral' };
    };

    const cancellationCount = currentBookings.filter(b => b.status === 'cancelled').length;

    // ============================================
    // CHART DATA GENERATION - LABELS
    // ============================================
    let dateLabels = [];
    
    if (activeFilter === 'yearly') {
      if (selectedYear === null) {
        // All Years: one label per year from listing approval to now
        const currentYear = new Date().getFullYear();
        const startYear = listingApprovedDate
          ? new Date(listingApprovedDate).getFullYear()
          : currentYear;
        for (let y = startYear; y <= currentYear; y++) dateLabels.push(y.toString());
      } else {
        dateLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => `${m} ${selectedYear}`);
      }
    } else if (activeFilter === 'monthly') {
      const monthName = currentRange.start.toLocaleString('default', { month: 'short' });
      const lastDay = new Date(currentRange.start.getFullYear(), currentRange.start.getMonth() + 1, 0).getDate();
      dateLabels = [`${monthName} 1 - 7`, `${monthName} 8 - 14`, `${monthName} 15 - 21`, `${monthName} 22 - ${lastDay}`];
    } else if (activeFilter === 'custom' && currentRange.start && currentRange.end) {
      const tempDate = new Date(customDateStart);
      const endDate = new Date(customDateEnd);
      while (tempDate <= endDate) {
        dateLabels.push(formatLabel(tempDate)); 
        tempDate.setUTCDate(tempDate.getUTCDate() + 1);
      }
    } else {
      dateLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    }

    // ============================================
    // CHART DATA GENERATION - VALUES MAPPING
    // FIX: All new Date(pet.booking_date) calls replaced with parseLocalDate()
    // ============================================
    let dateValuesDog = new Array(dateLabels.length).fill(0);
    let dateValuesCat = new Array(dateLabels.length).fill(0);
    
    const petsToProcess = (activeFilter === 'yearly' && selectedYear === null) 
      ? getValidPets(rawBookings.filter(b => isBookingComplete(b)))
      : current.validPets;
    
    petsToProcess.forEach(pet => {
      let idx = -1;
      const bDate = parseLocalDate(pet.booking_date);
      
      if (activeFilter === 'yearly' && selectedYear === null) {
        idx = dateLabels.indexOf(bDate.getFullYear().toString());
      } else if (activeFilter === 'yearly' && selectedYear !== null) {
        if (bDate.getFullYear() === selectedYear) idx = bDate.getMonth();
      } else if (activeFilter === 'monthly') {
        const day = bDate.getDate();
        idx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
      } else if (activeFilter === 'custom') {
        const label = formatLabel(pet.booking_date);
        idx = dateLabels.indexOf(label);
      } else {
        // FIX: use bDate (local) instead of new Date(pet.booking_date) (UTC)
        idx = (bDate.getDay() + 6) % 7;
      }
      
      if (idx !== -1 && dateValuesDog[idx] !== undefined) {
        if (pet.pet_type === 'Dog') dateValuesDog[idx]++;
        else if (pet.pet_type === 'Cat') dateValuesCat[idx]++;
      }
    });

    // ============================================
    // CHART DATA GENERATION - PEAK DAYS
    // FIX: use parseLocalDate instead of new Date() for day-of-week extraction
    // ============================================
    const peakDaysLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let peakDaysValuesDog = new Array(7).fill(0);
    let peakDaysValuesCat = new Array(7).fill(0);
    
    petsToProcess.forEach(pet => {
      // FIX: parseLocalDate ensures correct local day-of-week
      const dayIdx = (parseLocalDate(pet.booking_date).getDay() + 6) % 7;
      if (pet.pet_type === 'Dog') peakDaysValuesDog[dayIdx]++;
      else if (pet.pet_type === 'Cat') peakDaysValuesCat[dayIdx]++;
    });

    // ============================================
    // CHART DATA GENERATION - BOOKED HOURS
    // ============================================
    const formatCleanTime = (timeStr) => {
      if (!timeStr || typeof timeStr !== 'string') return null;
      const parts = timeStr.trim().split(':');
      if (parts.length >= 2) {
        const h = parseInt(parts[0], 10);
        const m = parts[1].substring(0, 2);
        return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
      }
      return null;
    };

    const generateProviderTimeSlots = () => {
      if (!providerHours || providerHours.length === 0) return { labels: [], valuesDog: [], valuesCat: [] };
      const timeToMinutes = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      let start = Math.min(...providerHours.map(ph => timeToMinutes(ph.start_time)));
      let end = Math.max(...providerHours.map(ph => timeToMinutes(ph.end_time)));
      let step = providerHours[0].slot_interval_minutes || 60;
      
      const labels = [];
      for (let i = start; i < end; i += step) {
        const h = Math.floor(i / 60);
        labels.push(`${h % 12 || 12}:${(i % 60).toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`);
      }
      
      const vDog = new Array(labels.length).fill(0);
      const vCat = new Array(labels.length).fill(0);
      petsToProcess.forEach(pet => {
        const f = formatCleanTime(pet.time_slot);
        const idx = labels.indexOf(f);
        if (idx !== -1) {
          if (pet.pet_type === 'Dog') vDog[idx]++;
          else vCat[idx]++;
        }
      });
      return { labels, valuesDog: vDog, valuesCat: vCat };
    };

    const timeSlots = generateProviderTimeSlots();

    // ============================================
    // CHART DATA GENERATION - BOOKED SERVICES
    // FIX: use parseLocalDate instead of new Date() for inRange check
    // ============================================
    const filteredServices = serviceStats.filter(s => {
      const b = s.booking_pets?.bookings;
      if (!b) return false;
      const isComplete = isBookingComplete(b);
      
      if (activeFilter === 'yearly' && selectedYear === null) {
        const matchesPet = petTypeFilter === 'both' || s.booking_pets?.pet_type === petTypeFilter;
        return isComplete && matchesPet;
      }
      
      // FIX: parseLocalDate for correct local date comparison
      const bDate = parseLocalDate(b.booking_date);
      const inRange = bDate >= currentRange.start && bDate <= currentRange.end;
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

    const getBusiestHour = () => {
      if (timeSlots.labels.length === 0) return "No data";
      const combinedValues = timeSlots.labels.map((label, idx) => ({
        label,
        total: timeSlots.valuesDog[idx] + timeSlots.valuesCat[idx]
      }));
      const maxBooking = combinedValues.reduce((max, curr) => 
        curr.total > max.total ? curr : max, { label: "No data", total: 0 });
      return maxBooking.label;
    };

    // ========================================
    // PET TYPE BREAKDOWN FOR REPORT
    // ========================================
    const calculatePetTypeBreakdown = () => {
      const breakdown = {
        Dog: { revenue: 0, bookings: 0, customers: new Set() },
        Cat: { revenue: 0, bookings: 0, customers: new Set() }
      };
      currentBookings.forEach(booking => {
        if (!isBookingComplete(booking)) return;
        const bookingRevenue = Number(booking.total_estimated_price) || 0;
        const petTypes = new Set();
        booking.booking_pets?.forEach(pet => petTypes.add(pet.pet_type));

        if (petTypes.has('Dog') && petTypes.has('Cat')) {
          const splitRevenue = bookingRevenue / 2;
          breakdown.Dog.revenue += splitRevenue;
          breakdown.Cat.revenue += splitRevenue;
          breakdown.Dog.bookings += 1;
          breakdown.Cat.bookings += 1;
          breakdown.Dog.customers.add(booking.user_id);
          breakdown.Cat.customers.add(booking.user_id);
        } else if (petTypes.has('Dog')) {
          breakdown.Dog.revenue += bookingRevenue;
          breakdown.Dog.bookings += 1;
          breakdown.Dog.customers.add(booking.user_id);
        } else if (petTypes.has('Cat')) {
          breakdown.Cat.revenue += bookingRevenue;
          breakdown.Cat.bookings += 1;
          breakdown.Cat.customers.add(booking.user_id);
        }
      });
      return {
        Dog: { revenue: breakdown.Dog.revenue, bookings: breakdown.Dog.bookings, customers: breakdown.Dog.customers.size },
        Cat: { revenue: breakdown.Cat.revenue, bookings: breakdown.Cat.bookings, customers: breakdown.Cat.customers.size }
      };
    };

    return { 
      revenue: current.rev, 
      validCount: current.count, 
      cancellations: cancellationCount,
      avg: new Set(current.validPets.map(p => p.user_id)).size > 0 
        ? Math.round(current.count / new Set(current.validPets.map(p => p.user_id)).size) 
        : 0, 
      revTrend: getTrend(current.rev, previous.rev), 
      bookTrend: getTrend(current.count, previous.count),
      dateLabels, 
      dateValuesDog, 
      dateValuesCat,
      peakDaysLabels, 
      peakDaysValuesDog, 
      peakDaysValuesCat,
      sortedHourLabels: timeSlots.labels, 
      hourValuesDog: timeSlots.valuesDog, 
      hourValuesCat: timeSlots.valuesCat,
      sLabels, 
      sValues, 
      totalS: sValues.reduce((a, b) => a + b, 0),
      rangeText, 
      busiestHour: getBusiestHour(),
      petTypeBreakdown: calculatePetTypeBreakdown()
    };
  }, [rawBookings, serviceStats, activeFilter, providerHours, petTypeFilter, customDateStart, customDateEnd, selectedYear, listingApprovedDate]);

  // ============================================
  // CHART OPTIONS
  // ============================================
  const groupedChartOptions = {
    responsive: true, 
    maintainAspectRatio: false,
    layout: { padding: 0 },
    plugins: { 
      legend: { 
        display: petTypeFilter === 'both', 
        position: 'top', 
        labels: { boxWidth: 10, padding: 4, font: { size: 8 } } 
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
    layout: { padding: 0 },
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

  const getAverageBookingsChartOptions = () => {
    const baseOptions = petTypeFilter === 'both' ? { ...groupedChartOptions } : { ...commonChartOptions };
    baseOptions.onClick = null;
    baseOptions.onHover = (event) => {
      event.native.target.style.cursor = 'default';
    };
    return baseOptions;
  };

  // ============================================
  // HELPER COMPONENTS
  // ============================================
  const TrendIndicator = ({ trend }) => (
    <div className={`kpi-trend ${trend.dir === 'up' ? 'positive' : trend.dir === 'down' ? 'negative' : 'neutral'}`}>
      {trend.dir === 'up' ? <FaCaretUp /> : trend.dir === 'down' ? <FaCaretDown /> : <FaMinus />} {trend.val}%
    </div>
  );

  // ============================================
  // CHART DATA FUNCTIONS
  // ============================================
  const getAverageBookingsChartData = () => {
    let barThickness;
    if (activeFilter === 'yearly' && selectedYear === null) {
      barThickness = 20;
    } else if (activeFilter === 'yearly' && selectedYear !== null) {
      barThickness = 8;
    } else if (activeFilter === 'monthly') {
      barThickness = 25;
    } else if (activeFilter === 'custom') {
      barThickness = 30;
    } else {
      barThickness = 35;
    }
    
    if (petTypeFilter === 'both') {
      return {
        labels: analytics.dateLabels,
        datasets: [
          { 
            label: 'Dog', 
            data: analytics.dateValuesDog, 
            backgroundColor: '#1e3a8a', 
            borderRadius: 4, 
            barThickness: barThickness
          },
          { 
            label: 'Cat', 
            data: analytics.dateValuesCat, 
            backgroundColor: '#facc15', 
            borderRadius: 4, 
            barThickness: barThickness
          }
        ]
      };
    }
    return {
      labels: analytics.dateLabels,
      datasets: [{
        data: petTypeFilter === 'Dog' ? analytics.dateValuesDog : analytics.dateValuesCat,
        backgroundColor: petTypeFilter === 'Dog' ? '#1e3a8a' : '#facc15',
        borderRadius: 4, 
        barThickness: barThickness
      }]
    };
  };

  const getPeakDaysChartData = () => {
    if (petTypeFilter === 'both') {
      return {
        labels: analytics.peakDaysLabels,
        datasets: [
          { label: 'Dog', data: analytics.peakDaysValuesDog, backgroundColor: '#1e3a8a', borderRadius: 4 },
          { label: 'Cat', data: analytics.peakDaysValuesCat, backgroundColor: '#facc15', borderRadius: 4 }
        ]
      };
    }
    return {
      labels: analytics.peakDaysLabels,
      datasets: [{
        data: petTypeFilter === 'Dog' ? analytics.peakDaysValuesDog : analytics.peakDaysValuesCat,
        backgroundColor: petTypeFilter === 'Dog' ? '#1e3a8a' : '#facc15',
        borderRadius: 4
      }]
    };
  };

  const getBookedHoursChartData = () => {
    if (petTypeFilter === 'both') {
      return {
        labels: analytics.sortedHourLabels,
        datasets: [
          { label: 'Dog', data: analytics.hourValuesDog, backgroundColor: '#1e3a8a', borderRadius: 4 },
          { label: 'Cat', data: analytics.hourValuesCat, backgroundColor: '#facc15', borderRadius: 4 }
        ]
      };
    }
    return {
      labels: analytics.sortedHourLabels,
      datasets: [{
        data: petTypeFilter === 'Dog' ? analytics.hourValuesDog : analytics.hourValuesCat,
        backgroundColor: petTypeFilter === 'Dog' ? '#1e3a8a' : '#facc15',
        borderRadius: 4
      }]
    };
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) return <div className="loading-state">Loading Dashboard...</div>;

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      
      <div className="sp-biz-main-layout">
        <div className="sp-biz-container">
          {/* ============================================ */}
          {/* SIDEBAR - Filters and Doughnut Chart */}
          {/* ============================================ */}
          <aside className="sp-biz-sidebar">
            <button 
              className="back-to-dashboard-btn"
              onClick={() => navigate('/service/dashboard')}
              title="Back to Dashboard"
            >
              <FaArrowLeft size={18} />
            </button>

            <div className="sidebar-tabs-group">
              <button 
                className={`sidebar-tab-btn ${activeTab === 'sales' ? 'active' : ''}`} 
                onClick={() => navigate('/service/sales')}
              >
                Sales Performance
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
              <select className="filter-dropdown" value={activeFilter} onChange={(e) => {
                setActiveFilter(e.target.value);
                setSelectedYear(new Date().getFullYear()); // Reset to current year when changing filter
              }}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom Range</option>
              </select>

              {/* Year selector for yearly filter */}
              {activeFilter === 'yearly' && (
                <div className="custom-date-range">
                  <label className="date-label">Year:</label>
                  <select
                    className="filter-dropdown"
                    value={selectedYear === null ? '' : selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value === '' ? null : Number(e.target.value))}
                  >
                    <option value="">All Years</option>
                    {(() => {
                      const startYear = listingApprovedDate
                        ? new Date(listingApprovedDate).getFullYear()
                        : new Date().getFullYear();
                      const endYear = new Date().getFullYear();
                      return Array.from(
                        { length: endYear - startYear + 1 },
                        (_, i) => endYear - i
                      ).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ));
                    })()}
                  </select>
                </div>
              )}
              
              {activeFilter === 'custom' && (
                <div className="custom-date-range">
                  <label className="date-label">From:</label>
                  <input 
                    type="date" 
                    className="date-input" 
                    value={customDateStart} 
                    onChange={(e) => setCustomDateStart(e.target.value)} 
                    max={customDateEnd || new Date().toISOString().split('T')[0]} 
                    min={listingApprovedDate}                  
                  />
                  <label className="date-label">To:</label>
                  <input 
                    type="date" 
                    className="date-input" 
                    value={customDateEnd} 
                    onChange={(e) => setCustomDateEnd(e.target.value)} 
                    min={listingApprovedDate || customDateStart} 
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

          {/* ============================================ */}
          {/* MAIN CONTENT - KPIs and Charts */}
          {/* ============================================ */}
          <main className="sp-biz-main-content">
            <div className="report-button-container">
              <div className="as-of-date">
                As of {new Date().toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </div>
              <button className="generate-report-btn" onClick={() => setShowReportModal(true)}>
                <FaFileAlt size={16} />
                <span>Generate Business Report</span>
              </button>
            </div>

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
                <span className="kpi-label">Total Completed Bookings</span>
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
                <div className="chart-title-wrapper">
                  <h3 className="chart-title">
                    Average Bookings ({activeFilter === 'yearly' && selectedYear ? selectedYear : activeFilter})
                  </h3>
                </div>
                <span className="date-range">{analytics.rangeText}</span>
              </div>

              <div 
                className="chart-scroll-wrapper" 
                style={{ 
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  width: '100%',
                  display: 'block'
                }}
              >
                <div 
                  className="chart-inner-container" 
                  style={{ 
                    height: '300px',
                    position: 'relative',
                    minWidth: activeFilter === 'custom' 
                      ? `${analytics.dateLabels.length * 60}px` 
                      : '100%'
                  }}
                >
                  <Bar 
                    key={activeFilter + analytics.dateLabels.length} 
                    data={getAverageBookingsChartData()} 
                    options={{
                      ...getAverageBookingsChartOptions(),
                      maintainAspectRatio: false,
                      responsive: true,
                      layout: {
                        padding: {
                          right: activeFilter === 'custom' ? 20 : 0
                        }
                      }
                    }} 
                  />
                </div>
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

      {/* ============================================ */}
      {/* BUSINESS REPORT MODAL */}
      {/* ============================================ */}
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

            <div className="report-modal-body" ref={reportRef}>
              <div className="report-info-section">
                <div className="report-info-row">
                  <span className="report-label">Report Period:</span>
                  <span className="report-value">{analytics.rangeText}</span>
                </div>
                <div className="report-info-row">
                  <span className="report-label">Report Type:</span>
                  <span className="report-value">
                    {activeFilter === 'yearly'
                      ? `${selectedYear} Yearly Summary`
                      : `${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Summary`}
                  </span>
                </div>
                <div className="report-info-row">
                  <span className="report-label">Pet Type Filter:</span>
                  <span className="report-value">
                    {petTypeFilter === 'both' ? 'All Pets (Dog & Cat)' : petTypeFilter}
                  </span>
                </div>
                <div className="report-info-row">
                  <span className="report-label">Generated:</span>
                  <span className="report-value">
                    {new Date().toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
              </div>

              <div className="report-section">
                <h3 className="report-section-title">Executive Summary</h3>
                <div className="report-kpi-grid">
                  <div className="report-kpi-item">
                    <span className="report-kpi-label">Gross Revenue</span>
                    <span className="report-kpi-value">
                      {analytics.revenue >= 1000 
                        ? `₱${(analytics.revenue / 1000).toFixed(1)}K` 
                        : `₱${Math.round(analytics.revenue)}`}
                    </span>
                    <div className="report-trend">
                      {analytics.revTrend.dir === 'up' ? <FaCaretUp /> : 
                       analytics.revTrend.dir === 'down' ? <FaCaretDown /> : <FaMinus />}
                      <span className={analytics.revTrend.dir}>
                        {analytics.revTrend.val}% vs previous period
                      </span>
                    </div>
                  </div>
                  <div className="report-kpi-item">
                    <span className="report-kpi-label">Total Bookings</span>
                    <span className="report-kpi-value">{analytics.validCount}</span>
                    <div className="report-trend">
                      {analytics.bookTrend.dir === 'up' ? <FaCaretUp /> : 
                       analytics.bookTrend.dir === 'down' ? <FaCaretDown /> : <FaMinus />}
                      <span className={analytics.bookTrend.dir}>
                        {analytics.bookTrend.val}% vs previous period
                      </span>
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

              <div className="report-section">
                <h3 className="report-section-title">Performance Analysis</h3>
                <div className="report-insights">
                  <div className="insight-item">
                    <strong>Peak Activity:</strong>
                    <p>
                      Your busiest time slot is typically <strong>{analytics.busiestHour}</strong>. 
                      Consider optimizing staffing during this period.
                    </p>
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
                  <div className="insight-item">
                    <strong>Top Performing Pet Type:</strong>
                    <p>
                      {analytics.petTypeBreakdown.Dog.revenue > analytics.petTypeBreakdown.Cat.revenue 
                        ? `Dog services generated ${((analytics.petTypeBreakdown.Dog.revenue / (analytics.petTypeBreakdown.Dog.revenue + analytics.petTypeBreakdown.Cat.revenue)) * 100).toFixed(0)}% of total revenue`
                        : `Cat services generated ${((analytics.petTypeBreakdown.Cat.revenue / (analytics.petTypeBreakdown.Dog.revenue + analytics.petTypeBreakdown.Cat.revenue)) * 100).toFixed(0)}% of total revenue`}
                    </p>
                  </div>
                </div>
              </div>

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
                            {analytics.totalS > 0 
                              ? Math.round((analytics.sValues[idx] / analytics.totalS) * 100) 
                              : 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {petTypeFilter === 'both' && (
                <div className="report-section">
                  <h3 className="report-section-title">Booking Volume by Pet Type</h3>
                  <div className="pet-distribution">
                    <div className="pet-dist-item">
                      <span className="pet-type">🐕 Dogs</span>
                      <span className="pet-count">
                        {analytics.dateValuesDog.reduce((a, b) => a + b, 0)} bookings
                      </span>
                    </div>
                    <div className="pet-dist-item">
                      <span className="pet-type">🐱 Cats</span>
                      <span className="pet-count">
                        {analytics.dateValuesCat.reduce((a, b) => a + b, 0)} bookings
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="report-modal-footer">
              <button 
                className="btn-download-report" 
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
              >
                {isGeneratingPDF ? (
                  <>
                    <FaDownload />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <FaDownload />
                    Download as PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}