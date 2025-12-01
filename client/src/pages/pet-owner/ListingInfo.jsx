// src/pages/pet-owner/ListingInfo.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { Store, MapPin, X } from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./ListingInfo.css";

// Image Modal Component
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
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [hours, setHours] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedImage, setSelectedImage] = useState(null);

  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    fetchAllData();
  }, [id]);

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

      // Fetch services
      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select(`*, service_options (*)`)
        .eq("provider_id", id);

      console.log("Services Data:", servicesData);
      console.log("Services Error:", servicesError);
      
      setServices(servicesData || []);

      // Fetch hours
      const { data: hoursData } = await supabase
        .from("service_provider_hours")
        .select("*")
        .eq("provider_id", id);
      setHours(hoursData || []);

      // Fetch images
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

  const formatTime = (time) => {
    if (!time) return "";
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
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

          {/* Prices Tab */}
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

          {/* Location Tab */}
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

          {/* Reviews Tab */}
          {activeTab === "reviews" && (
            <div className="tab-content">
              <h2 className="section-title">Reviews</h2>
              <p style={{ color: "#6b7280" }}>No reviews yet. Be the first to review!</p>
            </div>
          )}

        </div>
      </main>

      {/* Image Modal */}
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