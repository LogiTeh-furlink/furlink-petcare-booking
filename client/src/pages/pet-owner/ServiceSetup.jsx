// src/pages/pet-owner/ServiceSetup.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./ServiceSetup.css";

// Correct icon paths
import PackageIcon from "../../assets/apply-sp-package.png";
import IndivIcon from "../../assets/apply-sp-indiv.png";

export default function ServiceSetup() {
  const navigate = useNavigate();

  return (
    <>
      <LoggedInNavbar hideBecomeProvider={true} />

      <div className="service-setup-wrapper">
        <h1 className="setup-title">Service Provider Application</h1>
        <p className="setup-subtitle">What services do you want to add?</p>

        <div className="setup-cards">
          {/* PACKAGED SERVICE */}
          <div
            className="setup-card"
            onClick={() => navigate("/service-listing")}
          >
            <div>
              <h3>Packaged Service</h3>
              <p>
                A bundled set of services (grooming, hotel, etc.) for complete
                care and better value.
              </p>
            </div>

            <img src={PackageIcon} alt="packages icon" className="setup-icon" />
          </div>

          {/* INDIVIDUAL SERVICE */}
          <div
            className="setup-card"
            onClick={() => navigate("/service-listing")}
          >
            <div>
              <h3>Individual / A La Carte Service</h3>
              <p>
                Add single services individually and customize what you want to
                provide.
              </p>
            </div>

            <img src={IndivIcon} alt="individual service icon" className="setup-icon" />
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
