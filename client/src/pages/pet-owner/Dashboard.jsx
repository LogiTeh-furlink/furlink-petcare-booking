// src/pages/auth/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { Heart, Store } from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./Dashboard.css";

const Dashboard = () => {
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
        // For each provider, get the minimum price from their services
        const providersWithPrices = await Promise.all(
          data.map(async (provider) => {
            const { data: services } = await supabase
              .from("services")
              .select(`
                service_options (
                  price
                )
              `)
              .eq("provider_id", provider.id);

            // Extract all prices
            let minPrice = null;
            let maxPrice = null;
            
            if (services && services.length > 0) {
              const prices = services
                .flatMap(s => s.service_options || [])
                .map(opt => parseFloat(opt.price))
                .filter(p => !isNaN(p));
              
              if (prices.length > 0) {
                minPrice = Math.min(...prices);
                maxPrice = Math.max(...prices);
              }
            }

            return {
              ...provider,
              priceRange: minPrice && maxPrice ? `₱${minPrice} - ₱${maxPrice}` : "Price not available"
            };
          })
        );

        setProviders(providersWithPrices);
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
              <div key={provider.id} className="provider-card">
                <div className="provider-image-placeholder">
                  <Store size={48} strokeWidth={1.5} color="#9ca3af" />
                </div>
                
                <div className="provider-info">
                  <div className="provider-header">
                    <h3 className="provider-name">{provider.business_name}</h3>
                    <button className="favorite-btn" aria-label="Add to favorites">
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