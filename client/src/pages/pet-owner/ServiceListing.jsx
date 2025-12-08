// src/pages/pet-owner/ServiceListing.jsx
import React, { useEffect, useState, useRef } from "react";
import { X, PlusCircle, Save, ArrowLeft, Trash2, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { supabase } from "../../config/supabase";
import "./ServiceListing.css";

// --- CONFIGURATION ---
const PET_TYPES = [
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "dog-cat", label: "Dog & Cat" },
];

const ALL_SIZES_DATA = [
  { key: "extra_small", label: "Extra Small" },
  { key: "small", label: "Small" },
  { key: "medium", label: "Medium" },
  { key: "large", label: "Large" },
  { key: "extra_large", label: "Extra Large" },
  { key: "cat", label: "Cat (Standard)" },
  { key: "all", label: "General / All Sizes" },
];

const ALLOWED_SIZES = {
  dog: ["extra_small", "small", "medium", "large", "extra_large"],
  cat: ["extra_small", "small", "medium", "large", "extra_large", "cat"],
  "dog-cat": ["all"],
};

// --- UPGRADED MODAL COMPONENT ---
const FinalConfirmationModal = ({ isOpen, onClose, onConfirm, status, errorMessage, onNavigateDashboard }) => {
  if (!isOpen) return null;

  // 1. SUCCESS STATE
  if (status === 'success') {
    return (
      <div className="modal-overlay">
        <div className="modal-content final-confirm-modal success">
          <div className="modal-header-center">
            <CheckCircle size={56} className="modal-icon-success" />
            <h2>Application Submitted!</h2>
          </div>
          <div className="modal-body-center">
            <p>
              Thank you for submitting your service listing! 
              <br/> It has been received and is currently under review by our administrators.
            </p>
          </div>
          <div className="modal-footer-center">
            <button className="btn-modal-dashboard" onClick={onNavigateDashboard}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. ERROR STATE
  if (status === 'error') {
    return (
      <div className="modal-overlay">
        <div className="modal-content final-confirm-modal error">
          <div className="modal-header-center">
            <AlertTriangle size={56} className="modal-icon-error" />
            <h2>Submission Failed</h2>
          </div>
          <div className="modal-body-center">
            <p>We encountered an issue saving your data.</p>
            <div className="error-box">
                {errorMessage || "Unknown error occurred. Please try again."}
            </div>
          </div>
          <div className="modal-footer-center">
            <button className="btn-modal-cancel" onClick={onClose}>
              Back to Review
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. CONFIRMATION STATE (Idle/Submitting)
  return (
    <div className="modal-overlay">
      <div className="modal-content final-confirm-modal">
        <div className="modal-header-center">
          <CheckCircle size={48} className="modal-icon-brand" />
          <h2>Confirm Submission</h2>
        </div>
        <div className="modal-body-center">
          <p>Are you sure you want to submit your service listing?</p>
          <p className="modal-warning-text">
            <AlertCircle size={16} style={{ display: 'inline', marginBottom: -2, marginRight: 5 }} /> 
            Once submitted, you cannot edit these details until your application is approved.
          </p>
        </div>
        <div className="modal-footer-center">
          <button className="btn-modal-cancel" onClick={onClose} disabled={status === 'submitting'}>
            Cancel
          </button>
          <button className="btn-modal-confirm" onClick={onConfirm} disabled={status === 'submitting'}>
            {status === 'submitting' ? "Saving..." : "Yes, Submit Application"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ServiceListing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const processedRedirect = useRef(false);
  
  // Modal & Submission State
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState('idle'); // 'idle' | 'submitting' | 'success' | 'error'
  const [submissionError, setSubmissionError] = useState('');

  // --- Helper: Create Empty Service ---
  const createNewService = (type = "package") => ({
    type,
    name: "",
    description: "",
    notes: "",
    pricing: [
      {
        id: Date.now().toString(),
        petType: "dog",
        size: "extra_small",
        sizeLabel: "Extra Small",
        weight: "",
        price: "",
      },
    ],
  });

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
  const [isSaving, setIsSaving] = useState(false); // Used for local UI states if needed

  // --- Auto-Initialize ---
  useEffect(() => {
    if (!processedRedirect.current) {
      if (location.state?.initialType) {
        setServices([createNewService(location.state.initialType)]);
        window.history.replaceState({}, document.title);
      } else {
        if (services.length === 0) setServices([createNewService("package")]);
      }
      processedRedirect.current = true;
    }
  }, [location.state]);

  useEffect(() => {
    localStorage.setItem("provider_services", JSON.stringify(services));
  }, [services]);

  // --- LOGIC: Dropdown Filtering ---
  const getAvailablePetTypes = (pricingList, currentIndex) => {
    const currentRow = pricingList[currentIndex];
    const otherRows = pricingList.filter((_, idx) => idx !== currentIndex);
    const hasSpecific = otherRows.some(row => row.petType === 'dog' || row.petType === 'cat');
    const hasGeneral = otherRows.some(row => row.petType === 'dog-cat');
    const hasCatStandard = otherRows.some(row => row.petType === 'cat' && row.size === 'cat');

    return PET_TYPES.filter(type => {
        if (type.value === currentRow.petType) return true;
        if (hasSpecific && type.value === 'dog-cat') return false;
        if (hasGeneral && (type.value === 'dog' || type.value === 'cat')) return false;
        if (hasCatStandard && type.value === 'cat') return false;
        return true;
    });
  };

  const getOptionsForPricingRow = (pricingList, currentIndex) => {
    const currentRow = pricingList[currentIndex];
    const currentType = currentRow.petType;
    const currentSizeKey = currentRow.size;
    const allowedKeys = ALLOWED_SIZES[currentType] || [];
    const otherRows = pricingList.filter((row, idx) => idx !== currentIndex && row.petType === currentType);
    const hasStandardCat = otherRows.some(r => r.size === 'cat');
    const hasSpecificCat = otherRows.some(r => r.size !== 'cat' && r.petType === 'cat');
    const usedKeys = otherRows.map(row => row.size);

    return ALL_SIZES_DATA.filter((sizeObj) => {
      if (!allowedKeys.includes(sizeObj.key)) return false;
      if (usedKeys.includes(sizeObj.key) && sizeObj.key !== currentSizeKey) return false;
      if (currentType === 'cat') {
          if (hasStandardCat && sizeObj.key !== 'cat') return false;
          if (hasSpecificCat && sizeObj.key === 'cat') return false;
      }
      return true;
    });
  };

  // --- CRUD Functions ---
  const addService = (type) => setServices((prev) => [...prev, createNewService(type)]);
  const removeService = (index) => setServices((prev) => prev.filter((_, i) => i !== index));
  const updateService = (index, field, value) => {
    setServices((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const addPricingRow = (serviceIndex) => {
    setServices((prev) =>
      prev.map((s, i) => {
        if (i !== serviceIndex) return s;
        if (s.pricing.some(p => p.petType === 'dog-cat')) return s;

        const lastRow = s.pricing[s.pricing.length - 1];
        let defaultType = lastRow ? lastRow.petType : "dog";
        if (defaultType === 'cat' && lastRow.size === 'cat') defaultType = 'dog';

        const getNextAvailableSize = (currentPricing, petType) => {
            const allowed = ALLOWED_SIZES[petType] || [];
            const used = currentPricing.filter(p => p.petType === petType).map(p => p.size);
            const available = allowed.find(size => !used.includes(size));
            return available || allowed[0];
        };

        let defaultSize = getNextAvailableSize(s.pricing, defaultType);
        let defaultLabel = ALL_SIZES_DATA.find(x => x.key === defaultSize)?.label || "Extra Small";
        let defaultWeight = (defaultSize === 'cat' || defaultSize === 'all') ? "N/A" : "";

        return { ...s, pricing: [...s.pricing, {
          id: `${Date.now()}_${Math.random()}`,
          petType: defaultType,
          size: defaultSize,
          sizeLabel: defaultLabel,
          weight: defaultWeight,
          price: "",
        }] };
      })
    );
  };

  const removePricingRow = (serviceIndex, pricingIndex) => {
    setServices((prev) => prev.map((s, i) => i === serviceIndex ? { ...s, pricing: s.pricing.filter((_, j) => j !== pricingIndex) } : s));
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

                if (field === "petType") {
                  const getNextAvailableSize = (currentPricing, petType) => {
                    const allowed = ALLOWED_SIZES[petType] || [];
                    const used = currentPricing.filter((pr, idx) => pr.petType === petType && idx !== j).map(pr => pr.size);
                    return allowed.find(size => !used.includes(size)) || allowed[0];
                  };

                  let newSize = getNextAvailableSize(s.pricing, value);
                  
                  if (value === "dog-cat") newSize = "all";
                  else if (value === "cat") {
                      const hasSpecific = s.pricing.some((x, idx) => idx !== j && x.petType === 'cat' && x.size !== 'cat');
                      if (!hasSpecific) newSize = "cat"; 
                  }
                  
                  updated.size = newSize;
                  const sizeObj = ALL_SIZES_DATA.find(x => x.key === newSize);
                  updated.sizeLabel = sizeObj ? sizeObj.label : "";
                  updated.weight = (newSize === 'cat' || newSize === 'all') ? "N/A" : "";
                }

                if (field === "size") {
                  const sizeData = ALL_SIZES_DATA.find((sz) => sz.key === value);
                  if (sizeData) {
                    updated.sizeLabel = sizeData.label;
                    if (value === "all") { updated.petType = "dog-cat"; updated.weight = "N/A"; }
                    else if (value === "cat") { updated.weight = "N/A"; }
                    else { if (updated.weight === "N/A") updated.weight = ""; }
                  }
                }

                if (field === "price" && parseFloat(value) < 0) updated.price = "0";
                return updated;
              }),
            }
          : s
      )
    );
  };

  // --- VALIDATION ---
  const validateWeightRange = (rangeStr) => {
    const match = rangeStr.match(/^(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)$/);
    if (!match) return null;
    return { min: parseFloat(match[1]), max: parseFloat(match[3]) };
  };

  const validateServices = () => {
    const errs = {};
    let hasError = false;

    if (services.length === 0) {
      errs.general = "Please add at least one service.";
      setValidationErrors(errs);
      return false;
    }

    services.forEach((service, si) => {
      if (!service.name.trim()) { errs[`service_${si}_name`] = "Service Name is required"; hasError = true; }
      if (!service.pricing || service.pricing.length === 0) {
        errs[`service_${si}_pricing`] = "Add at least one pricing row."; hasError = true;
      } else {
        const dogRanges = []; const catRanges = [];
        service.pricing.forEach((pricing, pi) => {
          const priceVal = parseFloat(pricing.price);
          if (!pricing.price || isNaN(priceVal) || priceVal <= 0) {
            errs[`service_${si}_pricing_${pi}_price`] = "Required (Must be greater than 0)"; hasError = true;
          }
          if (pricing.size !== "cat" && pricing.size !== "all") {
            if (!pricing.weight || pricing.weight.trim() === "") {
               errs[`service_${si}_pricing_${pi}_weight`] = "Weight required"; hasError = true;
            } else {
                const parsed = validateWeightRange(pricing.weight);
                if (!parsed) {
                  errs[`service_${si}_pricing_${pi}_weight`] = "Use format: 'min - max'"; hasError = true;
                } else if (parsed.min < 1) {
                  errs[`service_${si}_pricing_${pi}_weight`] = "Min must be ≥ 1kg"; hasError = true;
                } else if (parsed.min >= parsed.max) {
                  errs[`service_${si}_pricing_${pi}_weight`] = "Min must be < Max"; hasError = true;
                } else {
                  const targetRanges = pricing.petType === 'cat' ? catRanges : dogRanges;
                  const hasOverlap = targetRanges.some((r) => 
                      (parsed.min >= r.min && parsed.min <= r.max) || (parsed.max >= r.min && parsed.max <= r.max) || (parsed.min <= r.min && parsed.max >= r.max)
                  );
                  if (hasOverlap) {
                    errs[`service_${si}_pricing_${pi}_weight`] = "Ranges overlap"; hasError = true;
                  } else {
                    targetRanges.push(parsed);
                  }
                }
            }
          }
        });
      }
    });

    setValidationErrors(errs);
    if (hasError) setGlobalError("Please fix the highlighted errors before proceeding.");
    return !hasError;
  };

  const handleReviewServices = () => {
    setGlobalError("");
    if (validateServices()) { setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else { window.scrollTo({ top: 0, behavior: "smooth" }); }
  };

  const handleBackToEdit = () => { setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // --- SAVE LOGIC ---
  const saveServicesToDB = async () => {
    // Return promise so we can await it
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      let providerId = localStorage.getItem("providerId");
      if (!providerId) {
        const { data: providers } = await supabase.from("service_providers").select("id").eq("user_id", user.id).limit(1);
        if (providers && providers.length > 0) providerId = providers[0].id;
      }
      if (!providerId) throw new Error("Provider ID missing.");

      for (const service of services) {
        const { data: serviceData, error: serviceError } = await supabase
          .from("services")
          .insert([{
            provider_id: providerId,
            type: service.type,
            name: service.name,
            description: service.description || "No description",
            notes: service.notes || null,
          }])
          .select().single();

        if (serviceError) throw serviceError;

        const optionsData = service.pricing.map((pricing) => ({
          service_id: serviceData.id,
          pet_type: pricing.petType,
          size: pricing.size,
          weight_range: pricing.weight,
          price: parseFloat(pricing.price).toFixed(2),
        }));

        const { error: optionsError } = await supabase.from("service_options").insert(optionsData);
        if (optionsError) throw optionsError;
      }

      localStorage.removeItem("provider_services");
      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, message: err.message };
    }
  };

  // Trigger Modal
  const handleFinalSaveClick = () => {
    setSubmissionStatus('idle'); // Reset status
    setShowFinalModal(true);
  };

  // Confirm in Modal (New Logic)
  const handleConfirmSubmit = async () => {
    setSubmissionStatus('submitting');
    
    // Perform save
    const result = await saveServicesToDB();
    
    if (result.success) {
        setSubmissionStatus('success');
    } else {
        setSubmissionStatus('error');
        setSubmissionError(result.message);
    }
  };

  const handleCloseModal = () => {
      // If closing from error state, we stay on summary to let them fix or try again
      setShowFinalModal(false);
  };

  const handleNavigateDashboard = () => {
      navigate("/dashboard");
  };

  // --- RENDER FORM ---
  if (step === 1) {
    return (
      <>
        <LoggedInNavbar hideBecomeProvider={true} />
        <div className="service-listing-page">
          <div className="container">
            <h1 className="page-title">Service Listings</h1>
            <p className="section-subtitle">Define your services below.</p>

            {globalError && (
                <div className="global-error">
                    <AlertCircle size={18} style={{marginRight: 8}}/>
                    {globalError}
                </div>
            )}
            
            <div className="services-list">
              {services.map((service, si) => (
                <div key={si} className="service-form-card">
                  <div className="service-card-header">
                    <div className={`service-type-badge ${service.type}`}>
                      {service.type === "package" ? "Packaged Service" : "Individual Service"}
                    </div>
                    <button type="button" className="icon-btn-remove" onClick={() => removeService(si)}><X size={20} /></button>
                  </div>

                  <div className="service-form-body">
                    <div className="form-left">
                      <div className="form-field">
                        <label>Name of Service*</label>
                        <input
                          type="text"
                          value={service.name}
                          onChange={(e) => updateService(si, "name", e.target.value)}
                          placeholder="e.g. Full Grooming, Nail Trimming"
                          className={validationErrors[`service_${si}_name`] ? "input-error" : ""}
                        />
                        {validationErrors[`service_${si}_name`] && <small className="error">{validationErrors[`service_${si}_name`]}</small>}
                      </div>
                      <div className="form-field">
                        <label>Description</label>
                        <input type="text" value={service.description} onChange={(e) => updateService(si, "description", e.target.value)} />
                      </div>
                      <div className="form-field">
                        <label>Notes</label>
                        <textarea value={service.notes} onChange={(e) => updateService(si, "notes", e.target.value)} rows={3} />
                      </div>
                    </div>

                    <div className="form-right">
                      <div className="pricing-section">
                        <label>Pricing List*</label>
                        <div className="pricing-table">
                          <div className="pricing-header">
                            <div>Pet Type</div>
                            <div>Size</div>
                            <div>Weight (kg)</div>
                            <div>Price (₱)</div>
                            <div></div>
                          </div>

                          {service.pricing.map((pricing, pi) => (
                            <div key={pricing.id} className="pricing-row">
                              <div className="pricing-cell">
                                <select value={pricing.petType} onChange={(e) => updatePricing(si, pi, "petType", e.target.value)}>
                                  {getAvailablePetTypes(service.pricing, pi).map((pt) => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                                </select>
                              </div>
                              <div className="pricing-cell">
                                <select value={pricing.size} onChange={(e) => updatePricing(si, pi, "size", e.target.value)}>
                                  {getOptionsForPricingRow(service.pricing, pi).map((sz) => <option key={sz.key} value={sz.key}>{sz.label}</option>)}
                                </select>
                              </div>
                              <div className="pricing-cell">
                                <input
                                  type="text"
                                  value={pricing.weight}
                                  onChange={(e) => updatePricing(si, pi, "weight", e.target.value)}
                                  placeholder={pricing.size === "cat" || pricing.size === "all" ? "N/A" : "e.g. 1 - 5"}
                                  disabled={pricing.size === "cat" || pricing.size === "all"}
                                  className={pricing.size === "cat" || pricing.size === "all" ? "input-disabled" : validationErrors[`service_${si}_pricing_${pi}_weight`] ? "input-error" : ""}
                                />
                                {validationErrors[`service_${si}_pricing_${pi}_weight`] && <small className="error">{validationErrors[`service_${si}_pricing_${pi}_weight`]}</small>}
                              </div>
                              <div className="pricing-cell">
                                <input
                                  type="number"
                                  value={pricing.price}
                                  onChange={(e) => updatePricing(si, pi, "price", e.target.value)}
                                  onBlur={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val) && val > 0) updatePricing(si, pi, "price", val.toFixed(2));
                                  }}
                                  placeholder="0.00"
                                  step="0.01"
                                  className={validationErrors[`service_${si}_pricing_${pi}_price`] ? "input-error" : ""}
                                />
                                {validationErrors[`service_${si}_pricing_${pi}_price`] && <small className="error">{validationErrors[`service_${si}_pricing_${pi}_price`]}</small>}
                              </div>
                              <div className="pricing-cell-action">
                                {service.pricing.length > 1 && <button type="button" className="btn-remove-pricing" onClick={() => removePricingRow(si, pi)}><Trash2 size={16} /></button>}
                              </div>
                            </div>
                          ))}
                        </div>
                        {validationErrors[`service_${si}_pricing`] && <small className="error">{validationErrors[`service_${si}_pricing`]}</small>}

                        {!service.pricing.some(p => p.petType === 'dog-cat') && (
                            <button type="button" className="btn-add-pricing" onClick={() => addPricingRow(si)}>
                              <PlusCircle size={14} style={{ marginRight: 5 }} /> Add Variant
                            </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bottom-actions">
              <button type="button" className="btn-save-services" onClick={handleReviewServices}>Review & Submit</button>
              <div className="add-service-buttons">
                <button type="button" className="btn-add-individual" onClick={() => addService("individual")}><PlusCircle size={16} /> Individual</button>
                <button type="button" className="btn-add-package" onClick={() => addService("package")}><PlusCircle size={16} /> Package</button>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // STEP 2: SUMMARY
  return (
    <>
      <LoggedInNavbar hideBecomeProvider={true} />
      <div className="service-listing-page">
        <div className="container">
          <h1 className="page-title">Review Your Services</h1>
          <p className="summary-intro">Please confirm details below.</p>

          <div className="summary-list">
            {services.map((service, si) => (
              <div key={si} className="summary-card">
                <div className="summary-header">
                  <h3>{service.type === "package" ? "Package Service" : "Individual Service"}</h3>
                </div>
                <div className="summary-body">
                  <div className="summary-row"><strong>Name:</strong> {service.name}</div>
                  <div className="summary-row"><strong>Description:</strong> {service.description || "N/A"}</div>
                  <div className="summary-row"><strong>Description:</strong> {service.notes || "N/A"}</div>
                  <div className="summary-pricing">
                    <table className="summary-table">
                      <thead><tr><th>Type</th><th>Size</th><th>Weight (kg)</th><th>Price</th></tr></thead>
                      <tbody>
                        {service.pricing.map((p, pi) => (
                          <tr key={pi}>
                            <td style={{ textTransform: "capitalize" }}>{p.petType === "dog-cat" ? "Dog & Cat" : p.petType}</td>
                            <td>{p.sizeLabel}</td>
                            <td>{p.weight} kg</td>
                            <td>₱{parseFloat(p.price).toFixed(2)}</td>
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
            <button type="button" className="btn-back" onClick={handleBackToEdit} disabled={isSaving}><ArrowLeft size={16} /> Back</button>
            <button type="button" className="btn-final-save" onClick={handleFinalSaveClick} disabled={isSaving}><Save size={16} /> {isSaving ? "Submitting..." : "Confirm & Submit"}</button>
          </div>
        </div>
      </div>
      
      {/* FINAL CONFIRMATION MODAL */}
      <FinalConfirmationModal 
        isOpen={showFinalModal} 
        onClose={handleCloseModal}
        onConfirm={handleConfirmSubmit}
        status={submissionStatus}
        errorMessage={submissionError}
        onNavigateDashboard={handleNavigateDashboard}
      />

      <Footer />
    </>
  );
}