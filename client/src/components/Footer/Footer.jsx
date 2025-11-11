import React from "react";
import "./Footer.css";
import { FaFacebook, FaInstagram } from "react-icons/fa";
import { MdEmail } from "react-icons/md";

const Footer = () => {
  return (
    <footer className="main-footer">
      <div className="footer-container">
        <div className="footer-left">
          <span>© 2025 furlink</span>
          <a href="/terms">Terms and Conditions</a>
          <a href="/privacy">Privacy Policy</a>
        </div>
        <div className="footer-right">
          <a href="https://www.facebook.com/profile.php?id=61576298152992"><FaFacebook /></a>
          <a href="https://www.instagram.com/furbnb_startup/"><FaInstagram /></a>
          <a href="mailto:logiteh045@gmail.com"><MdEmail /></a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
