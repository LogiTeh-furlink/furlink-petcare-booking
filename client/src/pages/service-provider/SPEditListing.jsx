import React, { useEffect, useState, useRef } from "react";
import { X, PlusCircle, Save, ArrowLeft, Trash2, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { supabase } from "../../config/supabase";
import "./SPEditListing.css";

// --- CONFIGURATION (Same as Creation Flow) ---
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

// --- MODAL COMPONENT ---
const FinalConfirmationModal = ({ isOpen, onClose, onConfirm, status, errorMessage, onNavigateManage }) => {
  if (!isOpen) return null;

  if (status === 'success') {
    return (
      <div className="modal-overlay">
        <div className="modal-content final-confirm-modal success">
          <div className="modal-header-center">
            <CheckCircle size={56} className="modal-icon-success" />
            <h2>Listing Updated!</h2>
          </div>
          <div className="modal-body-center">
            <p>Your service listing has been successfully updated in the database.</p>
          </div>
          <div className="modal-footer-center">
            <button className="btn-modal-dashboard" onClick={onNavigateManage}>
              Return to Manage Listing
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="modal-overlay">
        <div className="modal-content final-confirm-modal error">
          <div className="modal-header-center">
            <AlertTriangle size={56} className="modal-icon-error" />
            <h2>Update Failed</h2>
          </div>
          <div className="modal-body-center">
            <p>We encountered an issue saving your changes.</p>
            <div className="error-box">
                {errorMessage || "Unknown error occurred."}
            </div>
          </div>
          <div className="modal-footer-center">
            <button className="btn-modal-cancel" onClick={onClose}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content final-confirm-modal">
        <div className="modal-header-center">
          <CheckCircle size={48} className="modal-icon-brand" />
          <h2>Confirm Changes</h2>
        </div>
        <div className="modal-body-center">
          <p>Are you sure you want to save these changes?</p>
          <p className="modal-warning-text">
            <AlertCircle size={16} style={{ display: 'inline', marginBottom: -2, marginRight: 5 }} /> 
            This will permanently update your live listing.
          </p>
        </div>
        <div className="modal-footer-center">
          <button className="btn-modal-cancel" onClick={onClose} disabled={status === 'submitting'}>
            Cancel
          </button>
          <button className="btn-modal-confirm" onClick={onConfirm} disabled={status === 'submitting'}>
            {status === 'submitting' ? "Saving..." : "Yes, Update Listing"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function SPEditListing() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = Edit Form, 2 = Summary Review
  const [loadingData, setLoadingData] = useState(true);

  // Data State
  const [services, setServices] = useState([]);
  
  // Track Deletions (To run DELETE queries on save)
  const [deletedServiceIds, setDeletedServiceIds] = useState([]);
  const [deletedOptionIds, setDeletedOptionIds] = useState([]);

  // UI State
  const [validationErrors, setValidationErrors] = useState({});
  const [globalError, setGlobalError] = useState("");
  
  // Modal State
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState('idle');
  const [submissionError, setSubmissionError] = useState('');

  // --- 1. FETCH EXISTING DATA ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/login");

        // Get Provider ID
        const { data: providerData } = await supabase
          .from("service_providers")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (providerData) {
          // Fetch Services + Options
          const { data: serviceData } = await supabase
            .from("services")
            .select(`*, service_options (*)`)
            .eq("provider_id", providerData.id)
            .order("created_at", { ascending: true });

          if (serviceData) {
            // Map DB structure to Local State structure
            const mappedServices = serviceData.map(s => ({
                id: s.id, // Real UUID
                type: s.type, // 'package' or 'individual'
                name: s.name,
                description: s.description || "",
                notes: s.notes || "",
                // Map options to 'pricing'
                pricing: s.service_options.map(opt => ({
                    id: opt.id, // Real UUID
                    petType: opt.pet_type,
                    size: opt.size,
                    // Reconstruct Label from key
                    sizeLabel: ALL_SIZES_DATA.find(x => x.key === opt.size)?.label || opt.size,
                    weight: opt.weight_range,
                    price: opt.price
                }))
            }));
            setServices(mappedServices);
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [navigate]);

  // --- HELPER: Create New Service (Client Side) ---
  const createNewService = (type = "individual") => ({
    id: `temp_${Date.now()}`, // Temp ID
    type,
    name: "",
    description: "",
    notes: "",
    pricing: [{
      id: `temp_${Date.now()}_opt`,
      petType: "dog",
      size: "extra_small",
      sizeLabel: "Extra Small",
      weight: "",
      price: "",
    }],
  });

  // --- HELPER: Smart Size Defaults (Reused from Creation) ---
  const getNextAvailableSize = (currentPricing, petType) => {
    const allowed = ALLOWED_SIZES[petType] || [];
    const used = currentPricing.filter(p => p.petType === petType).map(p => p.size);
    const available = allowed.find(size => !used.includes(size));
    return available || allowed[0];
  };

  // --- DROPDOWN LOGIC ---
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

  // --- CRUD HANDLERS ---

  const addService = (type) => setServices(prev => [...prev, createNewService(type)]);

  const removeService = (index) => {
    const serviceToRemove = services[index];
    // If it has a real UUID (not temp), track it for DB deletion
    if (!serviceToRemove.id.toString().startsWith("temp_")) {
        setDeletedServiceIds(prev => [...prev, serviceToRemove.id]);
    }
    setServices(prev => prev.filter((_, i) => i !== index));
  };

  const updateService = (index, field, value) => {
    setServices(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const addPricingRow = (serviceIndex) => {
    setServices(prev => prev.map((s, i) => {
        if (i !== serviceIndex) return s;
        if (s.pricing.some(p => p.petType === 'dog-cat')) return s; // Block if General

        const lastRow = s.pricing[s.pricing.length - 1];
        let defaultType = lastRow ? lastRow.petType : "dog";
        if (defaultType === 'cat' && lastRow.size === 'cat') defaultType = 'dog';

        let defaultSize = getNextAvailableSize(s.pricing, defaultType);
        let defaultLabel = ALL_SIZES_DATA.find(x => x.key === defaultSize)?.label || "Extra Small";
        let defaultWeight = (defaultSize === 'cat' || defaultSize === 'all') ? "N/A" : "";

        return { ...s, pricing: [...s.pricing, {
            id: `temp_${Date.now()}_${Math.random()}`,
            petType: defaultType,
            size: defaultSize,
            sizeLabel: defaultLabel,
            weight: defaultWeight,
            price: ""
        }]};
    }));
  };

  const removePricingRow = (serviceIndex, pricingIndex) => {
    const service = services[serviceIndex];
    const rowToRemove = service.pricing[pricingIndex];

    // If it has a real UUID, track for deletion
    if (!rowToRemove.id.toString().startsWith("temp_")) {
        setDeletedOptionIds(prev => [...prev, rowToRemove.id]);
    }

    setServices(prev => prev.map((s, i) => 
        i === serviceIndex ? { ...s, pricing: s.pricing.filter((_, j) => j !== pricingIndex) } : s
    ));
  };

  const updatePricing = (serviceIndex, pricingIndex, field, value) => {
    setServices(prev => prev.map((s, i) => 
        i === serviceIndex ? {
            ...s,
            pricing: s.pricing.map((p, j) => {
                if (j !== pricingIndex) return p;
                const updated = { ...p, [field]: value };

                // Reuse Logic from ServiceListing
                if (field === "petType") {
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
            })
        } : s
    ));
  };

  // --- VALIDATION ---
  const validateWeightRange = (rangeStr) => {
    const match = rangeStr.match(/^(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)$/);
    if (!match) return null;
    return { min: parseFloat(match[1]), max: parseFloat(match[3]) };
  };

  const validateForm = () => {
    const errs = {};
    let hasError = false;

    if (services.length === 0) {
        setGlobalError("You must have at least one service.");
        return false;
    }

    services.forEach((service, si) => {
        if (!service.name.trim()) { errs[`service_${si}_name`] = "Required"; hasError = true; }
        if (!service.pricing.length) { errs[`service_${si}_pricing`] = "Add pricing."; hasError = true; }
        
        const dogRanges = []; const catRanges = [];
        service.pricing.forEach((pricing, pi) => {
            const priceVal = parseFloat(pricing.price);
            if (!pricing.price || isNaN(priceVal) || priceVal <= 0) {
                errs[`service_${si}_pricing_${pi}_price`] = "Req > 0"; hasError = true;
            }
            if (pricing.size !== "cat" && pricing.size !== "all") {
                if (!pricing.weight || pricing.weight.trim() === "") {
                    errs[`service_${si}_pricing_${pi}_weight`] = "Req"; hasError = true;
                } else {
                    const parsed = validateWeightRange(pricing.weight);
                    if (!parsed) { errs[`service_${si}_pricing_${pi}_weight`] = "Use 'min - max'"; hasError = true; }
                    else if (parsed.min >= parsed.max) { errs[`service_${si}_pricing_${pi}_weight`] = "Min < Max"; hasError = true; }
                    else {
                        const targetRanges = pricing.petType === 'cat' ? catRanges : dogRanges;
                        const hasOverlap = targetRanges.some((r) => 
                            (parsed.min >= r.min && parsed.min <= r.max) || (parsed.max >= r.min && parsed.max <= r.max) || (parsed.min <= r.min && parsed.max >= r.max)
                        );
                        if (hasOverlap) { errs[`service_${si}_pricing_${pi}_weight`] = "Overlap"; hasError = true; }
                        else targetRanges.push(parsed);
                    }
                }
            }
        });
    });

    setValidationErrors(errs);
    if (hasError) setGlobalError("Please fix errors.");
    return !hasError;
  };

  const handleUpdateClick = () => {
    setGlobalError("");
    if (validateForm()) {
        setStep(2);
        window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // --- DATABASE UPDATE LOGIC ---
  const saveChangesToDB = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user");

        // 1. Get Provider ID
        const { data: providerData } = await supabase.from("service_providers").select("id").eq("user_id", user.id).single();
        const providerId = providerData.id;

        // 2. DELETE Removed Records
        if (deletedOptionIds.length > 0) {
            await supabase.from("service_options").delete().in("id", deletedOptionIds);
        }
        if (deletedServiceIds.length > 0) {
            await supabase.from("services").delete().in("id", deletedServiceIds);
        }

        // 3. UPSERT Services & Options
        for (const service of services) {
            let serviceId = service.id;

            // Prepare Payload
            const servicePayload = {
                provider_id: providerId,
                type: service.type,
                name: service.name,
                description: service.description,
                notes: service.notes || null
            };

            // A. Service Handling
            if (serviceId.toString().startsWith("temp_")) {
                // INSERT NEW SERVICE
                const { data, error } = await supabase.from("services").insert([servicePayload]).select().single();
                if (error) throw error;
                serviceId = data.id; // Get real ID
            } else {
                // UPDATE EXISTING SERVICE
                const { error } = await supabase.from("services").update(servicePayload).eq("id", serviceId);
                if (error) throw error;
            }

            // B. Options Handling
            for (const pricing of service.pricing) {
                const optionPayload = {
                    service_id: serviceId, // Link to correct parent
                    pet_type: pricing.petType,
                    size: pricing.size,
                    weight_range: pricing.weight,
                    price: parseFloat(pricing.price)
                };

                if (pricing.id.toString().startsWith("temp_")) {
                    // INSERT NEW OPTION
                    const { error } = await supabase.from("service_options").insert([optionPayload]);
                    if (error) throw error;
                } else {
                    // UPDATE EXISTING OPTION
                    const { error } = await supabase.from("service_options").update(optionPayload).eq("id", pricing.id);
                    if (error) throw error;
                }
            }
        }

        return { success: true };
    } catch (err) {
        console.error(err);
        return { success: false, message: err.message };
    }
  };

  const handleConfirmSubmit = async () => {
    setSubmissionStatus('submitting');
    const result = await saveChangesToDB();
    if (result.success) {
        setSubmissionStatus('success');
    } else {
        setSubmissionStatus('error');
        setSubmissionError(result.message);
    }
  };

  if (loadingData) return <div className="sp-loading">Loading data...</div>;

  /* ================= VIEW 1: EDIT FORM ================= */
  if (step === 1) {
    return (
      <>
        <LoggedInNavbar />
        <div className="sp-edit-container">
          <div className="header-row">
            <button className="back-link" onClick={() => navigate("/service/manage-listing")}>
                <ArrowLeft size={16} />
            </button>
            <h1>Edit Service Listings</h1>
          </div>

          {globalError && (
            <div className="global-error">
                <AlertCircle size={18} style={{marginRight: 8}}/> {globalError}
            </div>
          )}

          <div className="services-list">
            {services.map((service, si) => (
                <div key={service.id} className="edit-card">
                    <div className="card-header-bar">
                        <span className={`type-badge ${service.type}`}>
                            {service.type === 'package' ? 'Package' : 'Individual'}
                        </span>
                        <button type="button" className="btn-delete-service" onClick={() => removeService(si)}>
                            <Trash2 size={18} />
                        </button>
                    </div>

                    <div className="edit-form-grid">
                        <div className="col-left">
                            <div className="form-group">
                                <label>Service Name</label>
                                <input type="text" value={service.name} onChange={(e) => updateService(si, 'name', e.target.value)} className={validationErrors[`service_${si}_name`] ? "error-input" : ""} />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <input type="text" value={service.description} onChange={(e) => updateService(si, 'description', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Notes</label>
                                <textarea value={service.notes} onChange={(e) => updateService(si, 'notes', e.target.value)} />
                            </div>
                        </div>

                        <div className="col-right">
                            <label className="section-label">Pricing Variants</label>
                            <div className="pricing-grid-header">
                                <span>Type</span>
                                <span>Size</span>
                                <span>Weight (kg)</span>
                                <span>Price</span>
                                <span></span>
                            </div>
                            <div className="pricing-rows-container">
                                {service.pricing.map((p, pi) => (
                                    <div key={p.id} className="pricing-edit-row">
                                        <select value={p.petType} onChange={(e) => updatePricing(si, pi, 'petType', e.target.value)}>
                                            {getAvailablePetTypes(service.pricing, pi).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                        <select value={p.size} onChange={(e) => updatePricing(si, pi, 'size', e.target.value)}>
                                            {getOptionsForPricingRow(service.pricing, pi).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                        </select>
                                        <input 
                                            type="text" 
                                            value={p.weight} 
                                            onChange={(e) => updatePricing(si, pi, 'weight', e.target.value)}
                                            placeholder={p.size === 'cat' || p.size === 'all' ? 'N/A' : '1 - 5'}
                                            disabled={p.size === 'cat' || p.size === 'all'}
                                            className={validationErrors[`service_${si}_pricing_${pi}_weight`] ? "error-input" : ""}
                                        />
                                        <input 
                                            type="number" 
                                            value={p.price} 
                                            onChange={(e) => updatePricing(si, pi, 'price', e.target.value)}
                                            onBlur={(e) => {
                                                const v = parseFloat(e.target.value);
                                                if (!isNaN(v) && v > 0) updatePricing(si, pi, 'price', v.toFixed(2));
                                            }}
                                            placeholder="0.00"
                                            className={validationErrors[`service_${si}_pricing_${pi}_price`] ? "error-input" : ""}
                                        />
                                        {service.pricing.length > 1 && (
                                            <button className="btn-del-row" onClick={() => removePricingRow(si, pi)}><X size={16}/></button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {!service.pricing.some(p => p.petType === 'dog-cat') && (
                                <button className="btn-add-variant" onClick={() => addPricingRow(si)}>
                                    <PlusCircle size={14}/> Add Variant
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}
          </div>

          <div className="bottom-actions-bar">
             <div className="add-btns">
                <button className="btn-add-svc" onClick={() => addService('individual')}>+ Individual</button>
                <button className="btn-add-svc" onClick={() => addService('package')}>+ Package</button>
             </div>
             <button className="btn-proceed-update" onClick={handleUpdateClick}>Review Updates</button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  /* ================= VIEW 2: SUMMARY REVIEW ================= */
  return (
    <>
      <LoggedInNavbar />
      <div className="sp-edit-container">
        <div className="summary-header">
            <h1>Review Updates</h1>
            <p>Please confirm your changes before saving to the database.</p>
        </div>

        <div className="summary-list">
            {services.map((service, si) => (
                <div key={si} className="summary-card">
                    <div className="summary-top">
                        <h3>{service.name}</h3>
                        <span className="type-tag">{service.type}</span>
                    </div>
                    <p className="summary-desc">{service.description || "No description"}</p>
                    <table className="summary-table">
                        <thead><tr><th>Type</th><th>Size</th><th>Weight (kg)</th><th>Price</th></tr></thead>
                        <tbody>
                            {service.pricing.map((p, pi) => (
                                <tr key={pi}>
                                    <td style={{textTransform:'capitalize'}}>{p.petType === 'dog-cat' ? 'Dog & Cat' : p.petType}</td>
                                    <td>{p.sizeLabel}</td>
                                    <td>{p.weight} kg</td>
                                    <td>₱{p.price}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>

        <div className="summary-actions">
            <button className="btn-back-edit" onClick={() => setStep(1)} disabled={submissionStatus === 'submitting'}>
                <ArrowLeft size={16}/> Back to Edit
            </button>
            <button className="btn-final-submit" onClick={() => setShowFinalModal(true)} disabled={submissionStatus === 'submitting'}>
                Update
            </button>
        </div>
      </div>

      <FinalConfirmationModal 
        isOpen={showFinalModal}
        onClose={() => setShowFinalModal(false)}
        onConfirm={handleConfirmSubmit}
        status={submissionStatus}
        errorMessage={submissionError}
        onNavigateManage={() => navigate("/service/manage-listing")}
      />
      <Footer />
    </>
  );
}