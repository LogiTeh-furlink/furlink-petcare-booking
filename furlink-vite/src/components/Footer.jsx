// src/components/Footer.jsx
import React from "react";
import { Link } from "react-router-dom";
import "../pages/auth/LandingPage.css"; // optional for shared vars

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-left">
            <div className="footer-logo">furlink</div>
            <p className="footer-description">
              Connecting pet owners with trusted grooming services. Simple, fast, and reliable.
            </p>
          </div>

          <div className="footer-right">
            <Link className="footer-link" to="/about">About</Link>
            <Link className="footer-link" to="/login">Login</Link>
            <Link className="footer-link" to="/signup">Sign Up</Link>
          </div>
        </div>
        <div className="footer-copyright">
          &copy; {new Date().getFullYear()} furlink. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
