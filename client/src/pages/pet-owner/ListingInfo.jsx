import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom"; 
import { supabase } from "../../config/supabase";
import { 
  MapPin, X, ChevronDown, 
  ChevronLeft, ChevronRight, Clock, 
  Facebook, Instagram, Globe, ExternalLink,
  Calendar as CalendarIcon, Users, User,
  AlertCircle
} from "lucide-react";
import LocationPicker from "../../components/Map/LocationPicker";
import { FaStar, FaStarHalfAlt, FaRegStar } from "react-icons/fa";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./ListingInfo.css";


// Helper for a Read-Only Map Preview
const MapPreview = ({ lat, lng, businessName }) => {
  if (!lat || !lng) return (
    <div className="no-map-data">
      <MapPin size={24} className="no-map-icon" />
      <p>Location coordinates not yet pinned by provider.</p>
    </div>
  );

  return (
    <div className="listing-map-group">
      <div className="map-container-300">
        <LocationPicker 
          key={`${lat}-${lng}`} 
          lat={lat} 
          lng={lng} 
          onLocationChange={() => {}} 
          previewOnly={true} 
        />
      </div>
      <div className="coord-badge-row">
        <span className="coord-tag"><b>Lat:</b> {parseFloat(lat).toFixed(6)}</span>
        <span className="coord-tag"><b>Long:</b> {parseFloat(lng).toFixed(6)}</span>
      </div>
    </div>
  );
};

// --- CUSTOM CALENDAR COMPONENT ---
const BookingCalendar = ({ selectedDate, onDateSelect, providerHours }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isDateSelectable = (day) => {
    const dateToCheck = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateToCheck <= today) return false;
    if (!providerHours || providerHours.length === 0) return false;
    const dayName = dateToCheck.toLocaleDateString('en-US', { weekday: 'long' });
    return providerHours.some(h => h.day_of_week === dayName);
  };

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isSelectable = isDateSelectable(d);
      const isSelected = selectedDate && 
        selectedDate.getDate() === d &&
        selectedDate.getMonth() === month &&
        selectedDate.getFullYear() === year;
      days.push(
        <div 
          key={d} 
          className={`cal-day ${isSelected ? 'selected' : ''} ${!isSelectable ? 'disabled' : ''}`}
          onClick={() => isSelectable && onDateSelect(new Date(year, month, d))}
        >
          <span className="day-num">{d}</span>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="custom-calendar-wrapper">
      <div className="cal-nav">
        <button type="button" onClick={handlePrevMonth}><ChevronLeft size={18}/></button>
        <span className="cal-month-title">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" onClick={handleNextMonth}><ChevronRight size={18}/></button>
      </div>
      <div className="cal-grid-header">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      <div className="cal-grid">
        {renderDays()}
      </div>
    </div>
  );
};

// --- Image Modal (Carousel) ---
const ImageModal = ({ isOpen, onClose, images, currentIndex, onNext, onPrev }) => {
  if (!isOpen || !images || images.length === 0) return null;
  const safeIndex = (currentIndex >= 0 && currentIndex < images.length) ? currentIndex : 0;
  const currentUrl = images[safeIndex]?.image_url;
  return (
    <div className="image-modal-overlay" onClick={onClose}>
      <button className="image-modal-close" onClick={onClose}><X size={24} color="#153e75" /></button>
      {images.length > 1 && (
        <button className="image-nav-btn prev" onClick={(e) => { e.stopPropagation(); onPrev(); }}>
          <ChevronLeft size={32} />
        </button>
      )}
      <img src={currentUrl} alt="Full view" onClick={(e) => e.stopPropagation()} className="image-modal-img"/>
      {images.length > 1 && (
        <button className="image-nav-btn next" onClick={(e) => { e.stopPropagation(); onNext(); }}>
          <ChevronRight size={32} />
        </button>
      )}
    </div>
  );
};

// --- Star Rating Helper ---
const StarRating = ({ rating, size = 14 }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      stars.push(<FaStar key={i} size={size} color="#facc15" />);
    } else if (i - 0.5 <= rating) {
      stars.push(<FaStarHalfAlt key={i} size={size} color="#facc15" />);
    } else {
      stars.push(<FaRegStar key={i} size={size} color="#cbd5e1" />);
    }
  }
  return <div className="stars-wrapper">{stars}</div>;
};

