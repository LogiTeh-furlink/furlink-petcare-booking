import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Header.css";
import logo from "../../assets/logo.png";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isAboutPage = location.pathname === "/about";

  return (
    <header className="main-header">
      <div className="header-container">
        {/* Logo */}
        <div className="header-left" onClick={() => navigate("/")}>
          <img src={logo} alt="Furlink logo" className="header-logo" />
        </div>

        {/* Navigation */}
        <nav className="header-nav">
          {!isAboutPage && (
            <button onClick={() => navigate("/about")} className="nav-link">
              About furlink
            </button>
          )}
          <button onClick={() => navigate("/login")} className="signup-btn">
            Log in or Sign Up
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;