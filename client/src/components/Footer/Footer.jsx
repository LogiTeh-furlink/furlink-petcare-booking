import React from "react";
import "./Footer.css";
import { FaFacebook, FaInstagram } from "react-icons/fa";
import { MdEmail } from "react-icons/md";

const Footer = () => {
  // Replace 'your-actual-id' with your real Supabase project ID
  const SUPABASE_PROJECT_ID = "mdhudfatvdipxwufcbis"; 
  const BASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/agreements`;

  const termsUrl = `${BASE_URL}/terms_general.pdf`;
  const privacyUrl = `${BASE_URL}/privacy_policy.pdf`;

  return (
    <footer className="main-footer">
      <div className="footer-container">
        <div className="footer-left">
          <span>© 2026 furlink</span>
          {/* Updated Links to open Supabase PDF in new tab */}
          <a href={termsUrl} target="_blank" rel="noreferrer">Terms and Conditions</a>
          <a href={privacyUrl} target="_blank" rel="noreferrer">Privacy Policy</a>
        </div>
        <div className="footer-right">
          <a href="https://www.facebook.com/profile.php?id=61576298152992" target="_blank" rel="noreferrer"><FaFacebook /></a>
          <a href="https://www.instagram.com/furbnb_startup/" target="_blank" rel="noreferrer"><FaInstagram /></a>
          <a href="mailto:logiteh045@gmail.com"><MdEmail /></a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;