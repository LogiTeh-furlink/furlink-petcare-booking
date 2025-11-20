// src/pages/pet-owner/ServiceSummary.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { supabase } from "../../config/supabase";

export default function ServiceSummary() {
  const navigate = useNavigate();

  const [services, setServices] = useState([]);
  const [providerId, setProviderId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // load saved services
    const savedServices = localStorage.getItem("provider_services");
    const savedProviderId = localStorage.getItem("provider_id");

    if (!savedServices) {
      navigate("/service-listing");
      return;
    }

    setServices(JSON.parse(savedServices));
    setProviderId(savedProviderId);

    // If no provider ID → redirect user back to ApplyProvider
    if (!savedProviderId) {
      setError("Provider ID missing — please complete provider application.");
      setTimeout(() => navigate("/apply-provider"), 1500);
    }
  }, []);

  const handleEdit = () => {
    navigate("/service-listing");
  };

  const handleSubmit = async () => {
    if (!providerId) {
      setError("Provider ID missing — cannot save.");
      return;
    }

    setSaving(true);

    try {
      for (const service of services) {
        const { data: insertedService, error: serviceErr } = await supabase
          .from("services")
          .insert([
            {
              provider_id: providerId,
              type: service.type,
              name: service.name,
              description: service.description,
              notes: service.notes || null,
            },
          ])
          .select()
          .single();

        if (serviceErr) throw serviceErr;

        const serviceId = insertedService.id;

        const optionsPayload = service.options.map((opt) => ({
          service_id: serviceId,
          pet_type: opt.petType,
          size: opt.size,
          weight_range: opt.weightRange,
          price: parseFloat(opt.price),
        }));

        const { error: optErr } = await supabase
          .from("service_options")
          .insert(optionsPayload);

        if (optErr) throw optErr;
      }

      // Clear saved services once everything is saved
      localStorage.removeItem("provider_services");

      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save services.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <LoggedInNavbar hideBecomeProvider={true} />

      <div className="summary-container">
        <h1>Service Summary</h1>

        {error && <div className="error-box">{error}</div>}

        {services.map((service, idx) => (
          <div key={idx} className="summary-card">
            <h2>
              {service.type === "package" ? "Package" : "Individual"} Service
            </h2>

            <p><strong>Name:</strong> {service.name}</p>
            <p><strong>Description:</strong> {service.description}</p>
            {service.notes && <p><strong>Notes:</strong> {service.notes}</p>}

            <h3>Options</h3>
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Pet Type</th>
                  <th>Size</th>
                  <th>Weight Range</th>
                  <th>Price (PHP)</th>
                </tr>
              </thead>
              <tbody>
                {service.options.map((opt, i) => (
                  <tr key={i}>
                    <td>{opt.petType}</td>
                    <td>{opt.sizeLabel || opt.size}</td>
                    <td>{opt.weightRange}</td>
                    <td>{opt.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div className="summary-actions">
          <button className="btn-outline" onClick={handleEdit} disabled={saving}>
            Edit
          </button>

          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : "Save to Database"}
          </button>
        </div>
      </div>

      <Footer />
    </>
  );
}
