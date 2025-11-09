// src/components/Header.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../pages/auth/LandingPage.css"; // optional for shared vars like colors
import logo from "../assets/logo.png";

const Header = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <img
            src={logo}
            alt="Furlink Logo"
            className="header-logo"
            onClick={() => navigate("/")}
          />

          <nav className="desktop-nav">
            <Link className="nav-link" to="/about">About</Link>
            <Link className="nav-link" to="/login">Login</Link>
            <button className="btn-primary" onClick={() => navigate("/signup")}>
              Sign Up
            </button>
          </nav>

          {/* Mobile Menu */}
          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          {mobileOpen && (
            <div className="mobile-menu">
              <Link className="mobile-nav-link" to="/about">About</Link>
              <Link className="mobile-nav-link" to="/login">Login</Link>
              <button
                className="btn-primary mobile"
                onClick={() => navigate("/signup")}
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
