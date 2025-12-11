// src/pages/pet-owner/ListingInfo.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom"; 
import { supabase } from "../../config/supabase";
import { 
  MapPin, X, ChevronDown, 
  ChevronLeft, ChevronRight, Clock, 
  Facebook, Instagram, Globe, ExternalLink,
  Calendar, Users 
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
      <button className="image-modal-close" onClick={onClose}><X size={24} /></button>
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

const ListingInfo = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null); 
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [hours, setHours] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  
  // --- BOOKING STATES ---
  const [bookingDate, setBookingDate] = useState(null);
  const [bookingTime, setBookingTime] = useState("");
  const [numberOfPets, setNumberOfPets] = useState(1);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  
  // --- ERROR STATES ---
  const [dateError, setDateError] = useState(null);
  const [bookingError, setBookingError] = useState(null);

  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // 1. Fetch User First
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
    fetchAllData();
  }, [id]);

  // 2. RESTORE FROM SESSION STORAGE (Only when User is loaded)
  useEffect(() => {
    if (user && id) {
      const storageKey = `booking_draft_${user.id}_${id}`; // ⭐ SCOPED TO USER
      const savedData = sessionStorage.getItem(storageKey);
      
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.date) setBookingDate(new Date(parsed.date));
          if (parsed.time) setBookingTime(parsed.time);
          if (parsed.pets) setNumberOfPets(parsed.pets);
          
          // Trigger slot regeneration if date exists (requires hours to be loaded)
          // We handle the actual regeneration logic inside the data fetching or separate effect below
        } catch (e) {
          console.error("Failed to restore draft", e);
        }
      }
    }
  }, [user, id]);

  // 3. SAVE TO SESSION STORAGE (Scoped to User)
  useEffect(() => {
    if (user && id && (bookingDate || bookingTime || numberOfPets !== 1)) {
      const storageKey = `booking_draft_${user.id}_${id}`; // ⭐ SCOPED TO USER
      const draft = {
        date: bookingDate ? bookingDate.toISOString() : null,
        time: bookingTime,
        pets: numberOfPets
      };
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
    }
  }, [bookingDate, bookingTime, numberOfPets, id, user]);

  // 4. Regenerate Slots when Date or Hours change
  useEffect(() => {
     if (bookingDate && hours.length > 0) {
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
        } else {
            setAvailableTimeSlots([]); // Reset if day is closed
        }
     }
  }, [bookingDate, hours]);

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
    } catch (error) { console.error("Error fetching data:", error); } finally { setLoading(false); }
  };

  // ... [Keep formatTime, getSocialIcon, getImageGridClass, isDateEnabled, handleDateChange same as before] ...
  const formatTime = (time) => {
    if (!time) return "";
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
    setAvailableTimeSlots([]);
  };

  const handleCompleteBooking = () => {
    setBookingError(null);

    if (!user) { setBookingError("You must be logged in to book."); return; }
    if (!bookingDate) { setDateError("Please select a date."); return; }
    if (!bookingTime) { setBookingError("Please select a time slot."); return; }
    if (numberOfPets < 1) { setBookingError("Please enter at least 1 pet."); return; }

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

  // [Render logic same as before...]
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
      )) : <p>No services listed.</p>}
    </>
  );

  if (loading) return <div className="listing-info-page"><Header /><main className="listing-container"><p style={{padding:"4rem", textAlign:"center"}}>Loading...</p></main><Footer /></div>;
  if (!provider) return <div className="listing-info-page"><Header /><main className="listing-container"><p style={{padding:"4rem", textAlign:"center"}}>Provider not found.</p></main><Footer /></div>;

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
                 <div className="info-section" style={{marginTop:'3rem', borderTop:'1px solid #e5e7eb', paddingTop:'2rem'}}>
                   <h3 className="subsection-title">Service Prices</h3>
                   <ServicesList />
                 </div>
              </div>
            )}
            {activeTab === "prices" && <div className="tab-content"><h2 className="section-title">Service Prices</h2><ServicesList /></div>}
            {activeTab === "location" && <div className="tab-content"><h2 className="section-title">Location</h2><div className="location-info"><MapPin size={20} /><p>{provider.house_street}, {provider.barangay}, {provider.city}</p></div></div>}
            {activeTab === "reviews" && <div className="tab-content"><h2 className="section-title">Reviews</h2><p style={{ color: "#6b7280" }}>No reviews yet.</p></div>}
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
              min="1" 
              max="5"
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