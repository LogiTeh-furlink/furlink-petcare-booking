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
  const [selectedYear, setSelectedYear] = useState(savedFilters.selectedYear || new Date().getFullYear());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [listingApprovedDate, setListingApprovedDate] = useState(null);
  const [providerHours, setProviderHours] = useState([]);

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
          setListingApprovedDate(provider.created_at.split('T')[0]);
        }

        // Fetch provider hours for slot interval logic
        const { data: hoursData, error: hoursError } = await supabase
          .from("service_provider_hours")
          .select("day_of_week, slot_interval_minutes")
          .eq("provider_id", provider.id);

        if (!hoursError && hoursData) {
          setProviderHours(hoursData);
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

    // ============================================
    // FIX: Parse booking_date as LOCAL midnight, not UTC.
    // new Date('2025-02-17') parses as UTC midnight which shifts the date
    // in negative-offset timezones (e.g. UTC-8 becomes Feb 16 at 4pm local).
    // Splitting into parts and constructing with new Date(y, m, d) uses local time.
    // ============================================
    const parseLocalDate = (dateStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    // ============================================
    // FIX: Cap the end of all non-custom ranges to end-of-today.
    // This ensures bookings with future dates (e.g. upcoming bookings)
    // are never counted in cancellation or completion metrics.
    // ============================================
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const isBookingComplete = (b) => {
      return ['for review', 'rated'].includes(b.status);
    };
      
    // Helper function to get date ranges based on filter
    const getRange = (filter, isPrevious = false) => {
      const today = new Date();

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

      if (filter === 'weekly') {
        if (isPrevious) { 
          start.setDate(today.getDate() - 14);
          start.setHours(0, 0, 0, 0); // FIX: start at midnight so boundary day is included
          end.setDate(today.getDate() - 7);
          end.setHours(23, 59, 59, 999);
        } else { 
          start.setDate(today.getDate() - 7);
          start.setHours(0, 0, 0, 0); // FIX: start at midnight so boundary day is included
          end = new Date(endOfToday);
        }
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
      } else if (filter === 'yearly') {
        if (selectedYear === null) {
          // All Years: span from listing approval to today
          const listingYear = listingApprovedDate
            ? new Date(listingApprovedDate).getFullYear()
            : today.getFullYear();
          if (isPrevious) {
            // No meaningful comparison period for all-years; return empty range
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
      } else {
        if (isPrevious) { 
          start.setFullYear(today.getFullYear() - 1, 0, 1); 
          end.setFullYear(today.getFullYear() - 1, 11, 31); 
        } else { 
          start = new Date(today.getFullYear(), 0, 1);
          end = new Date(endOfToday);
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

    // ============================================
    // FIX: filterByRange now uses parseLocalDate so booking_date strings
    // are always compared in local time, matching what the user sees.
    // ============================================
    const filterByRange = (list, range) => {
      return list.filter(b => {
        const d = parseLocalDate(b.booking_date);
        return d >= range.start && d <= range.end;
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

    const cancellationCount = currentBookings.filter(b => b.status === 'cancelled').length;

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
      if (selectedYear === null) {
        // All Years: one label per year from listing approval to now
        const startYear = listingApprovedDate
          ? new Date(listingApprovedDate).getFullYear()
          : currentYear;
        for (let year = startYear; year <= currentYear; year++) {
          timeLabels.push(year.toString());
        }
      } else {
        timeLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => `${m} ${selectedYear}`);
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
    // ========================================
    const overallSalesData = new Array(timeLabels.length).fill(0);
    const overallCustomerCount = new Array(timeLabels.length).fill(0).map(() => new Set());
    
    const bookingsToProcess = (activeFilter === 'yearly' && selectedYear === null) 
      ? rawBookings.filter(b => isBookingComplete(b))
      : currentBookings;
    
    bookingsToProcess.forEach(booking => {
      if (!isBookingComplete(booking)) return;
      
      if (petTypeFilter !== 'both') {
        const hasPetType = booking.booking_pets?.some(pet => pet.pet_type === petTypeFilter);
        if (!hasPetType) return;
      }
      
      const bDate = parseLocalDate(booking.booking_date);
      let idx;
      
      if (activeFilter === 'yearly') {
        if (selectedYear !== null) {
          if (bDate.getFullYear() === selectedYear) idx = bDate.getMonth();
        } else {
          idx = timeLabels.indexOf(bDate.getFullYear().toString());
        }
      } else if (activeFilter === 'monthly') {
        const day = bDate.getDate();
        idx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
      } else if (activeFilter === 'custom') {
        const startMs = currentRange.start.getTime();
        const diffDays = Math.floor((bDate.getTime() - startMs) / (1000 * 60 * 60 * 24));
        idx = diffDays >= 0 && diffDays < timeLabels.length ? diffDays : -1;
      } else {
        idx = (bDate.getDay() + 6) % 7;
      }
      
      if (idx !== undefined && idx !== -1 && overallSalesData[idx] !== undefined) {
        overallSalesData[idx] += Number(booking.total_estimated_price) || 0;
        overallCustomerCount[idx].add(booking.user_id);
      }
    });

    const overallCustomerCountArray = overallCustomerCount.map(set => set.size);

    // ========================================
    // CHART 2: SALES PERFORMANCE PER SERVICE
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
      
      if (petTypeFilter !== 'both' && bs.booking_pets?.pet_type !== petTypeFilter) return;
      
      const bDate = parseLocalDate(booking.booking_date);
      const bookingYear = bDate.getFullYear();
      
      if (activeFilter === 'yearly') {
        if (selectedYear !== null) {
          if (bookingYear !== selectedYear) return;
        }
      } else {
        if (bDate < currentRange.start || bDate > currentRange.end) return;
      }
      
      let idx;
      
      if (activeFilter === 'yearly') {
        if (selectedYear !== null) {
          idx = bDate.getMonth();
        } else {
          idx = timeLabels.indexOf(bookingYear.toString());
        }
      } else if (activeFilter === 'monthly') {
        const day = bDate.getDate();
        idx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
      } else if (activeFilter === 'custom') {
        const startMs = currentRange.start.getTime();
        const diffDays = Math.floor((bDate.getTime() - startMs) / (1000 * 60 * 60 * 24));
        idx = diffDays >= 0 && diffDays < timeLabels.length ? diffDays : -1;
      } else {
        idx = (bDate.getDay() + 6) % 7;
      }
      
      if (idx !== undefined && idx !== -1 && serviceRevenueMap[bs.service_id] && serviceRevenueMap[bs.service_id].data[idx] !== undefined) {
        serviceRevenueMap[bs.service_id].data[idx] += Number(bs.price) || 0;
        serviceCustomerCount[bs.service_id][idx].add(booking.user_id);
      }
    });

    const serviceCustomerCountArrays = {};
    Object.keys(serviceCustomerCount).forEach(serviceId => {
      serviceCustomerCountArrays[serviceId] = serviceCustomerCount[serviceId].map(set => set.size);
    });

    // ========================================
    // CHART 3: NEW VS RETURNING CUSTOMERS REVENUE
    // ========================================
    const newCustomerRevenue = new Array(timeLabels.length).fill(0);
    const returningCustomerRevenue = new Array(timeLabels.length).fill(0);
    const newCustomerCount = new Array(timeLabels.length).fill(0).map(() => new Set());
    const returningCustomerCount = new Array(timeLabels.length).fill(0).map(() => new Set());
    
    const customerFirstBooking = {};
    
    const allCompletedBookings = rawBookings
      .filter(b => isBookingComplete(b))
      .sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date));
    
    allCompletedBookings.forEach(booking => {
      if (!customerFirstBooking[booking.user_id]) {
        customerFirstBooking[booking.user_id] = booking.booking_date;
      }
    });
    
    const bookingsForCustomerSegmentation = (activeFilter === 'yearly' && selectedYear === null)
      ? allCompletedBookings
      : currentBookings;
    
    bookingsForCustomerSegmentation.forEach(booking => {
      if (!isBookingComplete(booking)) return;
      
      if (petTypeFilter !== 'both') {
        const hasPetType = booking.booking_pets?.some(pet => pet.pet_type === petTypeFilter);
        if (!hasPetType) return;
      }
      
      const bDate = parseLocalDate(booking.booking_date);
      let idx;
      
      if (activeFilter === 'yearly') {
        if (selectedYear !== null) {
          if (bDate.getFullYear() === selectedYear) idx = bDate.getMonth();
        } else {
          idx = timeLabels.indexOf(bDate.getFullYear().toString());
        }
      } else if (activeFilter === 'monthly') {
        const day = bDate.getDate();
        idx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
      } else if (activeFilter === 'custom') {
        const startMs = currentRange.start.getTime();
        const diffDays = Math.floor((bDate.getTime() - startMs) / (1000 * 60 * 60 * 24));
        idx = diffDays >= 0 && diffDays < timeLabels.length ? diffDays : -1;
      } else {
        idx = (bDate.getDay() + 6) % 7;
      }
      
      const isFirstBooking = customerFirstBooking[booking.user_id] === booking.booking_date;
      const revenue = Number(booking.total_estimated_price) || 0;
      
      if (idx !== undefined && idx !== -1) {
        if (isFirstBooking) {
          newCustomerRevenue[idx] += revenue;
          newCustomerCount[idx].add(booking.user_id);
        } else {
          returningCustomerRevenue[idx] += revenue;
          returningCustomerCount[idx].add(booking.user_id);
        }
      }
    });

    const newCustomerCountArray = newCustomerCount.map(set => set.size);
    const returningCustomerCountArray = returningCustomerCount.map(set => set.size);

    // ========================================
    // CHART 4: REVENUE LOSS DUE TO CANCELLATIONS
    // Uses currentBookings which is already capped to today via filterByRange fix
    // ========================================
    const actualRevenue = new Array(timeLabels.length).fill(0);
    const potentialRevenue = new Array(timeLabels.length).fill(0);
    const cancellationsPerPeriod = new Array(timeLabels.length).fill(0);
    
    currentBookings.forEach(booking => {
      if (petTypeFilter !== 'both') {
        const hasPetType = booking.booking_pets?.some(pet => pet.pet_type === petTypeFilter);
        if (!hasPetType) return;
      }
      
      const bDate = parseLocalDate(booking.booking_date);
      let idx;
      
      if (activeFilter === 'yearly') {
        if (selectedYear !== null) {
          if (bDate.getFullYear() === selectedYear) idx = bDate.getMonth();
        } else {
          idx = timeLabels.indexOf(bDate.getFullYear().toString());
        }
      } else if (activeFilter === 'monthly') {
        const day = bDate.getDate();
        idx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
      } else if (activeFilter === 'custom') {
        const startMs = currentRange.start.getTime();
        const diffDays = Math.floor((bDate.getTime() - startMs) / (1000 * 60 * 60 * 24));
        idx = diffDays >= 0 && diffDays < timeLabels.length ? diffDays : -1;
      } else {
        idx = (bDate.getDay() + 6) % 7;
      }
      
      const revenue = Number(booking.total_estimated_price) || 0;
      
      if (idx !== undefined && idx !== -1) {
        potentialRevenue[idx] += revenue;
        
        if (booking.status === 'cancelled' || booking.status === 'declined') {
          cancellationsPerPeriod[idx] += 1;
        }
        
        if (isBookingComplete(booking)) {
          actualRevenue[idx] += revenue;
        }
      }
    });

    const totalLoss = potentialRevenue.reduce((sum, val, idx) => 
      sum + (val - actualRevenue[idx]), 0
    );

    const totalRevenue = overallSalesData.reduce((sum, val) => sum + val, 0);

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

    const petTypeBreakdown = calculatePetTypeBreakdown();

    return { 
      revenue: current.rev, 
      validCount: current.count, 
      cancellations: cancellationCount,
      avg: new Set(current.validPets.map(p => p.user_id)).size > 0 
        ? Math.round(current.count / new Set(current.validPets.map(p => p.user_id)).size) 
        : 0, 
      revTrend: getTrend(current.rev, previous.rev), 
      bookTrend: getTrend(current.count, previous.count),
      rangeText,
      timeLabels,
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
  }, [rawBookings, servicesList, bookingServices, activeFilter, providerHours, petTypeFilter, customDateStart, customDateEnd, selectedYear, listingApprovedDate]);

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

      const fileName = `Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
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
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
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
              <select className="filter-dropdown" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
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
                <span>Generate Sales Report</span>
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

            {/* ============================================ */}
            {/* TOP CHARTS GRID: OVERALL SALES & REVENUE LOSS */}
            {/* ============================================ */}
            <div className="sales-charts-grid">
              
              <div className="chart-box">
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
                <p className="chart-insight-text">
                  Total Revenue: ₱{formatCurrency(analytics.totalRevenue)}
                </p>
              </div>

              <div className="chart-box">
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
                            label: function(context) {
                              let label = context.dataset.label || '';
                              if (label) label += ': ';
                              if (context.parsed.y !== null) {
                                label += '₱' + formatCurrency(context.parsed.y);
                              }
                              return label;
                            },
                            afterLabel: function(context) {
                              if (context.datasetIndex === 0) {
                                const cancellations = analytics.cancellationsPerPeriod[context.dataIndex];
                                const loss = analytics.potentialRevenue[context.dataIndex] - analytics.actualRevenue[context.dataIndex];
                                return [
                                  `Cancellations: ${cancellations}`,
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
                <p className="chart-insight-text">
                  Total Loss: ₱{formatCurrency(analytics.totalLoss)}
                </p>
              </div>

            </div>

            {/* ============================================ */}
            {/* BOTTOM CHARTS GRID: NEW/RETURNING & SALES BY SERVICE */}
            {/* ============================================ */}
            <div className="sales-charts-grid">
              
              <div className="chart-box">
                <div className="chart-header-with-btn">
                  <h4 className="chart-title-sm">New vs Returning Customer Revenue</h4>
                  <span className="date-range-topright">
                    {activeFilter === 'yearly' && selectedYear 
                      ? `Year ${selectedYear}` 
                      : analytics.rangeText}
                  </span>
                </div>
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

              <div className="chart-box">
                <div className="chart-header-with-btn">
                  <h4 className="chart-title-sm">Sales Performance by Service</h4>
                  <span className="date-range-topright">
                    {activeFilter === 'yearly' && selectedYear 
                      ? `Year ${selectedYear}` 
                      : analytics.rangeText}
                  </span>
                </div>
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
                          serviceId: serviceId
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
            <div className="report-modal-header">
              <div className="report-header-title">
                <FaFileAlt size={20} />
                <h2>Sales Report</h2>
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
                      ? `${selectedYear} Yearly Sales Summary`
                      : `${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Sales Summary`}
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
                    <span className="report-kpi-label">Revenue Loss</span>
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

              <div className="report-section">
                <h3 className="report-section-title">Customer Segmentation</h3>
                <div className="pet-distribution">
                  <div className="pet-dist-item">
                    <span className="pet-type">New Customers</span>
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