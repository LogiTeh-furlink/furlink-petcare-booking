// src/pages/auth/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./Dashboard.css";

const Dashboard = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
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
      setLoading(false);
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-page">
        <Header />
        <main className="dashboard-container" style={{ textAlign: "center", padding: "4rem" }}>
          <h2>Loading your dashboard...</h2>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Header />
      <main className="dashboard-container" style={{ textAlign: "center", padding: "4rem" }}>
        <h1 style={{ color: "#0E2679", fontSize: "2rem", marginBottom: "1rem" }}>
          Welcome back,{" "}
          <span style={{ color: "#FDBF00" }}>
            {profile?.first_name || profile?.display_name || "Pet Lover"}
          </span>
          ! 👋
        </h1>
        <p style={{ color: "#333", fontSize: "1.1rem" }}>
          You’re now logged in to <i>furlink</i>. Explore pet care services or manage your bookings
          effortlessly.
        </p>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
