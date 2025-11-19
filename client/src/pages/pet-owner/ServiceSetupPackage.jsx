// src/pages/pet-owner/ServiceSetupPackage.jsx
import React, { useState } from "react";

export default function ServiceSetupPackage() {
  const [packageName, setPackageName] = useState("");
  const [price, setPrice] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Package Submitted:", { packageName, price });
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Service Setup - Package</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
        <label>
          Package Name:
          <input
            type="text"
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            required
          />
        </label>

        <br /><br />

        <label>
          Price:
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </label>

        <br /><br />

        <button type="submit">Save Package</button>
      </form>
    </div>
  );
}
