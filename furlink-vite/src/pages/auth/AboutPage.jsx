/* src/pages/auth/AboutPage.jsx */
import React from "react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import "../../styles/pages/AboutPage.css";

import LalainneImg from "../../assets/team/lalainne.jpg";
import AtashaImg from "../../assets/team/atasha.jpg";
import MichelleImg from "../../assets/team/michelle.jpg";
import FelizImg from "../../assets/team/feliz.jpg";
import LogitehImg from "../../assets/team/logiteh.jpg";

const AboutPage = () => (
  <div className="about-page">
    <Header />
    <main className="about-container">
      <section className="about-definition">
        <h1>What is <i>furlink</i>?</h1>
        <p>
          <i>furlink</i> offers a hassle-free experience for both customers and service providers. It enables grooming businesses to advertise their services while allowing pet owners to discover, schedule, and manage appointments in one place. It also provides an innovative AI-powered grooming preview tool, giving users a visual reference of potential pet haircut styles before booking.
        </p>
      </section>

      <section className="about-team">
        <h2>Meet the Team</h2>
        <div className="group-photo">
          <img src={LogitehImg} alt="FurLink Team" className="group-photo-img" />
        </div>
        <p className="team-subtitle">The team behind <i>furlink</i></p>
        <div className="team-grid">
          {[
            { name: "Lalainne Andaya", role: "Product Owner", img: LalainneImg },
            { name: "Atasha Frances Gayle Doria", role: "Lead Developer", img: AtashaImg },
            { name: "Michelle Reina Pineda", role: "QA Tester", img: MichelleImg },
            { name: "Feliz Angelica Salting", role: "Release Manager", img: FelizImg },
          ].map((member) => (
            <div key={member.name} className="team-member">
              <img src={member.img} alt={member.name} className="team-photo" />
              <h3>{member.name}</h3>
              <p>{member.role}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
    <Footer />
  </div>
);

export default AboutPage;
