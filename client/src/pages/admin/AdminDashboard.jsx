// src/pages/admin/AdminDashboard.jsx
import React from "react";
import LoggedInAdmin from "../../components/Header/LoggedInAdmin";
import { FaStore } from "react-icons/fa";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  return (
    <>
      <LoggedInAdmin />

      <div className="admin-dashboard-container">
        <h1 className="admin-welcome">Welcome, Admin!</h1>

        {/* ==== TOP CARDS ROW ==== */}
        <div className="admin-cards-row">

          {/* Pending Approvals Card */}
          <div className="admin-card admin-card-primary">
            <div className="admin-card-icon">
              <FaStore size={32} />
            </div>

            <div className="admin-card-info">
              <h2 className="admin-card-number">10</h2>
              <p className="admin-card-label">Pending Approvals</p>
            </div>
          </div>

        </div>

        {/* ==== Business List Preview (not yet required but placeholder) ==== */}
        <div className="admin-business-box">
          <div className="admin-business-name">Furbnb</div>
          <button className="admin-view-btn">View Details</button>
        </div>

      </div>
    </>
  );
}
