import React, { useEffect, useState, useMemo, useRef} from "react";
import { supabase } from "../../config/supabase";
import { Store, Filter, Star, MapPin, Tag, X, Ban, Info, AlertTriangle, CheckCircle } from "lucide-react"; 
import { useNavigate } from "react-router-dom"; 
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./Dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate();
  const filterRef = useRef();

  // 1. INITIALIZE STATES
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // ⭐ SUSPENSION STATES
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionDate, setSuspensionDate] = useState(null);
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);

  // ⭐ WARNING INTERCEPTOR STATES
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [activeWarning, setActiveWarning] = useState(null);

  const [filters, setFilters] = useState({
    city: "All",
    exactRating: "Any",
    minPrice: 0,
    maxPrice: 5000,
  });

  // 2. Click Outside Logic
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterDropdown && filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilterDropdown]);

  // 3. Extraction & Filtering Logic
  const availableCities = useMemo(() => {
    const cities = providers.map(p => p.city).filter(Boolean);
    return ["All", ...new Set(cities)];
  }, [providers]);

  const filteredProviders = useMemo(() => {
    return providers.filter(p => {
      const matchCity = filters.city === "All" || p.city === filters.city;
      const providerRating = Math.floor(parseFloat(p.rating)).toString(); 
      const matchRating = filters.exactRating === "Any" || providerRating === filters.exactRating;
      const shopMin = p.numericMinPrice || 0;
      const matchPrice = shopMin >= filters.minPrice && shopMin <= filters.maxPrice;
      return matchCity && matchRating && matchPrice;
    });
  }, [providers, filters]);

  // 4. Data Loading Logic & Warning Check
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user);
          
          // A. Fetch Profile
          const { data: prof } = await supabase
            .from("profiles")
            .select("first_name, display_name, suspension_end_date, role") 
            .eq("id", user.id)
            .single();
          
          if (prof) {
            setProfile(prof);
            if (prof.suspension_end_date) {
                const endDate = new Date(prof.suspension_end_date);
                if (endDate > new Date()) {
                    setIsSuspended(true);
                    setSuspensionDate(endDate);
                }
            }
          }

          // B. Check for Unread Admin Warnings
          const { data: warningData } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .eq('title', 'Admin Warning')
            .eq('read', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (warningData) {
            setActiveWarning(warningData);
            setShowWarningModal(true);
          }
        }

        // C. Fetch Providers
        const { data, error } = await supabase
          .from("service_providers")
          .select(`id, business_name, city, user_id, provider_rating_analytics(total_combined_avg)`) 
          .eq("status", "approved")
          .order("created_at", { ascending: false });

        if (!error && data) {
          const detailed = await Promise.all(data.map(async (provider) => {
            const { data: services } = await supabase.from("services").select(`service_options(price)`).eq("provider_id", provider.id);
            let min = 0, max = 0;
            let formattedPriceRange = "Price not available";

            if (services?.length > 0) {
              const prices = services.flatMap(s => s.service_options || []).map(opt => parseFloat(opt.price)).filter(p => !isNaN(p));
              if (prices.length > 0) {
                min = Math.min(...prices);
                max = Math.max(...prices);
                formattedPriceRange = min === max ? `₱${min.toFixed(2)}` : `₱${min.toFixed(2)} - ₱${max.toFixed(2)}`;
              }
            }

            const { data: images } = await supabase.from("service_provider_images").select("image_url").eq("provider_id", provider.id).limit(1);
            const stats = provider.provider_rating_analytics?.[0];

            return {
              ...provider,
              numericMinPrice: min,
              priceRange: formattedPriceRange, 
              imageUrl: images?.[0]?.image_url || null,
              rating: stats ? parseFloat(stats.total_combined_avg).toFixed(1) : "0.0"
            };
          }));
          setProviders(detailed);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [navigate]);

  // ⭐ CLICK HANDLER: Intercepts if suspended
  const handleProviderClick = async (providerId, providerOwnerId) => {
    if (isSuspended) {
        setShowSuspendedModal(true);
        return;
    }

    try {
      const isOwner = currentUser && currentUser.id === providerOwnerId;
      if (!isOwner) {
        await supabase.rpc('increment_provider_click', { provider_id: providerId });
      }
    } catch (err) {
      console.error("Click handler error:", err);
    } finally {
      navigate(`/listing/${providerId}`);
    }
  };

  // ⭐ ACKNOWLEDGE WARNING HANDLER
  const acknowledgeWarning = async () => {
    if (!activeWarning) return;
  
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', activeWarning.id);
  
      if (error) throw error;
      setShowWarningModal(false);
      setActiveWarning(null);
    } catch (err) {
      console.error("Error acknowledging warning:", err);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard-page">
      <Header />
      <main className="dashboard-container">
        <div className="dashboard-content">
          <div className="dashboard-header-flex">
            <h1 className="dashboard-title">Explore Pet Grooming shops</h1>
            <div className="filter-wrapper" ref={filterRef}>
              <button className="filter-toggle-btn" onClick={() => setShowFilterDropdown(!showFilterDropdown)}>
                <Filter size={18} /> 
                <span>Filters</span>
                {(filters.city !== "All" || filters.exactRating !== "Any" || filters.minPrice > 0 || filters.maxPrice < 5000) && (
                    <span className="filter-dot" />
                )}
              </button>

              {showFilterDropdown && (
                  <div className="filter-dropdown-card">
                      <div className="filter-header">
                          <h3>Filter Options</h3>
                          <button 
                            className="reset-link" 
                            onClick={() => {
                              setFilters({ city: "All", exactRating: "Any", minPrice: 0, maxPrice: 5000 });
                              setShowFilterDropdown(false);
                            }}
                          >
                            Reset All
                          </button>
                      </div>

                      <div className="filter-section">
                          <label><MapPin size={14}/> Location</label>
                          <select className="filter-select" value={filters.city} onChange={(e) => setFilters({...filters, city: e.target.value})}>
                              {availableCities.map(city => <option key={city} value={city}>{city}</option>)}
                          </select>
                      </div>

                      <div className="filter-section">
                          <label><Star size={14}/> Rating (Exact Stars)</label>
                          <div className="rating-filter-grid">
                              {["Any", "1", "2", "3", "4"].map(r => (
                                  <button key={r} className={filters.exactRating === r ? "active" : ""} onClick={() => setFilters({...filters, exactRating: r})}>
                                      {r === "Any" ? "Any" : `${r} ★`}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div className="filter-section">
                        <label><Tag size={14}/> Price Range (₱)</label>
                        <div className="price-input-container">
                            <div className="price-field compact">
                                <span>Minimum</span>
                                <input type="number" value={filters.minPrice} onChange={(e) => setFilters({...filters, minPrice: Math.min(parseInt(e.target.value) || 0, filters.maxPrice)})} />
                            </div>
                            <div className="price-field compact" style={{ textAlign: 'right' }}>
                                <span>Maximum</span>
                                <input type="number" value={filters.maxPrice} onChange={(e) => setFilters({...filters, maxPrice: Math.max(parseInt(e.target.value) || 0, filters.minPrice)})} />
                            </div>
                        </div>
                        <div className="dual-range-slider">
                            <div className="slider-track" style={{ background: `linear-gradient(to right, #e2e8f0 ${ (filters.minPrice / 5000) * 100 }%, #0E2679 ${ (filters.minPrice / 5000) * 100 }%, #0E2679 ${ (filters.maxPrice / 5000) * 100 }%, #e2e8f0 ${ (filters.maxPrice / 5000) * 100 }%)` }}></div>
                            <input type="range" min="0" max="5000" step="100" value={filters.minPrice} onChange={(e) => { const val = parseInt(e.target.value); if (val <= filters.maxPrice) setFilters({...filters, minPrice: val}); }} className="range-input" />
                            <input type="range" min="0" max="5000" step="100" value={filters.maxPrice} onChange={(e) => { const val = parseInt(e.target.value); if (val >= filters.minPrice) setFilters({...filters, maxPrice: val}); }} className="range-input" />
                        </div>
                      </div>
                  </div>
              )}
            </div>
          </div>

          <div className="providers-grid">
            {filteredProviders.map((provider) => (
              <div
                key={provider.id}
                className={`provider-card ${isSuspended ? 'suspended-card' : ''}`}
                onClick={() => handleProviderClick(provider.id, provider.user_id)}
              >
                <div className="provider-image-container">
                  {provider.imageUrl ? (
                    <img src={provider.imageUrl} alt={provider.business_name} className="provider-image" />
                  ) : (
                    <div className="provider-image-placeholder">
                      <Store size={48} strokeWidth={1.5} color="#9ca3af" />
                    </div>
                  )}
                </div>

                <div className="provider-info">
                  <div className="provider-header">
                    <h3 className="provider-name">{provider.business_name}</h3>
                  </div>
                  <p className="provider-location">{provider.city}</p>
                  <p className="provider-price">{provider.priceRange}</p>
                  <div className="provider-rating">
                    <span className="rating-value">{provider.rating}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {providers.length === 0 && (
            <p className="dashboard-empty-message">No pet grooming shops available yet.</p>
          )}
        </div>
      </main>

      {/* ⭐ SUSPENSION MODAL */}
      {showSuspendedModal && (
        <div className="modal-overlay">
            <div className="modal-content refined-alert">
                <button className="modal-close-x" onClick={() => setShowSuspendedModal(false)}>
                    <X size={24} />
                </button>

                <div className="alert-icon-container" style={{ backgroundColor: '#fee2e2', color: '#ef4444', margin: '0 auto 20px', width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ban size={40} style={{ margin: '0 auto' }}/>
                </div>
                
                <div className="alert-text-content">
                    <h3 style={{ color: '#0E2679', fontSize: '1.25rem', fontWeight: '700', marginBottom: '10px' }}>
                        Account Restricted
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '25px' }}>
                        {profile?.role === 'service_provider' 
                            ? "Your service provider account is currently suspended. You cannot manage your shop, accept new bookings, or view other listings at this time."
                            : profile?.role === 'both'
                            ? "Your account is currently suspended. You are restricted from both booking new services and managing your own grooming shop."
                            : "Your account is currently restricted for policy violations. You cannot view shop details or make bookings at this time."
                        }
                    </p>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', width: '100%', border: '1px solid #e2e8f0', textAlign: 'left', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Info color="#0E2679" size={20} />
                        <div>
                            <label style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>Restoration Date</label>
                            <p style={{ margin: 0, fontWeight: '700', color: '#1e293b' }}>
                                {suspensionDate?.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '10px' }}>
                    Review the <span 
                        style={{ color: '#0E2679', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }} 
                        onClick={() => navigate('/terms')}
                    >
                        terms and conditions here
                    </span>.
                </p>
            </div>
        </div>
      )}

      {/* ⭐ WARNING MODAL (NEW) */}
      {showWarningModal && (
        <div className="warning-popup-overlay">
          <div className="warning-popup-content">
            <div className="warning-popup-header">
              <div className="warning-icon-wrapper">
                 <AlertTriangle color="#ef4444" size={32} />
              </div>
              <h2>Administrative Warning</h2>
            </div>
            <div className="warning-popup-body">
              <p className="warning-meta">Received on: {new Date(activeWarning?.created_at).toLocaleDateString()}</p>
              <div className="warning-message-box">
                "{activeWarning?.message}"
              </div>
              <p className="warning-footer-text">
                Please follow our terms and conditions to avoid further actions, including potential account suspension.
              </p>
            </div>
            <div className="warning-popup-footer">
              <button className="btn-acknowledge" onClick={acknowledgeWarning}>
                <CheckCircle size={18} />
                I Acknowledge this Warning
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Dashboard;