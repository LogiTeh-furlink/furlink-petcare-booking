import React from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { FaFileContract } from "react-icons/fa";

const TandC = () => {
  return (
    <div className="legal-page">
      <Header />
      <main className="legal-container" style={{ padding: "80px 20px", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <FaFileContract size={50} color="#0E2679" />
          <h1 style={{ color: "#0E2679", marginTop: "10px" }}>Terms and Conditions</h1>
          <p style={{ color: "#64748b" }}>Last Updated: February 2026</p>
        </div>

        <section className="legal-content" style={{ lineHeight: "1.6", color: "#1e293b" }}>
          <h3>1. Acceptance of Terms</h3>
          <p>By accessing and using furlink, you agree to be bound by these Terms and Conditions. If you do not agree, please refrain from using our services.</p>

          <h3>2. User Roles</h3>
          <p>Users can register as Pet Owners, Service Providers, or both. You are responsible for providing accurate information and maintaining the security of your account.</p>

          <h3>3. Booking and Payments</h3>
          <p>Service Providers set their own rates. furlink acts as a platform to facilitate bookings. Cancellations and refunds are subject to the provider's specific policies.</p>

          <h3>4. Account Deactivation</h3>
          <p>Users may deactivate their accounts at any time. Accounts are subject to a 30-day grace period before permanent data deletion.</p>

          <h3>5. Limitation of Liability</h3>
          <p>furlink is not responsible for the quality of services provided by third-party groomers or stylists.</p>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default TandC;