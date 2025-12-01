// src/pages/pet-owner/ListingInfo.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { Store, MapPin } from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./ListingInfo.css";

const ListingInfo = () => {
  const { id } = useParams();
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    fetchAllData();
  }, [id]);

  const fetchAllData = async () => {
    try {
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

      // Fetch services with their options
      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select(`
          *,
          service_options (
            id,
            pet_type,
            size,
            weight_range,
            price
          )
        `)
        .eq("provider_id", id);

      console.log("Services Data:", servicesData);
      console.log("Services Error:", servicesError);
      
      if (servicesData) {
        // Sort service options by pet type and size
        const sortedServices = servicesData.map(service => ({
          ...service,
          service_options: service.service_options?.sort((a, b) => {
            // First sort by pet type
            if (a.pet_type !== b.pet_type) {
              return a.pet_type === "Dog" ? -1 : 1;
            }
            // Then sort by size
            const sizeOrder = { "Small": 1, "Medium": 2, "Large": 3, "Extra Large": 4 };
            return (sizeOrder[a.size] || 0) - (sizeOrder[b.size] || 0);
          }) || []
        }));
        setServices(sortedServices);
      } else {
        setServices([]);
      }

      // Fetch hours
      const { data: hoursData } = await supabase
        .from("service_provider_hours")
        .select("*")
        .eq("provider_id", id);
      setHours(hoursData || []);

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

        {/* Image Gallery Placeholder */}
        <div className="listing-images">
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
            </div>
          )}

          {/* Prices Tab */}
          {activeTab === "prices" && (
            <div className="tab-content">
              <h2 className="section-title">Service Prices</h2>
              
              {services.length > 0 ? (
                services.map((service) => {
                  const hasDogs = service.service_options?.some(opt => opt.pet_type === "Dog");
                  const hasCats = service.service_options?.some(opt => opt.pet_type === "Cat");
                  
                  return (
                    <div key={service.id} className="service-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 className="service-name">{service.name}</h3>
                        {service.type && (
                          <span style={{ 
                            backgroundColor: '#dbeafe', 
                            color: '#1e40af', 
                            padding: '0.25rem 0.75rem', 
                            borderRadius: '9999px',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            textTransform: 'uppercase'
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
                        <div className="pricing-tables">
                          {/* Dogs Table */}
                          {hasDogs && (
                            <div className="pricing-table">
                              <h4>Dogs</h4>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Size</th>
                                    <th>Weight</th>
                                    <th>Price</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {service.service_options
                                    .filter(opt => opt.pet_type === "Dog")
                                    .map((option) => (
                                      <tr key={option.id}>
                                        <td>{option.size}</td>
                                        <td>{option.weight_range || 'N/A'}</td>
                                        <td style={{ fontWeight: '600', color: '#059669' }}>
                                          ₱{parseFloat(option.price).toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Cats Table */}
                          {hasCats && (
                            <div className="pricing-table">
                              <h4>Cats</h4>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Size</th>
                                    <th>Weight</th>
                                    <th>Price</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {service.service_options
                                    .filter(opt => opt.pet_type === "Cat")
                                    .map((option) => (
                                      <tr key={option.id}>
                                        <td>{option.size}</td>
                                        <td>{option.weight_range || 'N/A'}</td>
                                        <td style={{ fontWeight: '600', color: '#059669' }}>
                                          ₱{parseFloat(option.price).toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p style={{ color: '#6b7280', marginTop: '1rem', fontStyle: 'italic' }}>
                          No pricing options available for this service.
                        </p>
                      )}
                    </div>
                  );
                })
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
      <Footer />
    </div>
  );
};

export default ListingInfo;