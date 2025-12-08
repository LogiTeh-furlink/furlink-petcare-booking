// src/pages/auth/PetDetails.jsx
import React from "react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";

const PetDetails = () => {
  return (
    <div className="pet-details-page">
      <Header />
      
      <main className="pet-details-container" style={{ padding: "4rem", textAlign: "center" }}>
        {/* Main content for pet details will go here */}
        <h1>Pet Details Page</h1>
        <p>This is where pet-specific information will be displayed.</p>
      </main>

      <Footer />
    </div>
  );
};

export default PetDetails;