// src/pages/pet-owner/ServiceListing.jsx
import React, { useEffect, useState } from "react";
import { X, PlusCircle, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { supabase } from "../../config/supabase";
import "./ServiceListing.css"; // update/create CSS as needed

// ORDER: All Sizes, XS, S, M, L, XL, Cat
const DEFAULT_SIZES = [
  { key: "all", label: "All Sizes" },
  { key: "xs", label: "XS (Extra Small)" },
  { key: "s", label: "S (Small)" },
  { key: "m", label: "M (Medium)" },
  { key: "l", label: "L (Large)" },
  { key: "xl", label: "XL (Extra Large)" },
  { key: "cat", label: "Cat" },
];

const PET_TYPES = [
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "dog-cat", label: "Dog & Cat" },
];

export default function ServiceListing() {
  const navigate = useNavigate();

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

  // create new service with default size rows (includes 'all' and 'cat')
  const addService = (type = "package") => {
    setServices((prev) => [
      ...prev,
      {
        type,
        name: "",
        description: "",
        notes: "",
        options: DEFAULT_SIZES.map((s) => ({
          petType: "dog",
          size: s.key,
          sizeLabel: s.label, // keep label purely for display
          weightRange: "",
          minWeight: "",
          maxWeight: "",
          price: "",
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        })),
      },
    ]);
  };

  const removeService = (index) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  const updateService = (index, field, value) => {
    setServices((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const addServiceOption = (serviceIndex) => {
    setServices((prev) =>
      prev.map((s, i) =>
        i === serviceIndex
          ? {
              ...s,
              options: [
                ...s.options,
                {
                  petType: "dog",
                  size: "custom",
                  sizeLabel: "Custom",
                  weightRange: "",
                  minWeight: "",
                  maxWeight: "",
                  price: "",
                  id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                },
              ],
            }
          : s
      )
    );
  };

  const removeServiceOption = (serviceIndex, optionIndex) => {
    setServices((prev) =>
      prev.map((s, i) => (i === serviceIndex ? { ...s, options: s.options.filter((_, j) => j !== optionIndex) } : s))
    );
  };

  const updateServiceOption = (serviceIndex, optionIndex, field, value) => {
    setServices((prev) =>
      prev.map((s, i) =>
        i === serviceIndex
          ? {
              ...s,
              options: s.options.map((opt, j) => {
                if (j !== optionIndex) return opt;
                const updated = { ...opt, [field]: value };

                // If user types weightRange (eg "1 - 5 kg"), attempt to parse min/max and store them
                if (field === "weightRange") {
                  const v = (value || "").trim();
                  // Accept formats like "1-5", "1 - 5", "1 - 5 kg", "1kg - 5kg"
                  const match = v.match(/(\d+(\.\d+)?)\s*(?:kg|kgs?)?\s*[-–]\s*(\d+(\.\d+)?)\s*(?:kg|kgs?)?/i);
                  if (match) {
                    const min = parseFloat(match[1]);
                    const max = parseFloat(match[3]);
                    updated.minWeight = Number.isFinite(min) ? String(min) : "";
                    updated.maxWeight = Number.isFinite(max) ? String(max) : "";
                  } else {
                    // If user entered "N/A" or "0" for cat/all, treat as blank numeric fields
                    if (v.toLowerCase() === "n/a" || v === "0") {
                      updated.minWeight = "";
                      updated.maxWeight = "";
                    } else {
                      // keep weightRange but do not set min/max
                      updated.minWeight = "";
                      updated.maxWeight = "";
                    }
                  }
                }

                return updated;
              }),
            }
          : s
      )
    );
  };

  // disable a default size if it's already used within the service (same petType & size)
  const isSizeDisabledForService = (serviceIndex, optionIndex, petType, sizeKey) => {
    const s = services[serviceIndex];
    if (!s) return false;
    return s.options.some((opt, i) => i !== optionIndex && opt.petType === petType && opt.size === sizeKey);
  };

  // parse min/max numeric values from opt (either minWeight/maxWeight fields or weightRange)
  const parseOptionMinMax = (opt) => {
    if (!opt) return { min: null, max: null };

    // If size is 'all' or 'cat', we do not require min/max — return nulls to indicate skipped.
    if (opt.size === "all" || opt.size === "cat") {
      return { min: null, max: null };
    }

    // prefer explicit fields if available
    const maybeMin = opt.minWeight !== "" && opt.minWeight !== null ? parseFloat(opt.minWeight) : NaN;
    const maybeMax = opt.maxWeight !== "" && opt.maxWeight !== null ? parseFloat(opt.maxWeight) : NaN;
    if (!Number.isNaN(maybeMin) && !Number.isNaN(maybeMax)) {
      return { min: maybeMin, max: maybeMax };
    }

    // fallback to parsing weightRange e.g. "1 - 5 kg"
    if (opt.weightRange) {
      const match = opt.weightRange.match(/(\d+(\.\d+)?)\s*(?:kg|kgs?)?\s*[-–]\s*(\d+(\.\d+)?)/i);
      if (match) {
        const min = parseFloat(match[1]);
        const max = parseFloat(match[3]);
        if (!Number.isNaN(min) && !Number.isNaN(max)) {
          return { min, max };
        }
      }
    }

    return { min: null, max: null };
  };

  // check overlap between current option and others within same service
  const checkWeightRangeOverlap = (serviceIndex, optionIndex) => {
    const service = services[serviceIndex];
    if (!service) return null;
    const current = service.options[optionIndex];
    if (!current || !current.petType) return null;

    // if current size is 'all' or 'cat' -> we won't produce overlap warnings (they are special)
    if (current.size === "all" || current.size === "cat") return null;

    const { min: curMin, max: curMax } = parseOptionMinMax(current);
    if (curMin === null || curMax === null) return null; // can't check

    for (let i = 0; i < service.options.length; i++) {
      if (i === optionIndex) continue;
      const other = service.options[i];
      if (!other || !other.petType) continue;
      if (other.petType !== current.petType) continue;

      // skip if other is 'all' or 'cat' (they are treated as N/A)
      if (other.size === "all" || other.size === "cat") continue;

      const { min: oMin, max: oMax } = parseOptionMinMax(other);
      if (oMin === null || oMax === null) continue;

      // overlap detection (any intersection)
      if (
        (curMin > oMin && curMin < oMax) ||
        (curMax > oMin && curMax < oMax) ||
        (curMin <= oMin && curMax >= oMax) ||
        (oMin <= curMin && oMax >= curMax)
      ) {
        const otherLabel = other.sizeLabel || other.size || other.id || `option ${i + 1}`;
        return `Overlaps with ${otherLabel} (${oMin}-${oMax} kg)`;
      }
    }
    return null;
  };

  // Validate services BEFORE summary/save — implements your rule set
  const validateServices = () => {
    const errs = {};
    if (services.length === 0) {
      errs.general = "Add at least one service before saving.";
      setValidationErrors(errs);
      return false;
    }

    services.forEach((service, si) => {
      if (!service.name || !service.name.trim()) {
        errs[`service_${si}_name`] = "Name is required";
      }
      if (!service.description || !service.description.trim()) {
        errs[`service_${si}_description`] = "Description is required";
      }

      if (!service.options || service.options.length === 0) {
        errs[`service_${si}_options`] = "Add at least one size/price option";
      } else {
        for (let oi = 0; oi < service.options.length; oi++) {
          const opt = service.options[oi];

          // price check
          if (opt.price === "" || isNaN(Number(opt.price))) {
            errs[`service_${si}_opt_${oi}_price`] = "Valid price required";
          }

          // required petType & size
          if (!opt.petType) {
            errs[`service_${si}_opt_${oi}_pettype`] = "Pet type required";
          }
          if (!opt.size) {
            errs[`service_${si}_opt_${oi}_size`] = "Size required";
          }

          // weight-range logic
          // If size !== 'cat' && size !== 'all' => require numeric min/max
          if (opt.size !== "cat" && opt.size !== "all") {
            const { min, max } = parseOptionMinMax(opt);
            if (min === null || max === null) {
              errs[`service_${si}_opt_${oi}_weight`] = "Provide a valid weight range (e.g. 1 - 5 kg)";
            } else {
              if (min < 1) errs[`service_${si}_opt_${oi}_weight`] = "Minimum weight must be at least 1 kg";
              if (max <= min) errs[`service_${si}_opt_${oi}_weight`] = "Maximum weight must be greater than minimum weight";
            }
          } else {
            // size is 'cat' or 'all' — weightRange may be "N/A" or "0" or blank — accept it
            // no specific validation needed here
          }

          // overlap validation with following options
          if (!errs[`service_${si}_opt_${oi}_weight`]) {
            // only check overlap if current option has numeric min/max (non-null)
            const overlap = checkWeightRangeOverlap(si, oi);
            if (overlap) {
              errs[`service_${si}_opt_${oi}_overlap`] = overlap;
            }
          }
        }
      }
    });

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Navigate to summary page (summary will read localStorage)
  const handleSaveServices = (e) => {
    e?.preventDefault();
    setGlobalError("");
    if (!validateServices()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // ensure the snapshot is saved
    localStorage.setItem("provider_services", JSON.stringify(services));
    navigate("/service-summary");
  };

  // Persist services to DB (called from summary page)
  // Requires providerId (created when provider applied) to be present in localStorage
  const saveServicesToDB = async (providerIdParam) => {
    setIsSaving(true);
    try {
      const providerId = providerIdParam || localStorage.getItem("providerId");
      if (!providerId) throw new Error("No providerId found. Please complete the provider application first (Apply Provider).");

      // ensure user is authenticated (RLS policies commonly require user to be authenticated)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("User not authenticated. Please sign in and try again.");
      }

      // Insert each service and its options
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

        // build options rows
        const optionsData = service.options.map((opt) => {
          // unify weight_range string (store user-supplied weightRange)
          const wr = opt.weightRange || (opt.size === "all" || opt.size === "cat" ? "N/A" : "");
          return {
            service_id: serviceId,
            pet_type: opt.petType,
            size: opt.size,
            weight_range: wr,
            price: parseFloat(opt.price) || 0,
          };
        });

        if (optionsData.length > 0) {
          const { error: optionsError } = await supabase.from("service_options").insert(optionsData);
          if (optionsError) throw optionsError;
        }
      }

      return { success: true };
    } catch (err) {
      console.error("Error saving services to DB:", err);
      return { success: false, error: err };
    } finally {
      setIsSaving(false);
    }
  };

  // Rendering:
  return (
    <>
      <LoggedInNavbar hideBecomeProvider={true} />
      <div className="service-listing-page">
        <div className="container">
          <h1 className="page-title">Service Listings</h1>

          {globalError && <div className="global-error">{globalError}</div>}
          {validationErrors.general && <div className="global-error">{validationErrors.general}</div>}

          <div className="actions-row">
            <button type="button" className="btn-outline" onClick={() => addService("individual")}>
              <PlusCircle size={16} /> Add Individual Service
            </button>

            <button type="button" className="btn-outline" onClick={() => addService("package")}>
              <PlusCircle size={16} /> Add Packaged Service
            </button>
          </div>

          <div className="services-list">
            {services.map((service, si) => (
              <div key={si} className="service-card">
                <div className="service-card-header">
                  <h3 className="service-type-indicator">
                    {service.type === "package" ? "Package Service" : "Individual Service"}
                  </h3>
                  <div className="service-controls">
                    <button type="button" className="icon-btn danger" onClick={() => removeService(si)} title="Remove service">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="service-body">
                  <div className="form-row">
                    <label>Name *</label>
                    <input type="text" value={service.name} onChange={(e) => updateService(si, "name", e.target.value)} placeholder="Service name" />
                    {validationErrors[`service_${si}_name`] && <small className="error">{validationErrors[`service_${si}_name`]}</small>}
                  </div>

                  <div className="form-row">
                    <label>Description *</label>
                    <input type="text" value={service.description} onChange={(e) => updateService(si, "description", e.target.value)} placeholder="Short description" />
                    {validationErrors[`service_${si}_description`] && <small className="error">{validationErrors[`service_${si}_description`]}</small>}
                  </div>

                  <div className="form-row">
                    <label>Notes (optional)</label>
                    <textarea value={service.notes} onChange={(e) => updateService(si, "notes", e.target.value)} placeholder="Optional notes" rows={2} />
                  </div>

                  <div className="options-block">
                    <h4>Size & Pricing</h4>
                    <div className="options-table">
                      <div className="options-header">
                        <div>Pet Type</div>
                        <div>Size</div>
                        <div>Weight Range</div>
                        <div>Price (PHP)</div>
                        <div></div>
                      </div>

                      {service.options.map((opt, oi) => (
                        <div key={opt.id || oi} className="option-row">
                          <div>
                            <select value={opt.petType} onChange={(e) => updateServiceOption(si, oi, "petType", e.target.value)}>
                              {PET_TYPES.map((p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <select
                              value={opt.size}
                              onChange={(e) => {
                                const newSize = e.target.value;
                                const sizeLabel = DEFAULT_SIZES.find(s => s.key === newSize)?.label || newSize;
                                updateServiceOption(si, oi, "size", newSize);
                                updateServiceOption(si, oi, "sizeLabel", sizeLabel);
                              }}
                            >
                              {DEFAULT_SIZES.map((s) => (
                                <option
                                  key={s.key}
                                  value={s.key}
                                  disabled={isSizeDisabledForService(si, oi, opt.petType, s.key)}
                                >
                                  {s.label}
                                  {isSizeDisabledForService(si, oi, opt.petType, s.key) ? " (used)" : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <input type="text" placeholder="e.g. 1 - 5 kg or N/A" value={opt.weightRange} onChange={(e) => updateServiceOption(si, oi, "weightRange", e.target.value)} />
                            {validationErrors[`service_${si}_opt_${oi}_weight`] && <small className="error">{validationErrors[`service_${si}_opt_${oi}_weight`]}</small>}
                            {(() => {
                              const overlap = checkWeightRangeOverlap(si, oi);
                              return overlap ? <small className="error">{overlap}</small> : null;
                            })()}
                          </div>

                          <div>
                            <input type="number" step="0.01" min="0" placeholder="00.00" value={opt.price} onChange={(e) => updateServiceOption(si, oi, "price", e.target.value)} />
                            {validationErrors[`service_${si}_opt_${oi}_price`] && <small className="error">{validationErrors[`service_${si}_opt_${oi}_price`]}</small>}
                          </div>

                          <div>
                            {service.options.length > 1 && (
                              <button type="button" className="icon-btn" onClick={() => removeServiceOption(si, oi)} title="Remove size/price row">
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="options-actions">
                      <button type="button" className="btn-outline" onClick={() => addServiceOption(si)}>
                        <PlusCircle size={14} /> Add size / price row
                      </button>
                    </div>

                    {validationErrors[`service_${si}_options`] && <small className="error">{validationErrors[`service_${si}_options`]}</small>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bottom-actions">
            <button type="button" className="btn-primary" onClick={handleSaveServices} disabled={isSaving}>
              <Save size={16} /> {isSaving ? "Saving..." : "Save Services & Continue"}
            </button>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
