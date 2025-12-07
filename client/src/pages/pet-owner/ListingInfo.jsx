// src/pages/pet-owner/ListingInfo.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { 
  MapPin, X, ChevronDown, 
  ChevronLeft, ChevronRight, // Added for Carousel
  Facebook, Instagram, Globe // Added for Social Media
} from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./ListingInfo.css";

// Updated Image Modal Component with Carousel
const ImageModal = ({ isOpen, onClose, images, currentIndex, onNext, onPrev }) => {
  if (!isOpen || !images || images.length === 0) return null;

  const currentUrl = images[currentIndex]?.image_url;

  return (
    <div className="image-modal-overlay" onClick={onClose}>
      <button className="image-modal-close" onClick={onClose}>
        <X size={24} />
      </button>
      
      {/* Previous Button */}
      {images.length > 1 && (
        <button 
          className="image-nav-btn prev" 
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          style={{ position: 'absolute', left: '20px', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', borderRadius: '50%', padding: '10px', cursor: 'pointer', zIndex: 1001 }}
        >
          <ChevronLeft size={32} />
        </button>
      )}

      <img 
        src={currentUrl} 
        alt="Full view" 
        onClick={(e) => e.stopPropagation()}
        className="image-modal-img"
      />

      {/* Next Button */}
      {images.length > 1 && (
        <button 
          className="image-nav-btn next" 
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          style={{ position: 'absolute', right: '20px', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', borderRadius: '50%', padding: '10px', cursor: 'pointer', zIndex: 1001 }}
        >
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
  
  // Changed from selectedImage URL to Index for Carousel logic
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  
  const [error, setError] = useState(null); 

  // Booking form states
  const [petType, setPetType] = useState('');
  const [petSize, setPetSize] = useState('');
  const [serviceType, setServiceType] = useState(''); 
  const [selectedDate, setSelectedDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState(0);

  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    fetchAllData();
    fetchUser();
  }, [id]);

  useEffect(() => {
    calculatePrice();
  }, [petType, petSize, serviceType]);

  useEffect(() => {
    if (serviceType) {
        setPetType('');
        setPetSize('');
    }
  }, [serviceType]);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);

      const { data: providerData, error: providerError } = await supabase
        .from("service_providers")
        .select("*")
        .eq("id", id)
        .eq("status", "approved")
        .single();
      setProvider(providerData || null);

      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select(`*, service_options (*)`)
        .eq("provider_id", id);
      
      setServices(servicesData || []);

      const { data: hoursData } = await supabase
        .from("service_provider_hours")
        .select("*")
        .eq("provider_id", id);
      setHours(hoursData || []);

      const { data: imagesData } = await supabase
        .from("service_provider_images")
        .select("*")
        .eq("provider_id", id);
      setImages(imagesData || []);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableOptions = (key) => {
    if (!serviceType) return [];

    const selectedService = services.find(s => s.id === serviceType);
    if (!selectedService || !selectedService.service_options) return [];

    const options = selectedService.service_options.map(opt => opt[key]);
    return [...new Set(options)].filter(val => val && val !== 'dog-cat').sort();
  };

  const availablePetTypes = useMemo(() => {
    if (!serviceType) return [];

    const selectedService = services.find(s => s.id === serviceType);
    if (!selectedService || !selectedService.service_options) return [];

    let types = selectedService.service_options.map(opt => opt.pet_type);
    
    let uniqueTypes = new Set();
    types.forEach(type => {
        if (type === 'dog-cat') {
            uniqueTypes.add('dog');
            uniqueTypes.add('cat');
        } else {
            uniqueTypes.add(type);
        }
    });

    return Array.from(uniqueTypes).sort();
  }, [serviceType, services]);

  const availablePetSizes = useMemo(() => {
    return getAvailableOptions('size');
  }, [serviceType, services]);

  const calculatePrice = () => {
    if (!serviceType || !petSize || !petType) {
      setEstimatedPrice(0);
      return;
    }
    setError(null); 

    const selectedService = services.find(s => s.id === serviceType);
    if (!selectedService || !selectedService.service_options) {
      setEstimatedPrice(0);
      return;
    }

    const matchingOption = selectedService.service_options.find(
      opt => opt.size === petSize && (opt.pet_type === petType || opt.pet_type === 'dog-cat')
    );

    if (matchingOption) {
      setEstimatedPrice(parseFloat(matchingOption.price));
    } else {
      setEstimatedPrice(0);
      setError("No valid pricing option found for the selected pet type and size combination for this service.");
    }
  };

  const formatTime = (time) => {
    if (!time) return "";
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const isSlotAvailable = async (date, time) => {
    const bookingDay = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    const dayHours = hours.filter(h => h.day_of_week === bookingDay);

    if (dayHours.length === 0) {
        return { available: false, message: `The provider is closed on ${bookingDay}s.` };
    }

    const selectedHour = new Date(`2000/01/01 ${time}`).getHours();
    const selectedMinute = new Date(`2000/01/01 ${time}`).getMinutes();
    
    const isWithinHours = dayHours.some(h => {
        const startTime24 = parseInt(h.start_time.split(':')[0]);
        const endTime24 = parseInt(h.end_time.split(':')[0]);
        
        const selectedTimeValue = selectedHour + (selectedMinute / 60);

        return selectedTimeValue >= startTime24 && selectedTimeValue < endTime24;
    });

    if (!isWithinHours) {
        return { available: false, message: `The time slot ${time} is outside the provider's operating hours on ${bookingDay}.` };
    }
    
    const { data: existingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id')
        .eq('provider_id', id)
        .eq('booking_date', date)
        .eq('time_slot', time)
        .in('status', ['pending', 'confirmed']);

    if (bookingsError) {
        console.error("Booking check error:", bookingsError);
        return { available: false, message: "Could not check for existing bookings. Please try again." };
    }

    if (existingBookings.length > 0) {
        return { available: false, message: `The time slot ${time} on ${date} is already booked. Please choose another time.` };
    }

    return { available: true };
  };

  const handleBookAppointment = async () => {
    if (isBooking) return;
    setError(null);

    if (!user) {
        setError("You must be logged in to book an appointment.");
        return;
    }
    if (!petType || !petSize || !serviceType || !selectedDate || !timeSlot || estimatedPrice <= 0) {
        setError("Please fill out all booking fields and ensure a price is calculated.");
        return;
    }

    setIsBooking(true);

    try {
        const availabilityCheck = await isSlotAvailable(selectedDate, timeSlot);
        if (!availabilityCheck.available) {
            throw new Error(availabilityCheck.message);
        }

        const selectedService = services.find(s => s.id === serviceType);
        if (!selectedService || !selectedService.service_options) {
            throw new Error("Invalid service selected.");
        }

        const matchingOption = selectedService.service_options.find(
            opt => opt.size === petSize && (opt.pet_type === petType || opt.pet_type === 'dog-cat')
        );

        if (!matchingOption) {
            throw new Error("Price calculation failed. The selected options are not available together.");
        }
        
        const serviceOptionId = matchingOption.id;

        const bookingData = {
            provider_id: id,
            user_id: user.id,
            service_id: serviceType,
            service_option_id: serviceOptionId,
            pet_type: petType,
            pet_size: petSize,
            booking_date: selectedDate,
            time_slot: timeSlot,
            estimated_price: estimatedPrice.toFixed(2),
        };

        const { error: bookingError } = await supabase
            .from('bookings')
            .insert([bookingData]);

        if (bookingError) {
            console.error("Supabase Booking Error:", bookingError);
            throw new Error(`Booking failed: ${bookingError.message}`);
        }

        alert('Appointment booked successfully! Status is pending confirmation.');

        setPetType('');
        setPetSize('');
        setServiceType('');
        setSelectedDate('');
        setTimeSlot('');
        setEstimatedPrice(0);

    } catch (err) {
        console.error("Booking handler error:", err);
        setError(err.message || "An unexpected error occurred during booking.");
    } finally {
        setIsBooking(false);
    }
  };

  // Determine grid class based on image count
  const getImageGridClass = () => {
    const count = images.length;
    if (count === 0) return 'images-0';
    if (count === 1) return 'images-1';
    if (count === 2) return 'images-2';
    if (count === 3) return 'images-3';
    return 'images-3'; // Max 3 images
  };

  // Carousel Handlers
  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Social Media Icon Helper
  const getSocialIcon = (url) => {
    if (!url) return null;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('facebook')) return <Facebook size={20} className="social-icon" />;
    if (lowerUrl.includes('instagram')) return <Instagram size={20} className="social-icon" />;
    return <Globe size={20} className="social-icon" />;
  };

  if (loading) {
    return (
      <div className="listing-info-page">
        <Header />
        <main className="listing-container">
          <p style={{ textAlign: "center", padding: "4rem" }}>Loading...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="listing-info-page">
        <Header />
        <main className="listing-container">
          <p style={{ textAlign: "center", padding: "4rem" }}>Provider not found or not approved.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="listing-info-page">
      <Header />
      <main className="listing-container">
        
        {/* Main Content */}
        <div className="listing-main-content">
          {/* Tab Navigation */}
          <div className="listing-tabs">
            <button 
              className={`tab-button ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button 
              className={`tab-button ${activeTab === "prices" ? "active" : ""}`}
              onClick={() => setActiveTab("prices")}
            >
              Prices
            </button>
            <button 
              className={`tab-button ${activeTab === "location" ? "active" : ""}`}
              onClick={() => setActiveTab("location")}
            >
              Location
            </button>
            <button 
              className={`tab-button ${activeTab === "reviews" ? "active" : ""}`}
              onClick={() => setActiveTab("reviews")}
            >
              Reviews
            </button>
          </div>

          {/* Image Gallery */}
          {images.length > 0 ? (
            <div className={`listing-images ${getImageGridClass()}`}>
              {/* First Image */}
              <div 
                className="main-image-placeholder" 
                onClick={() => setSelectedImageIndex(0)}
              >
                <img 
                  src={images[0].image_url} 
                  alt="Main facility"
                />
              </div>

              {/* Remaining Images */}
              {images.length === 2 ? (
                // For 2 images: show second image directly as equal column
                <div 
                  className="main-image-placeholder" 
                  onClick={() => setSelectedImageIndex(1)}
                >
                  <img 
                    src={images[1].image_url} 
                    alt="Facility 2"
                  />
                </div>
              ) : images.length === 3 ? (
                // For 3 images: show 2 smaller images stacked on the right
                <div className="thumbnail-grid">
                  {images.slice(1, 3).map((img, index) => (
                    <div 
                      key={img.id} 
                      className="thumbnail-placeholder"
                      onClick={() => setSelectedImageIndex(index + 1)}
                    >
                      <img 
                        src={img.image_url} 
                        alt={`Facility ${index + 2}`}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="listing-images">
              <div className="no-images-message">
                No images available for this provider
              </div>
            </div>
          )}

          {/* Tab Content */}
          <div className="listing-content">
            
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="tab-content">
                 <div className="listing-header">
                  <h1 className="listing-title">{provider.business_name}</h1>
                  <div className="listing-location">
                    <MapPin size={18} />
                    <span>{provider.city}, {provider.province}</span>
                  </div>
                </div>

                <div className="info-section">
                  {provider.description ? (
                    <p className="shop-description">{provider.description}</p>
                  ) : (
                    <p className="shop-description" style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                      No description provided.
                    </p>
                  )}
                  
                  {provider.social_media_url && (
                    <div className="info-text" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <a href={provider.social_media_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: 'inherit', textDecoration: 'none' }}>
                        {getSocialIcon(provider.social_media_url)}
                      </a>
                    </div>
                  )}
                </div>

                <div className="info-section">
                  <div className="location-info">
                    <MapPin size={20} style={{ flexShrink: 0 }} />
                    {/* Changed Address Format to One Line */}
                    <p>
                        {`${provider.house_street}, ${provider.barangay}, ${provider.city}, ${provider.province}, ${provider.country}, ${provider.postal_code}`}
                    </p>
                  </div>
                </div>

                {hours.length > 0 && (
                  <div className="info-section">
                    <h2 className="section-title">Operating Hours</h2>
                    <div className="hours-list">
                      {daysOrder.map((day) => {
                        const dayHours = hours.filter(h => h.day_of_week === day);
                        return dayHours.length > 0 ? (
                          <div key={day} className="hours-row">
                            <span className="day-name">{day}</span>
                            <span className="time-range">
                              {dayHours.map((h, idx) => (
                                <span key={h.id}>
                                  {formatTime(h.start_time)} - {formatTime(h.end_time)}
                                  {idx < dayHours.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {services.length > 0 && (
                  <div className="info-section">
                    <h2 className="section-title">Services & Pricing</h2>
                    {services.map((service) => (
                      <div key={service.id} className="service-section">
                        <div className="service-header">
                          <h3 className="service-name">{service.name}</h3>
                          {service.type && (
                            <span className={`service-type-badge ${service.type}`}>
                              {service.type}
                            </span>
                          )}
                        </div>
                        
                        {service.description && (
                          <p className="service-description-text">
                            {service.description}
                          </p>
                        )}
                        
                        {service.notes && (
                          <p className="service-notes-text">
                            <strong>Note:</strong> {service.notes}
                          </p>
                        )}
                    
                        {service.service_options && service.service_options.length > 0 && (
                          <div className="pricing-wrapper">
                            <table className="pricing-table">
                              <thead>
                                <tr>
                                  <th>Pet Type</th>
                                  <th>Size</th>
                                  <th>Weight</th>
                                  <th>Price</th>
                                </tr>
                              </thead>
                              <tbody>
                                {service.service_options.map((opt) => (
                                  <tr key={opt.id}>
                                    <td>
                                      {opt.pet_type === 'dog-cat' ? 'Dog & Cat' : opt.pet_type}
                                    </td>
                                    <td>
                                      {opt.size ? opt.size.replace('_', ' ') : 'N/A'}
                                    </td>
                                    <td>
                                      {opt.weight_range || 'N/A'}
                                    </td>
                                    <td>
                                      ₱{parseFloat(opt.price).toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

            {/* Prices Tab */}
            {activeTab === "prices" && (
              <div className="tab-content">
                <h2 className="section-title">Service Prices</h2>
                
                {services.length > 0 ? (
                  services.map((service) => (
                    <div key={service.id} className="service-section">
                       <div className="service-header">
                        <h3 className="service-name">{service.name}</h3>
                        {service.type && (
                          <span className={`service-type-badge ${service.type}`}>
                            {service.type}
                          </span>
                        )}
                      </div>
                      
                      {service.description && (
                        <p className="service-description">
                          <strong>Description:</strong> {service.description}
                        </p>
                      )}
                      
                      {service.notes && (
                        <p className="service-notes-text">
                          <strong>Note:</strong> {service.notes}
                        </p>
                      )}
                      
                      {service.service_options && service.service_options.length > 0 ? (
                        <div className="pricing-wrapper">
                          <table className="pricing-table">
                            <thead>
                              <tr>
                                <th>Pet Type</th>
                                <th>Size</th>
                                <th>Weight</th>
                                <th>Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {service.service_options.map((opt) => (
                                <tr key={opt.id}>
                                  <td>
                                    {opt.pet_type === 'dog-cat' ? 'Dog & Cat' : opt.pet_type}
                                  </td>
                                  <td>
                                    {opt.size ? opt.size.replace('_', ' ') : 'N/A'}
                                  </td>
                                  <td>
                                    {opt.weight_range || 'N/A'}
                                  </td>
                                  <td>
                                    ₱{parseFloat(opt.price).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p style={{ color: '#6b7280', marginTop: '1rem', fontStyle: 'italic' }}>
                          No pricing options available for this service.
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No services available.</p>
                )}
              </div>
            )}

            {/* Location Tab */}
            {activeTab === "location" && (
              <div className="tab-content">
                <div className="location-info">
                  <MapPin size={20} />
                  <div>
                    {/* Changed Address Format to One Line */}
                    <p>
                        {`${provider.house_street}, ${provider.barangay}, ${provider.city}, ${provider.province}, ${provider.country}, ${provider.postal_code}`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === "reviews" && (
              <div className="tab-content">
                <h2 className="section-title">Reviews</h2>
                <p style={{ color: "#6b7280" }}>No reviews yet. Be the first to review!</p>
              </div>
            )}
            
          </div>
        </div>

        {/* Booking Sidebar */}
        <div className="booking-sidebar">
          
          {error && (
            <div className="booking-error">
              {error}
            </div>
          )}

          <div className={`booking-price ${estimatedPrice > 0 ? 'has-price' : 'no-price'}`}>
            ₱{estimatedPrice.toFixed(2)}
          </div>

          {/* Service Type */}
          <div className="booking-field">
            <label className="booking-label">
              Service type
            </label>
            <div className="booking-select-wrapper">
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="booking-select"
              >
                <option value="">Select Service</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={20} className="booking-select-icon" />
            </div>
          </div>

          {/* Pet Type */}
          <div className="booking-field">
            <label className="booking-label">
              Pet type
            </label>
            <div className="booking-select-wrapper">
              <select
                value={petType}
                onChange={(e) => setPetType(e.target.value)}
                disabled={!serviceType}
                className="booking-select"
              >
                <option value="">
                  {serviceType ? 'Select Pet Type' : 'Select Service First'}
                </option>
                {availablePetTypes.map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
              <ChevronDown size={20} className="booking-select-icon" />
            </div>
          </div>

          {/* Pet Size */}
          <div className="booking-field">
            <label className="booking-label">
              Pet size
            </label>
            <div className="booking-select-wrapper">
              <select
                value={petSize}
                onChange={(e) => setPetSize(e.target.value)}
                disabled={!serviceType}
                className="booking-select"
              >
                <option value="">
                    {serviceType ? 'Select Pet Size' : 'Select Service First'}
                </option>
                {['small', 'medium', 'large', 'extra_large'].filter(size => availablePetSizes.includes(size)).map(size => (
                  <option key={size} value={size}>
                    {size.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </option>
                ))}
              </select>
              <ChevronDown size={20} className="booking-select-icon" />
            </div>
          </div>

          {/* Date */}
          <div className="booking-field">
            <label className="booking-label">
              Date
            </label>
            <div className="booking-select-wrapper">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} 
                className="booking-date-input"
              />
            </div>
          </div>

          {/* Time Slot */}
          <div className="booking-field">
            <label className="booking-label">
              Time slot
            </label>
            <div className="booking-select-wrapper">
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="booking-select"
              >
                <option value="">Select Time</option>
                <option value="9:00 AM">9:00 AM</option>
                <option value="10:00 AM">10:00 AM</option>
                <option value="11:00 AM">11:00 AM</option>
                <option value="1:00 PM">1:00 PM</option>
                <option value="2:00 PM">2:00 PM</option>
                <option value="3:00 PM">3:00 PM</option>
                <option value="4:00 PM">4:00 PM</option>
              </select>
              <ChevronDown size={20} className="booking-select-icon" />
            </div>
          </div>

          {/* Book Button */}        
          <button          
            onClick={handleBookAppointment} 
            disabled={isBooking || estimatedPrice <= 0}           
            className="booking-button"
          >          
            {isBooking ? 'Checking Availability...' : 'Book an appointment'}        
          </button>    
        </div>
      </main>
    
    <ImageModal 
      isOpen={selectedImageIndex !== null}
      onClose={() => setSelectedImageIndex(null)}
      images={images}
      currentIndex={selectedImageIndex}
      onNext={handleNextImage}
      onPrev={handlePrevImage}
    />
    <Footer />
  </div>
  );
};

export default ListingInfo;