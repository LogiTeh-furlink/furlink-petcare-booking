import React from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import "./AboutPage.css";

import LalainneImg from "../../assets/team/lalainne.jpg";
import AtashaImg from "../../assets/team/atasha.jpg";
import MichelleImg from "../../assets/team/michelle.jpg";
import FelizImg from "../../assets/team/feliz.jpg";
import LogitehImg from "../../assets/team/logiteh.jpg";

const AboutPage = () => {
  return (
    <div className="about-page">
      <Header />

      <main className="about-container">
        {/* Definition Section */}
        <section className="about-definition">
          <h1>
            What is <i>furlink</i>?
          </h1>
          <p>
            <i>furlink</i> offers a hassle-free experience for both customers and
            service providers. It enables grooming businesses to advertise their
            services while allowing pet owners to discover, schedule, and manage
            appointments in one place. It also provides an innovative AI-powered
            grooming preview tool, giving users a visual reference of potential
            pet haircut styles before booking — bridging the gap between customer
            expectations and actual grooming outcomes.
          </p>
        </section>

        {/* Team Section */}
        <section className="about-team">
          <h2>Meet the Team</h2>

          <div className="group-photo">
            <img
              src={LogitehImg}
              alt="FurLink Team"
              className="group-photo-img"
            />
          </div>

          <p className="team-subtitle">
            The team behind <i>furlink</i>
          </p>

          <div className="team-grid">
            <div className="team-member">
              <img src={LalainneImg} alt="Lalainne Andaya" className="team-photo" />
              <h3>Lalainne Andaya</h3>
              <p>Product Owner</p>
            </div>

            <div className="team-member">
              <img src={AtashaImg} alt="Atasha Frances Gayle Doria" className="team-photo" />
              <h3>Atasha Frances Gayle Doria</h3>
              <p>Lead Developer</p>
            </div>

            <div className="team-member">
              <img src={MichelleImg} alt="Michelle Reina Pineda" className="team-photo" />
              <h3>Michelle Reina Pineda</h3>
              <p>QA Tester</p>
            </div>

            <div className="team-member">
              <img src={FelizImg} alt="Feliz Angelica Salting" className="team-photo" />
              <h3>Feliz Angelica Salting</h3>
              <p>Release Manager</p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AboutPage;
