// src/pages/pet-owner/ServiceSetupIndiv.jsx
import React, { useState } from "react";

export default function ServiceSetupIndiv() {
  const [serviceName, setServiceName] = useState("");
  const [rate, setRate] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Individual Service Submitted:", { serviceName, rate });
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Service Setup - Individual Service</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
        <label>
          Service Name:
          <input
            type="text"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            required
          />
        </label>

        <br /><br />

        <label>
          Rate:
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            required
          />
        </label>

        <br /><br />

        <button type="submit">Save Service</button>
      </form>
    </div>
  );
}
