// src/pages/LandingPage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";
import petScene from "../../assets/pet_image_homepage.png";
import POFront from "../../assets/howto-petowner-front.png";
import POBack from "../../assets/howto-petowner-back.png";
import SPFront from "../../assets/howto-provider-front.png";
import SPBack from "../../assets/howto-provider-back.png";
import "../../components/HowToUse.css";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";

const HeroSection = () => {
  const navigate = useNavigate();
  return (
    <section className="hero">
      <div className="hero-container">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              Link with service providers
              <span className="hero-highlight"> with just few clicks</span>
            </h1>
            <p className="hero-description">
              Connect with trusted pet grooming professionals in your area. <br />
              Safe, reliable, and convenient pet care at your fingertips.
            </p>
            <button onClick={() => navigate("/signup")} className="hero-cta">
              Book now
              <svg
                className="cta-arrow"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M5 12h14m-7-7l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="hero-image">
            <img
              src={petScene}
              alt="Happy pets illustration"
              className="pet-scene-image"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

const AboutSection = () => (
  <section id="about" className="about">
    <div className="about-container">
      <h2 className="about-title">
        What is <i>furlink</i>?
      </h2>
      <p className="about-text">
        <i>furlink</i> offers a hassle-free experience for both customers and
        service providers. It enables grooming businesses to advertise their
        services while allowing pet owners to discover, schedule, and manage
        appointments in one place. It also provides an innovative AI-powered
        grooming preview tool, giving users a visual reference of potential pet
        haircut styles before booking—bridging the gap between customer
        expectations and actual grooming outcomes.
      </p>
    </div>
  </section>
);

const HowToUseSection = () => (
  <section className="how-to-use">
    <div className="how-to-use-container">
      <h2 className="about-title">How to use Furlink</h2>

      <div className="flip-card-container">
        {/* Pet Owner Card */}
        <div className="flip-card">
          <div className="flip-card-inner">
            <div className="flip-card-front">
              <img src={POFront} alt="Pet Owner Front" className="flip-image" />
              <h3>For Pet Owners</h3>
            </div>
            <div className="flip-card-back">
              <img src={POBack} alt="Pet Owner Back" className="flip-image" />
            </div>
          </div>
        </div>

        {/* Service Provider Card */}
        <div className="flip-card">
          <div className="flip-card-inner">
            <div className="flip-card-front">
              <img
                src={SPFront}
                alt="Service Provider Front"
                className="flip-image"
              />
              <h3>For Service Providers</h3>
            </div>
            <div className="flip-card-back">
              <img src={SPBack} alt="Service Provider Back" className="flip-image" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const LandingPage = () => {
  return (
    <div className="landing-page">
      <Header />
      <HeroSection />
      <AboutSection />
      <HowToUseSection />
      <Footer />
    </div>
  );
};

export default LandingPage;
