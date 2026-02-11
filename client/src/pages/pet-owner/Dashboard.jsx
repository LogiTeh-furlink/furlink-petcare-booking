// src/pages/auth/Dashboard.jsx
import React, { useEffect, useState, useMemo, useRef} from "react";
import { supabase } from "../../config/supabase";
import { Store, Filter, Star, MapPin, Tag } from "lucide-react"; 
import { useNavigate } from "react-router-dom"; 
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./Dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate();
  const filterRef = useRef();

  // 1. INITIALIZE ALL STATES FIRST (Crucial to prevent ReferenceError)
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filters, setFilters] = useState({
    city: "All",
    exactRating: "Any",
    minPrice: 0,
    maxPrice: 5000,
  });

  // 2. Click Outside Logic (Now showFilterDropdown is initialized)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterDropdown && filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilterDropdown]);

  // 3. Extraction & Filtering Logic (useMemo)
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

  // 4. Data Loading Logic
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch User First
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user); // Set the state so handleProviderClick can see it
          const { data: prof } = await supabase.from("profiles").select("first_name, display_name").eq("id", user.id).single();
          if (prof) setProfile(prof);
        }

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

                // Logic for decimal display and range vs single value
                if (min === max) {
                  formattedPriceRange = `₱${min.toFixed(2)}`;
                } else {
                  formattedPriceRange = `₱${min.toFixed(2)} - ₱${max.toFixed(2)}`;
                }
              }
            }

            const { data: images } = await supabase.from("service_provider_images").select("image_url").eq("provider_id", provider.id).limit(1);
            const stats = provider.provider_rating_analytics?.[0];

            return {
              ...provider,
              numericMinPrice: min,
              priceRange: formattedPriceRange, // Using the new formatted string
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

  const handleProviderClick = async (providerId, providerOwnerId) => {
    try {
      // Use the currentUser state we fetched during loadData
      const isOwner = currentUser && currentUser.id === providerOwnerId;

      if (!isOwner) {
        // Log the click if it's not the owner
        await supabase.rpc('increment_provider_click', { provider_id: providerId });
      }
    } catch (err) {
      console.error("Click handler error:", err);
    } finally {
      // Redirect happens regardless of whether the RPC call succeeded
      navigate(`/listing/${providerId}`);
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
          <Filter size={18} /> {/* Added icon here */}
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
                        setShowFilterDropdown(false); // <--- Add this line
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
                            <button 
                                key={r} 
                                className={filters.exactRating === r ? "active" : ""} 
                                onClick={() => setFilters({...filters, exactRating: r})}
                            >
                                {r === "Any" ? "Any" : `${r} ★`}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="filter-section">
                  <label><Tag size={14}/> Price Range (₱)</label>
                  
                  {/* Input container now matches the width of the slider below */}
                  <div className="price-input-container">
                      <div className="price-field compact">
                          <span>Minimum</span>
                          <input 
                              type="number" 
                              value={filters.minPrice} 
                              onChange={(e) => setFilters({...filters, minPrice: Math.min(parseInt(e.target.value) || 0, filters.maxPrice)})} 
                          />
                      </div>
                      <div className="price-field compact" style={{ textAlign: 'right' }}>
                          <span>Maximum</span>
                          <input 
                              type="number" 
                              value={filters.maxPrice} 
                              onChange={(e) => setFilters({...filters, maxPrice: Math.max(parseInt(e.target.value) || 0, filters.minPrice)})} 
                          />
                      </div>
                  </div>

                  <div className="dual-range-slider">
                      {/* Fill color logic */}
                      <div 
                          className="slider-track" 
                          style={{
                              background: `linear-gradient(to right, #e2e8f0 ${ (filters.minPrice / 5000) * 100 }%, #0E2679 ${ (filters.minPrice / 5000) * 100 }%, #0E2679 ${ (filters.maxPrice / 5000) * 100 }%, #e2e8f0 ${ (filters.maxPrice / 5000) * 100 }%)`
                          }}
                      ></div>
                      
                      <input 
                          type="range" min="0" max="5000" step="100" 
                          value={filters.minPrice} 
                          onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (val <= filters.maxPrice) setFilters({...filters, minPrice: val});
                          }} 
                          className="range-input"
                      />
                      <input 
                          type="range" min="0" max="5000" step="100" 
                          value={filters.maxPrice} 
                          onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (val >= filters.minPrice) setFilters({...filters, maxPrice: val});
                          }} 
                          className="range-input"
                      />
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
                className="provider-card"
                // 4. Pass the provider.user_id (owner ID) to the handler
                onClick={() => handleProviderClick(provider.id, provider.user_id)}
              >
                <div className="provider-image-container">
                  {provider.imageUrl ? (
                    <img
                      src={provider.imageUrl}
                      alt={provider.business_name}
                      className="provider-image"
                    />
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
            <p className="dashboard-empty-message">
              No pet grooming shops available yet.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;