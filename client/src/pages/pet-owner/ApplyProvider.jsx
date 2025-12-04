// /src/pages/pet-owner/ApplyProvider.jsx
import React, { useState, useEffect } from "react";
import { X, Upload, FileText, CheckCircle, AlertCircle, Trash2, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { supabase } from "../../config/supabase";
import "./ApplyProvider.css";

/* =========================================
   CONFIRMATION MODAL COMPONENT
   ========================================= */
const ConfirmationModal = ({ isOpen, onClose, onConfirm, data, files, isSubmitting }) => {
  if (!isOpen) return null;

  const formatOperatingHours = (hours) =>
    hours.map((slot, idx) => (
      <div key={idx} style={{ marginBottom: 6 }}>
        <strong>{slot.days.join(", ") || "—"}:</strong> {slot.startTime} - {slot.endTime}
      </div>
    ));

  const renderFileLink = (file, url) => {
    if (url) {
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="modal-file-link">
          <FileText size={14} style={{ marginRight: 4 }} /> View existing file
        </a>
      );
    }
    if (file) {
      return (
        <span className="modal-file-new">
          <FileText size={14} style={{ marginRight: 4 }} /> {file.name}
        </span>
      );
    }
    return <span className="modal-file-none" style={{ color: "#9ca3af", fontStyle: "italic" }}>No file provided</span>;
  };

  const renderFileList = (fileArray, existingArray) => {
    const items = [];
    if (existingArray && existingArray.length > 0) {
      existingArray.forEach((item, idx) => {
        const url = item.image_url || item.file_url;
        items.push(
          <div key={`existing-${idx}`} className="modal-file-existing">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <FileText size={14} style={{ marginRight: 4 }} /> Existing file {idx + 1}
            </a>
          </div>
        );
      });
    }
    if (fileArray && fileArray.length > 0) {
      fileArray.forEach((file, idx) => {
        items.push(
          <div key={`new-${idx}`} className="modal-file-new">
            <FileText size={14} style={{ marginRight: 4 }} /> {file.name}
          </div>
        );
      });
    }
    if (items.length === 0) return <span className="modal-file-none">No files</span>;
    return items;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">
            <CheckCircle size={20} style={{ color: "#10b981", marginRight: 8 }} />
            Confirm Your Application
          </h2>
          <button onClick={onClose} disabled={isSubmitting} className="modal-close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-alert">
            <AlertCircle size={18} style={{ color: "#f59e0b", marginRight: 8 }} />
            <p>Please review all information below. Once submitted, you cannot edit this form again.</p>
          </div>

          <section className="modal-section">
            <h3>Business Information</h3>
            <div className="info-box">
              <div className="info-item"><strong>Business Name:</strong> {data.businessName}</div>
              
              {/* Added Description to Modal */}
              <div className="info-item" style={{alignItems: 'flex-start'}}>
                <strong>Description:</strong> 
                <span style={{whiteSpace: 'pre-wrap', marginTop: '4px', display:'block'}}>{data.description}</span>
              </div>

              <div className="info-item"><strong>Email:</strong> {data.businessEmail}</div>
              <div className="info-item"><strong>Mobile:</strong> {data.businessMobile}</div>
              <div className="info-item"><strong>Service Type:</strong> {data.typeOfService}</div>
              <div className="info-item"><strong>Social Media:</strong> {data.socialMediaUrl || "N/A"}</div>
              <div className="info-item">
                <strong>Operating Hours:</strong>
                <div style={{ marginTop: 8, paddingLeft: 10 }}>{formatOperatingHours(data.operatingHours || [])}</div>
              </div>
            </div>
          </section>

          <section className="modal-section">
            <h3>Address</h3>
            <div className="info-box">
              <div className="info-item">{data.houseStreet}, {data.barangay}</div>
              <div className="info-item">{data.city}, {data.province}</div>
              <div className="info-item">{data.postalCode}, {data.country}</div>
            </div>
          </section>

          <section className="modal-section">
            <h3>Documents & Images</h3>
            <div className="info-box">
              <div className="info-item">
                <strong>Business Permit:</strong>
                <div style={{ marginTop: 6 }}>{renderFileLink(files.businessPermitFile, files.existingPermitUrl)}</div>
              </div>
              <div className="info-item">
                <strong>Waiver:</strong>
                <div style={{ marginTop: 6 }}>{renderFileLink(files.waiverFile, files.existingWaiverUrl)}</div>
              </div>
              <div className="info-item">
                <strong>Facility Images:</strong>
                <div style={{ marginTop: 6 }}>{renderFileList(files.facilityImages, files.existingFacilityImages)}</div>
              </div>
              <div className="info-item">
                <strong>Payment Channel:</strong>
                <div style={{ marginTop: 6 }}>{renderFileList(files.paymentChannelFiles, files.existingPaymentChannels)}</div>
              </div>
            </div>
          </section>

          <section className="modal-section">
            <h3>Employees</h3>
            <div className="info-box">
              {(files.employees || []).map((emp, idx) => (
                <div key={idx} className="info-item">
                  <strong>{emp.fullName}</strong> — {emp.position}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} disabled={isSubmitting} className="btn-cancel">
            Go Back & Edit
          </button>
          <button onClick={onConfirm} disabled={isSubmitting} className="btn-confirm">
            {isSubmitting ? "Submitting..." : "Save & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================
   MAIN COMPONENT
   ========================================= */
export default function ApplyProvider() {
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [providerId, setProviderId] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Requirement 2: Defaults set here
  const [businessInfo, setBusinessInfo] = useState({
    businessName: "",
    description: "", // New State for Description
    businessEmail: "",
    businessMobile: "",
    socialMediaUrl: "",
    typeOfService: "Pet Grooming", // Default
    operatingHours: [{ days: [], startTime: "09:00", endTime: "17:00" }],
    houseStreet: "",
    barangay: "",
    city: "",
    province: "",
    postalCode: "",
    country: "Philippines", // Default
  });

  const [waiverFile, setWaiverFile] = useState(null);
  const [existingWaiverUrl, setExistingWaiverUrl] = useState(null);

  const [facilityImages, setFacilityImages] = useState([]);
  const [existingFacilityImages, setExistingFacilityImages] = useState([]);

  const [paymentChannelFiles, setPaymentChannelFiles] = useState([]);
  const [existingPaymentChannels, setExistingPaymentChannels] = useState([]);

  const [businessPermitFile, setBusinessPermitFile] = useState(null);
  const [existingPermitUrl, setExistingPermitUrl] = useState(null);

  // Requirement 6: Position will be dropdown
  const [employees, setEmployees] = useState([{ fullName: "", position: "" }]);
  const [validationErrors, setValidationErrors] = useState({});

  const daysOfWeekShort = ["S", "M", "T", "W", "T", "F", "S"];
  const daysOfWeekFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const positionOptions = ["Business Owner", "Pet Stylist", "Staff"];

  // --- Load Data on Mount ---
  useEffect(() => {
    const loadProviderData = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) return;

        const { data: providerData, error } = await supabase
            .from("service_providers")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle(); 

        if (providerData) {
            setProviderId(providerData.id);
            localStorage.setItem("providerId", providerData.id); 

            setBusinessInfo(prev => ({
              ...prev,
              businessName: providerData.business_name || "",
              description: providerData.description || "", // Load description
              businessEmail: providerData.business_email || "",
              businessMobile: providerData.business_mobile || "",
              socialMediaUrl: providerData.social_media_url || "",
              houseStreet: providerData.house_street || "",
              barangay: providerData.barangay || "",
              city: providerData.city || "",
              province: providerData.province || "",
              postalCode: providerData.postal_code || "",
            }));

            if (providerData.waiver_url) setExistingWaiverUrl(providerData.waiver_url);

            const { data: hours } = await supabase.from("service_provider_hours").select("*").eq("provider_id", providerData.id);
            if (hours && hours.length > 0) {
              const grouped = {};
              hours.forEach((h) => {
                const key = `${h.start_time}-${h.end_time}`;
                if (!grouped[key]) grouped[key] = { days: [], startTime: h.start_time, endTime: h.end_time };
                grouped[key].days.push(h.day_of_week);
              });
              setBusinessInfo((prev) => ({ ...prev, operatingHours: Object.values(grouped) }));
            }

            const { data: imgs } = await supabase.from("service_provider_images").select("*").eq("provider_id", providerData.id);
            if (imgs) setExistingFacilityImages(imgs);

            const { data: payments } = await supabase.from("service_provider_payments").select("*").eq("provider_id", providerData.id);
            if (payments) setExistingPaymentChannels(payments);

            const { data: permits } = await supabase.from("service_provider_permits").select("*").eq("provider_id", providerData.id);
            if (permits && permits.length > 0) setExistingPermitUrl(permits[0].file_url);

            const { data: staff } = await supabase.from("service_provider_staff").select("*").eq("provider_id", providerData.id);
            if (staff && staff.length > 0) {
                setEmployees(staff.map(s => ({ fullName: s.full_name, position: s.job_title })));
            }
        }
      } catch (err) {
        console.error("Load error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadProviderData();
  }, []);

  // --- Handlers ---

  const handleBusinessChange = (e) => {
    const { name, value } = e.target;
    
    // Description: Limit to 500 chars
    if (name === "description") {
        if (value.length <= 500) {
            setBusinessInfo((prev) => ({ ...prev, [name]: value }));
        }
        return;
    }

    // Mobile Number Validation
    if (name === "businessMobile") {
        const numbersOnly = value.replace(/\D/g, "");
        if (numbersOnly.length <= 11) {
            setBusinessInfo((prev) => ({ ...prev, [name]: numbersOnly }));
        }
        return;
    }
    
    // Postal Code Validation
    if (name === "postalCode") {
        const numbersOnly = value.replace(/\D/g, "");
        if (numbersOnly.length <= 4) {
             setBusinessInfo((prev) => ({ ...prev, [name]: numbersOnly }));
        }
        return;
    }

    setBusinessInfo((prev) => ({ ...prev, [name]: value }));
  };

  const toggleDay = (slotIndex, day) => {
    setBusinessInfo((prev) => {
      const used = prev.operatingHours.some((s, i) => i !== slotIndex && s.days.includes(day));
      if (used) return prev;
      return {
        ...prev,
        operatingHours: prev.operatingHours.map((slot, i) =>
          i === slotIndex ? { ...slot, days: slot.days.includes(day) ? slot.days.filter((d) => d !== day) : [...slot.days, day] } : slot
        ),
      };
    });
  };

  const isDayDisabled = (slotIndex, day) => businessInfo.operatingHours.some((slot, i) => i !== slotIndex && slot.days.includes(day));
  const addTimeSlot = () => setBusinessInfo((prev) => ({ ...prev, operatingHours: [...prev.operatingHours, { days: [], startTime: "09:00", endTime: "17:00" }] }));
  const removeTimeSlot = (index) => setBusinessInfo((prev) => ({ ...prev, operatingHours: prev.operatingHours.filter((_, i) => i !== index) }));
  const handleTimeChange = (slotIndex, type, value) => {
    setBusinessInfo((prev) => ({ ...prev, operatingHours: prev.operatingHours.map((slot, i) => (i === slotIndex ? { ...slot, [type]: value } : slot)) }));
  };

  const handleFileSelect = (setter, e, maxSizeMB, fieldName) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > maxSizeMB * 1024 * 1024) {
        setValidationErrors((prev) => ({ ...prev, [fieldName]: `File size must not exceed ${maxSizeMB}MB.` }));
        e.target.value = "";
        return;
      }
      setValidationErrors((prev) => { const u = { ...prev }; delete u[fieldName]; return u; });
      setter(file);
    }
  };

  const handleMultiFileSelect = (setter, currentFiles, e, maxFiles, fieldName, existingCount = 0, maxSizeMB = 2) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      
      if (currentFiles.length + files.length + existingCount > maxFiles) {
        setValidationErrors((prev) => ({ ...prev, [fieldName]: `You can upload up to ${maxFiles} files total.` }));
        e.target.value = "";
        return;
      }

      const invalidFile = files.find(f => f.size > maxSizeMB * 1024 * 1024);
      if (invalidFile) {
        setValidationErrors((prev) => ({ ...prev, [fieldName]: `One or more files exceed the ${maxSizeMB}MB limit.` }));
        e.target.value = "";
        return;
      }

      setValidationErrors((prev) => { const u = { ...prev }; delete u[fieldName]; return u; });
      setter((prev) => [...prev, ...files]);
      e.target.value = "";
    }
  };

  const removeFile = (setter, index) => setter((prev) => prev.filter((_, i) => i !== index));
  const removeSingleFile = (fileSetter, urlSetter) => { fileSetter(null); urlSetter(null); };

  const handleEmployeeChange = (index, field, value) => setEmployees((prev) => prev.map((emp, i) => (i === index ? { ...emp, [field]: value } : emp)));
  const addEmployee = () => setEmployees((prev) => [...prev, { fullName: "", position: "" }]);
  const removeEmployee = (index) => setEmployees((prev) => prev.filter((_, i) => i !== index));

  // VALIDATION
  const validateForm = () => {
    const errors = {};
    if (!businessInfo.businessName.trim()) errors.businessName = "Business Name is required";
    // New Required Check for Description
    if (!businessInfo.description.trim()) errors.description = "Business Description is required";
    
    if (!businessInfo.businessEmail.trim()) errors.businessEmail = "Email is required";
    if (!/^09\d{9}$/.test(businessInfo.businessMobile)) errors.businessMobile = "Must be a valid PH mobile number (09XXXXXXXXX)";

    if (businessInfo.socialMediaUrl && !/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?(\?.*)?$/.test(businessInfo.socialMediaUrl)) {
        errors.socialMediaUrl = "Must be a valid URL";
    }

    if (!businessInfo.operatingHours || businessInfo.operatingHours.length === 0) {
      errors.operatingHours = "At least one operating hour slot is required";
    } else {
        businessInfo.operatingHours.forEach(slot => {
            if(slot.days.length === 0) errors.operatingHours = "Select at least one day for each slot";
        });
    }

    ["houseStreet", "barangay", "city", "province"].forEach((field) => {
      if (!businessInfo[field] || !businessInfo[field].trim()) errors[field] = "This field is required";
    });

    if (!/^\d{4}$/.test(businessInfo.postalCode)) errors.postalCode = "Postal code must be 4 digits";

    if (facilityImages.length === 0 && existingFacilityImages.length === 0) errors.facilityImages = "At least 1 facility image required";
    if (paymentChannelFiles.length === 0 && existingPaymentChannels.length === 0) errors.paymentChannelFiles = "At least 1 payment QR required";
    if (!businessPermitFile && !existingPermitUrl) errors.businessPermitFile = "Business Permit is required";

    if (employees.length === 0) errors.employees = "At least one employee is required";
    employees.forEach((emp, i) => {
      if (!emp.fullName.trim()) errors[`employee_${i}_name`] = "Required";
      if (!emp.position.trim()) errors[`employee_${i}_pos`] = "Required";
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setShowConfirmModal(true);
  };

  const getFilePathFromUrl = (url) => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const match = u.pathname.match(/\/storage\/v1\/object\/public\/[^\/]+\/(.+)$/);
      return match ? decodeURIComponent(match[1]) : null;
    } catch { return null; }
  };

  const removeExistingFile = async (type, id, fileUrl) => {
    if (!window.confirm("Are you sure you want to remove this file?")) return;
    try {
        let tableName = "";
        if (type === "image") tableName = "service_provider_images";
        else if (type === "payment") tableName = "service_provider_payments";
        else if (type === "permit") tableName = "service_provider_permits";

        const filePath = getFilePathFromUrl(fileUrl);
        if (filePath) await supabase.storage.from("service_provider_uploads").remove([filePath]);

        if (tableName) {
            await supabase.from(tableName).delete().eq("id", id);
            if (type === "image") setExistingFacilityImages(prev => prev.filter(i => i.id !== id));
            if (type === "payment") setExistingPaymentChannels(prev => prev.filter(p => p.id !== id));
            if (type === "permit") setExistingPermitUrl(null);
        }
    } catch (e) { console.error("Remove error", e); }
  };

  const uploadFileToStorage = async (userId, folder, file) => {
    if (!file) return null;
    const filePath = `${userId}/${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const { error } = await supabase.storage.from("service_provider_uploads").upload(filePath, file);
    if (error) throw error;
    const { data } = supabase.storage.from("service_provider_uploads").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user found");

        const waiverUrl = waiverFile ? await uploadFileToStorage(user.id, "waivers", waiverFile) : null;
        const permitUrl = businessPermitFile ? await uploadFileToStorage(user.id, "permits", businessPermitFile) : null;
        
        const newFacilityUrls = [];
        for (const f of facilityImages) {
            const u = await uploadFileToStorage(user.id, "facilities", f);
            if(u) newFacilityUrls.push(u);
        }

        const newPaymentUrls = [];
        for (const f of paymentChannelFiles) {
            const u = await uploadFileToStorage(user.id, "payments", f);
            if(u) newPaymentUrls.push(u);
        }

        let currentProviderId = providerId;

        // Fetch current ID to ensure we don't duplicate
        if (!currentProviderId) {
             const { data: existing } = await supabase.from("service_providers").select("id").eq("user_id", user.id).maybeSingle();
             if (existing) currentProviderId = existing.id;
        }

        // --- UPSERT PROVIDER ---
        const payload = {
            user_id: user.id,
            business_name: businessInfo.businessName,
            description: businessInfo.description, // Save Description
            business_email: businessInfo.businessEmail,
            business_mobile: businessInfo.businessMobile,
            house_street: businessInfo.houseStreet,
            barangay: businessInfo.barangay,
            city: businessInfo.city,
            province: businessInfo.province,
            postal_code: businessInfo.postalCode,
            country: businessInfo.country,
            type_of_service: businessInfo.typeOfService,
            social_media_url: businessInfo.socialMediaUrl,
            waiver_url: waiverUrl || existingWaiverUrl || null,
            updated_at: new Date().toISOString()
        };

        if (currentProviderId) {
            const { error: updateError } = await supabase.from("service_providers").update(payload).eq("id", currentProviderId);
            if (updateError) throw updateError;

            // Safe delete of children now that parent update succeeded
            await supabase.from("service_provider_hours").delete().eq("provider_id", currentProviderId);
            await supabase.from("service_provider_staff").delete().eq("provider_id", currentProviderId);
        } else {
            payload.status = "pending";
            const { data, error: insertError } = await supabase.from("service_providers").insert([payload]).select().single();
            if (insertError) throw insertError;
            
            currentProviderId = data.id;
            setProviderId(currentProviderId);
            localStorage.setItem("providerId", currentProviderId);
        }

        // --- INSERT RELATIONS ---
        const hoursPayload = [];
        businessInfo.operatingHours.forEach(slot => {
            slot.days.forEach(day => {
                hoursPayload.push({
                    provider_id: currentProviderId,
                    day_of_week: day,
                    start_time: slot.startTime,
                    end_time: slot.endTime
                });
            });
        });
        if(hoursPayload.length > 0) {
            const { error: hError } = await supabase.from("service_provider_hours").insert(hoursPayload);
            if (hError) throw hError;
        }

        for (const url of newFacilityUrls) {
            await supabase.from("service_provider_images").insert({ provider_id: currentProviderId, image_url: url });
        }
        for (const url of newPaymentUrls) {
            await supabase.from("service_provider_payments").insert({ provider_id: currentProviderId, method_type: "QR", file_url: url });
        }
        if (permitUrl) {
            await supabase.from("service_provider_permits").delete().eq("provider_id", currentProviderId);
            await supabase.from("service_provider_permits").insert({ provider_id: currentProviderId, permit_type: "Business Permit", file_url: permitUrl });
        }
        for (const emp of employees) {
            const { error: sError } = await supabase.from("service_provider_staff").insert({ provider_id: currentProviderId, full_name: emp.fullName, job_title: emp.position });
            if (sError) throw sError;
        }

        setShowConfirmModal(false);
        navigate("/service-setup");

    } catch (err) {
        console.error("SUBMISSION FAILED:", err);
        alert("Submission failed: " + err.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  const getFileNameFromUrl = (url) => {
    try { return decodeURIComponent(url.split('/').pop().split('_').slice(1).join('_')); } catch { return "File"; }
  };

  if (isLoading) return <div className="loading-screen">Loading Application...</div>;

  return (
    <>
      <LoggedInNavbar hideBecomeProvider={true} />
      <div className="apply-provider-wrapper">
        <h1 className="page-title">Service Provider Application</h1>

        {validationErrors.general && <div className="form-error">{validationErrors.general}</div>}

        <form className="apply-provider-form" onSubmit={handleFormSubmit}>
          
          <section className="form-section">
            <h2>Business Information</h2>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Business Name *</label>
                <input type="text" name="businessName" value={businessInfo.businessName} onChange={handleBusinessChange} />
                {validationErrors.businessName && <small className="error">{validationErrors.businessName}</small>}
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" name="businessEmail" value={businessInfo.businessEmail} onChange={handleBusinessChange} />
                {validationErrors.businessEmail && <small className="error">{validationErrors.businessEmail}</small>}
              </div>
              <div className="form-group">
                <label>Mobile Number * (09XXXXXXXXX)</label>
                <input type="tel" name="businessMobile" value={businessInfo.businessMobile} onChange={handleBusinessChange} placeholder="09123456789" />
                {validationErrors.businessMobile && <small className="error">{validationErrors.businessMobile}</small>}
              </div>
            </div>

            <div className="form-grid-2">
                <div className="form-group">
                    <label>Service Type</label>
                    <input type="text" name="typeOfService" value={businessInfo.typeOfService} disabled className="input-disabled" />
                </div>
                <div className="form-group">
                    <label>Social Media URL (Optional)</label>
                    <input type="url" name="socialMediaUrl" value={businessInfo.socialMediaUrl} onChange={handleBusinessChange} placeholder="https://facebook.com/..." />
                    {validationErrors.socialMediaUrl && <small className="error">{validationErrors.socialMediaUrl}</small>}
                </div>
            </div>

            {/* --- NEW DESCRIPTION FIELD --- */}
            <div className="form-group" style={{marginTop:'20px'}}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom:'5px' }}>
                    <label>Business Description *</label>
                    <span style={{ fontSize: "0.85rem", color: businessInfo.description.length >= 500 ? "#ef4444" : "#6b7280", fontWeight:500 }}>
                        {businessInfo.description.length}/500
                    </span>
                </div>
                <textarea
                    name="description"
                    value={businessInfo.description}
                    onChange={handleBusinessChange}
                    rows={5}
                    maxLength={500}
                    placeholder="Tell us about your business experience, services, and what makes you unique..."
                    style={{ width:'100%', padding:'12px', border: validationErrors.description ? '1px solid #ef4444' : '1px solid #d1d5db', borderRadius:'8px', fontFamily:'inherit' }}
                />
                {validationErrors.description && <small className="error">{validationErrors.description}</small>}
            </div>
            {/* ----------------------------- */}

            <div className="form-group" style={{marginTop:'20px'}}>
              <label>Operating Hours *</label>
              {businessInfo.operatingHours.map((slot, i) => (
                <div key={i} className="operating-slot">
                  <div className="day-buttons">
                    {daysOfWeekFull.map((d, idx) => (
                      <button key={d} type="button" 
                        className={`day-btn ${slot.days.includes(d) ? "active" : ""} ${isDayDisabled(i, d) ? "disabled" : ""}`} 
                        onClick={() => toggleDay(i, d)} disabled={isDayDisabled(i, d)}>
                        {daysOfWeekShort[idx]}
                      </button>
                    ))}
                  </div>
                  <div className="time-inputs">
                    <input type="time" value={slot.startTime} onChange={(e) => handleTimeChange(i, "startTime", e.target.value)} />
                    <span>to</span>
                    <input type="time" value={slot.endTime} onChange={(e) => handleTimeChange(i, "endTime", e.target.value)} />
                    {businessInfo.operatingHours.length > 1 && (
                      <button type="button" onClick={() => removeTimeSlot(i)} className="remove-btn"><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
              ))}
              <button type="button" className="add-btn" onClick={addTimeSlot}><Plus size={16} /> Add Slot</button>
              {validationErrors.operatingHours && <small className="error">{validationErrors.operatingHours}</small>}
            </div>
          </section>

          {/* ... (Address, Documents, Employees Sections remain unchanged) ... */}
          
          <section className="form-section">
            <h2>Business Address</h2>
            <div className="form-grid-3">
              <div className="form-group"><label>Street / House No. *</label><input type="text" name="houseStreet" value={businessInfo.houseStreet} onChange={handleBusinessChange} />{validationErrors.houseStreet && <small className="error">{validationErrors.houseStreet}</small>}</div>
              <div className="form-group"><label>Barangay *</label><input type="text" name="barangay" value={businessInfo.barangay} onChange={handleBusinessChange} />{validationErrors.barangay && <small className="error">{validationErrors.barangay}</small>}</div>
              <div className="form-group"><label>City / Municipality *</label><input type="text" name="city" value={businessInfo.city} onChange={handleBusinessChange} />{validationErrors.city && <small className="error">{validationErrors.city}</small>}</div>
              <div className="form-group"><label>Province *</label><input type="text" name="province" value={businessInfo.province} onChange={handleBusinessChange} />{validationErrors.province && <small className="error">{validationErrors.province}</small>}</div>
              <div className="form-group"><label>Postal Code *</label><input type="text" name="postalCode" value={businessInfo.postalCode} onChange={handleBusinessChange} maxLength={4} />{validationErrors.postalCode && <small className="error">{validationErrors.postalCode}</small>}</div>
              <div className="form-group"><label>Country</label><input type="text" name="country" value={businessInfo.country} disabled className="input-disabled" /></div>
            </div>
          </section>

          <section className="form-section">
            <h2>Documents & Uploads</h2>
            <div className="form-grid-2">
              <div className="form-group"><label>Waiver (Optional)</label><label className="file-btn"><Upload size={18} /> <span>Select File</span><input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileSelect(setWaiverFile, e, 1, "waiverFile")} hidden /></label><div className="file-preview-small">{waiverFile ? <span>{waiverFile.name} <X size={14} onClick={() => setWaiverFile(null)} /></span> : existingWaiverUrl ? <span><a href={existingWaiverUrl} target="_blank" rel="noreferrer">View Existing</a> <X size={14} onClick={() => removeSingleFile(setWaiverFile, setExistingWaiverUrl)} /></span> : null}</div>{validationErrors.waiverFile && <small className="error">{validationErrors.waiverFile}</small>}</div>
              <div className="form-group"><label>Business Permit *</label><label className="file-btn"><Upload size={18} /> <span>Select File</span><input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileSelect(setBusinessPermitFile, e, 1, "businessPermitFile")} hidden /></label><div className="file-preview-small">{businessPermitFile ? <span>{businessPermitFile.name} <X size={14} onClick={() => setBusinessPermitFile(null)} /></span> : existingPermitUrl ? <span><a href={existingPermitUrl} target="_blank" rel="noreferrer">View Existing</a> <X size={14} onClick={() => removeSingleFile(setBusinessPermitFile, setExistingPermitUrl)} /></span> : null}</div>{validationErrors.businessPermitFile && <small className="error">{validationErrors.businessPermitFile}</small>}</div>
            </div>
            <div className="form-grid-2">
                <div className="form-group"><label>Facility Images * (Max 3)</label><label className="file-btn"><Upload size={18} /> <span>Select Images</span><input type="file" accept=".jpg,.jpeg,.png" multiple onChange={(e) => handleMultiFileSelect(setFacilityImages, facilityImages, e, 3, "facilityImages", existingFacilityImages.length, 2)} hidden /></label><div className="file-list">{existingFacilityImages.map(img => (<div key={img.id} className="file-item"><FileText size={14} /> Existing Img <button type="button" onClick={() => removeExistingFile("image", img.id, img.image_url)}><X size={12} /></button></div>))}{facilityImages.map((f, i) => (<div key={i} className="file-item"><FileText size={14} /> {f.name}<button type="button" onClick={() => removeFile(setFacilityImages, i)}><X size={12} /></button></div>))}</div>{validationErrors.facilityImages && <small className="error">{validationErrors.facilityImages}</small>}</div>
                <div className="form-group"><label>Payment QR * (Max 3)</label><label className="file-btn"><Upload size={18} /> <span>Select QR Images</span><input type="file" accept=".jpg,.jpeg,.png" multiple onChange={(e) => handleMultiFileSelect(setPaymentChannelFiles, paymentChannelFiles, e, 3, "paymentChannelFiles", existingPaymentChannels.length, 2)} hidden /></label><div className="file-list">{existingPaymentChannels.map(img => (<div key={img.id} className="file-item"><FileText size={14} /> Existing QR <button type="button" onClick={() => removeExistingFile("payment", img.id, img.file_url)}><X size={12} /></button></div>))}{paymentChannelFiles.map((f, i) => (<div key={i} className="file-item"><FileText size={14} /> {f.name}<button type="button" onClick={() => removeFile(setPaymentChannelFiles, i)}><X size={12} /></button></div>))}</div>{validationErrors.paymentChannelFiles && <small className="error">{validationErrors.paymentChannelFiles}</small>}</div>
            </div>
          </section>

          <section className="form-section">
            <h2>Employee Information</h2>
            {employees.map((emp, idx) => (
              <div className="employee-row" key={idx}>
                <div className="form-grid-2">
                  <div className="form-group"><label>Full Name *</label><input type="text" value={emp.fullName} onChange={(e) => handleEmployeeChange(idx, "fullName", e.target.value)} />{validationErrors[`employee_${idx}_name`] && <small className="error">{validationErrors[`employee_${idx}_name`]}</small>}</div>
                  <div className="form-group"><label>Position *</label><div className="input-with-btn"><select value={emp.position} onChange={(e) => handleEmployeeChange(idx, "position", e.target.value)}><option value="">Select Position</option>{positionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>{employees.length > 1 && (<button type="button" onClick={() => removeEmployee(idx)} className="remove-btn"><Trash2 size={16} /></button>)}</div>{validationErrors[`employee_${idx}_pos`] && <small className="error">{validationErrors[`employee_${idx}_pos`]}</small>}</div>
                </div>
              </div>
            ))}
            <button type="button" className="add-btn" onClick={addEmployee}><Plus size={16} /> Add Employee</button>
            {validationErrors.employees && <small className="error">{validationErrors.employees}</small>}
          </section>

          <div className="form-actions">
            <button type="submit" className="btn-primary">Review Application</button>
          </div>
        </form>
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        isSubmitting={isSubmitting}
        data={businessInfo}
        files={{
          waiverFile, existingWaiverUrl,
          facilityImages, existingFacilityImages,
          paymentChannelFiles, existingPaymentChannels,
          businessPermitFile, existingPermitUrl,
          employees
        }}
      />

      <Footer />
    </>
  );
}