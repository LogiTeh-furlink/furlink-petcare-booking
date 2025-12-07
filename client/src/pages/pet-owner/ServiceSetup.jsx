// src/pages/pet-owner/ServiceSetup.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaBoxOpen, FaPaw, FaArrowRight } from "react-icons/fa"; // Using react-icons
import "./ServiceSetup.css";

export default function ServiceSetup() {
  const navigate = useNavigate();

  return (
    <>
      <LoggedInNavbar hideBecomeProvider={true} />

      <div className="service-setup-wrapper">
        <div className="setup-header">
            <h1 className="setup-title">Choose Your Service Type</h1>
            <p className="setup-subtitle">Select how you want to list your services to get started.</p>
        </div>

        <div className="setup-cards">
          {/* PACKAGED SERVICE */}
          <div
            className="setup-card package"
            // 👇 Pass state: initialType = "package"
            onClick={() => navigate("/service-listing", { state: { initialType: "package" } })}
          >
            <div className="card-icon-wrapper">
                <FaBoxOpen className="setup-icon" />
            </div>
            <div className="card-content">
              <h3>Packaged Service</h3>
              <p>
                Bundle multiple services (e.g., Full Grooming) into a single package for better value and convenience.
              </p>
              <span className="card-action">Select Package <FaArrowRight size={12}/></span>
            </div>
          </div>

          {/* INDIVIDUAL SERVICE */}
          <div
            className="setup-card individual"
            // 👇 Pass state: initialType = "individual"
            onClick={() => navigate("/service-listing", { state: { initialType: "individual" } })}
          >
            <div className="card-icon-wrapper">
                <FaPaw className="setup-icon" />
            </div>
            <div className="card-content">
              <h3>Individual Service</h3>
              <p>
                List single services (e.g., Nail Trim, Ear Cleaning) for pet owners who want specific treatments.
              </p>
              <span className="card-action">Select Individual <FaArrowRight size={12}/></span>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}