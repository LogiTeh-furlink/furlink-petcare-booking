import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom"; 
import { supabase } from "../../config/supabase";
import { 
  MapPin, X, ChevronDown, 
  ChevronLeft, ChevronRight, Clock, 
  Facebook, Instagram, Globe, ExternalLink,
  Calendar as CalendarIcon, Users, User
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
       <MapPin size={24} style={{marginBottom: '8px', opacity: 0.5}}/>
       <p>Location coordinates not yet pinned by provider.</p>
    </div>
  );

  return (
    <div className="listing-map-group">
      <div style={{ height: "300px", width: "100%", position: "relative" }}>
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

  // Check if a specific date is selectable
  const isDateSelectable = (day) => {
    const dateToCheck = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Disable past dates AND today (Changed < to <= to prevent same-day booking)
    if (dateToCheck <= today) return false;

    // 2. Disable if provider is closed on this day of week
    if (!providerHours || providerHours.length === 0) return false;
    const dayName = dateToCheck.toLocaleDateString('en-US', { weekday: 'long' });
    return providerHours.some(h => h.day_of_week === dayName);
  };

  const renderDays = () => {
    const days = [];
    
    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateToCheck = new Date(year, month, d);
      const isSelectable = isDateSelectable(d);
      
      // Check if this specific day is the currently selected one
      const isSelected = selectedDate && 
        selectedDate.getDate() === d &&
        selectedDate.getMonth() === month &&
        selectedDate.getFullYear() === year;

      days.push(
        <div 
          key={d} 
          className={`cal-day ${isSelected ? 'selected' : ''} ${!isSelectable ? 'disabled' : ''}`}
          onClick={() => isSelectable && onDateSelect(dateToCheck)}
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
      stars.push(<FaRegStar key={i} size={size} color="#cbd5e1" />); // Default gray for empty
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

  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const [existingBookings, setExistingBookings] = useState([]);
  useEffect(() => {
    const fetchDateBookings = async () => {
        if (!bookingDate || !id) return;
        const dateStr = bookingDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
        
        const { data, error } = await supabase
            .from("bookings")
            .select("time_slot, status, booking_pets(id)") // Add booking_pets(id) here
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
                        if (!isNaN(draftDate.getTime())) {
                            setBookingDate(draftDate);
                        }
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
        const requestedPets = parseInt(numberOfPets, 10) || 0;

        while (start < end) {
            const timeValue = start.toTimeString().split(' ')[0]; // "12:00:00"
            const displayLabel = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

            // 1. Get ALL active booking records for this specific time slot
            const bookingsAtThisTime = existingBookings.filter(b => b.time_slot === timeValue);

            // 2. Count EVERY record. This ensures 1 booking with 2 pets = 2 slots taken.
            const totalPetsOccupied = bookingsAtThisTime.reduce((sum, b) => 
                sum + (b.booking_pets?.length || 0), 0
            );

            // 3. Calculate remaining based on the SP's specific slot_capacity
            const remainingSpace = capacity - totalPetsOccupied;
            const requestedPets = parseInt(numberOfPets, 10) || 0;

            let slotStatus = "available";
            if (remainingSpace <= 0) {
                slotStatus = "full"; 
            } else if (requestedPets > 0 && requestedPets > remainingSpace) {
                slotStatus = "insufficient_space"; 
            }

            slots.push({ 
                value: timeValue, 
                label: displayLabel, 
                status: slotStatus,
                remaining: Math.max(0, remainingSpace)
            });

            start.setMinutes(start.getMinutes() + interval);
        }
        setAvailableTimeSlots(slots);
    }
}, [bookingDate, hours, existingBookings, numberOfPets]); 
// Added numberOfPets to dependencies so slots update when user changes pet count

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      const { data: providerData } = await supabase.from("service_providers").select("*").eq("id", id).eq("status", "approved").single();
      setProvider(providerData || null);

      const { data: servicesData } = await supabase.from("services").select(`*, service_options (*)`).eq("provider_id", id);
      setServices(servicesData || []);

      const { data: hoursData } = await supabase.from("service_provider_hours").select("*").eq("provider_id", id);
      setHours(hoursData || []);

      const { data: imagesData } = await supabase.from("service_provider_images").select("*").eq("provider_id", id);
      setImages(imagesData || []);

      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("*")
        .eq("provider_id", id)
        .order("created_at", { ascending: false });

      if (reviewsData && reviewsData.length > 0) {
        setReviews(reviewsData);
        
        const total = reviewsData.length;
        const totalService = reviewsData.reduce((acc, r) => acc + r.rating_overall, 0);
        const totalStaff = reviewsData.reduce((acc, r) => acc + r.rating_staff, 0);
        
        const avgService = totalService / total;
        const avgStaff = totalStaff / total;
        const avgOverall = (avgService + avgStaff) / 2;

        setReviewStats({
            count: total,
            overall: avgOverall,
            service: avgService,
            staff: avgStaff
        });
      } else {
        setReviews([]);
        setReviewStats({ count: 0, overall: 0, service: 0, staff: 0 });
      }

    } catch (error) { console.error("Error fetching data:", error); } finally { setLoading(false); }
  };

  // Add this inside your component (e.g., near line 190)
useEffect(() => {
  if (!id) return;

  // 1. Create the Real-time Channel
  const bookingsChannel = supabase
    .channel('booking-updates')
    .on(
      'postgres_changes', 
      { 
        event: '*', // Listen for all changes (Insert, Update, Delete)
        schema: 'public', 
        table: 'bookings',
        filter: `provider_id=eq.${id}` // Only listen for this SP's bookings
      }, 
      (payload) => {
        // 2. When a change happens, re-trigger the occupancy fetch
        console.log("Real-time update received:", payload);
        fetchDateBookings(); 
      }
    )
    .subscribe();

  // 3. Clean up the listener when the user leaves the page
  return () => {
    supabase.removeChannel(bookingsChannel);
  };
}, [id, bookingDate]); // Re-subscribe if the SP or Date changes


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


const handleCompleteBooking = async () => {
    setBookingError(null);
    setDateError(null);

    // 1. Initial Validation Guards
    if (!user) { 
        setBookingError("You must be logged in to book."); 
        return; 
    }
    if (!bookingDate) { 
        setDateError("Please select a date."); 
        return; 
    }
    if (!bookingTime) { 
        setBookingError("Please select a time slot."); 
        return; 
    }
    if (!agreedToTerms) { 
        setBookingError("Please agree to the Terms and Conditions to proceed.");
        return; 
    }

    const petCount = parseInt(numberOfPets, 10);
    if (isNaN(petCount) || petCount < 1) { 
        setBookingError("Please enter a valid number of pets."); 
        return; 
    }

    try {
        setLoading(true); // Ensure you have a loading state for the sidebar button

        // 2. FRESH DB FETCH: Verify actual availability right now
        const dateStr = bookingDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
        
        const { data: freshBookings, error } = await supabase
            .from("bookings")
            .select("id, booking_pets(id)") 
            .eq("provider_id", id)
            .eq("booking_date", dateStr)
            .eq("time_slot", bookingTime)
            .not("status", "in", '("cancelled", "declined", "rejected", "void", "voided")');

        if (error) throw error;

        // 3. IDENTIFY CAPACITY: Based on the provider's specific hours for that day
        const dayName = bookingDate.toLocaleDateString('en-US', { weekday: 'long' });
        const workingDay = hours.find(h => h.day_of_week === dayName);
        const maxCapacity = workingDay ? parseInt(workingDay.slot_capacity) : 1;

        // 4. THE MATH: Calculate real-time remaining slots
        const actualPetsOccupied = freshBookings?.reduce((sum, b) => 
            sum + (b.booking_pets?.length || 0), 0
        ) || 0;
        
        const finalRemaining = maxCapacity - actualPetsOccupied;

        // 5. FINAL GUARD: Check if the user's pets fit in the remaining slots
        if (petCount > finalRemaining) {
            setBookingError(`Conflict: Only ${Math.max(0, finalRemaining)} slot(s) left. Someone else may have just booked.`);
            setExistingBookings(freshBookings); // Sync UI slots immediately
            setLoading(false);
            return;
        }

        // 6. SUCCESS: Navigate to the next step
        // We bypass the modal here because they checked the box in the sidebar
        navigate('/pet-details', {
            state: {
                providerId: id,
                providerName: provider.business_name,
                bookingDate: dateStr,
                bookingTime,
                numberOfPets: petCount
            }
        });

    } catch (err) {
        console.error("Booking verification error:", err);
        setBookingError("Unable to verify availability. Please try again.");
    } finally {
        setLoading(false);
    }
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
                      <td style={{textTransform:'capitalize'}}>{opt.pet_type === 'dog-cat' ? 'Dog & Cat' : opt.pet_type}</td>
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

  if (loading) return (
    <div className="listing-info-page">
      <Header />
      <main className="listing-container">
        <p className="loading-text">Loading...</p>
      </main>
      <Footer />
    </div>
  );

  if (!provider) return (
    <div className="listing-info-page">
      <Header />
      <main className="listing-container">
        <p className="loading-text">Provider not found.</p>
      </main>
      <Footer />
    </div>
  );

  // Add this helper before the return statement
const isBookingDisabled = 
  !bookingDate || 
  !bookingTime || 
  parseInt(numberOfPets, 10) < 1 || 
  !agreedToTerms || 
  loading;

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
                    <div className="listing-full-location" style={{marginBottom:'1rem'}}>
                      <MapPin size={24} className="text-primary"/>
                      <a href={provider.google_map_url || "#"} target="_blank" rel="noopener noreferrer" className={`location-link ${!provider.google_map_url ? 'disabled' : ''}`} style={{fontSize:'1.1rem'}}>
                        {`${provider.house_street}, ${provider.barangay}, ${provider.city}, ${provider.province}, ${provider.country} ${provider.postal_code}`}
                        {provider.google_map_url && <ExternalLink size={16} style={{marginLeft:'6px'}}/>}
                      </a>
                    </div>
                    {/* MAP LOCATION FOR OVERVIEW */}
                    <div className="info-section">
                      <h3 className="subsection-title">Shop Location</h3>
                      <div style={{ height: "300px", width: "100%", borderRadius: "12px", overflow: "hidden", border: "1px solid #dbeafe" }}>
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
                            <div className="hour-header">
                              <Clock size={14} />
                              <span>{day}</span>
                            </div>
                            <div className="hour-body">
                              {isOpen ? (
                                dayHours.map((h, i) => (
                                  <div key={i} className="time-badge">
                                    {formatTime(h.start_time)} - {formatTime(h.end_time)}
                                  </div>
                                ))
                              ) : (
                                <span className="closed-text">Closed</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="info-section" style={{marginTop:'3rem', borderTop:'1px solid #dbeafe', paddingTop:'2rem'}}>
                    <h3 className="subsection-title">Service Prices</h3>
                    <p className="vat-note">* VAT inclusive</p>
                    <ServicesList />
                  </div>
              </div>
            )}

            {activeTab === "prices" && (
                <div className="tab-content">
                    <h2 className="section-title">Service Prices</h2>
                    <p className="vat-note">* VAT exclusive</p>
                    <ServicesList />
                </div>
            )}
            
            {activeTab === "location" && (
            <div className="tab-content">
              <h2 className="section-title">Location Details</h2>
              <div className="location-info-card">
                <div className="location-address-header" style={{ marginBottom: '15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <MapPin size={24} className="text-primary" />
                  <p style={{ margin: 0 }}>
                    <strong>{provider.business_name}</strong><br/>
                    {`${provider.house_street}, ${provider.barangay}, ${provider.city}, ${provider.province}`}
                  </p>
                </div>

                {/* THE ACTUAL MAP */}
                <div style={{ height: "300px", width: "100%", position: "relative" }}>
                  <LocationPicker 
                    lat={provider.latitude} 
                    lng={provider.longitude} 
                    onLocationChange={() => {}} 
                    previewOnly={true} 
                  />
                </div>

                {/* Lat/Long Labels */}
                <div className="coord-badge-row" style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                  <span className="coord-tag">Lat: {parseFloat(provider.latitude).toFixed(6)}</span>
                  <span className="coord-tag">Long: {parseFloat(provider.longitude).toFixed(6)}</span>
                </div>
                
                {provider.google_map_url && (
                  <a 
                    href={provider.google_map_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="external-map-btn"
                    style={{ marginTop: '20px', display: 'inline-block' }}
                  >
                    Open in Google Maps <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          )}
            
            {activeTab === "reviews" && (
              <div className="tab-content">
                <h2 className="section-title">Reviews</h2>
                
                {reviewStats.count > 0 ? (
                  <div className="reviews-container">
                    {/* UPDATED Summary Card (Clean Light Version) */}
                    <div className="review-summary-card">
                      <div className="summary-main">
                        <span className="summary-score">{reviewStats.overall.toFixed(1)}</span>
                        <div className="summary-stars">
                          <StarRating rating={reviewStats.overall} size={24} />
                        </div>
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

                    {/* Reviews List */}
                    <div className="reviews-list">
                      {reviews.map((review) => (
                        <div key={review.id} className="review-card">
                          <div className="review-header">
                            <div className="review-user-avatar">
                              <User size={20} color="#153e75" />
                            </div>
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
                                    <span className="rating-decimal-text">
                                      {avgRating.toFixed(1)}
                                    </span>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          
                          <div className="review-body">
                             {review.comment ? (
                               <p className="review-text">{review.comment}</p>
                             ) : (
                               <p className="review-text-empty">No comment provided.</p>
                             )}
                          </div>
                          
                          <div className="review-footer">
                            <div className="mini-rating">
                              <span>Service: </span> <b>{review.rating_overall}/5</b>
                            </div>
                            <div className="mini-rating">
                              <span>Staff: </span> <b>{review.rating_staff}/5</b>
                            </div>
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

        {/* --- BOOKING SIDEBAR --- */}
        <div className="booking-sidebar">
          <h3 className="booking-header">Book Appointment</h3>
          
          {bookingError && <div className="booking-error">{bookingError}</div>}

          <div className="booking-field">
            <label className="booking-label">
              <CalendarIcon size={14} style={{marginRight:'6px', marginBottom:'-2px'}}/>
              Select Date
            </label>
            
            {/* --- REPLACED DATEPICKER WITH CUSTOM CALENDAR --- */}
            <BookingCalendar 
              selectedDate={bookingDate} 
              onDateSelect={handleDateChange} 
              providerHours={hours}
            />
            {dateError && <span className="field-error-text">{dateError}</span>}
          </div>

          <div className="booking-field">
            <label className="booking-label">
              <Clock size={14} style={{marginRight:'6px', marginBottom:'-2px'}}/>
              Select Time Slot
            </label>
            <div className="booking-select-wrapper">
              <select 
                value={bookingTime} 
                onChange={(e) => setBookingTime(e.target.value)} 
                className="booking-select"
                disabled={!bookingDate || availableTimeSlots.length === 0}
            >
                <option value="">
                    {availableTimeSlots.length > 0 ? "Select Time" : "No slots available"}
                </option>
                {availableTimeSlots.map((slot, idx) => {
                    const isFull = slot.status === "full";
                    const isTooSmall = slot.status === "insufficient_space";
                    const isRisk = slot.status === "clash_risk"; // New status check
                    
                    return (
                        <option 
                            key={idx} 
                            value={slot.value} 
                            disabled={isFull || isTooSmall}
                        >
                            {slot.label} 
                            {isFull ? " (Fully Booked)" : 
                            isTooSmall ? ` (Only ${slot.remaining} left)` : 
                            isRisk ? ` (${slot.remaining} left - Pending SP Approval)` : // Inform the user
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
              <Users size={14} style={{marginRight:'6px', marginBottom:'-2px'}}/>
              Number of Pets
            </label>
            <input 
              type="number" 
              min="1"
              // Calculate remaining capacity for the current selection for the 'max' attribute
              max={bookingTime ? 
                (hours.find(h => h.day_of_week === bookingDate?.toLocaleDateString('en-US', { weekday: 'long' }))?.slot_capacity || 1) - 
                existingBookings.filter(b => b.time_slot === bookingTime).length 
                : 10
              }
              value={numberOfPets} 
              onChange={(e) => setNumberOfPets(e.target.value)} 
              className="booking-date-input" 
              style={{width: '100%', boxSizing: 'border-box'}}
            />
            {bookingTime && (
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
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
                I agree to the <a href={TERMS_URL} target="_blank" rel="noreferrer">Terms and Conditions</a> including policies on <strong>down payments, cancellations, and pet safety.</strong>
              </label>
            </div>
          </div>

          <button 
            onClick={handleCompleteBooking} 
            className="booking-button"
            disabled={isBookingDisabled} // Now checks all requirements
          >
            {loading ? "Verifying..." : "Complete Booking"}
          </button>
        </div>
      </main>
    
      <ImageModal isOpen={selectedImageIndex !== null} onClose={() => setSelectedImageIndex(null)} images={images} currentIndex={selectedImageIndex} onNext={() => setSelectedImageIndex((prev) => (prev + 1) % images.length)} onPrev={() => setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length)}/>

      <Footer />
    </div>
  );
};

export default ListingInfo;