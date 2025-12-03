// src/pages/pet-owner/ListingInfo.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { Store, MapPin, X, ChevronDown } from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./ListingInfo.css";

// Image Modal Component (Unchanged)
const ImageModal = ({ isOpen, onClose, imageUrl }) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div 
      className="image-modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '2rem'
      }}
    >
      <button 
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10000
        }}
      >
        <X size={24} />
      </button>
      <img 
        src={imageUrl} 
        alt="Full view" 
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90%',
          maxHeight: '90%',
          objectFit: 'contain',
          borderRadius: '8px'
        }}
      />
    </div>
  );
};

const ListingInfo = () => {
  const { id } = useParams();
  const [user, setUser] = useState(null); // Added state for current user
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [hours, setHours] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false); // New state for booking status
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedImage, setSelectedImage] = useState(null);
  const [error, setError] = useState(null); // New state for errors

  // Booking form states
  const [petType, setPetType] = useState('');
  const [petSize, setPetSize] = useState('');
  const [serviceType, setServiceType] = useState(''); // Holds service ID
  const [selectedDate, setSelectedDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState(0);

  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // --- Data Fetching Hooks ---

  useEffect(() => {
    fetchAllData();
    fetchUser();
  }, [id]);

  useEffect(() => {
    calculatePrice();
  }, [petType, petSize, serviceType]);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (!user) {
        // Redirect or show a message if not logged in
        console.error("User not logged in.");
    }
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // Fetch provider
      const { data: providerData, error: providerError } = await supabase
        .from("service_providers")
        .select("*")
        .eq("id", id)
        .eq("status", "approved")
        .single();

      if (providerError) {
        console.error("Provider Error:", providerError);
        setProvider(null);
      } else {
        setProvider(providerData);
      }

      // Fetch services with options
      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select(`*, service_options (*)`)
        .eq("provider_id", id);
      
      setServices(servicesData || []);

      // Fetch hours (omitted for brevity)
      const { data: hoursData } = await supabase
        .from("service_provider_hours")
        .select("*")
        .eq("provider_id", id);
      setHours(hoursData || []);

      // Fetch images (omitted for brevity)
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

  // --- Helper Functions ---

  const calculatePrice = () => {
    if (!serviceType || !petSize || !petType) {
      setEstimatedPrice(0);
      return;
    }
    setError(null); // Clear previous errors

    const selectedService = services.find(s => s.id === serviceType);
    if (!selectedService || !selectedService.service_options) {
      setEstimatedPrice(0);
      return;
    }

    // Find the price option based on pet type and size
    const matchingOption = selectedService.service_options.find(
      opt => opt.size === petSize && (opt.pet_type === petType || opt.pet_type === 'dog-cat')
    );

    if (matchingOption) {
      setEstimatedPrice(parseFloat(matchingOption.price));
    } else {
      setEstimatedPrice(0);
      setError("No valid pricing option found for the selected pet type and size.");
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

  // --- Booking Logic ---

  const handleBookAppointment = async () => {
    if (isBooking) return;
    setError(null);

    // 1. Basic Client-Side Validation
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
        // 2. Determine Service Option ID
        const selectedService = services.find(s => s.id === serviceType);
        if (!selectedService || !selectedService.service_options) {
            throw new Error("Invalid service selected.");
        }

        const matchingOption = selectedService.service_options.find(
            opt => opt.size === petSize && (opt.pet_type === petType || opt.pet_type === 'dog-cat')
        );

        if (!matchingOption) {
            throw new Error("Price calculation failed. Please check pet type and size.");
        }
        
        const serviceOptionId = matchingOption.id;

        // 3. Construct Booking Data
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
            // Default status is 'pending', payment_status is 'unpaid'
        };

        // 4. Insert into Supabase
        const { error: bookingError } = await supabase
            .from('bookings')
            .insert([bookingData]);

        if (bookingError) {
            console.error("Supabase Booking Error:", bookingError);
            throw new Error(`Booking failed: ${bookingError.message}`);
        }

        alert('Appointment booked successfully! Status is pending confirmation.');

        // Optional: Reset form fields
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
      <main className="listing-container" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
        
        {/* Main Content (Unchanged) */}
        <div style={{ flex: 1 }}>
          {/* ... (Tab Navigation, Image Gallery, Tab Content sections remain unchanged) ... */}
          {/* Removed for brevity in the response, but they are still in the final code. */}

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
          <div className="listing-images">
            {images.length > 0 ? (
              <>
                <div 
                  className="main-image-placeholder" 
                  onClick={() => setSelectedImage(images[0].image_url)}
                  style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                >
                  <img 
                    src={images[0].image_url} 
                    alt="Main facility" 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover',
                      transition: 'transform 0.3s ease'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                </div>
                <div className="thumbnail-grid">
                  {images.slice(1, 5).map((img, index) => (
                    <div 
                      key={img.id} 
                      className="thumbnail-placeholder"
                      onClick={() => setSelectedImage(img.image_url)}
                      style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                    >
                      <img 
                        src={img.image_url} 
                        alt={`Facility ${index + 2}`}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      />
                    </div>
                  ))}
                  {/* Fill remaining slots with placeholders if less than 4 additional images */}
                  {[...Array(Math.max(0, 4 - images.slice(1).length))].map((_, index) => (
                    <div key={`placeholder-${index}`} className="thumbnail-placeholder">
                      <Store size={40} strokeWidth={1.5} color="#9ca3af" />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="main-image-placeholder">
                  <Store size={80} strokeWidth={1.5} color="#9ca3af" />
                </div>
                <div className="thumbnail-grid">
                  <div className="thumbnail-placeholder">
                    <Store size={40} strokeWidth={1.5} color="#9ca3af" />
                  </div>
                  <div className="thumbnail-placeholder">
                    <Store size={40} strokeWidth={1.5} color="#9ca3af" />
                  </div>
                  <div className="thumbnail-placeholder">
                    <Store size={40} strokeWidth={1.5} color="#9ca3af" />
                  </div>
                  <div className="thumbnail-placeholder">
                    <Store size={40} strokeWidth={1.5} color="#9ca3af" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Tab Content */}
          <div className="listing-content">
            
            {/* Overview Tab (Content Omitted for brevity) */}
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
                  <h2 className="section-title">About the shop</h2>
                  <div className="info-text">
                    <p><strong>Business Name:</strong> {provider.business_name}</p>
                    <p><strong>Email:</strong> {provider.business_email}</p>
                    <p><strong>Mobile:</strong> {provider.business_mobile}</p>
                    <p><strong>Type of Service:</strong> {provider.type_of_service}</p>
                    {provider.social_media_url && (
                      <p>
                        <strong>Social Media:</strong>{" "}
                        <a href={provider.social_media_url} target="_blank" rel="noopener noreferrer">
                          Visit Page
                        </a>
                      </p>
                    )}
                  </div>
                </div>

                {/* Location in Overview */}
                <div className="info-section">
                  <h2 className="section-title">Location</h2>
                  <div className="location-info">
                    <MapPin size={20} />
                    <div>
                      <p>{provider.house_street}</p>
                      <p>{provider.barangay}, {provider.city}</p>
                      <p>{provider.province}, {provider.postal_code}</p>
                      <p>{provider.country}</p>
                    </div>
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

                {/* Services & Prices in Overview */}
                {services.length > 0 && (
                  <div className="info-section">
                    <h2 className="section-title">Services & Pricing</h2>
                    {services.map((service) => (
                      <div key={service.id} className="service-section" style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <h3 className="service-name">{service.name}</h3>
                          {service.type && (
                            <span style={{ 
                              backgroundColor: service.type === 'package' ? '#dbeafe' : '#e0e7ff', 
                              color: service.type === 'package' ? '#1e40af' : '#4338ca', 
                              padding: '0.25rem 0.75rem', 
                              borderRadius: '9999px',
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              textTransform: 'capitalize'
                            }}>
                              {service.type}
                            </span>
                          )}
                        </div>
                        
                        {service.description && (
                          <p style={{ color: '#4b5563', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                            {service.description}
                          </p>
                        )}
                        
                        {service.notes && (
                          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem', fontStyle: 'italic' }}>
                            <strong>Note:</strong> {service.notes}
                          </p>
                        )}
                        
                        {service.service_options && service.service_options.length > 0 && (
                          <div className="pricing-wrapper" style={{ marginTop: '0.75rem' }}>
                            <table style={{ 
                              width: '100%', 
                              borderCollapse: 'collapse',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                            }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f3f4f6' }}>
                                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>Pet Type</th>
                                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>Size</th>
                                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>Weight</th>
                                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', fontSize: '0.875rem' }}>Price</th>
                                </tr>
                              </thead>
                              <tbody>
                                {service.service_options.map((opt, index) => (
                                  <tr key={opt.id} style={{ 
                                    borderTop: index > 0 ? '1px solid #e5e7eb' : 'none'
                                  }}>
                                    <td style={{ 
                                      padding: '12px', 
                                      textTransform: 'capitalize',
                                      fontSize: '0.875rem'
                                    }}>
                                      {opt.pet_type === 'dog-cat' ? 'Dog & Cat' : opt.pet_type}
                                    </td>
                                    <td style={{ 
                                      padding: '12px',
                                      fontSize: '0.875rem'
                                    }}>
                                      {opt.size ? opt.size.replace('_', ' ') : 'N/A'}
                                    </td>
                                    <td style={{ 
                                      padding: '12px',
                                      fontSize: '0.875rem',
                                      color: '#6b7280'
                                    }}>
                                      {opt.weight_range || 'N/A'}
                                    </td>
                                    <td style={{ 
                                      padding: '12px', 
                                      textAlign: 'right',
                                      fontWeight: '600',
                                      color: '#059669',
                                      fontSize: '0.875rem'
                                    }}>
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

            {/* Prices Tab (Content Omitted for brevity) */}
            {activeTab === "prices" && (
              <div className="tab-content">
                <h2 className="section-title">Service Prices</h2>
                
                {services.length > 0 ? (
                  services.map((service) => (
                    <div key={service.id} className="service-section">
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 className="service-name">{service.name}</h3>
                        {service.type && (
                          <span style={{ 
                            backgroundColor: service.type === 'package' ? '#dbeafe' : '#e0e7ff', 
                            color: service.type === 'package' ? '#1e40af' : '#4338ca', 
                            padding: '0.25rem 0.75rem', 
                            borderRadius: '9999px',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            textTransform: 'capitalize'
                          }}>
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
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                          <strong>Note:</strong> {service.notes}
                        </p>
                      )}
                      
                      {service.service_options && service.service_options.length > 0 ? (
                        <div className="pricing-wrapper" style={{ marginTop: '1rem' }}>
                          <table style={{ 
                            width: '100%', 
                            borderCollapse: 'collapse',
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f3f4f6' }}>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>Pet Type</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>Size</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>Weight</th>
                                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', fontSize: '0.875rem' }}>Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {service.service_options.map((opt, index) => (
                                <tr key={opt.id} style={{ 
                                  borderTop: index > 0 ? '1px solid #e5e7eb' : 'none'
                                }}>
                                  <td style={{ 
                                    padding: '12px', 
                                    textTransform: 'capitalize',
                                    fontSize: '0.875rem'
                                  }}>
                                    {opt.pet_type === 'dog-cat' ? 'Dog & Cat' : opt.pet_type}
                                  </td>
                                  <td style={{ 
                                    padding: '12px',
                                    fontSize: '0.875rem'
                                  }}>
                                    {opt.size ? opt.size.replace('_', ' ') : 'N/A'}
                                  </td>
                                  <td style={{ 
                                    padding: '12px',
                                    fontSize: '0.875rem',
                                    color: '#6b7280'
                                  }}>
                                    {opt.weight_range || 'N/A'}
                                  </td>
                                  <td style={{ 
                                    padding: '12px', 
                                    textAlign: 'right',
                                    fontWeight: '600',
                                    color: '#059669',
                                    fontSize: '0.875rem'
                                  }}>
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

            {/* Location Tab (Content Omitted for brevity) */}
            {activeTab === "location" && (
              <div className="tab-content">
                <h2 className="section-title">Location</h2>
                <div className="location-info">
                  <MapPin size={20} />
                  <div>
                    <p><strong>Address:</strong></p>
                    <p>{provider.house_street}</p>
                    <p>{provider.barangay}, {provider.city}</p>
                    <p>{provider.province}, {provider.postal_code}</p>
                    <p>{provider.country}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Reviews Tab (Content Omitted for brevity) */}
            {activeTab === "reviews" && (
              <div className="tab-content">
                <h2 className="section-title">Reviews</h2>
                <p style={{ color: "#6b7280" }}>No reviews yet. Be the first to review!</p>
              </div>
            )}
            
          </div>
        </div>

        {/* Booking Sidebar */}
        <div style={{
          width: '320px',
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          position: 'sticky',
          top: '100px',
          height: 'fit-content'
        }}>
          
          {/* Booking Error Display */}
          {error && (
            <div style={{ 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              backgroundColor: '#fee2e2', 
              color: '#dc2626', 
              borderRadius: '8px',
              fontSize: '0.875rem',
              border: '1px solid #fca5a5'
            }}>
              {error}
            </div>
          )}

          <div style={{ 
            fontSize: '2rem', 
            fontWeight: '700', 
            color: estimatedPrice > 0 ? '#059669' : '#9ca3af', // Color change based on price
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            ₱{estimatedPrice.toFixed(2)}
          </div>

          {/* Pet Type (Unchanged) */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.75rem', 
              fontWeight: '600',
              color: '#6b7280',
              marginBottom: '0.5rem',
              textTransform: 'uppercase'
            }}>
              Pet type
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={petType}
                onChange={(e) => setPetType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  appearance: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'white'
                }}
              >
                <option value="">Select Pet Type</option>
                <option value="dog">Dog</option>
                <option value="cat">Cat</option>
              </select>
              <ChevronDown size={20} style={{ 
                position: 'absolute', 
                right: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#6b7280'
              }} />
            </div>
          </div>

          {/* Pet Size (Unchanged) */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.75rem', 
              fontWeight: '600',
              color: '#6b7280',
              marginBottom: '0.5rem',
              textTransform: 'uppercase'
            }}>
              Pet size
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={petSize}
                onChange={(e) => setPetSize(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  appearance: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'white'
                }}
              >
                <option value="">Select Pet Size</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="extra_large">Extra Large</option>
              </select>
              <ChevronDown size={20} style={{ 
                position: 'absolute', 
                right: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#6b7280'
              }} />
            </div>
          </div>

          {/* Service Type (Unchanged) */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.75rem', 
              fontWeight: '600',
              color: '#6b7280',
              marginBottom: '0.5rem',
              textTransform: 'uppercase'
            }}>
              Service type
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  appearance: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'white'
                }}
              >
                <option value="">Select Service</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={20} style={{ 
                position: 'absolute', 
                right: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#6b7280'
              }} />
            </div>
          </div>

          {/* Date (Unchanged) */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.75rem', 
              fontWeight: '600',
              color: '#6b7280',
              marginBottom: '0.5rem',
              textTransform: 'uppercase'
            }}>
              Date
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} // Ensure date is not in the past
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: 'white'
                }}
              />
            </div>
          </div>

          {/* Time Slot (Unchanged) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.75rem', 
              fontWeight: '600',
              color: '#6b7280',
              marginBottom: '0.5rem',
              textTransform: 'uppercase'
            }}>
              Time slot
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  appearance: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'white'
                }}
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
              <ChevronDown size={20} style={{ 
                position: 'absolute', 
                right: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#6b7280'
              }} />
            </div>
          </div>

          {/* Book Button (Updated) */}      
          <button        
            onClick={handleBookAppointment} 
            disabled={isBooking || estimatedPrice <= 0}       
            style={{          
              width: '100%',          
              padding: '1rem',          
              backgroundColor: isBooking || estimatedPrice <= 0 ? '#9ca3af' : '#1e3a8a',          
              color: 'white',          
              border: 'none',          
              borderRadius: '8px',          
              fontSize: '1rem',          
              fontWeight: '600',          
              cursor: isBooking || estimatedPrice <= 0 ? 'not-allowed' : 'pointer',          
              transition: 'background-color 0.2s'        
            }}        
            onMouseOver={(e) => { if (!isBooking && estimatedPrice > 0) e.currentTarget.style.backgroundColor = '#1e40af'; }}        
            onMouseOut={(e) => { if (!isBooking && estimatedPrice > 0) e.currentTarget.style.backgroundColor = '#1e3a8a'; }}      
          >        
            {isBooking ? 'Booking...' : 'Book an appointment'}      
          </button>    
        </div>
      </main>
      
      {/* Image Modal (Unchanged) */}
      <ImageModal 
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageUrl={selectedImage}
      />
      <Footer />
    </div>
  );
};

export default ListingInfo;