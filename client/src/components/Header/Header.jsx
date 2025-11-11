import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Header.css";
import logo from "../../assets/logo.png"; // adjust path if needed

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we're on the About page
  const isAboutPage = location.pathname === "/about";

  return (
    <header className="main-header">
      <div className="header-container">
        {/* Logo - always goes back to LandingPage */}
        <div className="header-left" onClick={() => navigate("/")}>
          <img src={logo} alt="Furlink logo" className="header-logo" />
        </div>

        {/* Navigation - hide About furlink when already on it */}
        <nav className="header-nav">
          {!isAboutPage && (
            <button onClick={() => navigate("/about")} className="nav-link">
              About furlink
            </button>
          )}
          <button
            onClick={() => navigate("/login")}
            className="nav-link"
          >
            Become a Service Provider
          </button>
          <button onClick={() => navigate("/signup")} className="signup-btn">
            Sign Up
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
