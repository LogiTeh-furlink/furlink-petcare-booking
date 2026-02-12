import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCaretUp, FaCaretDown, FaMinus, FaFileAlt, FaTimes, FaDownload, FaArrowLeft } from 'react-icons/fa';
import {
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement,
  LineElement,
  Title,
  Tooltip, 
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { loadFilters, saveFilters } from '../../utils/filterUtils';
import './SPSales.css';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement,
  LineElement,
  Title,
  Tooltip, 
  Legend,
  Filler
);

// ============================================
// HELPER: Format currency with 2 decimal places
// ============================================
const formatCurrency = (value) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SPSales() {
  const navigate = useNavigate();
  const reportRef = useRef(null);
  const printableReportRef = useRef(null);
  
  // ============================================
  // STATE MANAGEMENT - Load from localStorage
  // ============================================
  const [activeTab] = useState('sales'); 
  const savedFilters = loadFilters();
  const [activeFilter, setActiveFilter] = useState(savedFilters.activeFilter);
  const [petTypeFilter, setPetTypeFilter] = useState(savedFilters.petTypeFilter);
  const [customDateStart, setCustomDateStart] = useState(savedFilters.customDateStart);
  const [customDateEnd, setCustomDateEnd] = useState(savedFilters.customDateEnd);
  const [loading, setLoading] = useState(true);
  const [rawBookings, setRawBookings] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [bookingServices, setBookingServices] = useState([]);
  const [listingVisitors, setListingVisitors] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(savedFilters.selectedYear);
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
    const fetchSalesData = async () => {
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
          // Splits "2024-01-15T14:30:00" into "2024-01-15"
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

        // Fetch services for this provider
        const { data: services, error: sError } = await supabase
          .from('services')
          .select('id, name, type')
          .eq('provider_id', provider.id);

        if (sError) throw sError;
        setServicesList(services || []);

        // Fetch booking_services data
        const { data: bServices, error: bsError } = await supabase
          .from('booking_services')
          .select(`
            id,
            service_id,
            service_name,
            service_type,
            price,
            booking_pet_id,
            booking_pets!inner (
              id,
              pet_type,
              booking_id,
              bookings!inner (
                id,
                booking_date,
                status,
                time_slot,
                user_id
              )
            )
          `)
          .in('service_id', services.map(s => s.id));

        if (bsError) throw bsError;
        setBookingServices(bServices || []);

      } catch (err) {
        console.error("Sales Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSalesData();
  }, [navigate]);

  // ============================================
  // ANALYTICS CALCULATIONS
  // ============================================
  const analytics = useMemo(() => {
    const now = new Date();
    
    // Helper function to get date ranges based on filter
    const getRange = (filter, isPrevious = false) => {
    const today = new Date(); // Freeze 'now' for consistency

    // CUSTOM RANGE (Logic remains mostly the same, ensures fair duration)
    if (filter === 'custom' && customDateStart && customDateEnd) {
      const start = new Date(customDateStart);
      const end = new Date(customDateEnd);
      end.setHours(23, 59, 59, 999);
      
      if (isPrevious) {
        const duration = end - start; // Difference in milliseconds
        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);
        prevEnd.setHours(23, 59, 59, 999);
        const prevStart = new Date(prevEnd - duration); // Same duration back
        return { start: prevStart, end: prevEnd };
      }
      return { start, end };
    }
    
    let start = new Date();
    let end = new Date();

    if (filter === 'weekly') {
      // === WEEKLY LOGIC (Rolling 7 Days) ===
      // This is already fair because it compares 7 days vs 7 days.
      if (isPrevious) { 
        start.setDate(today.getDate() - 14); 
        end.setDate(today.getDate() - 7); 
        end.setHours(23, 59, 59, 999); // Ensure we get the full last day
      } else { 
        start.setDate(today.getDate() - 7); 
        end = today;
      }

    } else if (filter === 'monthly') {
      // === MONTHLY LOGIC (Fixed for Period-to-Date) ===
      if (isPrevious) { 
        // Start: 1st of previous month
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        
        // End: The SAME DAY of the previous month (or last day if it doesn't exist)
        // Example: If today is March 31, previous period ends Feb 28 (or 29)
        const daysInPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
        const targetDay = Math.min(today.getDate(), daysInPrevMonth);
        
        end = new Date(today.getFullYear(), today.getMonth() - 1, targetDay);
        end.setHours(23, 59, 59, 999);
      } else { 
        // Current: 1st of this month to NOW
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = today;
      }

    } else if (filter === 'yearly') {
      // === YEARLY LOGIC (Fixed for Year-to-Date) ===
      if (selectedYear) {
        // If a specific past year is selected (e.g., 2023), compare full 2023 vs full 2022
        start = new Date(selectedYear, 0, 1);
        end = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
        if (isPrevious) {
          start = new Date(selectedYear - 1, 0, 1);
          end = new Date(selectedYear - 1, 11, 31, 23, 59, 59, 999);
        }
      } else {
        // Default: This Year (YTD) vs Last Year (YTD)
        if (isPrevious) { 
          start = new Date(today.getFullYear() - 1, 0, 1);
          
          // End: Same month/day but last year
          // Handle leap year edge case (Feb 29 -> Feb 28)
          if (today.getMonth() === 1 && today.getDate() === 29) {
            end = new Date(today.getFullYear() - 1, 1, 28);
          } else {
            end = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
          }
          end.setHours(23, 59, 59, 999);
        } else { 
          start = new Date(today.getFullYear(), 0, 1); // Jan 1st of this year
          end = today; // To right now
        }
      }
    } else {
      // Default Fallback
      if (isPrevious) { 
        start.setFullYear(today.getFullYear() - 1, 0, 1); 
        end.setFullYear(today.getFullYear() - 1, 11, 31); 
      } else { 
        start = new Date(today.getFullYear(), 0, 1);
        end = today;
      }
    }
    return { start, end };
  };

    const currentRange = getRange(activeFilter);
    const previousRange = getRange(activeFilter, true);
    
    // Format the date range text
    const rangeText = activeFilter === 'custom' && customDateStart && customDateEnd
      ? `${new Date(customDateStart).toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} - ${new Date(customDateEnd).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`
      : `${currentRange.start.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} - ${now.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`;

    // Helper to convert 12-hour time to 24-hour format
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

    // Check if booking is 4 hours past scheduled time
    const isFourHoursPast = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return false;
      try {
        const bookingDateTime = new Date(`${dateStr}T${convertTo24Hour(timeStr)}`);
        const diffMs = now - bookingDateTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours >= 4;
      } catch (e) { return false; }
    };

    // Determine if booking is complete
    const isBookingComplete = (b) => {
      // Include all statuses that represent completed bookings
      if (['rated', 'for review'].includes(b.status)) return true;
      if (['paid'].includes(b.status) && isFourHoursPast(b.booking_date, b.time_slot)) return true;
      return false;
    };

    // Filter bookings by date range
    const filterByRange = (list, range) => {
      return list.filter(b => {
        const d = new Date(b.booking_date);
        return d >= range.start && d <= (range.end || now);
      });
    };

    const currentBookings = filterByRange(rawBookings, currentRange);
    const previousBookings = filterByRange(rawBookings, previousRange);

    // Extract valid pets from complete bookings
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

    // Calculate metrics (revenue, count)
    const calculateMetrics = (petsList, originalBookings) => {
      const uniqueBookingIds = new Set(petsList.map(p => p.booking_id));
      const uniqueBookings = originalBookings.filter(b => uniqueBookingIds.has(b.id));
      const rev = uniqueBookings.reduce((sum, b) => sum + (Number(b.total_estimated_price) || 0), 0);
      return { rev, count: petsList.length, validPets: petsList };
    };

    const current = calculateMetrics(currentValidPets, currentBookings);
    const previous = calculateMetrics(previousValidPets, previousBookings);

    // Calculate percentage trend
    const getTrend = (curr, prev) => {
      if (prev === 0) return curr > 0 ? { val: 100, dir: 'up' } : { val: 0, dir: 'neutral' };
      const diff = ((curr - prev) / prev) * 100;
      return { val: Math.abs(Math.round(diff)), dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral' };
    };

    // ========================================
    // GENERATE TIME LABELS (X-AXIS)
    // ========================================
    let timeLabels = [];
    const currentYear = now.getFullYear();
    
    if (activeFilter === 'yearly') {
      if (selectedYear) {
        // Show months of selected year
        timeLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => `${m} ${selectedYear}`);
      } else {
        // Show years from 2020 to current
        const years = [];
        for (let year = 2020; year <= currentYear; year++) {
          years.push(year.toString());
        }
        timeLabels = years;
      }
    } else if (activeFilter === 'monthly') {
      const monthName = currentRange.start.toLocaleString('default', { month: 'short' });
      const lastDay = new Date(currentRange.start.getFullYear(), currentRange.start.getMonth() + 1, 0).getDate();
      timeLabels = [
        `${monthName} 1 - 7`,
        `${monthName} 8 - 14`,
        `${monthName} 15 - 21`,
        `${monthName} 22 - ${lastDay}`
      ];
    } else if (activeFilter === 'custom' && currentRange.start && currentRange.end) {
      // === MODIFIED: GENERATE DAILY LABELS FOR CUSTOM RANGE ===
      // This loop creates a label for every day between start and end date
      const tempDate = new Date(currentRange.start);
      while (tempDate <= currentRange.end) {
        timeLabels.push(tempDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        tempDate.setDate(tempDate.getDate() + 1);
      }
    } else {
      timeLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    }

    // ========================================
    // CHART 1: OVERALL SALES PERFORMANCE
    // Shows total revenue over time + customer count per period
    // ========================================
    const overallSalesData = new Array(timeLabels.length).fill(0);
    const overallCustomerCount = new Array(timeLabels.length).fill(0).map(() => new Set());
    
    currentBookings.forEach(booking => {
      if (!isBookingComplete(booking)) return;
      
      // Apply pet type filter - check if booking has pets matching the filter
      if (petTypeFilter !== 'both') {
        const hasPetType = booking.booking_pets?.some(pet => pet.pet_type === petTypeFilter);
        if (!hasPetType) return;
      }
      
      const bDate = new Date(booking.booking_date);
      let idx;
      
      if (activeFilter === 'yearly') {
        if (selectedYear) {
          // Monthly view of selected year
          idx = bDate.getMonth();
        } else {
          // Year list view
          const bookingYear = bDate.getFullYear();
          idx = timeLabels.indexOf(bookingYear.toString());
        }
      } else if (activeFilter === 'monthly') {
        const day = bDate.getDate();
        idx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
      } else {
        idx = (bDate.getDay() + 6) % 7;
      }
      
      if (idx !== -1 && overallSalesData[idx] !== undefined) {
        overallSalesData[idx] += Number(booking.total_estimated_price) || 0;
        overallCustomerCount[idx].add(booking.user_id);
      }
    });

    // Convert Sets to counts
    const overallCustomerCountArray = overallCustomerCount.map(set => set.size);

    // ========================================
    // CHART 2: SALES PERFORMANCE PER SERVICE
    // Shows revenue for each service type + customer count
    // ========================================
    const serviceRevenueMap = {};
    const serviceCustomerCount = {};
    
    servicesList.forEach(service => {
      serviceRevenueMap[service.id] = {
        name: service.name,
        data: new Array(timeLabels.length).fill(0)
      };
      serviceCustomerCount[service.id] = new Array(timeLabels.length).fill(0).map(() => new Set());
    });

    bookingServices.forEach(bs => {
      const booking = bs.booking_pets?.bookings;
      if (!booking || !isBookingComplete(booking)) return;
      
      // Apply pet type filter
      if (petTypeFilter !== 'both' && bs.booking_pets?.pet_type !== petTypeFilter) return;
      
      const bDate = new Date(booking.booking_date);
      const bookingYear = bDate.getFullYear();
      
      // Filter by selected year when in yearly drill-down mode
      if (activeFilter === 'yearly' && selectedYear && bookingYear !== selectedYear) return;
      
      // Filter by current range (handles all year data when selectedYear is null)
      if (bDate < currentRange.start || bDate > (currentRange.end || now)) return;
      
      let idx;
      
      if (activeFilter === 'yearly') {
        if (selectedYear) {
          // Monthly view of selected year
          idx = bDate.getMonth();
        } else {
          // Year list view
          idx = timeLabels.indexOf(bookingYear.toString());
        }
      } else if (activeFilter === 'monthly') {
        const day = bDate.getDate();
        idx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
      } else {
        idx = (bDate.getDay() + 6) % 7;
      }
      
      if (idx !== -1 && serviceRevenueMap[bs.service_id] && serviceRevenueMap[bs.service_id].data[idx] !== undefined) {
        serviceRevenueMap[bs.service_id].data[idx] += Number(bs.price) || 0;
        serviceCustomerCount[bs.service_id][idx].add(booking.user_id);
      }
    });

    // Convert customer count Sets to arrays
    const serviceCustomerCountArrays = {};
    Object.keys(serviceCustomerCount).forEach(serviceId => {
      serviceCustomerCountArrays[serviceId] = serviceCustomerCount[serviceId].map(set => set.size);
    });

    // ========================================
    // CHART 3: NEW VS RETURNING CUSTOMERS REVENUE
    // Two lines: revenue from new customers vs returning customers + customer counts
    // ========================================
    const newCustomerRevenue = new Array(timeLabels.length).fill(0);
    const returningCustomerRevenue = new Array(timeLabels.length).fill(0);
    const newCustomerCount = new Array(timeLabels.length).fill(0).map(() => new Set());
    const returningCustomerCount = new Array(timeLabels.length).fill(0).map(() => new Set());
    
    // Track first booking date for each customer
    const customerFirstBooking = {};
    
    // Sort all bookings by date to identify first booking
    const allCompletedBookings = rawBookings
      .filter(b => isBookingComplete(b))
      .sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date));
    
    allCompletedBookings.forEach(booking => {
      if (!customerFirstBooking[booking.user_id]) {
        customerFirstBooking[booking.user_id] = booking.booking_date;
      }
    });
    
    // Now categorize current period bookings
    currentBookings.forEach(booking => {
      if (!isBookingComplete(booking)) return;
      
      // Apply pet type filter - check if booking has pets matching the filter
      if (petTypeFilter !== 'both') {
        const hasPetType = booking.booking_pets?.some(pet => pet.pet_type === petTypeFilter);
        if (!hasPetType) return;
      }
      
      const bDate = new Date(booking.booking_date);
      let idx;
      
      if (activeFilter === 'yearly') {
        if (selectedYear) {
          // Monthly view of selected year
          idx = bDate.getMonth();
        } else {
          // Year list view
          const bookingYear = bDate.getFullYear();
          idx = timeLabels.indexOf(bookingYear.toString());
        }
      } else if (activeFilter === 'monthly') {
        const day = bDate.getDate();
        idx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
      } else {
        idx = (bDate.getDay() + 6) % 7;
      }
      
      const isFirstBooking = customerFirstBooking[booking.user_id] === booking.booking_date;
      const revenue = Number(booking.total_estimated_price) || 0;
      
      if (idx !== -1 && idx !== undefined) {
        if (isFirstBooking) {
          newCustomerRevenue[idx] += revenue;
          newCustomerCount[idx].add(booking.user_id);
        } else {
          returningCustomerRevenue[idx] += revenue;
          returningCustomerCount[idx].add(booking.user_id);
        }
      }
    });

    // Convert customer count Sets to arrays
    const newCustomerCountArray = newCustomerCount.map(set => set.size);
    const returningCustomerCountArray = returningCustomerCount.map(set => set.size);

    // ========================================
    // CHART 4: REVENUE LOSS DUE TO CANCELLATIONS
    // Two lines: actual revenue earned vs potential revenue without cancellations
    // ========================================
    const actualRevenue = new Array(timeLabels.length).fill(0);
    const potentialRevenue = new Array(timeLabels.length).fill(0);
    const cancellationsPerPeriod = new Array(timeLabels.length).fill(0);
    
    currentBookings.forEach(booking => {
      // Apply pet type filter - check if booking has pets matching the filter
      if (petTypeFilter !== 'both') {
        const hasPetType = booking.booking_pets?.some(pet => pet.pet_type === petTypeFilter);
        if (!hasPetType) return;
      }
      
      const bDate = new Date(booking.booking_date);
      let idx;
      
      if (activeFilter === 'yearly') {
        if (selectedYear) {
          // Monthly view of selected year
          idx = bDate.getMonth();
        } else {
          // Year list view
          const bookingYear = bDate.getFullYear();
          idx = timeLabels.indexOf(bookingYear.toString());
        }
      } else if (activeFilter === 'monthly') {
        const day = bDate.getDate();
        idx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
      } else {
        idx = (bDate.getDay() + 6) % 7;
      }
      
      const revenue = Number(booking.total_estimated_price) || 0;
      
      if (idx !== -1 && idx !== undefined) {
        // Add to potential revenue regardless of status
        potentialRevenue[idx] += revenue;
        
        // Track cancellations
        if (booking.status === 'cancelled') {
          cancellationsPerPeriod[idx] += 1;
        }
        
        // Only add to actual if booking is complete
        if (isBookingComplete(booking)) {
          actualRevenue[idx] += revenue;
        }
      }
    });

    // Calculate total loss from cancellations
    const totalLoss = potentialRevenue.reduce((sum, val, idx) => 
      sum + (val - actualRevenue[idx]), 0
    );

    // Calculate total revenue for overall sales chart
    const totalRevenue = overallSalesData.reduce((sum, val) => sum + val, 0);

    // ========================================
    // PET TYPE BREAKDOWN FOR REPORT
    // Calculate stats broken down by pet type
    // ========================================
    const calculatePetTypeBreakdown = () => {
      const breakdown = {
        Dog: { revenue: 0, bookings: 0, customers: new Set() },
        Cat: { revenue: 0, bookings: 0, customers: new Set() }
      };

      currentBookings.forEach(booking => {
        if (!isBookingComplete(booking)) return;
        
        const bookingRevenue = Number(booking.total_estimated_price) || 0;
        
        // Track which pet types are in this booking
        const petTypes = new Set();
        booking.booking_pets?.forEach(pet => {
          petTypes.add(pet.pet_type);
        });

        // If booking has both pet types, split the revenue
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
        Dog: {
          revenue: breakdown.Dog.revenue,
          bookings: breakdown.Dog.bookings,
          customers: breakdown.Dog.customers.size
        },
        Cat: {
          revenue: breakdown.Cat.revenue,
          bookings: breakdown.Cat.bookings,
          customers: breakdown.Cat.customers.size
        }
      };
    };

    const petTypeBreakdown = calculatePetTypeBreakdown();

    return { 
      revenue: current.rev, 
      validCount: current.count, 
      cancellations: new Set(currentBookings.filter(b => b.status === 'cancelled').map(b => b.id)).size, 
      avg: new Set(current.validPets.map(p => p.user_id)).size > 0 
        ? Math.round(current.count / new Set(current.validPets.map(p => p.user_id)).size) 
        : 0, 
      revTrend: getTrend(current.rev, previous.rev), 
      bookTrend: getTrend(current.count, previous.count),
      rangeText,
      timeLabels,
      // Chart data
      overallSalesData,
      overallCustomerCountArray,
      totalRevenue,
      serviceRevenueMap,
      serviceCustomerCountArrays,
      newCustomerRevenue,
      returningCustomerRevenue,
      newCustomerCountArray,
      returningCustomerCountArray,
      actualRevenue,
      potentialRevenue,
      cancellationsPerPeriod,
      totalLoss,
      petTypeBreakdown
    };
  }, [rawBookings, servicesList, bookingServices, activeFilter, petTypeFilter, customDateStart, customDateEnd, selectedYear]);

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

      // Create a clone of the report content for printing
      const clone = element.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.width = '800px'; // Fixed width for consistent rendering
      clone.style.overflow = 'visible';
      clone.style.maxHeight = 'none';
      clone.style.height = 'auto';
      clone.style.padding = '24px';
      clone.style.backgroundColor = '#ffffff';
      
      // Append to body temporarily
      document.body.appendChild(clone);
      
      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture the cloned element
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: clone.scrollWidth,
        height: clone.scrollHeight
      });

      // Remove the clone
      document.body.removeChild(clone);

      console.log('Canvas captured:', { width: canvas.width, height: canvas.height });

      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // Create PDF with proper dimensions
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate image dimensions with margins
      const margin = 10;
      const imgWidth = pdfWidth - (2 * margin);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Calculate how many pages we need
      const pageHeight = pdfHeight - (2 * margin);
      const totalPages = Math.ceil(imgHeight / pageHeight);
      
      console.log('PDF pages needed:', totalPages);

      // Add content to PDF pages
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
          pdf.addPage();
        }
        
        // Calculate the portion of the image for this page
        const sourceY = page * (pageHeight * canvas.width / imgWidth);
        const sourceHeight = Math.min(
          pageHeight * canvas.width / imgWidth,
          canvas.height - sourceY
        );
        
        // Only add if there's content to add
        if (sourceHeight > 0) {
          // Create a temporary canvas for this page slice
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sourceHeight;
          const pageCtx = pageCanvas.getContext('2d');
          
          // Draw the slice of the full canvas onto the page canvas
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageCtx.drawImage(
            canvas,
            0, sourceY, canvas.width, sourceHeight,
            0, 0, canvas.width, sourceHeight
          );
          
          const pageImgData = pageCanvas.toDataURL('image/png', 1.0);
          const pageImgHeight = (sourceHeight * imgWidth) / canvas.width;
          
          pdf.addImage(pageImgData, 'PNG', margin, margin, imgWidth, pageImgHeight, '', 'FAST');
        }
      }

      // Generate filename with current date
      const fileName = `Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Save the PDF
      pdf.save(fileName);
      
      console.log('PDF generated successfully');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ============================================
  // CHART OPTIONS
  // ============================================
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          boxWidth: 12,
          padding: 8,
          font: { size: 10 }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          // CHANGE: Use formatCurrency for 2 decimal places in base tooltip
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += '₱' + formatCurrency(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: { size: 9 },
          callback: function(value) {
            return '₱' + value.toLocaleString();
          }
        },
        grid: {
          display: true,
          drawBorder: true
        }
      },
      x: {
        ticks: {
          font: { size: 9 }
        },
        grid: {
          display: false
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
    onClick: (event, elements) => {
      if (activeFilter === 'yearly' && !selectedYear && elements.length > 0) {
        const index = elements[0].index;
        const clickedYear = parseInt(analytics.timeLabels[index]);
        setSelectedYear(clickedYear);
      }
    }
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
  // LOADING STATE
  // ============================================
  if (loading) return <div className="loading-state">Loading...</div>;

  return (
    <div className="sp-biz-page-wrapper">
      <LoggedInNavbar />
      
      <div className="sp-biz-main-layout">
        <div className="sp-biz-container">
          
          {/* ============================================ */}
          {/* SIDEBAR - Filters */}
          {/* ============================================ */}
          <aside className="sp-biz-sidebar">
            {/* Back to Dashboard Button */}
            <button 
              className="back-to-dashboard-btn"
              onClick={() => navigate('/service/dashboard')}
              title="Back to Dashboard"
            >
              <FaArrowLeft size={18} />
            </button>

            {/* Tab Navigation */}
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
            
            {/* Timeframe Filter */}
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

            {/* Pet Type Filter */}
            <div className="sidebar-section">
              <h3>Pet Type</h3>
              <select className="filter-dropdown" value={petTypeFilter} onChange={(e) => setPetTypeFilter(e.target.value)}>
                <option value="both">Both (Dog & Cat)</option>
                <option value="Dog">Dog</option>
                <option value="Cat">Cat</option>
              </select>
            </div>
          </aside>

          {/* ============================================ */}
          {/* MAIN CONTENT - KPIs and Charts */}
          {/* ============================================ */}
          <main className="sp-biz-main-content">
            {/* Generate Report Button and As of Date */}
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
                <span>Generate Sales Report</span>
              </button>
            </div>

            {/* KPI Cards Grid */}
            <div className="sp-biz-kpi-grid">
              {/* Gross Revenue KPI */}
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
              
              {/* Total Bookings KPI */}
              <div className="kpi-card">
                <span className="kpi-label">Total Bookings</span>
                <div className="kpi-row">
                  <span className="kpi-value">{analytics.validCount}</span>
                  <TrendIndicator trend={analytics.bookTrend} />
                </div>
              </div>
              
              {/* Listing Visitors KPI */}
              <div className="kpi-card">
                <span className="kpi-label">Listing Visitors</span>
                <span className="kpi-value">{listingVisitors.toLocaleString()}</span>
              </div>
              
              {/* Average per Customer KPI */}
              <div className="kpi-card">
                <span className="kpi-label">Avg/Customer</span>
                <span className="kpi-value">{analytics.avg}</span>
              </div>
              
              {/* Cancellations KPI */}
              <div className="kpi-card">
                <span className="kpi-label">Cancellations</span>
                <span className="kpi-value">{analytics.cancellations.toString().padStart(2, '0')}</span>
              </div>
            </div>

            {/* ============================================ */}
            {/* TOP CHARTS GRID: OVERALL SALES & REVENUE LOSS */}
            {/* ============================================ */}
            <div className="sales-charts-grid">
              
              {/* CHART 1: OVERALL SALES PERFORMANCE */}
              <div className="chart-box">
                {activeFilter === 'yearly' && selectedYear && (
                  <button 
                    className="back-to-years-btn"
                    onClick={() => setSelectedYear(null)}
                    title="Back to years view"
                  >
                    <FaArrowLeft size={12} />
                  </button>
                )}
                <div className="chart-header-with-btn">
                  <h3 className="chart-title-centered">Overall Sales Performance</h3>
                  <span className="date-range-topright">
                    {activeFilter === 'yearly' && selectedYear 
                      ? `Year ${selectedYear}` 
                      : analytics.rangeText}
                  </span>
                </div>
                <div className="chart-container-large">
                  <Line
                    data={{
                      labels: analytics.timeLabels,
                      datasets: [{
                        label: 'Total Revenue',
                        data: analytics.overallSalesData,
                        borderColor: '#1e3a8a',
                        backgroundColor: 'rgba(30, 58, 138, 0.1)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                      }]
                    }}
                    options={{
                      ...lineChartOptions,
                      plugins: {
                        ...lineChartOptions.plugins,
                        tooltip: {
                          mode: 'index',
                          intersect: false,
                          callbacks: {
                            // CHANGE: decimals in tooltip
                            label: function(context) {
                              let label = context.dataset.label || '';
                              if (label) label += ': ';
                              if (context.parsed.y !== null) {
                                label += '₱' + formatCurrency(context.parsed.y);
                              }
                              return label;
                            },
                            afterLabel: function(context) {
                              const customerCount = analytics.overallCustomerCountArray[context.dataIndex];
                              return `Customers: ${customerCount}`;
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
                {/* CHANGE: Total Revenue summary below chart, matching Total Loss style */}
                <p className="chart-insight-text">
                  Total Revenue: ₱{formatCurrency(analytics.totalRevenue)}
                </p>
              </div>

              {/* CHART 4: REVENUE LOSS DUE TO CANCELLATIONS */}
              <div className="chart-box">
                {activeFilter === 'yearly' && selectedYear && (
                  <button 
                    className="back-to-years-btn"
                    onClick={() => setSelectedYear(null)}
                    title="Back to years view"
                  >
                    <FaArrowLeft size={12} />
                  </button>
                )}
                <div className="chart-header-with-btn">
                  <h3 className="chart-title-centered">Revenue Loss from Cancellations</h3>
                  <span className="date-range-topright">
                    {activeFilter === 'yearly' && selectedYear 
                      ? `Year ${selectedYear}` 
                      : analytics.rangeText}
                  </span>
                </div>
                <div className="chart-container-large">
                  <Line
                    data={{
                      labels: analytics.timeLabels,
                      datasets: [
                        {
                          label: 'Potential Revenue',
                          data: analytics.potentialRevenue,
                          borderColor: '#10b981',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          tension: 0.4,
                          fill: false,
                          borderWidth: 2,
                          borderDash: [5, 5],
                          pointRadius: 3,
                          pointHoverRadius: 5
                        },
                        {
                          label: 'Actual Revenue',
                          data: analytics.actualRevenue,
                          borderColor: '#ef4444',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          tension: 0.4,
                          fill: true,
                          borderWidth: 2,
                          pointRadius: 3,
                          pointHoverRadius: 5
                        }
                      ]
                    }}
                    options={{
                      ...lineChartOptions,
                      plugins: {
                        ...lineChartOptions.plugins,
                        tooltip: {
                          mode: 'index',
                          intersect: false,
                          callbacks: {
                            // CHANGE: decimals in tooltip
                            label: function(context) {
                              let label = context.dataset.label || '';
                              if (label) label += ': ';
                              if (context.parsed.y !== null) {
                                label += '₱' + formatCurrency(context.parsed.y);
                              }
                              return label;
                            },
                            afterLabel: function(context) {
                              // Show cancellations count only once (on the first dataset)
                              if (context.datasetIndex === 0) {
                                const cancellations = analytics.cancellationsPerPeriod[context.dataIndex];
                                const loss = analytics.potentialRevenue[context.dataIndex] - analytics.actualRevenue[context.dataIndex];
                                return [
                                  `Cancellations: ${cancellations}`,
                                  // CHANGE: decimals in revenue lost line
                                  `Revenue Lost: ₱${formatCurrency(loss)}`
                                ];
                              }
                              return null;
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
                {/* CHANGE: decimals in Total Loss summary */}
                <p className="chart-insight-text">
                  Total Loss: ₱{formatCurrency(analytics.totalLoss)}
                </p>
              </div>

            </div>

            {/* ============================================ */}
            {/* BOTTOM CHARTS GRID: NEW/RETURNING & SALES BY SERVICE */}
            {/* ============================================ */}
            <div className="sales-charts-grid">
              
              {/* CHART 3: NEW VS RETURNING CUSTOMERS */}
              <div className="chart-box">
                <h4 className="chart-title-sm">New vs Returning Customer Revenue</h4>
                <div className="chart-container-medium">
                  <Line
                    data={{
                      labels: analytics.timeLabels,
                      datasets: [
                        {
                          label: 'New Customers',
                          data: analytics.newCustomerRevenue,
                          borderColor: '#10b981',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          tension: 0.4,
                          fill: true,
                          borderWidth: 2,
                          pointRadius: 3,
                          pointHoverRadius: 5
                        },
                        {
                          label: 'Returning Customers',
                          data: analytics.returningCustomerRevenue,
                          borderColor: '#3b82f6',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          tension: 0.4,
                          fill: true,
                          borderWidth: 2,
                          pointRadius: 3,
                          pointHoverRadius: 5
                        }
                      ]
                    }}
                    options={{
                      ...lineChartOptions,
                      plugins: {
                        ...lineChartOptions.plugins,
                        tooltip: {
                          mode: 'index',
                          intersect: false,
                          callbacks: {
                            // CHANGE: decimals in tooltip
                            label: function(context) {
                              let label = context.dataset.label || '';
                              if (label) label += ': ';
                              if (context.parsed.y !== null) {
                                label += '₱' + formatCurrency(context.parsed.y);
                              }
                              return label;
                            },
                            afterLabel: function(context) {
                              const isNew = context.datasetIndex === 0;
                              const customerCount = isNew 
                                ? analytics.newCustomerCountArray[context.dataIndex]
                                : analytics.returningCustomerCountArray[context.dataIndex];
                              return `Customers: ${customerCount}`;
                            }
                          }
                        }
                      },
                      scales: {
                        ...lineChartOptions.scales,
                        x: {
                          ...lineChartOptions.scales.x,
                          ticks: {
                            ...lineChartOptions.scales.x.ticks,
                            maxRotation: activeFilter === 'yearly' && selectedYear ? 45 : 0,
                            minRotation: activeFilter === 'yearly' && selectedYear ? 45 : 0
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* CHART 2: SALES PERFORMANCE PER SERVICE */}
              <div className="chart-box">
                {activeFilter === 'yearly' && selectedYear && (
                  <button 
                    className="back-to-years-btn"
                    onClick={() => setSelectedYear(null)}
                    title="Back to years view"
                  >
                    <FaArrowLeft size={12} />
                  </button>
                )}
                <h4 className="chart-title-sm">Sales Performance by Service</h4>
                <div className="chart-container-medium">
                  <Line
                    data={{
                      labels: analytics.timeLabels,
                      datasets: Object.entries(analytics.serviceRevenueMap).map(([serviceId, service], idx) => {
                        const colors = [
                          { border: '#1e3a8a', bg: 'rgba(30, 58, 138, 0.1)' },
                          { border: '#facc15', bg: 'rgba(250, 204, 21, 0.1)' },
                          { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
                          { border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
                          { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
                          { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
                          { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' }
                        ];
                        const color = colors[idx % colors.length];
                        
                        return {
                          label: service.name,
                          data: service.data,
                          borderColor: color.border,
                          backgroundColor: color.bg,
                          tension: 0.4,
                          fill: false,
                          borderWidth: 2,
                          pointRadius: 3,
                          pointHoverRadius: 5,
                          serviceId: serviceId // Store serviceId for tooltip access
                        };
                      })
                    }}
                    options={{
                      ...lineChartOptions,
                      plugins: {
                        ...lineChartOptions.plugins,
                        tooltip: {
                          mode: 'index',
                          intersect: false,
                          callbacks: {
                            // CHANGE: decimals in tooltip
                            label: function(context) {
                              let label = context.dataset.label || '';
                              if (label) label += ': ';
                              if (context.parsed.y !== null) {
                                label += '₱' + formatCurrency(context.parsed.y);
                              }
                              return label;
                            },
                            afterLabel: function(context) {
                              const serviceId = context.dataset.serviceId;
                              const customerCount = analytics.serviceCustomerCountArrays[serviceId]?.[context.dataIndex] || 0;
                              return `Customers: ${customerCount}`;
                            }
                          }
                        }
                      },
                      scales: {
                        ...lineChartOptions.scales,
                        x: {
                          ...lineChartOptions.scales.x,
                          ticks: {
                            ...lineChartOptions.scales.x.ticks,
                            maxRotation: activeFilter === 'yearly' && selectedYear ? 45 : 0,
                            minRotation: activeFilter === 'yearly' && selectedYear ? 45 : 0
                          }
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

      {/* ============================================ */}
      {/* SALES REPORT MODAL */}
      {/* ============================================ */}
      {showReportModal && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="report-modal-header">
              <div className="report-header-title">
                <FaFileAlt size={20} />
                <h2>Sales Report</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setShowReportModal(false)}>
                <FaTimes />
              </button>
            </div>

            {/* Modal Body - This content will be captured for PDF */}
            <div className="report-modal-body" ref={reportRef}>
              {/* Report Header Info */}
              <div className="report-info-section">
                <div className="report-info-row">
                  <span className="report-label">Report Period:</span>
                  <span className="report-value">{analytics.rangeText}</span>
                </div>
                <div className="report-info-row">
                  <span className="report-label">Report Type:</span>
                  <span className="report-value">
                    {activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Sales Summary
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

              {/* Executive Summary — KPI values intentionally kept without decimals per requirement */}
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
                    <span className="report-kpi-label">Revenue Loss</span>
                    {/* KPI card — no decimals */}
                    <span className="report-kpi-value">₱{analytics.totalLoss.toLocaleString()}</span>
                  </div>
                  <div className="report-kpi-item">
                    <span className="report-kpi-label">Listing Visitors</span>
                    <span className="report-kpi-value">{listingVisitors.toLocaleString()}</span>
                  </div>
                  <div className="report-kpi-item">
                    <span className="report-kpi-label">Cancellations</span>
                    <span className="report-kpi-value">{analytics.cancellations}</span>
                  </div>
                </div>
              </div>

              {/* Sales Analysis */}
              <div className="report-section">
                <h3 className="report-section-title">Sales Analysis</h3>
                <div className="report-insights">
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
                    <strong>Cancellation Impact:</strong>
                    {/* CHANGE: decimals for revenue loss figure in narrative */}
                    <p>
                      Cancellations resulted in a revenue loss of ₱{formatCurrency(analytics.totalLoss)} during this period. 
                      {analytics.totalLoss > 0 
                        ? ' Consider implementing cancellation policies or improving customer communication.'
                        : ' Excellent! No revenue was lost to cancellations.'}
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

              {/* Customer Segmentation */}
              <div className="report-section">
                <h3 className="report-section-title">Customer Segmentation</h3>
                <div className="pet-distribution">
                  <div className="pet-dist-item">
                    <span className="pet-type">New Customers</span>
                    {/* CHANGE: decimals for segmentation revenue figures */}
                    <span className="pet-count">
                      ₱{formatCurrency(analytics.newCustomerRevenue.reduce((a, b) => a + b, 0))} revenue
                    </span>
                  </div>
                  <div className="pet-dist-item">
                    <span className="pet-type">Returning Customers</span>
                    <span className="pet-count">
                      ₱{formatCurrency(analytics.returningCustomerRevenue.reduce((a, b) => a + b, 0))} revenue
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
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
                    Download Report
                  </>
                )}
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