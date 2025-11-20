import React, { useState, useEffect } from "react";
import { X, Upload, FileText, Image as ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { supabase } from "../../config/supabase";
import "./ApplyProvider.css";

export default function ApplyProvider() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [providerId, setProviderId] = useState(null);

  const [businessInfo, setBusinessInfo] = useState({
    businessName: "",
    businessEmail: "",
    businessMobile: "",
    socialMediaUrl: "",
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
  const daysOfWeekFull = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // Load data from database on mount
  useEffect(() => {
    const loadProviderData = async () => {
      try {
        setIsLoading(true);

        // Check localStorage for providerId
        const savedProviderId = localStorage.getItem("providerId");
        
        if (savedProviderId) {
          setProviderId(savedProviderId);
          
          // Fetch provider data from database
          const { data: providerData, error: providerError } = await supabase
            .from("service_providers")
            .select("*")
            .eq("id", savedProviderId)
            .single();

          if (providerError) {
            console.error("Error fetching provider:", providerError);
            loadFromLocalStorage();
          } else if (providerData) {
            // Load business info
            setBusinessInfo({
              businessName: providerData.business_name || "",
              businessEmail: providerData.business_email || "",
              businessMobile: providerData.business_mobile || "",
              socialMediaUrl: providerData.social_media_url || "",
              typeOfService: providerData.type_of_service || "Pet Grooming",
              operatingHours: [],
              houseStreet: providerData.house_street || "",
              barangay: providerData.barangay || "",
              city: providerData.city || "",
              province: providerData.province || "",
              postalCode: providerData.postal_code || "",
              country: providerData.country || "Philippines",
            });

            // Load waiver URL
            if (providerData.waiver_url) {
              setExistingWaiverUrl(providerData.waiver_url);
            }

            // Fetch operating hours
            const { data: hoursData } = await supabase
              .from("service_provider_hours")
              .select("*")
              .eq("provider_id", savedProviderId);

            if (hoursData && hoursData.length > 0) {
              const groupedHours = {};
              hoursData.forEach((hour) => {
                const key = `${hour.start_time}-${hour.end_time}`;
                if (!groupedHours[key]) {
                  groupedHours[key] = {
                    days: [],
                    startTime: hour.start_time,
                    endTime: hour.end_time,
                  };
                }
                groupedHours[key].days.push(hour.day_of_week);
              });

              const operatingHours = Object.values(groupedHours);
              setBusinessInfo((prev) => ({
                ...prev,
                operatingHours: operatingHours.length > 0 ? operatingHours : [{ days: [], startTime: "09:00", endTime: "17:00" }],
              }));
            }

            // Fetch facility images
            const { data: imagesData } = await supabase
              .from("service_provider_images")
              .select("*")
              .eq("provider_id", savedProviderId);

            if (imagesData && imagesData.length > 0) {
              setExistingFacilityImages(imagesData);
            }

            // Fetch payment channels
            const { data: paymentsData } = await supabase
              .from("service_provider_payments")
              .select("*")
              .eq("provider_id", savedProviderId);

            if (paymentsData && paymentsData.length > 0) {
              setExistingPaymentChannels(paymentsData);
            }

            // Fetch business permit
            const { data: permitsData } = await supabase
              .from("service_provider_permits")
              .select("*")
              .eq("provider_id", savedProviderId)
              .single();

            if (permitsData) {
              setExistingPermitUrl(permitsData.file_url);
            }

            // Fetch employees
            const { data: staffData } = await supabase
              .from("service_provider_staff")
              .select("*")
              .eq("provider_id", savedProviderId);

            if (staffData && staffData.length > 0) {
              setEmployees(
                staffData.map((staff) => ({
                  fullName: staff.full_name || "",
                  position: staff.job_title || "",
                }))
              );
            }

            console.log("✅ Data loaded from database");
          }
        } else {
          loadFromLocalStorage();
        }
      } catch (error) {
        console.error("Error loading provider data:", error);
        loadFromLocalStorage();
      } finally {
        setIsLoading(false);
      }
    };

    const loadFromLocalStorage = () => {
      const savedBusinessInfo = localStorage.getItem("businessInfo");
      const savedEmployees = localStorage.getItem("employees");

      if (savedBusinessInfo) {
        setBusinessInfo(JSON.parse(savedBusinessInfo));
      }
      if (savedEmployees) {
        setEmployees(JSON.parse(savedEmployees));
      }
    };

    loadProviderData();
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem("businessInfo", JSON.stringify(businessInfo));
    }
  }, [businessInfo, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem("employees", JSON.stringify(employees));
    }
  }, [employees, isLoading]);

  // ----------------------- Handlers -----------------------
  const handleBusinessChange = (e) => {
    const { name, value } = e.target;
    setBusinessInfo((prev) => ({ ...prev, [name]: value }));
  };

  const toggleDay = (slotIndex, day) => {
    setBusinessInfo((prev) => {
      const dayUsedInOtherSlot = prev.operatingHours.some(
        (slot, i) => i !== slotIndex && slot.days.includes(day)
      );
      if (dayUsedInOtherSlot) return prev;

      return {
        ...prev,
        operatingHours: prev.operatingHours.map((slot, i) =>
          i === slotIndex
            ? {
                ...slot,
                days: slot.days.includes(day)
                  ? slot.days.filter((d) => d !== day)
                  : [...slot.days, day],
              }
            : slot
        ),
      };
    });
  };

  const isDayDisabled = (slotIndex, day) => {
    return businessInfo.operatingHours.some(
      (slot, i) => i !== slotIndex && slot.days.includes(day)
    );
  };

  const canAddMoreSlots = () => {
    const assignedDays = new Set();
    businessInfo.operatingHours.forEach((slot) =>
      slot.days.forEach((d) => assignedDays.add(d))
    );
    return assignedDays.size < 7;
  };

  const handleTimeChange = (slotIndex, type, value) => {
    setBusinessInfo((prev) => ({
      ...prev,
      operatingHours: prev.operatingHours.map((slot, i) =>
        i === slotIndex ? { ...slot, [type]: value } : slot
      ),
    }));
  };

  const addTimeSlot = () => {
    setBusinessInfo((prev) => ({
      ...prev,
      operatingHours: [
        ...prev.operatingHours,
        { days: [], startTime: "09:00", endTime: "17:00" },
      ],
    }));
  };

  const removeTimeSlot = (index) => {
    if (businessInfo.operatingHours.length > 1) {
      setBusinessInfo((prev) => ({
        ...prev,
        operatingHours: prev.operatingHours.filter((_, i) => i !== index),
      }));
    }
  };

  const handleFileSelect = (setter, e, maxSizeMB = 1, fieldName) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > maxSizeMB * 1024 * 1024) {
        setValidationErrors((prev) => ({
          ...prev,
          [fieldName]: `File size must not exceed ${maxSizeMB}MB.`,
        }));
        e.target.value = "";
        return;
      }
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[fieldName];
        return updated;
      });
      setter(file);
    }
  };

  const handleMultiFileSelect = (
    setter,
    currentFiles,
    e,
    maxFiles,
    fieldName,
    existingFiles = []
  ) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const totalFiles = currentFiles.length + files.length + existingFiles.length;
      
      if (totalFiles > maxFiles) {
        setValidationErrors((prev) => ({
          ...prev,
          [fieldName]: `You can upload up to ${maxFiles} files total.`,
        }));
        e.target.value = "";
        return;
      }
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[fieldName];
        return updated;
      });
      setter((prev) => [...prev, ...files]);
      e.target.value = "";
    }
  };

  const removeFile = (setter, index) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingFile = async (type, id, setter) => {
    try {
      let tableName = "";
      if (type === "image") tableName = "service_provider_images";
      else if (type === "payment") tableName = "service_provider_payments";
      else if (type === "permit") tableName = "service_provider_permits";

      if (tableName) {
        const { error } = await supabase.from(tableName).delete().eq("id", id);
        if (error) throw error;
        
        // Update state to remove from UI
        if (type === "image") {
          setExistingFacilityImages((prev) => prev.filter((img) => img.id !== id));
        } else if (type === "payment") {
          setExistingPaymentChannels((prev) => prev.filter((pay) => pay.id !== id));
        } else if (type === "permit") {
          setExistingPermitUrl(null);
        }
        
        console.log(`✅ Deleted ${type} with id ${id}`);
      }
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      alert(`Failed to delete ${type}. Please try again.`);
    }
  };

  const handleEmployeeChange = (index, field, value) => {
    setEmployees((prev) =>
      prev.map((emp, i) => (i === index ? { ...emp, [field]: value } : emp))
    );
  };

  const addEmployee = () => {
    setEmployees((prev) => [...prev, { fullName: "", position: "" }]);
  };

  const removeEmployee = (index) => {
    if (employees.length > 1) {
      setEmployees((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!businessInfo.businessName.trim()) errors.businessName = "Required";
    if (!businessInfo.businessEmail.trim()) errors.businessEmail = "Required";
    if (!businessInfo.businessMobile.trim()) errors.businessMobile = "Required";
    
    if (
      businessInfo.operatingHours.length === 0 ||
      businessInfo.operatingHours.some((s) => s.days.length === 0 || !s.startTime || !s.endTime)
    ) {
      errors.operatingHours = "Select at least one day and time for each slot";
    }

    ["houseStreet", "barangay", "city", "province", "postalCode"].forEach(
      (field) => {
        if (!businessInfo[field].trim()) errors[field] = "Required";
      }
    );

    // Only require files if this is a new submission and no existing files
    if (!providerId) {
      if (facilityImages.length === 0 && existingFacilityImages.length === 0)
        errors.facilityImages = "At least one image required";
      if (paymentChannelFiles.length === 0 && existingPaymentChannels.length === 0)
        errors.paymentChannelFiles = "At least one QR code required";
      if (!businessPermitFile && !existingPermitUrl) 
        errors.businessPermitFile = "Required";
    } else {
      // When updating, ensure at least one file exists (old or new)
      if (facilityImages.length === 0 && existingFacilityImages.length === 0)
        errors.facilityImages = "At least one image required";
      if (paymentChannelFiles.length === 0 && existingPaymentChannels.length === 0)
        errors.paymentChannelFiles = "At least one QR code required";
      if (!businessPermitFile && !existingPermitUrl)
        errors.businessPermitFile = "Required";
    }

    employees.forEach((emp, i) => {
      if (!emp.fullName.trim() || !emp.position.trim()) {
        errors[`employee_${i}`] = "Full name and position required";
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setValidationErrors({});

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("User not authenticated");
      }

      // Upload helper
      const uploadFile = async (folder, file) => {
        if (!file) return null;
        const filePath = `${user.id}/${folder}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage
          .from("service_provider_uploads")
          .upload(filePath, file);
        if (error) throw error;
        const { data: publicUrlData } = supabase.storage
          .from("service_provider_uploads")
          .getPublicUrl(filePath);
        return publicUrlData.publicUrl;
      };

      // Upload new files only if selected
      const waiverUrl = waiverFile ? await uploadFile("waivers", waiverFile) : null;
      const permitUrl = businessPermitFile ? await uploadFile("permits", businessPermitFile) : null;

      const facilityUrls = [];
      for (const file of facilityImages) {
        const url = await uploadFile("facilities", file);
        if (url) facilityUrls.push(url);
      }

      const paymentUrls = [];
      for (const file of paymentChannelFiles) {
        const url = await uploadFile("payments", file);
        if (url) paymentUrls.push(url);
      }

      let currentProviderId = providerId;

      if (currentProviderId) {
        // UPDATE MODE
        const updateData = {
          business_name: businessInfo.businessName,
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
          updated_at: new Date().toISOString(), // Track update time
        };

        // Only update waiver URL if new file uploaded
        if (waiverUrl) updateData.waiver_url = waiverUrl;

        const { error: updateError } = await supabase
          .from("service_providers")
          .update(updateData)
          .eq("id", currentProviderId);

        if (updateError) throw updateError;

        // Delete and re-insert operating hours
        await supabase
          .from("service_provider_hours")
          .delete()
          .eq("provider_id", currentProviderId);

        // Delete and re-insert staff
        await supabase
          .from("service_provider_staff")
          .delete()
          .eq("provider_id", currentProviderId);

      } else {
        // CREATE MODE
        const { data: providerData, error: providerError } = await supabase
          .from("service_providers")
          .insert([
            {
              user_id: user.id,
              business_name: businessInfo.businessName,
              business_email: businessInfo.businessEmail,
              business_mobile: businessInfo.businessMobile,
              house_street: businessInfo.houseStreet,
              barangay: businessInfo.barangay,
              city: businessInfo.city,
              province: businessInfo.province,
              postal_code: businessInfo.postalCode,
              country: businessInfo.country,
              type_of_service: businessInfo.typeOfService,
              waiver_url: waiverUrl,
              social_media_url: businessInfo.socialMediaUrl,
              status: "pending",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (providerError) throw providerError;
        currentProviderId = providerData.id;
        setProviderId(currentProviderId);
        localStorage.setItem("providerId", currentProviderId);
      }

      // Insert operating hours
      const hoursData = [];
      businessInfo.operatingHours.forEach((slot) => {
        slot.days.forEach((day) => {
          hoursData.push({
            provider_id: currentProviderId,
            day_of_week: day,
            start_time: slot.startTime,
            end_time: slot.endTime,
          });
        });
      });
      if (hoursData.length > 0) {
        const { error: hoursError } = await supabase
          .from("service_provider_hours")
          .insert(hoursData);
        if (hoursError) throw hoursError;
      }

      // Insert new facility images
      for (const url of facilityUrls) {
        await supabase.from("service_provider_images").insert({
          provider_id: currentProviderId,
          image_url: url,
        });
      }

      // Insert new payment channels
      for (const url of paymentUrls) {
        await supabase.from("service_provider_payments").insert({
          provider_id: currentProviderId,
          method_type: "QR",
          file_url: url,
        });
      }

      // Insert new permit file
      if (permitUrl) {
        // Delete old permit if exists
        await supabase
          .from("service_provider_permits")
          .delete()
          .eq("provider_id", currentProviderId);
          
        await supabase.from("service_provider_permits").insert({
          provider_id: currentProviderId,
          permit_type: "Business Permit",
          file_url: permitUrl,
        });
      }

      // Insert employees
      for (const emp of employees) {
        await supabase.from("service_provider_staff").insert({
          provider_id: currentProviderId,
          full_name: emp.fullName,
          job_title: emp.position,
        });
      }

      console.log("✅ Successfully saved provider data");
      navigate("/service-setup");
    } catch (error) {
      console.error("❌ Submission Error:", error);
      setValidationErrors({
        general: error.message || "Submission failed. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to extract filename from URL
  const getFileNameFromUrl = (url) => {
    if (!url) return "";
    const parts = url.split("/");
    const filename = parts[parts.length - 1];
    return decodeURIComponent(filename.split("_").slice(1).join("_") || filename);
  };

  if (isLoading) {
    return (
      <>
        <LoggedInNavbar hideBecomeProvider={true} />
        <div className="apply-provider-wrapper">
          <div style={{ textAlign: "center", padding: "50px" }}>
            <p>Loading your information...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <LoggedInNavbar hideBecomeProvider={true} />
      <div className="apply-provider-wrapper">
        <h1 className="page-title">Service Provider Application</h1>

        {validationErrors.general && (
          <div className="validation-error-message">{validationErrors.general}</div>
        )}

        <form className="apply-provider-form" onSubmit={handleSubmit}>
          <section className="form-section">
            <h2>Business Information</h2>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Business Name *</label>
                <input
                  type="text"
                  name="businessName"
                  value={businessInfo.businessName}
                  onChange={handleBusinessChange}
                />
                {validationErrors.businessName && (
                  <small className="error">{validationErrors.businessName}</small>
                )}
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  name="businessEmail"
                  value={businessInfo.businessEmail}
                  onChange={handleBusinessChange}
                />
                {validationErrors.businessEmail && (
                  <small className="error">{validationErrors.businessEmail}</small>
                )}
              </div>

              <div className="form-group">
                <label>Mobile Number *</label>
                <input
                  type="tel"
                  name="businessMobile"
                  value={businessInfo.businessMobile}
                  onChange={handleBusinessChange}
                />
                {validationErrors.businessMobile && (
                  <small className="error">{validationErrors.businessMobile}</small>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Service Type *</label>
              <input
                type="text"
                name="typeOfService"
                value={businessInfo.typeOfService}
                disabled
              />
            </div>

            <div className="form-group">
              <label>Social Media URL</label>
              <input
                type="url"
                name="socialMediaUrl"
                value={businessInfo.socialMediaUrl}
                onChange={handleBusinessChange}
              />
              <small className="file-hint">Enter your Facebook, Instagram, or website link</small>
            </div>

            <div className="form-group">
              <label>Operating Hours *</label>
              {businessInfo.operatingHours.map((slot, i) => (
                <div key={i} className="operating-slot">
                  <div className="day-buttons">
                    {daysOfWeekFull.map((d, idx) => {
                      const disabled = isDayDisabled(i, d);
                      return (
                        <button
                          type="button"
                          key={idx}
                          className={`day-btn ${slot.days.includes(d) ? "active" : ""} ${
                            disabled ? "disabled" : ""
                          }`}
                          onClick={() => toggleDay(i, d)}
                          disabled={disabled}
                        >
                          {daysOfWeekShort[idx]}
                        </button>
                      );
                    })}
                  </div>

                  <div className="time-inputs">
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => handleTimeChange(i, "startTime", e.target.value)}
                      required
                    />
                    <span>to</span>
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) => handleTimeChange(i, "endTime", e.target.value)}
                      required
                    />

                    {businessInfo.operatingHours.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTimeSlot(i)}
                        className="remove-btn"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {canAddMoreSlots() && (
                <button type="button" onClick={addTimeSlot} className="add-btn">
                  + Add Slot
                </button>
              )}
              {!canAddMoreSlots() && (
                <small className="info-message">
                  All days of the week are assigned to time slots
                </small>
              )}

              {validationErrors.operatingHours && (
                <small className="error">{validationErrors.operatingHours}</small>
              )}
            </div>
          </section>

          <section className="form-section">
            <h2>Business Address</h2>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Street / House No *</label>
                <input
                  type="text"
                  name="houseStreet"
                  value={businessInfo.houseStreet}
                  onChange={handleBusinessChange}
                />
                {validationErrors.houseStreet && (
                  <small className="error">{validationErrors.houseStreet}</small>
                )}
              </div>

              <div className="form-group">
                <label>Barangay *</label>
                <input
                  type="text"
                  name="barangay"
                  value={businessInfo.barangay}
                  onChange={handleBusinessChange}
                />
                {validationErrors.barangay && (
                  <small className="error">{validationErrors.barangay}</small>
                )}
              </div>

              <div className="form-group">
                <label>City / Municipality *</label>
                <input
                  type="text"
                  name="city"
                  value={businessInfo.city}
                  onChange={handleBusinessChange}
                />
                {validationErrors.city && (
                  <small className="error">{validationErrors.city}</small>
                )}
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label>Province *</label>
                <input
                  type="text"
                  name="province"
                  value={businessInfo.province}
                  onChange={handleBusinessChange}
                />
                {validationErrors.province && (
                  <small className="error">{validationErrors.province}</small>
                )}
              </div>

              <div className="form-group">
                <label>Postal Code *</label>
                <input
                  type="text"
                  name="postalCode"
                  value={businessInfo.postalCode}
                  onChange={handleBusinessChange}
                />
                {validationErrors.postalCode && (
                  <small className="error">{validationErrors.postalCode}</small>
                )}
              </div>

              <div className="form-group">
                <label>Country *</label>
                <input type="text" name="country" value={businessInfo.country} disabled />
              </div>
            </div>
          </section>

          <section className="form-section">
            <h2>Business Documents</h2>
            {providerId && (
              <div style={{ marginBottom: "15px", padding: "10px", backgroundColor: "#f0f9ff", borderRadius: "5px", border: "1px solid #bae6fd" }}>
                <small style={{ color: "#0369a1" }}>
                  ℹ️ You can keep existing files or upload new ones to replace them.
                </small>
              </div>
            )}
            
            <div className="form-grid-2">
              {/* Waiver */}
              <div className="form-group">
                <label>Waiver {!providerId && !existingWaiverUrl && ""}</label>
                
                {existingWaiverUrl && (
                  <div className="file-item" style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac" }}>
                    <FileText size={16} style={{ color: "#16a34a" }} />
                    <a href={existingWaiverUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#16a34a", textDecoration: "none", flex: 1 }}>
                      {getFileNameFromUrl(existingWaiverUrl)}
                    </a>
                    <button
                      type="button"
                      onClick={() => setExistingWaiverUrl(null)}
                      className="remove-btn"
                      title="Remove existing file"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                
                <label className="file-btn">
                  <Upload size={20} />
                  <span>{existingWaiverUrl ? "Replace File" : "Choose File"}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => handleFileSelect(setWaiverFile, e, 1, "waiverFile")}
                    hidden
                  />
                </label>
                <small className="file-hint">PDF or Word file, up to 1MB</small>
                {waiverFile && (
                  <div className="file-item">
                    <FileText size={16} />
                    <span>{waiverFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setWaiverFile(null)}
                      className="remove-btn"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                {validationErrors.waiverFile && (
                  <small className="error">{validationErrors.waiverFile}</small>
                )}
              </div>

              {/* Facility Images */}
              <div className="form-group">
                <label>Facility Images *</label>
                
                {existingFacilityImages.length > 0 && (
                  <div className="file-list">
                    {existingFacilityImages.map((img) => (
                      <div key={img.id} className="file-item" style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac" }}>
                        <ImageIcon size={16} style={{ color: "#16a34a" }} />
                        <a href={img.image_url} target="_blank" rel="noopener noreferrer" style={{ color: "#16a34a", textDecoration: "none", flex: 1 }}>
                          {getFileNameFromUrl(img.image_url)}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeExistingFile("image", img.id)}
                          className="remove-btn"
                          title="Delete this image"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <label className="file-btn">
                  <Upload size={20} />
                  <span>Add Images</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) =>
                      handleMultiFileSelect(
                        setFacilityImages,
                        facilityImages,
                        e,
                        3,
                        "facilityImages",
                        existingFacilityImages
                      )
                    }
                    disabled={facilityImages.length + existingFacilityImages.length >= 3}
                    hidden
                  />
                </label>
                <small className="file-hint">
                  Up to 3 images total ({existingFacilityImages.length + facilityImages.length}/3)
                </small>
                
                {facilityImages.length > 0 && (
                  <div className="file-list">
                    {facilityImages.map((f, i) => (
                      <div key={i} className="file-item">
                        <ImageIcon size={16} />
                        <span>{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(setFacilityImages, i)}
                          className="remove-btn"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {validationErrors.facilityImages && (
                  <small className="error">{validationErrors.facilityImages}</small>
                )}
              </div>

              {/* Payment Channels */}
              <div className="form-group">
                <label>Payment Channel *</label>
                
                {existingPaymentChannels.length > 0 && (
                  <div className="file-list">
                    {existingPaymentChannels.map((pay) => (
                      <div key={pay.id} className="file-item" style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac" }}>
                        <ImageIcon size={16} style={{ color: "#16a34a" }} />
                        <a href={pay.file_url} target="_blank" rel="noopener noreferrer" style={{ color: "#16a34a", textDecoration: "none", flex: 1 }}>
                          {getFileNameFromUrl(pay.file_url)}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeExistingFile("payment", pay.id)}
                          className="remove-btn"
                          title="Delete this QR code"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <label className="file-btn">
                  <Upload size={20} />
                  <span>Add QR Codes</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) =>
                      handleMultiFileSelect(
                        setPaymentChannelFiles,
                        paymentChannelFiles,
                        e,
                        3,
                        "paymentChannelFiles",
                        existingPaymentChannels
                      )
                    }
                    disabled={paymentChannelFiles.length + existingPaymentChannels.length >= 3}
                    hidden
                  />
                </label>
                <small className="file-hint">
                  Upload up to 3 QR codes total ({existingPaymentChannels.length + paymentChannelFiles.length}/3)
                </small>
                
                {paymentChannelFiles.length > 0 && (
                  <div className="file-list">
                    {paymentChannelFiles.map((f, i) => (
                      <div key={i} className="file-item">
                        <ImageIcon size={16} />
                        <span>{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(setPaymentChannelFiles, i)}
                          className="remove-btn"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {validationErrors.paymentChannelFiles && (
                  <small className="error">{validationErrors.paymentChannelFiles}</small>
                )}
              </div>

              {/* Business Permit */}
              <div className="form-group">
                <label>Business Permit *</label>
                
                {existingPermitUrl && (
                  <div className="file-item" style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac" }}>
                    <FileText size={16} style={{ color: "#16a34a" }} />
                    <a href={existingPermitUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#16a34a", textDecoration: "none", flex: 1 }}>
                      {getFileNameFromUrl(existingPermitUrl)}
                    </a>
                    <button
                      type="button"
                      onClick={() => setExistingPermitUrl(null)}
                      className="remove-btn"
                      title="Remove existing file"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                
                <label className="file-btn">
                  <Upload size={20} />
                  <span>{existingPermitUrl ? "Replace File" : "Choose File"}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) =>
                      handleFileSelect(setBusinessPermitFile, e, 1, "businessPermitFile")
                    }
                    hidden
                  />
                </label>
                <small className="file-hint">PDF or Word file, up to 1MB</small>
                {businessPermitFile && (
                  <div className="file-item">
                    <FileText size={16} />
                    <span>{businessPermitFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setBusinessPermitFile(null)}
                      className="remove-btn"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                {validationErrors.businessPermitFile && (
                  <small className="error">{validationErrors.businessPermitFile}</small>
                )}
              </div>
            </div>
          </section>

          {/* Employees */}
          <section className="form-section">
            <h2>Employee/s Information</h2>
            {employees.map((emp, i) => (
              <div className="employee-row" key={i}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      value={emp.fullName}
                      onChange={(e) => handleEmployeeChange(i, "fullName", e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Position *</label>
                    <div className="input-with-btn">
                      <input
                        type="text"
                        value={emp.position}
                        onChange={(e) => handleEmployeeChange(i, "position", e.target.value)}
                      />
                      {employees.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmployee(i)}
                          className="remove-btn"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {validationErrors[`employee_${i}`] && (
                  <small className="error">{validationErrors[`employee_${i}`]}</small>
                )}
              </div>
            ))}

            <button type="button" className="add-btn" onClick={addEmployee}>
              + Add Employee
            </button>
          </section>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : providerId ? "Update & Proceed" : "Proceed"}
            </button>
          </div>
        </form>
      </div>

      <Footer />
    </>
  );
}