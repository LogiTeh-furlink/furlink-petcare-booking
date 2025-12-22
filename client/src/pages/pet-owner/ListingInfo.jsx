// src/pages/pet-owner/ListingInfo.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom"; 
import { supabase } from "../../config/supabase";
import { 
  MapPin, X, ChevronDown, 
  ChevronLeft, ChevronRight, Clock, 
  Facebook, Instagram, Globe, ExternalLink,
  Calendar, Users, Star, User
} from "lucide-react";
import DatePicker from "react-datepicker"; 
import "react-datepicker/dist/react-datepicker.css"; 
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./ListingInfo.css";

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
const StarRating = ({ rating, size = 16 }) => {
  return (
    <div className="star-rating-row">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star 
          key={star} 
          size={size} 
          className={star <= Math.round(rating) ? "star-filled" : "star-empty"} 
          fill={star <= Math.round(rating) ? "#fdbf00" : "none"}
        />
      ))}
    </div>
  );
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
  const [bookingDate, setBookingDate] = useState(null);
  const [bookingTime, setBookingTime] = useState("");
  const [numberOfPets, setNumberOfPets] = useState(0);

  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [dateError, setDateError] = useState(null);
  const [bookingError, setBookingError] = useState(null);

  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

  // 3. AUTO-GENERATE TIME SLOTS
  useEffect(() => {
    setAvailableTimeSlots([]);
    if (!bookingDate || hours.length === 0) return;

    const dayName = bookingDate.toLocaleDateString('en-US', { weekday: 'long' });
    const workingDay = hours.find(h => h.day_of_week === dayName);

    if (workingDay) {
        const slots = [];
        const start = new Date(`2000-01-01T${workingDay.start_time}`);
        const end = new Date(`2000-01-01T${workingDay.end_time}`);

        while (start < end) {
            const timeValue = start.toTimeString().split(' ')[0];
            const displayLabel = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            slots.push({ value: timeValue, label: displayLabel });
            start.setHours(start.getHours() + 1);
        }
        setAvailableTimeSlots(slots);
    }
  }, [bookingDate, hours]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch Basic Provider Info
      const { data: providerData } = await supabase.from("service_providers").select("*").eq("id", id).eq("status", "approved").single();
      setProvider(providerData || null);

      const { data: servicesData } = await supabase.from("services").select(`*, service_options (*)`).eq("provider_id", id);
      setServices(servicesData || []);

      const { data: hoursData } = await supabase.from("service_provider_hours").select("*").eq("provider_id", id);
      setHours(hoursData || []);

      const { data: imagesData } = await supabase.from("service_provider_images").select("*").eq("provider_id", id);
      setImages(imagesData || []);

      // Fetch Reviews
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("*")
        .eq("provider_id", id)
        .order("created_at", { ascending: false });

      if (reviewsData && reviewsData.length > 0) {
        setReviews(reviewsData);
        
        // Calculate Averages
        const total = reviewsData.length;
        const totalService = reviewsData.reduce((acc, r) => acc + r.rating_overall, 0);
        const totalStaff = reviewsData.reduce((acc, r) => acc + r.rating_staff, 0);
        
        const avgService = totalService / total;
        const avgStaff = totalStaff / total;
        // Overall is average of the two categories
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

  const isDateEnabled = (date) => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    return hours.some(h => h.day_of_week === dayName);
  };

  const handleDateChange = (date) => {
    setBookingDate(date);
    setDateError(null);
    setBookingTime(""); 
  };

  const handleCompleteBooking = () => {
    setBookingError(null);

    if (!user) { setBookingError("You must be logged in to book."); return; }
    if (!bookingDate) { setDateError("Please select a date."); return; }
    if (!bookingTime) { setBookingError("Please select a time slot."); return; }
    if (numberOfPets < 1) { setBookingError("Please select at least 1 pet."); return; } 

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
                <thead><tr><th>Type</th><th>Size</th><th>Weight</th><th>Price</th></tr></thead>
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
                   <ServicesList />
                 </div>
              </div>
            )}

            {activeTab === "prices" && <div className="tab-content"><h2 className="section-title">Service Prices</h2><ServicesList /></div>}
            
            {activeTab === "location" && <div className="tab-content"><h2 className="section-title">Location</h2><div className="location-info"><MapPin size={20} /><p>{provider.house_street}, {provider.barangay}, {provider.city}</p></div></div>}
            
            {activeTab === "reviews" && (
              <div className="tab-content">
                <h2 className="section-title">Reviews</h2>
                
                {reviewStats.count > 0 ? (
                  <div className="reviews-container">
                    {/* Summary Card */}
                    <div className="review-summary-card">
                      <div className="summary-main">
                        <span className="summary-score">{reviewStats.overall.toFixed(1)}</span>
                        <div className="summary-stars">
                          <StarRating rating={reviewStats.overall} size={20} />
                        </div>
                        <span className="summary-count">{reviewStats.count} Reviews</span>
                      </div>
                      <div className="summary-details">
                        <div className="detail-row">
                          <span>Service</span>
                          <div className="detail-bar-container">
                            <div className="detail-bar-fill" style={{width: `${(reviewStats.service / 5) * 100}%`}}></div>
                          </div>
                          <span className="detail-score">{reviewStats.service.toFixed(1)}</span>
                        </div>
                        <div className="detail-row">
                          <span>Staff</span>
                          <div className="detail-bar-container">
                            <div className="detail-bar-fill" style={{width: `${(reviewStats.staff / 5) * 100}%`}}></div>
                          </div>
                          <span className="detail-score">{reviewStats.staff.toFixed(1)}</span>
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
                                <StarRating rating={(review.rating_overall + review.rating_staff) / 2} size={14} />
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
              <Calendar size={14} style={{marginRight:'6px', marginBottom:'-2px'}}/>
              Select Date
            </label>
            <DatePicker
              selected={bookingDate}
              onChange={handleDateChange}
              filterDate={isDateEnabled}
              minDate={new Date(new Date().setDate(new Date().getDate() + 1))}
              placeholderText="Select a date"
              className={`booking-date-input ${dateError ? 'input-error' : ''}`}
              dateFormat="MMMM d, yyyy"
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
                {availableTimeSlots.map((slot, idx) => (
                  <option key={idx} value={slot.value}>{slot.label}</option>
                ))}
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
              min="0"
              value={numberOfPets} 
              onChange={(e) => setNumberOfPets(e.target.value)} 
              className="booking-date-input"
            />
          </div>

          <button onClick={handleCompleteBooking} className="booking-button">
            Complete Booking
          </button>    
        </div>
      </main>
    
      <ImageModal isOpen={selectedImageIndex !== null} onClose={() => setSelectedImageIndex(null)} images={images} currentIndex={selectedImageIndex} onNext={() => setSelectedImageIndex((prev) => (prev + 1) % images.length)} onPrev={() => setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length)}/>
      <Footer />
    </div>
  );
};

export default ListingInfo;