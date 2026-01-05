// src/pages/auth/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { Store } from "lucide-react"; 
import { useNavigate } from "react-router-dom"; 
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./Dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null); // 1. Store the full user object
  const [profile, setProfile] = useState(null);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- UPDATED: Handle Click & Count ---
  const handleProviderClick = async (providerId, providerOwnerId) => {
    try {
        // 2. CHECK: Is the person clicking the owner?
        const isOwner = currentUser && currentUser.id === providerOwnerId;

        // Only count the view if it is NOT the owner
        if (!isOwner) {
            supabase.rpc('increment_provider_click', { provider_id: providerId }).then(({ error }) => {
                if (error) console.error("Error counting click:", error);
            });
        }
    } catch (err) {
        console.error("Click handler error:", err);
    } finally {
        navigate(`/listing/${providerId}`);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setCurrentUser(user); // Save user for comparison later
        const { data, error } = await supabase
          .from("profiles")
          .select("first_name, display_name")
          .eq("id", user.id)
          .single();

        if (!error && data) setProfile(data);
      }
    };

    const fetchProviders = async () => {
  const { data, error } = await supabase
    .from("service_providers")
    .select(`
      id, 
      business_name, 
      city, 
      user_id,
      provider_rating_analytics(total_combined_avg)
    `) 
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (!error && data) {
    const providersWithDetails = await Promise.all(
      data.map(async (provider) => {
        // --- Keep existing Price Logic ---
        const { data: services } = await supabase
          .from("services")
          .select(`service_options (price)`)
          .eq("provider_id", provider.id);

        let minPrice = null, maxPrice = null;
        if (services?.length > 0) {
          const prices = services.flatMap(s => s.service_options || []).map(opt => parseFloat(opt.price)).filter(p => !isNaN(p));
          if (prices.length > 0) {
            minPrice = Math.min(...prices);
            maxPrice = Math.max(...prices);
          }
        }

        // --- Keep existing Image Logic ---
        const { data: images } = await supabase
          .from("service_provider_images")
          .select("image_url")
          .eq("provider_id", provider.id)
          .limit(1);

        // --- DYNAMIC RATING LOGIC ---
        // This looks into the joined array for the specific provider's data
        const stats = provider.provider_rating_analytics?.[0];
        const avgRating = stats ? parseFloat(stats.total_combined_avg).toFixed(1) : "0.0";

        return {
          ...provider,
          priceRange: minPrice ? `₱${minPrice} - ₱${maxPrice}` : "Price not available",
          imageUrl: images?.[0]?.image_url || null,
          rating: avgRating // This is now unique to EACH shop
        };
      })
    );

    setProviders(providersWithDetails);
  }
};

    const loadData = async () => {
      setLoading(true);
      await fetchProfile();
      await fetchProviders();
      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-page">
        <Header />
        <main className="dashboard-container dashboard-loading">
          <h2>Loading...</h2>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Header />
      <main className="dashboard-container">
        <div className="dashboard-content">
          <h1 className="dashboard-title">Explore Pet Grooming shops</h1>

          <div className="providers-grid">
            {providers.map((provider) => (
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