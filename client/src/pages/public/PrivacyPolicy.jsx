import React from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { FaUserShield } from "react-icons/fa";

const PrivacyPolicy = () => {
  return (
    <div className="legal-page">
      <Header />
      <main className="legal-container" style={{ padding: "80px 20px", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <FaUserShield size={50} color="#0E2679" />
          <h1 style={{ color: "#0E2679", marginTop: "10px" }}>Privacy Policy</h1>
          <p style={{ color: "#64748b" }}>Last Updated: February 2026</p>
        </div>

        <section className="legal-content" style={{ lineHeight: "1.6", color: "#1e293b" }}>
          <h3>1. Information We Collect</h3>
          <p>We collect personal details such as your name, email address, mobile number, and information regarding your pets to facilitate booking services.</p>

          <h3>2. How We Use Your Data</h3>
          <p>Your data is used to manage your account, process bookings, and improve our service offerings. Service Providers will see your contact details only when a booking is confirmed.</p>

          <h3>3. Data Security</h3>
          <p>We implement industry-standard security measures including Row Level Security (RLS) to ensure your data is only accessible to authorized users.</p>

          <h3>4. Data Retention</h3>
          <p>If you deactivate your account, we retain your data for 30 days. After this period, your profile and pet information are permanently removed from our active database.</p>

          <h3>5. Cookies</h3>
          <p>We use essential cookies to keep you logged into your session and to remember your preferences.</p>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;