// /src/pages/pet-owner/ApplyProvider.jsx
import React, { useState, useEffect } from "react";
import { X, Upload, FileText, CheckCircle, AlertCircle, Trash2, Plus, MapPin, Users, FileCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { supabase } from "../../config/supabase";
import "./ApplyProvider.css";

/* =========================================
   CONFIRMATION MODAL COMPONENT (UPDATED)
   ========================================= */
const ConfirmationModal = ({ isOpen, onClose, onConfirm, data, files, isSubmitting }) => {
  if (!isOpen) return null;

  // Helper to extract clean filenames
  const getFileName = (fileOrUrl) => {
    if (!fileOrUrl) return "None";
    // Check if it's a File object (New Upload)
    if (fileOrUrl instanceof File) return fileOrUrl.name;
    
    // Check if it's a URL string (Existing)
    if (typeof fileOrUrl === 'string') {
        try {
            const decoded = decodeURIComponent(fileOrUrl);
            const baseName = decoded.split('/').pop(); 
            // Remove timestamp prefix if present (e.g. 173456_name.jpg)
            return baseName.replace(/^\d+_/, ''); 
        } catch (e) { return "Existing File"; }
    }
    return "File";
  };

  // --- PREPARE DATA LISTS ---

  // 1. Facilities (Combine New Arrays + Existing Objects)
  const finalFacilities = [
    ...(files.existingFacilityImages || []).map(f => ({ name: getFileName(f.image_url), status: 'Existing' })),
    ...(files.facilityImages || []).map(f => ({ name: f.name, status: 'New' }))
  ];

  // 2. Payments
  const finalPayments = [
    ...(files.existingPaymentChannels || []).map(f => ({ name: getFileName(f.file_url), status: 'Existing' })),
    ...(files.paymentChannelFiles || []).map(f => ({ name: f.name, status: 'New' }))
  ];

  // 3. Waiver
  let waiverInfo = { name: "None", status: "" };
  if (files.waiverFile) {
    waiverInfo = { name: files.waiverFile.name, status: "New" };
  } else if (files.existingWaiverUrl) {
    waiverInfo = { name: getFileName(files.existingWaiverUrl), status: "Existing" };
  }

  // 4. Permit
  let permitInfo = { name: "Missing", status: "Missing" };
  if (files.businessPermitFile) {
    permitInfo = { name: files.businessPermitFile.name, status: "New" };
  } else if (files.existingPermitUrl) {
    permitInfo = { name: getFileName(files.existingPermitUrl), status: "Existing" };
  }

  // 5. Operating Hours Formatting
  const hoursDisplay = (data.operatingHours || []).map(slot => 
    `${slot.days.join(", ")} (${slot.startTime} - ${slot.endTime})`
  ).join("; ");

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">
            Review Application
          </h2>
          <button onClick={onClose} disabled={isSubmitting} className="modal-close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="review-grid">
            
            {/* SECTION 1: BUSINESS INFO */}
            <div className="review-group">
                <h4><MapPin size={14}/> Business Details</h4>
                <div className="review-row"><span className="review-label">Name:</span> <span className="review-value">{data.businessName}</span></div>
                <div className="review-row"><span className="review-label">Email:</span> <span className="review-value">{data.businessEmail}</span></div>
                <div className="review-row"><span className="review-label">Mobile:</span> <span className="review-value">{data.businessMobile}</span></div>
                <div className="review-row"><span className="review-label">Type:</span> <span className="review-value">{data.typeOfService}</span></div>
                
                <div className="review-row" style={{display:'block'}}>
                    <span className="review-label">Description:</span>
                    <span className="review-value long-text">{data.description}</span>
                </div>

                <div className="review-row"><span className="review-label">Hours:</span> <span className="review-value">{hoursDisplay}</span></div>
                <div className="review-row"><span className="review-label">Social:</span> <span className="review-value">{data.socialMediaUrl || "N/A"}</span></div>
                <div className="review-row"><span className="review-label">Map Link:</span> <span className="review-value">{data.googleMapUrl || "N/A"}</span></div>
            </div>

            {/* SECTION 2: ADDRESS */}
            <div className="review-group">
                <h4><MapPin size={14}/> Location</h4>
                <div className="review-row"><span className="review-label">Street:</span> <span className="review-value">{data.houseStreet}</span></div>
                <div className="review-row"><span className="review-label">Barangay:</span> <span className="review-value">{data.barangay}</span></div>
                <div className="review-row"><span className="review-label">City:</span> <span className="review-value">{data.city}</span></div>
                <div className="review-row"><span className="review-label">Province:</span> <span className="review-value">{data.province}</span></div>
                <div className="review-row"><span className="review-label">Postal:</span> <span className="review-value">{data.postalCode}</span></div>
                <div className="review-row"><span className="review-label">Country:</span> <span className="review-value">{data.country}</span></div>
            </div>

            {/* SECTION 3: EMPLOYEES */}
            <div className="review-group">
                <h4><Users size={14}/> Employees ({(files.employees || []).length})</h4>
                <ul className="review-list">
                    {(files.employees || []).map((emp, idx) => (
                        <li key={idx}>
                            <strong>{emp.fullName}</strong> — <span style={{color:'#6b7280'}}>{emp.position}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* SECTION 4: ATTACHMENTS */}
            <div className="review-group">
                <h4><FileCheck size={14}/> Attachments</h4>
                
                {/* PERMIT */}
                <div className="review-row"><span className="review-label">Business Permit:</span></div>
                <ul className="review-list">
                    <li>
                        <span className={`review-file-tag tag-${permitInfo.status.toLowerCase()}`}>{permitInfo.status}</span>
                        {permitInfo.name}
                    </li>
                </ul>

                {/* WAIVER */}
                <div className="review-row" style={{marginTop:'10px'}}><span className="review-label">Waiver:</span></div>
                <ul className="review-list">
                    {waiverInfo.name !== "None" ? (
                        <li>
                            <span className={`review-file-tag tag-${waiverInfo.status.toLowerCase()}`}>{waiverInfo.status}</span>
                            {waiverInfo.name}
                        </li>
                    ) : (
                        <li style={{fontStyle:'italic', color:'#9ca3af'}}>No waiver provided</li>
                    )}
                </ul>

                {/* FACILITIES */}
                <div className="review-row" style={{marginTop:'10px'}}><span className="review-label">Facilities ({finalFacilities.length}):</span></div>
                <ul className="review-list">
                    {finalFacilities.map((f, i) => (
                        <li key={i}>
                            <span className={`review-file-tag tag-${f.status.toLowerCase()}`}>{f.status}</span>
                            {f.name}
                        </li>
                    ))}
                </ul>

                {/* PAYMENTS */}
                <div className="review-row" style={{marginTop:'10px'}}><span className="review-label">Payment QR ({finalPayments.length}):</span></div>
                <ul className="review-list">
                    {finalPayments.map((f, i) => (
                        <li key={i}>
                            <span className={`review-file-tag tag-${f.status.toLowerCase()}`}>{f.status}</span>
                            {f.name}
                        </li>
                    ))}
                </ul>
            </div>
          </div>

          <div className="review-note">
            <AlertCircle size={16} /> 
            <span>Please double-check all details. You cannot edit this form after submitting.</span>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} disabled={isSubmitting} className="btn-cancel">
            Go Back & Edit
          </button>
          <button onClick={onConfirm} disabled={isSubmitting} className="btn-confirm">
            {isSubmitting ? "Submitting..." : "Confirm & Submit"}
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

  const [businessInfo, setBusinessInfo] = useState({
    businessName: "",
    description: "",
    businessEmail: "",
    businessMobile: "",
    socialMediaUrl: "",
    googleMapUrl: "", 
    typeOfService: "Pet Grooming",
    operatingHours: [{ days: [], startTime: "09:00", endTime: "17:00" }],
    houseStreet: "",
    barangay: "",
    city: "",
    province: "",
    postalCode: "",
    country: "Philippines",
  });

  const [waiverFile, setWaiverFile] = useState(null);
  const [existingWaiverUrl, setExistingWaiverUrl] = useState(null);

  const [facilityImages, setFacilityImages] = useState([]);
  const [existingFacilityImages, setExistingFacilityImages] = useState([]);

  const [paymentChannelFiles, setPaymentChannelFiles] = useState([]);
  const [existingPaymentChannels, setExistingPaymentChannels] = useState([]);

  const [businessPermitFile, setBusinessPermitFile] = useState(null);
  const [existingPermitUrl, setExistingPermitUrl] = useState(null);

  const [employees, setEmployees] = useState([{ fullName: "", position: "" }]);
  const [validationErrors, setValidationErrors] = useState({});

  const daysOfWeekShort = ["S", "M", "T", "W", "T", "F", "S"];
  const daysOfWeekFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const positionOptions = ["Business Owner", "Pet Stylist", "Staff"];

  useEffect(() => {
    const loadProviderData = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) return;

        const { data: providerData } = await supabase
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
              description: providerData.description || "",
              businessEmail: providerData.business_email || "",
              businessMobile: providerData.business_mobile || "",
              socialMediaUrl: providerData.social_media_url || "",
              googleMapUrl: providerData.google_map_url || "", 
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

  const handleBusinessChange = (e) => {
    const { name, value } = e.target;
    
    if (name === "description") {
        if (value.length <= 500) {
            setBusinessInfo((prev) => ({ ...prev, [name]: value }));
        }
        return;
    }

    if (name === "businessMobile") {
        const numbersOnly = value.replace(/\D/g, "");
        if (numbersOnly.length <= 11) {
            setBusinessInfo((prev) => ({ ...prev, [name]: numbersOnly }));
        }
        return;
    }
    
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

  const validateForm = () => {
    const errors = {};
    if (!businessInfo.businessName.trim()) errors.businessName = "Business Name is required";
    if (!businessInfo.description.trim()) errors.description = "Business Description is required";
    
    if (!businessInfo.businessEmail.trim()) errors.businessEmail = "Email is required";
    if (!/^09\d{9}$/.test(businessInfo.businessMobile)) errors.businessMobile = "Must be a valid PH mobile number";

    if (businessInfo.socialMediaUrl && !/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?(\?.*)?$/.test(businessInfo.socialMediaUrl)) {
        errors.socialMediaUrl = "Must be a valid URL";
    }

    if (!businessInfo.googleMapUrl.trim()) {
        errors.googleMapUrl = "Google Map Link is required";
    } else if (!/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?(\?.*)?$/.test(businessInfo.googleMapUrl)) {
        errors.googleMapUrl = "Must be a valid URL";
    }

    if (!businessInfo.operatingHours || businessInfo.operatingHours.length === 0) {
      errors.operatingHours = "At least one operating hour slot is required";
    } else {
        businessInfo.operatingHours.forEach(slot => {
            if(slot.days.length === 0) errors.operatingHours = "Select at least one day for each slot";
        });
    }

    ["houseStreet", "barangay", "city", "province"].forEach((field) => {
      if (!businessInfo[field] || !businessInfo[field].trim()) errors[field] = "Please provide business address details";
    });

    if (!/^\d{4}$/.test(businessInfo.postalCode)) errors.postalCode = "Invalid postal code";

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

        if (!currentProviderId) {
             const { data: existing } = await supabase.from("service_providers").select("id").eq("user_id", user.id).maybeSingle();
             if (existing) currentProviderId = existing.id;
        }

        const payload = {
            user_id: user.id,
            business_name: businessInfo.businessName,
            description: businessInfo.description,
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
            google_map_url: businessInfo.googleMapUrl, 
            waiver_url: waiverUrl || existingWaiverUrl || null,
            updated_at: new Date().toISOString()
        };

        if (currentProviderId) {
            const { error: updateError } = await supabase.from("service_providers").update(payload).eq("id", currentProviderId);
            if (updateError) throw updateError;

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
                <label>Business Name*</label>
                <input type="text" name="businessName" value={businessInfo.businessName} onChange={handleBusinessChange} />
                {validationErrors.businessName && <small className="error">{validationErrors.businessName}</small>}
              </div>
              <div className="form-group">
                <label>Email*</label>
                <input type="email" name="businessEmail" value={businessInfo.businessEmail} onChange={handleBusinessChange} />
                {validationErrors.businessEmail && <small className="error">{validationErrors.businessEmail}</small>}
              </div>
              <div className="form-group">
                <label>Mobile Number*</label>
                <input type="tel" name="businessMobile" value={businessInfo.businessMobile} onChange={handleBusinessChange} placeholder="0912 345 6789" />
                {validationErrors.businessMobile && <small className="error">{validationErrors.businessMobile}</small>}
              </div>
            </div>

            <div className="form-grid-2">
                <div className="form-group">
                    <label>Service Type</label>
                    <input type="text" name="typeOfService" value={businessInfo.typeOfService} disabled className="input-disabled" />
                </div>
                <div className="form-group">
                    <label>Social Media URL</label>
                    <input type="url" name="socialMediaUrl" value={businessInfo.socialMediaUrl} onChange={handleBusinessChange} placeholder="https://facebook.com/..." />
                    {validationErrors.socialMediaUrl && <small className="error">{validationErrors.socialMediaUrl}</small>}
                </div>
                <div className="form-group">
                    <label>Google Map Link*</label>
                    <input type="url" name="googleMapUrl" value={businessInfo.googleMapUrl} onChange={handleBusinessChange} placeholder="https://maps.google.com/..." />
                    {validationErrors.googleMapUrl && <small className="error">{validationErrors.googleMapUrl}</small>}
                </div>
            </div>

            <div className="form-group description-container">
                <div className="description-label-row">
                    <label>Business Description*</label> 
                    <span className={`description-char-count ${businessInfo.description.length >= 500 ? 'limit' : 'normal'}`}>
                        {businessInfo.description.length}/500
                    </span>
                </div>
                <textarea
                    name="description"
                    value={businessInfo.description}
                    onChange={handleBusinessChange}
                    rows={5}
                    maxLength={500}
                    placeholder="Tell us about your business, services, and what makes you unique..."
                    className={`description-textarea ${validationErrors.description ? 'error' : ''}`}
                />
                {validationErrors.description && <small className="error">{validationErrors.description}</small>}
            </div>

            <div className="form-group operating-hours-container">
              <label>Operating Hours*</label>
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

          <section className="form-section">
            <h2>Business Address</h2>
            <div className="form-grid-3">
              <div className="form-group"><label>Street / House No.*</label><input type="text" name="houseStreet" value={businessInfo.houseStreet} onChange={handleBusinessChange} />{validationErrors.houseStreet && <small className="error">{validationErrors.houseStreet}</small>}</div>
              <div className="form-group"><label>Barangay*</label><input type="text" name="barangay" value={businessInfo.barangay} onChange={handleBusinessChange} />{validationErrors.barangay && <small className="error">{validationErrors.barangay}</small>}</div>
              <div className="form-group"><label>City / Municipality*</label><input type="text" name="city" value={businessInfo.city} onChange={handleBusinessChange} />{validationErrors.city && <small className="error">{validationErrors.city}</small>}</div>
              <div className="form-group"><label>Province*</label><input type="text" name="province" value={businessInfo.province} onChange={handleBusinessChange} />{validationErrors.province && <small className="error">{validationErrors.province}</small>}</div>
              <div className="form-group"><label>Postal Code*</label><input type="text" name="postalCode" value={businessInfo.postalCode} onChange={handleBusinessChange} maxLength={4} />{validationErrors.postalCode && <small className="error">{validationErrors.postalCode}</small>}</div>
              <div className="form-group"><label>Country</label><input type="text" name="country" value={businessInfo.country} disabled className="input-disabled" /></div>
            </div>
          </section>

          <section className="form-section">
            <h2>Documents & Uploads</h2>
            <div className="form-grid-2">
              <div className="form-group"><label>Waiver</label><label className="file-btn"><Upload size={18} /> <span>Select File</span><input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileSelect(setWaiverFile, e, 1, "waiverFile")} hidden /></label><div className="file-preview-small">{waiverFile ? <span>{waiverFile.name} <X size={14} onClick={() => setWaiverFile(null)} /></span> : existingWaiverUrl ? <span><a href={existingWaiverUrl} target="_blank" rel="noreferrer">View Existing</a> <X size={14} onClick={() => removeSingleFile(setWaiverFile, setExistingWaiverUrl)} /></span> : null}</div>{validationErrors.waiverFile && <small className="error">{validationErrors.waiverFile}</small>}</div>
              <div className="form-group"><label>Business Permit*</label><label className="file-btn"><Upload size={18} /> <span>Select File</span><input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileSelect(setBusinessPermitFile, e, 1, "businessPermitFile")} hidden /></label><div className="file-preview-small">{businessPermitFile ? <span>{businessPermitFile.name} <X size={14} onClick={() => setBusinessPermitFile(null)} /></span> : existingPermitUrl ? <span><a href={existingPermitUrl} target="_blank" rel="noreferrer">View Existing</a> <X size={14} onClick={() => removeSingleFile(setBusinessPermitFile, setExistingPermitUrl)} /></span> : null}</div>{validationErrors.businessPermitFile && <small className="error">{validationErrors.businessPermitFile}</small>}</div>
            </div>
            <div className="form-grid-2">
                <div className="form-group"><label>Facility Images*</label><label className="file-btn"><Upload size={18} /> <span>Select Images</span><input type="file" accept=".jpg,.jpeg,.png" multiple onChange={(e) => handleMultiFileSelect(setFacilityImages, facilityImages, e, 3, "facilityImages", existingFacilityImages.length, 2)} hidden /></label><div className="file-list">{existingFacilityImages.map(img => (<div key={img.id} className="file-item"><FileText size={14} /> Existing Img <button type="button" onClick={() => removeExistingFile("image", img.id, img.image_url)}><X size={12} /></button></div>))}{facilityImages.map((f, i) => (<div key={i} className="file-item"><FileText size={14} /> {f.name}<button type="button" onClick={() => removeFile(setFacilityImages, i)}><X size={12} /></button></div>))}</div>{validationErrors.facilityImages && <small className="error">{validationErrors.facilityImages}</small>}</div>
                <div className="form-group"><label>Payment QR*</label><label className="file-btn"><Upload size={18} /> <span>Select QR Images</span><input type="file" accept=".jpg,.jpeg,.png" multiple onChange={(e) => handleMultiFileSelect(setPaymentChannelFiles, paymentChannelFiles, e, 3, "paymentChannelFiles", existingPaymentChannels.length, 2)} hidden /></label><div className="file-list">{existingPaymentChannels.map(img => (<div key={img.id} className="file-item"><FileText size={14} /> Existing QR <button type="button" onClick={() => removeExistingFile("payment", img.id, img.file_url)}><X size={12} /></button></div>))}{paymentChannelFiles.map((f, i) => (<div key={i} className="file-item"><FileText size={14} /> {f.name}<button type="button" onClick={() => removeFile(setPaymentChannelFiles, i)}><X size={12} /></button></div>))}</div>{validationErrors.paymentChannelFiles && <small className="error">{validationErrors.paymentChannelFiles}</small>}</div>
            </div>
          </section>

          <section className="form-section">
            <h2>Employee Information</h2>
            {employees.map((emp, idx) => (
              <div className="employee-row" key={idx}>
                <div className="form-grid-2">
                  <div className="form-group"><label>Full Name*</label><input type="text" value={emp.fullName} onChange={(e) => handleEmployeeChange(idx, "fullName", e.target.value)} />{validationErrors[`employee_${idx}_name`] && <small className="error">{validationErrors[`employee_${idx}_name`]}</small>}</div>
                  <div className="form-group"><label>Position*</label><div className="input-with-btn"><select value={emp.position} onChange={(e) => handleEmployeeChange(idx, "position", e.target.value)}><option value="">Select Position</option>{positionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>{employees.length > 1 && (<button type="button" onClick={() => removeEmployee(idx)} className="remove-btn"><Trash2 size={16} /></button>)}</div>{validationErrors[`employee_${idx}_pos`] && <small className="error">{validationErrors[`employee_${idx}_pos`]}</small>}</div>
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