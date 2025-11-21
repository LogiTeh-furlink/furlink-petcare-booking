// src/pages/pet-owner/ServiceListing.jsx
import React, { useEffect, useState } from "react";
import { X, PlusCircle, Save, Edit, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { supabase } from "../../config/supabase";
import "./ServiceListing.css";

const PET_SIZES = [
  { key: "extra_small", label: "Extra Small", defaultWeight: "00kg - 00kg" },
  { key: "small", label: "Small", defaultWeight: "00kg - 00kg" },
  { key: "medium", label: "Medium", defaultWeight: "00kg - 00kg" },
  { key: "large", label: "Large", defaultWeight: "00kg - 00kg" },
  { key: "extra_large", label: "Extra Large", defaultWeight: "00kg - 00kg" },
];

const PET_TYPES = [
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "dog-cat", label: "Dog & Cat" },
];

export default function ServiceListing() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = form, 2 = summary

  const [services, setServices] = useState(() => {
    try {
      const saved = localStorage.getItem("provider_services");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [globalError, setGlobalError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    localStorage.setItem("provider_services", JSON.stringify(services));
  }, [services]);

  // Initialize new service with default size rows
  const createNewService = (type = "package") => ({
    type,
    name: "",
    description: "",
    notes: "",
    petType: "dog",
    pricing: PET_SIZES.map((s) => ({
      size: s.key,
      sizeLabel: s.label,
      weight: s.defaultWeight,
      price: "000",
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    })),
  });

  const addService = (type = "package") => {
    setServices((prev) => [...prev, createNewService(type)]);
  };

  const removeService = (index) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  const updateService = (index, field, value) => {
    setServices((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const addPricingRow = (serviceIndex) => {
    const newRow = {
      size: "extra_small",
      sizeLabel: "Extra Small",
      weight: "00kg - 00kg",
      price: "000",
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    };
    setServices((prev) =>
      prev.map((s, i) =>
        i === serviceIndex ? { ...s, pricing: [...s.pricing, newRow] } : s
      )
    );
  };

  const removePricingRow = (serviceIndex, pricingIndex) => {
    setServices((prev) =>
      prev.map((s, i) =>
        i === serviceIndex
          ? { ...s, pricing: s.pricing.filter((_, j) => j !== pricingIndex) }
          : s
      )
    );
  };

  const updatePricing = (serviceIndex, pricingIndex, field, value) => {
    setServices((prev) =>
      prev.map((s, i) =>
        i === serviceIndex
          ? {
              ...s,
              pricing: s.pricing.map((p, j) => {
                if (j !== pricingIndex) return p;
                const updated = { ...p, [field]: value };
                if (field === "size") {
                  const sizeData = PET_SIZES.find((sz) => sz.key === value);
                  if (sizeData) {
                    updated.sizeLabel = sizeData.label;
                    updated.weight = sizeData.defaultWeight;
                  }
                }
                return updated;
              }),
            }
          : s
      )
    );
  };

  const validateServices = () => {
    const errs = {};
    if (services.length === 0) {
      errs.general = "Add at least one service before continuing.";
      setValidationErrors(errs);
      return false;
    }

    services.forEach((service, si) => {
      if (!service.name || !service.name.trim()) {
        errs[`service_${si}_name`] = "Service name is required";
      }
      if (!service.description || !service.description.trim()) {
        errs[`service_${si}_description`] = "Description is required";
      }
      if (!service.petType) {
        errs[`service_${si}_petType`] = "Pet type is required";
      }

      if (!service.pricing || service.pricing.length === 0) {
        errs[`service_${si}_pricing`] = "Add at least one pricing row";
      } else {
        service.pricing.forEach((pricing, pi) => {
          if (!pricing.price || isNaN(Number(pricing.price))) {
            errs[`service_${si}_pricing_${pi}_price`] = "Valid price required";
          }
          if (!pricing.weight || !pricing.weight.trim()) {
            errs[`service_${si}_pricing_${pi}_weight`] = "Weight range required";
          }
        });
      }
    });

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleReviewServices = () => {
    setGlobalError("");
    if (validateServices()) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBackToEdit = () => {
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveServicesToDB = async () => {
    setIsSaving(true);
    setGlobalError("");
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("User not authenticated. Please sign in and try again.");
      }

      let providerId = localStorage.getItem("providerId");
      if (!providerId) {
        const { data: providers, error: provErr } = await supabase
          .from("service_providers")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        if (provErr) console.warn("Error fetching provider:", provErr);
        if (providers && providers.length > 0) {
          providerId = providers[0].id;
          localStorage.setItem("providerId", providerId);
        }
      }

      if (!providerId) {
        throw new Error(
          "Provider ID missing. Please complete your provider application first."
        );
      }

      for (const service of services) {
        const { data: serviceData, error: serviceError } = await supabase
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

        if (serviceError) throw serviceError;
        const serviceId = serviceData.id;

        const optionsData = service.pricing.map((pricing) => ({
          service_id: serviceId,
          pet_type: service.petType,
          size: pricing.size,
          weight_range: pricing.weight,
          price: parseFloat(pricing.price) || 0,
        }));

        if (optionsData.length > 0) {
          const { error: optionsError } = await supabase
            .from("service_options")
            .insert(optionsData);
          if (optionsError) throw optionsError;
        }
      }

      localStorage.removeItem("provider_services");
      return { success: true };
    } catch (err) {
      console.error("Error saving services:", err);
      setGlobalError(err.message || "Failed to save services.");
      return { success: false, error: err };
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalSave = async () => {
    setGlobalError("");
    const result = await saveServicesToDB();
    if (result.success) {
      alert("Services saved successfully!");
      navigate("/provider-dashboard"); // or wherever you want to redirect
    } else {
      if (
        result.error &&
        result.error.message &&
        result.error.message.includes("Provider ID missing")
      ) {
        if (
          window.confirm(
            "You need to complete the provider application. Go to Apply Provider now?"
          )
        ) {
          navigate("/apply-provider");
        }
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // STEP 1: FORM VIEW
  if (step === 1) {
    return (
      <>
        <LoggedInNavbar hideBecomeProvider={true} />
        <div className="service-listing-page">
          <div className="container">
            <h1 className="page-title">Service Provider Application</h1>
            <h2 className="section-subtitle">What services do you want to add?</h2>

            {globalError && <div className="global-error">{globalError}</div>}
            {validationErrors.general && (
              <div className="global-error">{validationErrors.general}</div>
            )}

            <div className="services-list">
              {services.map((service, si) => (
                <div key={si} className="service-form-card">
                  <div className="service-card-header">
                    <div className="service-type-badge">
                      {service.type === "package" ? "Packaged Service" : "Individual Service"}
                    </div>
                    <button
                      type="button"
                      className="icon-btn-remove"
                      onClick={() => removeService(si)}
                      title="Remove service"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="service-form-body">
                    <div className="form-left">
                      <div className="form-field">
                        <label>Name of Service</label>
                        <input
                          type="text"
                          value={service.name}
                          onChange={(e) => updateService(si, "name", e.target.value)}
                          placeholder="Enter service name"
                        />
                        {validationErrors[`service_${si}_name`] && (
                          <small className="error">
                            {validationErrors[`service_${si}_name`]}
                          </small>
                        )}
                      </div>

                      <div className="form-field">
                        <label>Description of Service</label>
                        <input
                          type="text"
                          value={service.description}
                          onChange={(e) =>
                            updateService(si, "description", e.target.value)
                          }
                          placeholder="Brief description"
                        />
                        {validationErrors[`service_${si}_description`] && (
                          <small className="error">
                            {validationErrors[`service_${si}_description`]}
                          </small>
                        )}
                      </div>

                      <div className="form-field">
                        <label>Notes</label>
                        <textarea
                          value={service.notes}
                          onChange={(e) => updateService(si, "notes", e.target.value)}
                          placeholder="Additional notes (optional)"
                          rows={4}
                        />
                      </div>
                    </div>

                    <div className="form-right">
                      <div className="form-field">
                        <label>Pet Type</label>
                        <select
                          value={service.petType}
                          onChange={(e) => updateService(si, "petType", e.target.value)}
                        >
                          {PET_TYPES.map((pt) => (
                            <option key={pt.value} value={pt.value}>
                              {pt.label}
                            </option>
                          ))}
                        </select>
                        {validationErrors[`service_${si}_petType`] && (
                          <small className="error">
                            {validationErrors[`service_${si}_petType`]}
                          </small>
                        )}
                      </div>

                      <div className="pricing-section">
                        <label>Pet Size and Pricing</label>
                        <div className="pricing-table">
                          <div className="pricing-header">
                            <div>Size</div>
                            <div>Weight</div>
                            <div>Price</div>
                            <div></div>
                          </div>

                          {(service.pricing ?? []).map((pricing, pi) => (
                            <div key={pricing.id || pi} className="pricing-row">
                              <div className="pricing-cell">
                                <select
                                  value={pricing.size}
                                  onChange={(e) =>
                                    updatePricing(si, pi, "size", e.target.value)
                                  }
                                >
                                  {PET_SIZES.map((sz) => (
                                    <option key={sz.key} value={sz.key}>
                                      {sz.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="pricing-cell">
                                <input
                                  type="text"
                                  value={pricing.weight}
                                  onChange={(e) =>
                                    updatePricing(si, pi, "weight", e.target.value)
                                  }
                                  placeholder="00kg - 00kg"
                                />
                                {validationErrors[
                                  `service_${si}_pricing_${pi}_weight`
                                ] && (
                                  <small className="error">
                                    {
                                      validationErrors[
                                        `service_${si}_pricing_${pi}_weight`
                                      ]
                                    }
                                  </small>
                                )}
                              </div>
                              <div className="pricing-cell">
                                <input
                                  type="number"
                                  value={pricing.price}
                                  onChange={(e) =>
                                    updatePricing(si, pi, "price", e.target.value)
                                  }
                                  placeholder="000"
                                />
                                {validationErrors[
                                  `service_${si}_pricing_${pi}_price`
                                ] && (
                                  <small className="error">
                                    {
                                      validationErrors[
                                        `service_${si}_pricing_${pi}_price`
                                      ]
                                    }
                                  </small>
                                )}
                              </div>
                              <div className="pricing-cell-action">
                                {service.pricing.length > 1 && (
                                  <button
                                    type="button"
                                    className="btn-remove-pricing"
                                    onClick={() => removePricingRow(si, pi)}
                                    title="Remove row"
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          className="btn-add-pricing"
                          onClick={() => addPricingRow(si)}
                        >
                          Add Pet Size and Pricing
                        </button>

                        {validationErrors[`service_${si}_pricing`] && (
                          <small className="error">
                            {validationErrors[`service_${si}_pricing`]}
                          </small>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bottom-actions">
              <button
                type="button"
                className="btn-save-services"
                onClick={handleReviewServices}
              >
                Save services
              </button>

              <div className="add-service-buttons">
                <button
                  type="button"
                  className="btn-add-individual"
                  onClick={() => addService("individual")}
                >
                  <PlusCircle size={16} /> Add Individual Services
                </button>
                <button
                  type="button"
                  className="btn-add-package"
                  onClick={() => addService("package")}
                >
                  <PlusCircle size={16} /> Add Packaged Services
                </button>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // STEP 2: SUMMARY VIEW
  return (
    <>
      <LoggedInNavbar hideBecomeProvider={true} />
      <div className="service-listing-page">
        <div className="container">
          <h1 className="page-title">Service Summary</h1>
          <p className="summary-intro">
            Please review your services before saving to the database.
          </p>

          {globalError && <div className="global-error">{globalError}</div>}

          <div className="summary-list">
            {services.map((service, si) => (
              <div key={si} className="summary-card">
                <div className="summary-header">
                  <h3>
                    {service.type === "package" ? "📦 Package Service" : "🐾 Individual Service"}
                  </h3>
                </div>

                <div className="summary-body">
                  <div className="summary-field">
                    <strong>Name:</strong> {service.name}
                  </div>
                  <div className="summary-field">
                    <strong>Description:</strong> {service.description}
                  </div>
                  {service.notes && (
                    <div className="summary-field">
                      <strong>Notes:</strong> {service.notes}
                    </div>
                  )}
                  <div className="summary-field">
                    <strong>Pet Type:</strong>{" "}
                    {PET_TYPES.find((pt) => pt.value === service.petType)?.label ||
                      service.petType}
                  </div>

                  <div className="summary-pricing">
                    <strong>Pricing:</strong>
                    <table className="summary-table">
                      <thead>
                        <tr>
                          <th>Size</th>
                          <th>Weight</th>
                          <th>Price (PHP)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(service.pricing ?? []).map((pricing, pi) => (
                          <tr key={pricing.id || pi}>
                            <td>{pricing.sizeLabel}</td>
                            <td>{pricing.weight}</td>
                            <td>₱{pricing.price}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="summary-actions">
            <button
              type="button"
              className="btn-back"
              onClick={handleBackToEdit}
              disabled={isSaving}
            >
              <ArrowLeft size={16} /> Back to Edit
            </button>
            <button
              type="button"
              className="btn-final-save"
              onClick={handleFinalSave}
              disabled={isSaving}
            >
              <Save size={16} /> {isSaving ? "Saving..." : "Save to Database"}
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}