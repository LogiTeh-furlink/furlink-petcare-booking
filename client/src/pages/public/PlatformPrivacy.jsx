import React from "react";
import { Lock, Info } from "lucide-react";
import "./PlatformPrivacy.css";

const PlatformPrivacy = () => {
  return (
    <div className="platform-privacy-wrapper">
      <div className="platform-privacy-header">
        <Lock size={36} className="privacy-lock-icon" />
        <div>
          <h2 className="privacy-title">Privacy Policy</h2>
          <p className="privacy-subtitle">
            Learn how we collect, use, and protect your personal information.
          </p>
        </div>
      </div>

      <div className="platform-privacy-body">
        <div className="privacy-alert-box">
          <Info size={20} className="info-icon" />
          <p>
            <strong>Last Updated: February 16, 2026</strong><br/>
            This Privacy Policy explains how we collect, use, and protect your personal information in compliance with the Data Privacy Act of 2012 (RA 10173) of the Philippines.
          </p>
        </div>

        <div className="privacy-section">
          <h3>1. Information We Collect</h3>
          <p>We collect personal details to facilitate booking services, including:</p>
          <ul>
            <li><strong>Personal Identity:</strong> Your name, email address, and mobile number.</li>
            <li><strong>Pet Information:</strong> Names, breeds, medical history, and temperament.</li>
          </ul>
        </div>

        <div className="privacy-section">
          <h3>2. How We Use Your Data</h3>
          <ul>
            <li><strong>Management:</strong> To manage your account and process bookings.</li>
            <li><strong>Service Delivery:</strong> Service Providers will see your contact details only when a booking is confirmed.</li>
            <li><strong>Optimization:</strong> To improve our service offerings and platform performance.</li>
          </ul>
        </div>

        <div className="privacy-section">
          <h3>3. Data Security</h3>
          <p>We implement industry-standard security measures to ensure your data is only accessible to authorized users, including:</p>
          <ul>
            <li><strong>Row Level Security (RLS):</strong> To programmatically restrict data access.</li>
            <li><strong>Encryption:</strong> To protect data during storage and transmission.</li>
          </ul>
        </div>

        <div className="privacy-section">
          <h3>4. Cookies</h3>
          <p>We use essential cookies to:</p>
          <ul>
            <li>Keep you logged into your secure session.</li>
            <li>Remember your preferences and display settings.</li>
          </ul>
        </div>

        <div className="privacy-section">
          <h3>5. Data Retention & Compliance (RA 10173)</h3>
          <ul>
            <li><strong>Account Deactivation:</strong> If you deactivate your account, we will retain your profile and pet information.</li>
            <li><strong>Legitimate Business Purpose:</strong> In accordance with Philippine law, Transaction Data (such as booking history, payment records, and shop analytics) is retained indefinitely for legitimate business purposes, including accounting, tax compliance, and platform-wide analytics, even after account deactivation.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PlatformPrivacy;