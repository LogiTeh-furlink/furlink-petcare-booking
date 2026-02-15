import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCaretUp, FaCaretDown, FaMinus, FaStar, FaFileAlt, FaTimes, FaDownload, FaArrowLeft } from 'react-icons/fa';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { loadFilters, saveFilters } from '../../utils/filterUtils';
import './SPCustomerInsight.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend);

// Helper: Format currency with 2 decimal places
const formatCurrency = (value) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SPCustomerInsight() {
  const navigate = useNavigate();
  const reportRef = useRef(null);
  const [activeTab] = useState('customer_insights');
  
  // Filter states - Load from localStorage
  const savedFilters = loadFilters();
  const [activeFilter, setActiveFilter] = useState(savedFilters.activeFilter);
  const [petTypeFilter, setPetTypeFilter] = useState(savedFilters.petTypeFilter);
  const [customDateStart, setCustomDateStart] = useState(savedFilters.customDateStart);
  const [customDateEnd, setCustomDateEnd] = useState(savedFilters.customDateEnd);
  
  // Data states
  const [loading, setLoading] = useState(true);
  const [rawBookings, setRawBookings] = useState([]);
  const [rawReviews, setRawReviews] = useState([]); 
  const [listingVisitors, setListingVisitors] = useState(0);
  const [providerServiceSizes, setProviderServiceSizes] = useState([]); 
  const [profilesMap, setProfilesMap] = useState({}); // Stores { userId: profileData }
  const [showReportModal, setShowReportModal] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [listingApprovedDate, setListingApprovedDate] = useState(null);

  // Save filters to localStorage on change
  useEffect(() => {
    saveFilters({
      activeFilter,
      petTypeFilter,
      customDateStart,
      customDateEnd,
      selectedYear: null 
    });
  }, [activeFilter, petTypeFilter, customDateStart, customDateEnd]);

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

  // ============================================
  // PDF DOWNLOAD FUNCTION (FIXED)
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

      // 1. Clone the element
      const clone = element.cloneNode(true);
      
      // 2. MANUALLY COPY CANVAS CONTENT
      // This is required because cloneNode() does not copy the internal state of <canvas> elements
      const originalCanvases = element.querySelectorAll('canvas');
      const clonedCanvases = clone.querySelectorAll('canvas');

      Array.from(originalCanvases).forEach((orig, index) => {
        const dest = clonedCanvases[index];
        const ctx = dest.getContext('2d');
        // Set dimensions to match original to prevent scaling issues
        dest.width = orig.width;
        dest.height = orig.height;
        // Draw the original canvas image onto the cloned canvas
        ctx.drawImage(orig, 0, 0);
      });

      // 3. Style the clone for PDF generation
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.width = '1000px'; // Fixed width for consistent PDF layout
      clone.style.overflow = 'visible';
      clone.style.maxHeight = 'none';
      clone.style.height = 'auto';
      clone.style.padding = '40px';
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
      const fileName = `Customer_Insight_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Save the PDF
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

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
      const today = new Date(); // Use a fixed 'now'

      // CUSTOM RANGE
      if (filter === 'custom' && customDateStart && customDateEnd) {
        const start = new Date(customDateStart);
        const end = new Date(customDateEnd);
        end.setHours(23, 59, 59, 999); // Ensure end of day
        
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
        // WEEKLY: Rolling 7 Days
        if (isPrevious) {
          start.setDate(today.getDate() - 14);
          end.setDate(today.getDate() - 7);
          end.setHours(23, 59, 59, 999);
        } else {
          start.setDate(today.getDate() - 7);
          end = today;
        }
      } else if (filter === 'monthly') {
        // MONTHLY: Period-to-Date (Fair Comparison)
        if (isPrevious) { 
          start.setMonth(today.getMonth() - 1, 1); 
          
          // Fix: End date is the SAME DAY of previous month
          const daysInPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
          const targetDay = Math.min(today.getDate(), daysInPrevMonth);
          
          end = new Date(today.getFullYear(), today.getMonth() - 1, targetDay);
          end.setHours(23, 59, 59, 999);
        } else { 
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          end = today;
        }
      } else {
        // YEARLY: Year-to-Date (Fair Comparison)
        if (isPrevious) { 
          start = new Date(today.getFullYear() - 1, 0, 1);
          
          // Fix: End date is SAME DATE of previous year
          if (today.getMonth() === 1 && today.getDate() === 29) {
             end = new Date(today.getFullYear() - 1, 1, 28); // Handle leap year
          } else {
             end = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
          }
          end.setHours(23, 59, 59, 999);
        } else { 
          start = new Date(today.getFullYear(), 0, 1);
          end = today;
        }
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

    const isBookingComplete = (b) => {
      // A booking is complete if it's waiting for a review OR if it has already been rated
      return ['for review', 'rated'].includes(b.status);
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
      cancellations: uniqueCancelledBookings.size, 
      avg: uniqueCustomers.size > 0 ? Math.round(current.count / uniqueCustomers.size) : 0, 
      revTrend: getTrend(current.rev, previous.rev), 
      bookTrend: getTrend(current.count, previous.count),
      customerReviewData,
      petSizeData, 
      petTypeData,
      customerTypeData,
      topRebookedCustomers, 
      dogBreedsData,
      petTypeBreakdown
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
            {/* Back to Dashboard Button */}
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
                  <input type="date" className="date-input" value={customDateStart} onChange={(e) => setCustomDateStart(e.target.value)} max={customDateEnd} min={listingApprovedDate} />
                  <label className="date-label">To:</label>
                  <input type="date" className="date-input" value={customDateEnd} onChange={(e) => setCustomDateEnd(e.target.value)} min={listingApprovedDate || customDateStart} />
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

                {/* Comments Section */}
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
                <span>Generate Customer Insight Report</span>
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

      {/* ============================================ */}
      {/* CUSTOMER INSIGHT REPORT MODAL */}
      {/* ============================================ */}
      {showReportModal && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="report-modal-header">
              <div className="report-header-title">
                <FaFileAlt size={20} />
                <h2>Customer Insight Report</h2>
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
                  <span className="report-label">Report Type:</span>
                  <span className="report-value">
                    {activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Customer Insight Summary
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

              {/* Executive Summary */}
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

              {/* Customer Demographics */}
              <div className="report-section">
                <h3 className="report-section-title">Customer Demographics</h3>
                <div className="report-insights">
                  <div className="insight-item">
                    <strong>Pet Type Preference:</strong>
                    <p>
                      {analytics.petTypeData.values[0] > analytics.petTypeData.values[1]
                        ? `Dogs account for ${Math.round((analytics.petTypeData.values[0] / (analytics.petTypeData.values[0] + analytics.petTypeData.values[1])) * 100)}% of bookings, indicating a strong preference for dog services.`
                        : analytics.petTypeData.values[1] > analytics.petTypeData.values[0]
                        ? `Cats account for ${Math.round((analytics.petTypeData.values[1] / (analytics.petTypeData.values[0] + analytics.petTypeData.values[1])) * 100)}% of bookings, indicating a strong preference for cat services.`
                        : 'Dog and cat bookings are evenly balanced.'}
                    </p>
                  </div>
                  <div className="insight-item">
                    <strong>Customer Loyalty:</strong>
                    <p>
                      {analytics.customerTypeData.values[1] > analytics.customerTypeData.values[0]
                        ? `Returning customers make up ${Math.round((analytics.customerTypeData.values[1] / (analytics.customerTypeData.values[0] + analytics.customerTypeData.values[1])) * 100)}% of your customer base, showing strong customer retention.`
                        : `New customers make up ${Math.round((analytics.customerTypeData.values[0] / (analytics.customerTypeData.values[0] + analytics.customerTypeData.values[1])) * 100)}% of your customer base. Focus on retention strategies to convert them into loyal customers.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Top Customers */}
              {analytics.topRebookedCustomers.length > 0 && (
                <div className="report-section">
                  <h3 className="report-section-title">Top Customers</h3>
                  <div className="report-services-list">
                    {analytics.topRebookedCustomers.map((customer, idx) => (
                      <div key={idx} className="service-item">
                        <div className="service-info">
                          <span className="service-rank">#{idx + 1}</span>
                          <span className="service-name">{customer.name}</span>
                        </div>
                        <div className="service-stats">
                          <span className="service-count">{customer.count} bookings</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customer Reviews */}
              <div className="report-section">
                <h3 className="report-section-title">Customer Reviews</h3>
                <div className="pet-distribution">
                  <div className="pet-dist-item">
                    <span className="pet-type">Overall Rating</span>
                    <span className="pet-count">
                      {analytics.customerReviewData.averageRating.toFixed(1)} / 5.0
                    </span>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                      {analytics.customerReviewData.totalReviews} reviews
                    </div>
                  </div>
                  <div className="pet-dist-item">
                    <span className="pet-type">Staff Rating</span>
                    <span className="pet-count">
                      {analytics.customerReviewData.ratings.staff.toFixed(1)} / 5.0
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
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}