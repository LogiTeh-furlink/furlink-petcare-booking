// src/pages/auth/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { Heart, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";   // ⭐ Added
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./Dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate(); // ⭐ Added

  const [profile, setProfile] = useState(null);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
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
        .select("id, business_name, city")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (!error && data) {
        const providersWithDetails = await Promise.all(
          data.map(async (provider) => {
            const { data: services } = await supabase
              .from("services")
              .select(`service_options (price)`)
              .eq("provider_id", provider.id);

            let minPrice = null;
            let maxPrice = null;

            if (services && services.length > 0) {
              const prices = services
                .flatMap((s) => s.service_options || [])
                .map((opt) => parseFloat(opt.price))
                .filter((p) => !isNaN(p));

              if (prices.length > 0) {
                minPrice = Math.min(...prices);
                maxPrice = Math.max(...prices);
              }
            }

            const { data: images } = await supabase
              .from("service_provider_images")
              .select("image_url")
              .eq("provider_id", provider.id)
              .limit(1);

            return {
              ...provider,
              priceRange:
                minPrice && maxPrice
                  ? `₱${minPrice} - ₱${maxPrice}`
                  : "Price not available",
              imageUrl:
                images && images.length > 0 ? images[0].image_url : null,
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
        <main className="dashboard-container" style={{ textAlign: "center", padding: "4rem" }}>
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
              
              // ⭐ Added clickable card
              <div
                key={provider.id}
                className="provider-card"
                onClick={() => navigate(`/listing/${provider.id}`)}
                style={{ cursor: "pointer" }}
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
                    <button
                      className="favorite-btn"
                      aria-label="Add to favorites"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Heart size={20} />
                    </button>
                  </div>

                  <p className="provider-location">{provider.city}</p>
                  <p className="provider-price">{provider.priceRange}</p>

                  <div className="provider-rating">
                    <span className="rating-value">0.0</span>
                  </div>
                </div>

              </div>
            ))}
          </div>

          {providers.length === 0 && (
            <p style={{ textAlign: "center", color: "#6b7280", marginTop: "2rem" }}>
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
