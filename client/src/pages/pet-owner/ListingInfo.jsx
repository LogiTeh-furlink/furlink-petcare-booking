// src/pages/pet-owner/ListingInfo.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { 
  MapPin, X, ChevronDown, 
  ChevronLeft, ChevronRight, Clock, 
  Facebook, Instagram, Globe, ExternalLink 
} from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./ListingInfo.css";

// --- Image Modal (Carousel) ---
const ImageModal = ({ isOpen, onClose, images, currentIndex, onNext, onPrev }) => {
  if (!isOpen || !images || images.length === 0) return null;
  const currentUrl = images[currentIndex]?.image_url;

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
  const [user, setUser] = useState(null); 
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [hours, setHours] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false); 
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [error, setError] = useState(null); 

  // Booking states
  const [petType, setPetType] = useState('');
  const [petSize, setPetSize] = useState('');
  const [serviceType, setServiceType] = useState(''); 
  const [selectedDate, setSelectedDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState(0);

  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => { fetchAllData(); fetchUser(); }, [id]);
  useEffect(() => { calculatePrice(); }, [petType, petSize, serviceType]);
  useEffect(() => { if (serviceType) { setPetType(''); setPetSize(''); } }, [serviceType]);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

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

  const availablePetTypes = useMemo(() => {
    if (!serviceType) return [];
    const selectedService = services.find(s => s.id === serviceType);
    if (!selectedService || !selectedService.service_options) return [];
    let types = selectedService.service_options.map(opt => opt.pet_type);
    let uniqueTypes = new Set();
    types.forEach(type => {
        if (type === 'dog-cat') { uniqueTypes.add('dog'); uniqueTypes.add('cat'); } 
        else { uniqueTypes.add(type); }
    });
    return Array.from(uniqueTypes).sort();
  }, [serviceType, services]);

  const availablePetSizes = useMemo(() => {
    if (!serviceType) return [];
    const selectedService = services.find(s => s.id === serviceType);
    if (!selectedService || !selectedService.service_options) return [];
    const options = selectedService.service_options.map(opt => opt.size);
    return [...new Set(options)].filter(val => val).sort();
  }, [serviceType, services]);

  const calculatePrice = () => {
    if (!serviceType || !petSize || !petType) { setEstimatedPrice(0); return; }
    setError(null); 
    const selectedService = services.find(s => s.id === serviceType);
    if (!selectedService || !selectedService.service_options) { setEstimatedPrice(0); return; }
    const matchingOption = selectedService.service_options.find(opt => opt.size === petSize && (opt.pet_type === petType || opt.pet_type === 'dog-cat'));
    if (matchingOption) { setEstimatedPrice(parseFloat(matchingOption.price)); } 
    else { setEstimatedPrice(0); setError("No valid pricing option found for selection."); }
  };

  const formatTime = (time) => {
    if (!time) return "";
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const isSlotAvailable = async (date, time) => {
    const bookingDay = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    const dayHours = hours.filter(h => h.day_of_week === bookingDay);
    if (dayHours.length === 0) return { available: false, message: `Closed on ${bookingDay}s.` };

    const selectedHour = new Date(`2000/01/01 ${time}`).getHours();
    const selectedMinute = new Date(`2000/01/01 ${time}`).getMinutes();
    const isWithinHours = dayHours.some(h => {
        const startTime24 = parseInt(h.start_time.split(':')[0]);
        const endTime24 = parseInt(h.end_time.split(':')[0]);
        const selectedTimeValue = selectedHour + (selectedMinute / 60);
        return selectedTimeValue >= startTime24 && selectedTimeValue < endTime24;
    });

    if (!isWithinHours) return { available: false, message: `Time slot ${time} is outside operating hours.` };
    
    const { data: existingBookings } = await supabase.from('bookings').select('id')
        .eq('provider_id', id).eq('booking_date', date).eq('time_slot', time).in('status', ['pending', 'confirmed']);
    
    if (existingBookings.length > 0) return { available: false, message: `Slot ${time} on ${date} is already booked.` };
    return { available: true };
  };

  const handleBookAppointment = async () => {
    if (isBooking) return;
    setError(null);
    if (!user) { setError("You must be logged in to book."); return; }
    if (!petType || !petSize || !serviceType || !selectedDate || !timeSlot || estimatedPrice <= 0) { setError("Please fill out all fields."); return; }

    setIsBooking(true);
    try {
        const availabilityCheck = await isSlotAvailable(selectedDate, timeSlot);
        if (!availabilityCheck.available) throw new Error(availabilityCheck.message);

        const selectedService = services.find(s => s.id === serviceType);
        const matchingOption = selectedService.service_options.find(opt => opt.size === petSize && (opt.pet_type === petType || opt.pet_type === 'dog-cat'));
        
        const { error: bookingError } = await supabase.from('bookings').insert([{
            provider_id: id, user_id: user.id, service_id: serviceType, service_option_id: matchingOption.id,
            pet_type: petType, pet_size: petSize, booking_date: selectedDate, time_slot: timeSlot, estimated_price: estimatedPrice.toFixed(2),
        }]);

        if (bookingError) throw bookingError;
        alert('Appointment booked successfully! Status: Pending.');
        setPetType(''); setPetSize(''); setServiceType(''); setSelectedDate(''); setTimeSlot(''); setEstimatedPrice(0);
    } catch (err) { console.error(err); setError(err.message); } 
    finally { setIsBooking(false); }
  };

  const getImageGridClass = () => {
    const count = images.length;
    if (count === 0) return 'images-0';
    if (count === 1) return 'images-1';
    if (count === 2) return 'images-2';
    return 'images-3'; 
  };

  const getSocialIcon = (url) => {
    if (!url) return null;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('facebook')) return <Facebook size={24} className="social-icon fb" />;
    if (lowerUrl.includes('instagram')) return <Instagram size={24} className="social-icon insta" />;
    return <Globe size={24} className="social-icon globe" />;
  };

  // Helper Component for Service List to avoid duplication
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
          {/* TABS */}
          <div className="listing-tabs">
            {["overview", "prices", "location", "reviews"].map(tab => (
                <button key={tab} className={`tab-button ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
          </div>

          {/* IMAGE GRID */}
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
            
            {/* --- OVERVIEW TAB --- */}
            {activeTab === "overview" && (
              <div className="tab-content">
                 
                 {/* 1. Header with Name & Inline Social Media */}
                 <div className="listing-header-row">
                    <h1 className="listing-title">{provider.business_name}</h1>
                    {provider.social_media_url && (
                        <a 
                            href={provider.social_media_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="social-link-inline"
                            title="Visit Social Media"
                        >
                            {getSocialIcon(provider.social_media_url)}
                        </a>
                    )}
                 </div>

                 {/* 2. Full Clickable Address */}
                 <div className="listing-full-location">
                    <MapPin size={18} className="text-primary"/>
                    <a 
                        href={provider.google_map_url || "#"} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`location-link ${!provider.google_map_url ? 'disabled' : ''}`}
                    >
                        {`${provider.house_street}, ${provider.barangay}, ${provider.city}, ${provider.province}, ${provider.country} ${provider.postal_code}`}
                        {provider.google_map_url && <ExternalLink size={12} style={{marginLeft:'4px'}}/>}
                    </a>
                 </div>

                 {/* 3. Description (NO 'About Us' Title) */}
                 <div className="info-section">
                    <p className="shop-description">
                        {provider.description || <span className="italic-gray">No description provided.</span>}
                    </p>
                 </div>

                 {/* 4. Operating Hours (Blue Card Style - Multi-line) */}
                 <div className="info-section">
                    <h3 className="subsection-title">Operating Hours</h3>
                    <div className="hours-horizontal-container">
                        {daysOrder.map((day) => {
                            const dayHours = hours.filter(h => h.day_of_week === day);
                            const isOpen = dayHours.length > 0;
                            return (
                                <div key={day} className="hour-card">
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

                 {/* 5. Service Prices (Included in Overview now) */}
                 <div className="info-section" style={{marginTop:'3rem', borderTop:'1px solid #e5e7eb', paddingTop:'2rem'}}>
                    <h3 className="subsection-title">Service Prices</h3>
                    <ServicesList />
                 </div>

              </div>
            )}

            {/* --- PRICES TAB --- */}
            {activeTab === "prices" && (
              <div className="tab-content">
                <h2 className="section-title">Service Prices</h2>
                <ServicesList />
              </div>
            )}

            {/* --- LOCATION TAB --- */}
            {activeTab === "location" && (
              <div className="tab-content">
                <h2 className="section-title">Location</h2>
                <div className="location-info-block">
                    <div className="listing-full-location" style={{marginBottom:'1rem'}}>
                        <MapPin size={24} className="text-primary"/>
                        <a 
                            href={provider.google_map_url || "#"} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={`location-link ${!provider.google_map_url ? 'disabled' : ''}`}
                            style={{fontSize:'1.1rem'}}
                        >
                            {`${provider.house_street}, ${provider.barangay}, ${provider.city}, ${provider.province}, ${provider.country} ${provider.postal_code}`}
                            {provider.google_map_url && <ExternalLink size={16} style={{marginLeft:'6px'}}/>}
                        </a>
                    </div>
                    {provider.google_map_url ? (
                        <p style={{color:'#6b7280', fontSize:'0.9rem', marginLeft:'32px'}}>Click the address above to open in Google Maps.</p>
                    ) : (
                        <p style={{color:'#ef4444', fontSize:'0.9rem', marginLeft:'32px'}}>No map link provided by this provider.</p>
                    )}
                </div>
              </div>
            )}

            {/* --- REVIEWS TAB --- */}
            {activeTab === "reviews" && (
              <div className="tab-content">
                <h2 className="section-title">Reviews</h2>
                <p style={{ color: "#6b7280" }}>No reviews yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* BOOKING SIDEBAR */}
        <div className="booking-sidebar">
          {error && <div className="booking-error">{error}</div>}
          <div className={`booking-price ${estimatedPrice > 0 ? 'has-price' : 'no-price'}`}>
            ₱{estimatedPrice.toFixed(2)}
          </div>

          <div className="booking-field">
            <label className="booking-label">Service type</label>
            <div className="booking-select-wrapper">
                <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="booking-select">
                    <option value="">Select Service</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown size={20} className="booking-select-icon" />
            </div>
          </div>

          <div className="booking-field">
            <label className="booking-label">Pet type</label>
            <div className="booking-select-wrapper">
                <select value={petType} onChange={(e) => setPetType(e.target.value)} disabled={!serviceType} className="booking-select">
                    <option value="">{serviceType ? 'Select Pet Type' : 'Select Service First'}</option>
                    {availablePetTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
                <ChevronDown size={20} className="booking-select-icon" />
            </div>
          </div>

          <div className="booking-field">
            <label className="booking-label">Pet size</label>
            <div className="booking-select-wrapper">
                <select value={petSize} onChange={(e) => setPetSize(e.target.value)} disabled={!serviceType} className="booking-select">
                    <option value="">{serviceType ? 'Select Pet Size' : 'Select Service First'}</option>
                    {['small', 'medium', 'large', 'extra_large'].filter(s => availablePetSizes.includes(s)).map(s => (
                        <option key={s} value={s}>{s.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</option>
                    ))}
                </select>
                <ChevronDown size={20} className="booking-select-icon" />
            </div>
          </div>

          <div className="booking-field"><label className="booking-label">Date</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="booking-date-input"/>
          </div>

          <div className="booking-field"><label className="booking-label">Time slot</label>
            <div className="booking-select-wrapper">
                <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} className="booking-select">
                    <option value="">Select Time</option>
                    {["9:00 AM","10:00 AM","11:00 AM","1:00 PM","2:00 PM","3:00 PM","4:00 PM"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={20} className="booking-select-icon" />
            </div>
          </div>

          <button onClick={handleBookAppointment} disabled={isBooking || estimatedPrice <= 0} className="booking-button">
            {isBooking ? 'Checking...' : 'Book an appointment'}
          </button>    
        </div>
      </main>
    
      <ImageModal isOpen={selectedImageIndex !== null} onClose={() => setSelectedImageIndex(null)} images={images} currentIndex={selectedImageIndex} onNext={() => setSelectedImageIndex((prev) => (prev + 1) % images.length)} onPrev={() => setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length)}/>
      <Footer />
    </div>
  );
};

export default ListingInfo;