const ListingInfo = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [user, setUser] = useState(null); 
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [hours, setHours] = useState([]);
  const [images, setImages] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ count: 0, overall: 0, service: 0, staff: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  
  // --- BOOKING STATES ---
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const TERMS_URL = "https://mdhudfatvdipxwufcbis.supabase.co/storage/v1/object/public/agreements/terms_po.pdf";
  const [bookingDate, setBookingDate] = useState(null);
  const [bookingTime, setBookingTime] = useState("");
  const [numberOfPets, setNumberOfPets] = useState(0);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [dateError, setDateError] = useState(null);
  const [bookingError, setBookingError] = useState(null);

  // --- EXISTING BOOKING MODAL STATES (Same Provider) ---
  const [showExistingBookingModal, setShowExistingBookingModal] = useState(false);
  const [existingUserBookings, setExistingUserBookings] = useState([]); 

  // --- DIFFERENT PROVIDER BOOKING MODAL STATES ---
  const [showDiffProviderModal, setShowDiffProviderModal] = useState(false);
  const [existingDiffProviderBookings, setExistingDiffProviderBookings] = useState([]); // Changed to an array

  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const [existingBookings, setExistingBookings] = useState([]);

  useEffect(() => {
    const fetchDateBookings = async () => {
      if (!bookingDate || !id) return;
      const dateStr = bookingDate.toLocaleDateString('en-CA');
      const { data, error } = await supabase
        .from("bookings")
        .select("time_slot, status, booking_pets(id)")
        .eq("provider_id", id)
        .eq("booking_date", dateStr)
        .not("status", "in", '("cancelled", "declined", "rejected", "void", "voided")');
      if (!error) setExistingBookings(data || []);
    };
    fetchDateBookings();
  }, [bookingDate, id]);

  // 1. Fetch User & Data
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      await fetchAllData();
    };
    init();
  }, [id]);

  // 2. LOAD DRAFT FROM SESSION
  useEffect(() => {
    const loadDraft = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && id) {
        const storageKey = `booking_draft_${user.id}_${id}`;
        const savedDraft = sessionStorage.getItem(storageKey);
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            if (parsed.date) {
              const draftDate = new Date(parsed.date);
              if (!isNaN(draftDate.getTime())) setBookingDate(draftDate);
            }
            if (parsed.time) setBookingTime(parsed.time);
            if (parsed.pets) setNumberOfPets(parseInt(parsed.pets, 10));
          } catch (e) { console.error("Failed to parse booking draft", e); }
        } else if (location.state) {
          if (location.state.bookingDate) setBookingDate(new Date(location.state.bookingDate));
          if (location.state.bookingTime) setBookingTime(location.state.bookingTime);
          if (location.state.numberOfPets) setNumberOfPets(parseInt(location.state.numberOfPets, 10));
        }
      }
    };
    loadDraft();
  }, [id, location.state]);

  // 3. AUTO-GENERATE TIME SLOTS with Capacity Validation
  useEffect(() => {
    setAvailableTimeSlots([]);
    if (!bookingDate || hours.length === 0) return;
    const dayName = bookingDate.toLocaleDateString('en-US', { weekday: 'long' });
    const workingDay = hours.find(h => h.day_of_week === dayName);
    if (workingDay) {
      const slots = [];
      const start = new Date(`2000-01-01T${workingDay.start_time}`);
      const end = new Date(`2000-01-01T${workingDay.end_time}`);
      const interval = parseInt(workingDay.slot_interval_minutes) || 60;
      const capacity = parseInt(workingDay.slot_capacity) || 1;
      while (start < end) {
        const timeValue = start.toTimeString().split(' ')[0];
        const displayLabel = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const bookingsAtThisTime = existingBookings.filter(b => b.time_slot === timeValue);
        const totalPetsOccupied = bookingsAtThisTime.reduce((sum, b) => sum + (b.booking_pets?.length || 0), 0);
        const remainingSpace = capacity - totalPetsOccupied;
        const requestedPets = parseInt(numberOfPets, 10) || 0;
        let slotStatus = "available";
        if (remainingSpace <= 0) { slotStatus = "full"; }
        else if (requestedPets > 0 && requestedPets > remainingSpace) { slotStatus = "insufficient_space"; }
        slots.push({ value: timeValue, label: displayLabel, status: slotStatus, remaining: Math.max(0, remainingSpace) });
        start.setMinutes(start.getMinutes() + interval);
      }
      setAvailableTimeSlots(slots);
    }
  }, [bookingDate, hours, existingBookings, numberOfPets]); 

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const { data: providerData, error: pError } = await supabase
        .from("service_providers")
        .select("*, waiver_url") 
        .eq("id", id)
        .eq("status", "approved")
        .single();
      if (pError) throw pError;
      setProvider(providerData || null);
      const { data: servicesData } = await supabase.from("services").select(`*, service_options (*)`).eq("provider_id", id);
      setServices(servicesData || []);
      const { data: hoursData } = await supabase.from("service_provider_hours").select("*").eq("provider_id", id);
      setHours(hoursData || []);
      const { data: imagesData } = await supabase.from("service_provider_images").select("*").eq("provider_id", id);
      setImages(imagesData || []);
      const { data: reviewsData } = await supabase
        .from("reviews").select("*").eq("provider_id", id).order("created_at", { ascending: false });
      if (reviewsData && reviewsData.length > 0) {
        setReviews(reviewsData);
        const total = reviewsData.length;
        const avgService = reviewsData.reduce((acc, r) => acc + r.rating_overall, 0) / total;
        const avgStaff = reviewsData.reduce((acc, r) => acc + r.rating_staff, 0) / total;
        setReviewStats({ count: total, overall: (avgService + avgStaff) / 2, service: avgService, staff: avgStaff });
      } else {
        setReviews([]);
        setReviewStats({ count: 0, overall: 0, service: 0, staff: 0 });
      }
    } catch (error) { console.error("Error fetching data:", error); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!id) return;
    const bookingsChannel = supabase
      .channel('booking-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `provider_id=eq.${id}` }, 
        (payload) => { console.log("Real-time update received:", payload); fetchDateBookings(); })
      .subscribe();
    return () => { supabase.removeChannel(bookingsChannel); };
  }, [id, bookingDate]);

  const formatTime = (time) => {
    if (!time) return "";
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getSocialIcon = (url) => {
    if (!url) return null;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('facebook')) return <Facebook size={24} className="social-icon fb" />;
    if (lowerUrl.includes('instagram')) return <Instagram size={24} className="social-icon insta" />;
    return <Globe size={24} className="social-icon globe" />;
  };

  const getImageGridClass = () => {
    const count = images.length;
    if (count === 0) return 'images-0';
    if (count === 1) return 'images-1';
    if (count === 2) return 'images-2';
    return 'images-3'; 
  };

  const handleDateChange = (date) => {
    setBookingDate(date);
    setDateError(null);
    setBookingTime(""); 
  };

  // --- Navigate to pet details ---
  const proceedToBooking = () => {
    const dateStr = bookingDate.toLocaleDateString('en-CA');
    navigate('/pet-details', {
      state: {
        providerId: id,
        providerName: provider.business_name,
        bookingDate: dateStr,
        bookingTime,
        numberOfPets: parseInt(numberOfPets, 10)
      }
    });
  };

  // --- Check for conflicts with a DIFFERENT provider on the SAME date ---
  const checkDiffProviderAndProceed = async () => {
    setLoading(true);
    const dateStr = bookingDate.toLocaleDateString('en-CA');
    
    try {
      const { data: diffBookings, error: diffError } = await supabase
        .from("bookings")
        .select("id, time_slot, status")
        .eq("user_id", user.id)
        .eq("booking_date", dateStr)
        .neq("provider_id", id) // Checking for different providers
        .in("status", ["pending", "approved"]) // ONLY pending or approved
        // Removed .limit(1) to get all conflicts on this date
        ;

      if (diffError) throw diffError;

      if (diffBookings && diffBookings.length > 0) {
        setExistingDiffProviderBookings(diffBookings);
        setShowDiffProviderModal(true);
        setLoading(false);
        return;
      }

      // If no conflict, proceed immediately
      proceedToBooking();
    } catch (err) {
      console.error("Error checking different provider conflicts:", err);
      setBookingError("Unable to verify schedule. Please try again.");
      setLoading(false);
    }
  };

  const handleCompleteBooking = async () => {
    setBookingError(null);
    setDateError(null);

    if (!user) { setBookingError("You must be logged in to book."); return; }
    if (!bookingDate) { setDateError("Please select a date."); return; }
    if (!bookingTime) { setBookingError("Please select a time slot."); return; }
    if (!agreedToTerms) { setBookingError("Please agree to the Terms and Conditions to proceed."); return; }

    const petCount = parseInt(numberOfPets, 10);
    if (isNaN(petCount) || petCount < 1) { setBookingError("Please enter a valid number of pets."); return; }

    try {
      setLoading(true);

      // 1. Fresh slot capacity check
      const dateStr = bookingDate.toLocaleDateString('en-CA');
      const { data: freshBookings, error } = await supabase
        .from("bookings")
        .select("id, booking_pets(id)") 
        .eq("provider_id", id)
        .eq("booking_date", dateStr)
        .eq("time_slot", bookingTime)
        .not("status", "in", '("cancelled", "declined", "rejected", "void", "voided")');

      if (error) throw error;

      const dayName = bookingDate.toLocaleDateString('en-US', { weekday: 'long' });
      const workingDay = hours.find(h => h.day_of_week === dayName);
      const maxCapacity = workingDay ? parseInt(workingDay.slot_capacity) : 1;
      const actualPetsOccupied = freshBookings?.reduce((sum, b) => sum + (b.booking_pets?.length || 0), 0) || 0;
      const finalRemaining = maxCapacity - actualPetsOccupied;

      if (petCount > finalRemaining) {
        setBookingError(`Conflict: Only ${Math.max(0, finalRemaining)} slot(s) left. Someone else may have just booked.`);
        setExistingBookings(freshBookings);
        setLoading(false);
        return;
      }

      // 2. Check Same Provider logic (Fetch active bookings that are ONLY pending or approved)
      const { data: userExistingBookings, error: existingError } = await supabase
        .from("bookings")
        .select("id, booking_date, time_slot, status")
        .eq("user_id", user.id)
        .eq("provider_id", id)
        .in("status", ["pending", "approved"]) // ONLY pending or approved
        .order("created_at", { ascending: false });

      if (existingError) throw existingError;

      if (userExistingBookings && userExistingBookings.length > 0) {
        setExistingUserBookings(userExistingBookings);
        setLoading(false);
        setShowExistingBookingModal(true);
        return;
      }

      // 3. If passed capacity & same provider checks, run different provider checks
      await checkDiffProviderAndProceed();

    } catch (err) {
      console.error("Booking verification error:", err);
      setBookingError("Unable to verify availability. Please try again.");
      setLoading(false);
    }
  };

  // --- EXISTING BOOKING MODAL (Same Provider) ---
  const ExistingBookingModal = () => {
    if (!showExistingBookingModal) return null;

    const getStatusClass = (status) => {
      if (status === 'pending') return 'eb-status-badge eb-status-pending';
      if (status === 'confirmed' || status === 'approved') return 'eb-status-badge eb-status-confirmed';
      return 'eb-status-badge eb-status-default';
    };

    const bookingCount = existingUserBookings?.length || 0;
    const isMultiple = bookingCount > 1;
    const singleBooking = bookingCount === 1 ? existingUserBookings[0] : null;

    return (
      <div className="eb-modal-overlay" onClick={() => setShowExistingBookingModal(false)}>
        <div className="eb-modal-card" onClick={(e) => e.stopPropagation()}>

          <button className="eb-close-btn" onClick={() => setShowExistingBookingModal(false)}>
            <X size={16} />
          </button>

          <div className="eb-icon-wrapper">
            <AlertCircle size={32} color="#d97706" />
          </div>

          <h3 className="eb-title">Existing Booking Found</h3>

          <p className="eb-subtitle">
            {isMultiple 
              ? <>You have multiple active bookings with <strong className="eb-provider-name">{provider?.business_name}</strong>.</>
              : <>You already have an active booking with <strong className="eb-provider-name">{provider?.business_name}</strong>.</>
            }
          </p>

          {isMultiple ? (
            <div className="eb-details-card" style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
              <span style={{ fontSize: '1rem', color: '#153e75', fontWeight: '500', textAlign: 'center' }}>
                You currently have <strong style={{ fontSize: '1.2rem', color: '#2563eb', padding: '0 4px' }}>{bookingCount}</strong> active appointments.
              </span>
            </div>
          ) : singleBooking ? (
            <div className="eb-details-card">
              <div className="eb-detail-row">
                <span className="eb-detail-label">📅 Date</span>
                <span className="eb-detail-value">{formatDate(singleBooking.booking_date)}</span>
              </div>
              <div className="eb-divider" />
              <div className="eb-detail-row">
                <span className="eb-detail-label">🕐 Time</span>
                <span className="eb-detail-value">{formatTime(singleBooking.time_slot)}</span>
              </div>
              <div className="eb-divider" />
              <div className="eb-detail-row">
                <span className="eb-detail-label">📋 Status</span>
                <span className={getStatusClass(singleBooking.status)}>
                  {singleBooking.status}
                </span>
              </div>
            </div>
          ) : null}

          <p className="eb-warning-note">
            Would you still like to book another appointment with this provider?
          </p>

          <div className="eb-actions">
            <button className="eb-btn-cancel" onClick={() => setShowExistingBookingModal(false)}>
              Cancel
            </button>
            <button 
              className="eb-btn-view" 
              onClick={() => navigate('/appointments')}
            >
              View Appointments
            </button>
            <button
              className="eb-btn-continue"
              onClick={() => { setShowExistingBookingModal(false); checkDiffProviderAndProceed(); }}
            >
              Continue Anyway
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- DIFFERENT PROVIDER CONFLICT MODAL (Same Date) ---
  const DiffProviderModal = () => {
    if (!showDiffProviderModal) return null;

    const getStatusClass = (status) => {
      if (status === 'pending') return 'eb-status-badge eb-status-pending';
      if (status === 'confirmed' || status === 'approved') return 'eb-status-badge eb-status-confirmed';
      return 'eb-status-badge eb-status-default';
    };

    const bookingCount = existingDiffProviderBookings?.length || 0;
    const isMultiple = bookingCount > 1;
    const singleBooking = bookingCount === 1 ? existingDiffProviderBookings[0] : null;

    return (
      <div className="eb-modal-overlay" onClick={() => setShowDiffProviderModal(false)}>
        <div className="eb-modal-card" onClick={(e) => e.stopPropagation()}>

          <button className="eb-close-btn" onClick={() => setShowDiffProviderModal(false)}>
            <X size={16} />
          </button>

          <div className="eb-icon-wrapper">
            <AlertCircle size={32} color="#d97706" />
          </div>

          <h3 className="eb-title">Schedule Conflict Warning</h3>

          <p className="eb-subtitle">
            {isMultiple
              ? <>You already have multiple active appointments on this exact date with <strong>different providers</strong>.</>
              : <>You already have an active appointment on this exact date with a <strong>different provider</strong>.</>
            }
          </p>

          {isMultiple ? (
            <div className="eb-details-card" style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
              <span style={{ fontSize: '1rem', color: '#153e75', fontWeight: '500', textAlign: 'center' }}>
                You currently have <strong style={{ fontSize: '1.2rem', color: '#2563eb', padding: '0 4px' }}>{bookingCount}</strong> active appointments on this date.
              </span>
            </div>
          ) : singleBooking ? (
            <div className="eb-details-card">
              <div className="eb-detail-row">
                <span className="eb-detail-label">📅 Date</span>
                <span className="eb-detail-value">{formatDate(bookingDate.toLocaleDateString('en-CA'))}</span>
              </div>
              <div className="eb-divider" />
              <div className="eb-detail-row">
                <span className="eb-detail-label">🕐 Time</span>
                <span className="eb-detail-value">{formatTime(singleBooking.time_slot)}</span>
              </div>
              <div className="eb-divider" />
              <div className="eb-detail-row">
                <span className="eb-detail-label">📋 Status</span>
                <span className={getStatusClass(singleBooking.status)}>
                  {singleBooking.status}
                </span>
              </div>
            </div>
          ) : null}

          <p className="eb-warning-note">
            Are you sure you want to proceed and double-book your schedule?
          </p>

          <div className="eb-actions">
            <button className="eb-btn-cancel" onClick={() => setShowDiffProviderModal(false)}>
              Cancel
            </button>
            <button 
              className="eb-btn-view" 
              onClick={() => navigate('/appointments')}
            >
              View Appointments
            </button>
            <button
              className="eb-btn-continue"
              onClick={() => { setShowDiffProviderModal(false); proceedToBooking(); }}
            >
              Continue Anyway
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ServicesList = () => (
    <>
      {services.length > 0 ? services.map(service => (
        <div key={service.id} className="service-section">
          <div className="service-header">
            <h3 className="service-name">{service.name}</h3>
            <span className={`service-type-badge ${service.type}`}>{service.type}</span>
          </div>
          {service.description && <p className="service-description">{service.description}</p>}
          {service.service_options && (
            <div className="pricing-wrapper">
              <table className="pricing-table">
                <thead><tr><th>Type</th><th>Size</th><th>Weight (kg)</th><th>Price</th></tr></thead>
                <tbody>
                  {service.service_options.map(opt => (
                    <tr key={opt.id}>
                      <td className="td-capitalize">{opt.pet_type === 'dog-cat' ? 'Dog & Cat' : opt.pet_type}</td>
                      <td>{opt.size.replace('_', ' ')}</td>
                      <td>{opt.weight_range || '-'}</td>
                      <td>₱{parseFloat(opt.price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )) : <p className="no-services-text">No services listed.</p>}
    </>
  );

  if (loading && !provider) return (
    <div className="listing-info-page">
      <Header />
      <main className="listing-container"><p className="loading-text">Loading...</p></main>
      <Footer />
    </div>
  );

  if (!provider && !loading) return (
    <div className="listing-info-page">
      <Header />
      <main className="listing-container"><p className="loading-text">Provider not found.</p></main>
      <Footer />
    </div>
  );

  const isBookingDisabled = !bookingDate || !bookingTime || parseInt(numberOfPets, 10) < 1 || !agreedToTerms || loading;

  return (
    <div className="listing-info-page">
      <Header />
      <main className="listing-container">
        
        <div className="listing-main-content">
          <div className="listing-tabs">
            {["overview", "prices", "location", "reviews"].map(tab => (
              <button key={tab} className={`tab-button ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {images.length > 0 ? (
            <div className={`listing-images ${getImageGridClass()}`}>
              <div className="main-image-placeholder" onClick={() => setSelectedImageIndex(0)}>
                <img src={images[0].image_url} alt="Main facility"/>
              </div>
              {images.length === 2 ? (
                <div className="main-image-placeholder" onClick={() => setSelectedImageIndex(1)}>
                  <img src={images[1].image_url} alt="Facility 2"/>
                </div>
              ) : images.length >= 3 ? (
                <div className="thumbnail-grid">
                  {images.slice(1, 3).map((img, index) => (
                    <div key={img.id} className="thumbnail-placeholder" onClick={() => setSelectedImageIndex(index + 1)}>
                      <img src={img.image_url} alt={`Facility ${index + 2}`}/>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : <div className="listing-images"><div className="no-images-message">No images available</div></div>}

          <div className="listing-content">

            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <div className="tab-content">
                <div className="listing-header-row">
                  <h1 className="listing-title">{provider.business_name}</h1>
                  {provider.social_media_url && (
                    <a href={provider.social_media_url} target="_blank" rel="noopener noreferrer" className="social-link-inline">
                      {getSocialIcon(provider.social_media_url)}
                    </a>
                  )}
                </div>
                <div className="location-info-block">
                  <div className="listing-full-location listing-full-location--mb">
                    <MapPin size={24} className="text-primary"/>
                    <a
                      href={provider.google_map_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`location-link location-link--lg ${!provider.google_map_url ? 'disabled' : ''}`}
                    >
                      {`${provider.house_street}, ${provider.barangay}, ${provider.city}, ${provider.province}, ${provider.country} ${provider.postal_code}`}
                      {provider.google_map_url && <ExternalLink size={16} className="external-link-icon"/>}
                    </a>
                  </div>
                  <div className="info-section">
                    <h3 className="subsection-title">Shop Location</h3>
                    <div className="map-container-overview">
                      <LocationPicker 
                        lat={provider.latitude} 
                        lng={provider.longitude} 
                        onLocationChange={() => {}} 
                        previewOnly={true} 
                      />
                    </div>
                  </div>
                </div>
                <div className="info-section">
                  <p className="shop-description">{provider.description || <span className="italic-gray">No description provided.</span>}</p>
                </div>
                <div className="info-section">
                  <h3 className="subsection-title">Operating Hours</h3>
                  <div className="hours-horizontal-container">
                    {daysOrder.map((day) => {
                      const dayHours = hours.filter(h => h.day_of_week === day);
                      const isOpen = dayHours.length > 0;
                      return (
                        <div key={day} className={`hour-card ${isOpen ? 'open' : 'closed'}`}>
                          <div className="hour-header"><Clock size={14} /><span>{day}</span></div>
                          <div className="hour-body">
                            {isOpen ? (
                              dayHours.map((h, i) => (
                                <div key={i} className="time-badge">{formatTime(h.start_time)} - {formatTime(h.end_time)}</div>
                              ))
                            ) : <span className="closed-text">Closed</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="info-section service-prices-section">
                  <h3 className="subsection-title">Service Prices</h3>
                  <p className="vat-note">* VAT inclusive</p>
                  <ServicesList />
                </div>
              </div>
            )}

            {/* ── PRICES TAB ── */}
            {activeTab === "prices" && (
              <div className="tab-content">
                <h2 className="section-title">Service Prices</h2>
                <p className="vat-note">* VAT exclusive</p>
                <ServicesList />
              </div>
            )}
            
            {/* ── LOCATION TAB ── */}
            {activeTab === "location" && (
              <div className="tab-content">
                <h2 className="section-title">Location Details</h2>
                <div className="location-info-card">
                  <div className="location-address-header">
                    <MapPin size={24} className="text-primary" />
                    <p className="location-address-text">
                      <strong>{provider.business_name}</strong><br/>
                      {`${provider.house_street}, ${provider.barangay}, ${provider.city}, ${provider.province}`}
                    </p>
                  </div>
                  <div className="map-container-300">
                    <LocationPicker 
                      lat={provider.latitude} 
                      lng={provider.longitude} 
                      onLocationChange={() => {}} 
                      previewOnly={true} 
                    />
                  </div>
                  <div className="coord-badge-row">
                    <span className="coord-tag">Lat: {parseFloat(provider.latitude).toFixed(6)}</span>
                    <span className="coord-tag">Long: {parseFloat(provider.longitude).toFixed(6)}</span>
                  </div>
                  {provider.google_map_url && (
                    <a href={provider.google_map_url} target="_blank" rel="noopener noreferrer" className="external-map-btn">
                      Open in Google Maps <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            )}
            
            {/* ── REVIEWS TAB ── */}
            {activeTab === "reviews" && (
              <div className="tab-content">
                <h2 className="section-title">Reviews</h2>
                {reviewStats.count > 0 ? (
                  <div className="reviews-container">
                    <div className="review-summary-card">
                      <div className="summary-main">
                        <span className="summary-score">{reviewStats.overall.toFixed(1)}</span>
                        <div className="summary-stars"><StarRating rating={reviewStats.overall} size={24} /></div>
                        <span className="summary-count">{reviewStats.count} Reviews</span>
                      </div>
                      <div className="summary-details">
                        <div className="detail-row">
                          <span className="detail-label">Service</span>
                          <div className="detail-bar-container">
                            <div className="detail-bar-fill" style={{width: `${(reviewStats.service / 5) * 100}%`}}></div>
                          </div>
                          <span className="detail-score-text">{reviewStats.service.toFixed(1)}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Staff</span>
                          <div className="detail-bar-container">
                            <div className="detail-bar-fill" style={{width: `${(reviewStats.staff / 5) * 100}%`}}></div>
                          </div>
                          <span className="detail-score-text">{reviewStats.staff.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="reviews-list">
                      {reviews.map((review) => (
                        <div key={review.id} className="review-card">
                          <div className="review-header">
                            <div className="review-user-avatar"><User size={20} color="#153e75" /></div>
                            <div className="review-meta">
                              <span className="review-user-name">Pet Owner</span>
                              <span className="review-date">{formatDate(review.created_at)}</span>
                            </div>
                            <div className="review-stars-display">
                              {(() => {
                                const avgRating = (review.rating_overall + review.rating_staff) / 2;
                                return (
                                  <>
                                    <StarRating rating={avgRating} size={14} />
                                    <span className="rating-decimal-text">{avgRating.toFixed(1)}</span>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="review-body">
                            {review.comment
                              ? <p className="review-text">{review.comment}</p>
                              : <p className="review-text-empty">No comment provided.</p>}
                          </div>
                          <div className="review-footer">
                            <div className="mini-rating"><span>Service: </span> <b>{review.rating_overall}/5</b></div>
                            <div className="mini-rating"><span>Staff: </span> <b>{review.rating_staff}/5</b></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="no-reviews-container">
                    <p>No reviews yet for this provider.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── BOOKING SIDEBAR ── */}
        <div className="booking-sidebar">
          <h3 className="booking-header">Book Appointment</h3>
          
          {bookingError && <div className="booking-error">{bookingError}</div>}

          <div className="booking-field">
            <label className="booking-label">
              <CalendarIcon size={14} className="label-icon"/>
              Select Date
            </label>
            <BookingCalendar selectedDate={bookingDate} onDateSelect={handleDateChange} providerHours={hours}/>
            {dateError && <span className="field-error-text">{dateError}</span>}
          </div>

          <div className="booking-field">
            <label className="booking-label">
              <Clock size={14} className="label-icon"/>
              Select Time Slot
            </label>
            <div className="booking-select-wrapper">
              <select 
                value={bookingTime} 
                onChange={(e) => setBookingTime(e.target.value)} 
                className="booking-select"
                disabled={!bookingDate || availableTimeSlots.length === 0}
              >
                <option value="">{availableTimeSlots.length > 0 ? "Select Time" : "No slots available"}</option>
                {availableTimeSlots.map((slot, idx) => {
                  const isFull = slot.status === "full";
                  const isTooSmall = slot.status === "insufficient_space";
                  const isRisk = slot.status === "clash_risk";
                  return (
                    <option key={idx} value={slot.value} disabled={isFull || isTooSmall}>
                      {slot.label} 
                      {isFull ? " (Fully Booked)" : 
                       isTooSmall ? ` (Only ${slot.remaining} left)` : 
                       isRisk ? ` (${slot.remaining} left - Pending SP Approval)` : 
                       ` (Available Slots: ${slot.remaining})`}
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={20} className="booking-select-icon" />
            </div>
          </div>

          <div className="booking-field">
            <label className="booking-label">
              <Users size={14} className="label-icon"/>
              Number of Pets
            </label>
            <input 
              type="number" 
              min="1"
              max={bookingTime ? 
                (hours.find(h => h.day_of_week === bookingDate?.toLocaleDateString('en-US', { weekday: 'long' }))?.slot_capacity || 1) - 
                existingBookings.filter(b => b.time_slot === bookingTime).length 
                : 10
              }
              value={numberOfPets} 
              onChange={(e) => setNumberOfPets(e.target.value)} 
              className="booking-date-input booking-date-input--full"
            />
            {bookingTime && (
              <span className="slots-available-hint">
                Available slots for this time: {
                  (hours.find(h => h.day_of_week === bookingDate?.toLocaleDateString('en-US', { weekday: 'long' }))?.slot_capacity || 1) - 
                  existingBookings.filter(b => b.time_slot === bookingTime).length
                }
              </span>
            )}
          </div>

          <div className="booking-field">
            <div className="terms-checkbox-container">
              <input 
                type="checkbox" 
                id="booking-terms" 
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
              <label htmlFor="booking-terms">
                I agree to the <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">Terms and Conditions</a> 
                including policies on <strong>down payments, cancellations, and pet safety</strong>
                {provider.waiver_url ? (
                  <> 
                    and to the <strong>{provider.business_name}</strong>{" "}
                    <a href={`https://docs.google.com/gview?url=${encodeURIComponent(provider.waiver_url)}&embedded=true`} target="_blank" rel="noopener noreferrer">
                      waiver
                    </a>.
                  </>
                ) : "."}
              </label>
            </div>
          </div>

          <button onClick={handleCompleteBooking} className="booking-button" disabled={isBookingDisabled}>
            {loading ? "Verifying..." : "Complete Booking"}
          </button>
        </div>
      </main>

      {/* ── MODALS ── */}
      <ExistingBookingModal />
      <DiffProviderModal />
    
      <ImageModal 
        isOpen={selectedImageIndex !== null} 
        onClose={() => setSelectedImageIndex(null)} 
        images={images} 
        currentIndex={selectedImageIndex} 
        onNext={() => setSelectedImageIndex((prev) => (prev + 1) % images.length)} 
        onPrev={() => setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length)}
      />

      <Footer />
    </div>
  );
};

export default ListingInfo;