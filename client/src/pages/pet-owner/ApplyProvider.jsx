// /src/pages/pet-owner/ApplyProvider.jsx
import React, { useState, useEffect } from "react";
import { X, Upload, FileText, Image as ImageIcon, CheckCircle, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { supabase } from "../../config/supabase";
import "./ApplyProvider.css";

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
          View existing file
        </a>
      );
    }
    if (file) {
      // file might be a File object
      return <span className="modal-file-new">✓ New file selected: {file.name}</span>;
    }
    return <span className="modal-file-none">No file</span>;
  };

  const renderFileList = (fileArray, existingArray) => {
    const items = [];

    if (existingArray && existingArray.length > 0) {
      existingArray.forEach((item, idx) => {
        const url = item.image_url || item.file_url;
        items.push(
          <div key={`existing-${idx}`} className="modal-file-existing">
            <a href={url} target="_blank" rel="noopener noreferrer">
              Existing file {idx + 1}
            </a>
          </div>
        );
      });
    }

    if (fileArray && fileArray.length > 0) {
      fileArray.forEach((file, idx) => {
        items.push(
          <div key={`new-${idx}`} className="modal-file-new">
            ✓ New file: {file.name}
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
            <p>Please review all information below. Click <strong>Confirm & Submit</strong> to save or <strong>Cancel & Edit</strong> to return.</p>
          </div>

          <section className="modal-section">
            <h3>Business Information</h3>
            <div className="info-box">
              <div className="info-item"><strong>Business Name:</strong> {data.businessName || "—"}</div>
              <div className="info-item"><strong>Email:</strong> {data.businessEmail || "—"}</div>
              <div className="info-item"><strong>Mobile:</strong> {data.businessMobile || "—"}</div>
              <div className="info-item"><strong>Service Type:</strong> {data.typeOfService || "—"}</div>
              {data.socialMediaUrl && (
                <div className="info-item">
                  <strong>Social Media:</strong>{" "}
                  <a href={data.socialMediaUrl} target="_blank" rel="noopener noreferrer">{data.socialMediaUrl}</a>
                </div>
              )}
              <div className="info-item">
                <strong>Operating Hours:</strong>
                <div style={{ marginTop: 8 }}>{formatOperatingHours(data.operatingHours || [])}</div>
              </div>
            </div>
          </section>

          <section className="modal-section">
            <h3>Business Address</h3>
            <div className="info-box">
              <div className="info-item"><strong>Street:</strong> {data.houseStreet || "—"}</div>
              <div className="info-item"><strong>Barangay:</strong> {data.barangay || "—"}</div>
              <div className="info-item"><strong>City:</strong> {data.city || "—"}</div>
              <div className="info-item"><strong>Province:</strong> {data.province || "—"}</div>
              <div className="info-item"><strong>Postal Code:</strong> {data.postalCode || "—"}</div>
              <div className="info-item"><strong>Country:</strong> {data.country || "—"}</div>
            </div>
          </section>

          <section className="modal-section">
            <h3>Business Documents</h3>
            <div className="info-box">
              <div className="info-item">
                <strong>Waiver:</strong>
                <div style={{ marginTop: 6 }}>{renderFileLink(files.waiverFile, files.existingWaiverUrl)}</div>
              </div>

              <div className="info-item">
                <strong>Facility Images:</strong>
                <div style={{ marginTop: 6 }}>{renderFileList(files.facilityImages, files.existingFacilityImages)}</div>
              </div>

              <div className="info-item">
                <strong>Payment Channels:</strong>
                <div style={{ marginTop: 6 }}>{renderFileList(files.paymentChannelFiles, files.existingPaymentChannels)}</div>
              </div>

              <div className="info-item">
                <strong>Business Permit:</strong>
                <div style={{ marginTop: 6 }}>{renderFileLink(files.businessPermitFile, files.existingPermitUrl)}</div>
              </div>
            </div>
          </section>

          <section className="modal-section">
            <h3>Employee Information</h3>
            <div className="info-box">
              {(files.employees || []).map((emp, idx) => (
                <div key={idx} className="info-item">
                  <strong>Employee {idx + 1}:</strong> {emp.fullName || "—"} {emp.position ? `- ${emp.position}` : ""}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} disabled={isSubmitting} className="btn-cancel">
            Cancel & Edit
          </button>
          <button onClick={onConfirm} disabled={isSubmitting} className="btn-confirm">
            {isSubmitting ? "Submitting..." : "Confirm & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ApplyProvider() {
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [providerId, setProviderId] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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

  const [facilityImages, setFacilityImages] = useState([]); // new File objects
  const [existingFacilityImages, setExistingFacilityImages] = useState([]); // records from DB

  const [paymentChannelFiles, setPaymentChannelFiles] = useState([]); // new File objects
  const [existingPaymentChannels, setExistingPaymentChannels] = useState([]); // records from DB

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

  // Load: either existing providerId from localStorage (update mode) or load from localStorage temporary save
  useEffect(() => {
    const loadProviderData = async () => {
      try {
        setIsLoading(true);
        const savedProviderId = localStorage.getItem("providerId");
        if (savedProviderId) {
          setProviderId(savedProviderId);

          // fetch provider
          const { data: providerData, error: providerError } = await supabase
            .from("service_providers")
            .select("*")
            .eq("id", savedProviderId)
            .single();

          if (providerError) {
            console.warn("Could not fetch provider. Falling back to localStorage", providerError);
            loadFromLocalStorage();
          } else if (providerData) {
            setBusinessInfo({
              businessName: providerData.business_name || "",
              businessEmail: providerData.business_email || "",
              businessMobile: providerData.business_mobile || "",
              socialMediaUrl: providerData.social_media_url || "",
              typeOfService: providerData.type_of_service || "Pet Grooming",
              operatingHours: [{ days: [], startTime: "09:00", endTime: "17:00" }],
              houseStreet: providerData.house_street || "",
              barangay: providerData.barangay || "",
              city: providerData.city || "",
              province: providerData.province || "",
              postalCode: providerData.postal_code || "",
              country: providerData.country || "Philippines",
            });

            if (providerData.waiver_url) setExistingWaiverUrl(providerData.waiver_url);

            // hours
            const { data: hoursData } = await supabase
              .from("service_provider_hours")
              .select("*")
              .eq("provider_id", savedProviderId);

            if (hoursData && hoursData.length > 0) {
              // Group hours by identical start/end times
              const grouped = {};
              hoursData.forEach((h) => {
                const key = `${h.start_time}-${h.end_time}`;
                if (!grouped[key]) grouped[key] = { days: [], startTime: h.start_time, endTime: h.end_time };
                grouped[key].days.push(h.day_of_week);
              });
              const operatingHours = Object.values(grouped);
              setBusinessInfo((prev) => ({ ...prev, operatingHours: operatingHours.length ? operatingHours : prev.operatingHours }));
            }

            // facility images
            const { data: imagesData } = await supabase
              .from("service_provider_images")
              .select("*")
              .eq("provider_id", savedProviderId);

            if (imagesData) setExistingFacilityImages(imagesData);

            // payments
            const { data: paymentsData } = await supabase
              .from("service_provider_payments")
              .select("*")
              .eq("provider_id", savedProviderId);

            if (paymentsData) setExistingPaymentChannels(paymentsData);

            // permit (single)
            const { data: permitsData } = await supabase
              .from("service_provider_permits")
              .select("*")
              .eq("provider_id", savedProviderId);

            if (permitsData && permitsData.length > 0) {
              // keep the first (you can adapt to multiple)
              setExistingPermitUrl(permitsData[0].file_url);
            }

            // staff
            const { data: staffData } = await supabase
              .from("service_provider_staff")
              .select("*")
              .eq("provider_id", savedProviderId);

            if (staffData && staffData.length > 0) {
              setEmployees(staffData.map((s) => ({ fullName: s.full_name || "", position: s.job_title || "" })));
            }

            console.log("Loaded provider from DB");
          } else {
            loadFromLocalStorage();
          }
        } else {
          loadFromLocalStorage();
        }
      } catch (err) {
        console.error("Error loading provider data:", err);
        loadFromLocalStorage();
      } finally {
        setIsLoading(false);
      }
    };

    const loadFromLocalStorage = () => {
      const savedBusinessInfo = localStorage.getItem("businessInfo");
      const savedEmployees = localStorage.getItem("employees");
      const savedFiles = localStorage.getItem("files"); // note: files stored as metadata only (names) if used before

      if (savedBusinessInfo) {
        try {
          setBusinessInfo(JSON.parse(savedBusinessInfo));
        } catch (e) {}
      }
      if (savedEmployees) {
        try {
          setEmployees(JSON.parse(savedEmployees));
        } catch (e) {}
      }
      if (savedFiles) {
        try {
          const parsed = JSON.parse(savedFiles);
          // We cannot reconstruct File objects from localStorage. Show only names as hint.
          if (parsed.existingFacilityImages) setExistingFacilityImages(parsed.existingFacilityImages);
          if (parsed.existingPaymentChannels) setExistingPaymentChannels(parsed.existingPaymentChannels);
          if (parsed.existingWaiverUrl) setExistingWaiverUrl(parsed.existingWaiverUrl);
          if (parsed.existingPermitUrl) setExistingPermitUrl(parsed.existingPermitUrl);
        } catch (e) {}
      }
    };

    loadProviderData();
  }, []);

  // persist some fields to localStorage for "continue later" behaviour
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

  useEffect(() => {
    // persist metadata of existing files for user convenience
    if (!isLoading) {
      localStorage.setItem(
        "files",
        JSON.stringify({
          existingFacilityImages,
          existingPaymentChannels,
          existingWaiverUrl,
          existingPermitUrl,
        })
      );
    }
  }, [existingFacilityImages, existingPaymentChannels, existingWaiverUrl, existingPermitUrl, isLoading]);

  // Helpers
  const handleBusinessChange = (e) => {
    const { name, value } = e.target;
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

  const isDayDisabled = (slotIndex, day) =>
    businessInfo.operatingHours.some((slot, i) => i !== slotIndex && slot.days.includes(day));

  const canAddMoreSlots = () => {
    const assigned = new Set();
    businessInfo.operatingHours.forEach((s) => s.days.forEach((d) => assigned.add(d)));
    return assigned.size < 7;
  };

  const handleTimeChange = (slotIndex, type, value) => {
    setBusinessInfo((prev) => ({
      ...prev,
      operatingHours: prev.operatingHours.map((slot, i) => (i === slotIndex ? { ...slot, [type]: value } : slot)),
    }));
  };

  const addTimeSlot = () => {
    setBusinessInfo((prev) => ({ ...prev, operatingHours: [...prev.operatingHours, { days: [], startTime: "09:00", endTime: "17:00" }] }));
  };

  const removeTimeSlot = (index) => {
    setBusinessInfo((prev) => ({ ...prev, operatingHours: prev.operatingHours.filter((_, i) => i !== index) }));
  };

  const handleFileSelect = (setter, e, maxSizeMB = 1, fieldName) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > maxSizeMB * 1024 * 1024) {
        setValidationErrors((prev) => ({ ...prev, [fieldName]: `File size must not exceed ${maxSizeMB}MB.` }));
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

  const handleMultiFileSelect = (setter, currentFiles, e, maxFiles, fieldName, existingCount = 0) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (currentFiles.length + files.length + existingCount > maxFiles) {
        setValidationErrors((prev) => ({ ...prev, [fieldName]: `You can upload up to ${maxFiles} files total.` }));
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

  const removeFile = (setter, index) => setter((prev) => prev.filter((_, i) => i !== index));

  const handleEmployeeChange = (index, field, value) => {
    setEmployees((prev) => prev.map((emp, i) => (i === index ? { ...emp, [field]: value } : emp)));
  };

  const addEmployee = () => setEmployees((prev) => [...prev, { fullName: "", position: "" }]);

  const removeEmployee = (index) => setEmployees((prev) => prev.filter((_, i) => i !== index));

  const validateForm = () => {
    const errors = {};
    if (!businessInfo.businessName.trim()) errors.businessName = "Required";
    if (!businessInfo.businessEmail.trim()) errors.businessEmail = "Required";
    if (!businessInfo.businessMobile.trim()) errors.businessMobile = "Required";

    if (!businessInfo.operatingHours || businessInfo.operatingHours.length === 0) {
      errors.operatingHours = "Select at least one day and time";
    } else {
      businessInfo.operatingHours.forEach((s, i) => {
        if (!s.days || s.days.length === 0 || !s.startTime || !s.endTime) {
          errors.operatingHours = "Select days and times for each slot";
        }
      });
    }

    ["houseStreet", "barangay", "city", "province", "postalCode"].forEach((field) => {
      if (!businessInfo[field] || !businessInfo[field].trim()) errors[field] = "Required";
    });

    if (facilityImages.length === 0 && existingFacilityImages.length === 0) errors.facilityImages = "At least one image required";
    if (paymentChannelFiles.length === 0 && existingPaymentChannels.length === 0) errors.paymentChannelFiles = "At least one QR code required";
    if (!businessPermitFile && !existingPermitUrl) errors.businessPermitFile = "Required";

    employees.forEach((emp, i) => {
      if (!emp.fullName.trim() || !emp.position.trim()) errors[`employee_${i}`] = "Full name and position required";
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

  // Helper to parse storage path out of public URL
  const getFilePathFromUrl = (url) => {
    if (!url) return null;
    try {
      const u = new URL(url);
      // path like /storage/v1/object/public/<bucket>/<path>
      const match = u.pathname.match(/\/storage\/v1\/object\/public\/[^\/]+\/(.+)$/);
      return match ? decodeURIComponent(match[1]) : null;
    } catch (e) {
      return null;
    }
  };

  const removeExistingFile = async (type, id, fileUrl) => {
    try {
      let tableName = "";
      if (type === "image") tableName = "service_provider_images";
      else if (type === "payment") tableName = "service_provider_payments";
      else if (type === "permit") tableName = "service_provider_permits";

      const filePath = getFilePathFromUrl(fileUrl);
      if (filePath) {
        const { error: storageError } = await supabase.storage.from("service_provider_uploads").remove([filePath]);
        if (storageError) console.warn("Storage delete error:", storageError);
      }

      if (tableName) {
        const { error: dbError } = await supabase.from(tableName).delete().eq("id", id);
        if (dbError) throw dbError;

        if (type === "image") setExistingFacilityImages((prev) => prev.filter((i) => i.id !== id));
        if (type === "payment") setExistingPaymentChannels((prev) => prev.filter((p) => p.id !== id));
        if (type === "permit") setExistingPermitUrl(null);
      }
    } catch (err) {
      console.error("Error deleting existing file:", err);
      alert("Failed to delete file. Try again.");
    }
  };

  const uploadFileToStorage = async (userId, folder, file) => {
    if (!file) return null;
    const filePath = `${userId}/${folder}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("service_provider_uploads").upload(filePath, file);
    if (error) throw error;
    const { data: publicUrlData } = supabase.storage.from("service_provider_uploads").getPublicUrl(filePath);
    return publicUrlData.publicUrl;
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setValidationErrors({});

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("User not authenticated");

      // Upload files
      const waiverUrl = waiverFile ? await uploadFileToStorage(user.id, "waivers", waiverFile) : null;
      const permitUrl = businessPermitFile ? await uploadFileToStorage(user.id, "permits", businessPermitFile) : null;

      const facilityUrls = [];
      for (const f of facilityImages) {
        const u = await uploadFileToStorage(user.id, "facilities", f);
        if (u) facilityUrls.push(u);
      }

      const paymentUrls = [];
      for (const f of paymentChannelFiles) {
        const u = await uploadFileToStorage(user.id, "payments", f);
        if (u) paymentUrls.push(u);
      }

      let currentProviderId = providerId;

      if (currentProviderId) {
        // UPDATE existing provider
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
          updated_at: new Date().toISOString(),
        };

        if (waiverUrl) {
          // remove previous storage object if exists
          if (existingWaiverUrl) {
            const oldPath = getFilePathFromUrl(existingWaiverUrl);
            if (oldPath) await supabase.storage.from("service_provider_uploads").remove([oldPath]);
          }
          updateData.waiver_url = waiverUrl;
        }

        const { error: updateError } = await supabase.from("service_providers").update(updateData).eq("id", currentProviderId);
        if (updateError) throw updateError;

        // remove old hours & staff — we'll reinsert
        const { error: deleteHoursError } = await supabase.from("service_provider_hours").delete().eq("provider_id", currentProviderId);
        if (deleteHoursError) throw deleteHoursError;
        const { error: deleteStaffError } = await supabase.from("service_provider_staff").delete().eq("provider_id", currentProviderId);
        if (deleteStaffError) throw deleteStaffError;
      } else {
        // CREATE provider
        const { data: providerData, error: providerError } = await supabase
          .from("service_providers")
          .insert([{
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
          }])
          .select()
          .single();

        if (providerError) throw providerError;
        currentProviderId = providerData.id;
        setProviderId(currentProviderId);
        localStorage.setItem("providerId", currentProviderId);
      }

      // insert operating hours
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
        const { error: hoursError } = await supabase.from("service_provider_hours").insert(hoursData);
        if (hoursError) throw hoursError;
      }

      // insert new facility images (if any)
      for (const url of facilityUrls) {
        const { error: imgError } = await supabase.from("service_provider_images").insert({ provider_id: currentProviderId, image_url: url });
        if (imgError) throw imgError;
      }

      // insert new payment channels
      for (const url of paymentUrls) {
        const { error: payError } = await supabase.from("service_provider_payments").insert({ provider_id: currentProviderId, method_type: "QR", file_url: url });
        if (payError) throw payError;
      }

      // insert/replace permit
      if (permitUrl) {
        // delete old permit row if exists
        await supabase.from("service_provider_permits").delete().eq("provider_id", currentProviderId);
        const { error: permitInsertError } = await supabase.from("service_provider_permits").insert({ provider_id: currentProviderId, permit_type: "Business Permit", file_url: permitUrl });
        if (permitInsertError) throw permitInsertError;
        setExistingPermitUrl(permitUrl);
      }

      // insert employees
      for (const emp of employees) {
        if (emp.fullName.trim() && emp.position.trim()) {
          const { error: staffError } = await supabase.from("service_provider_staff").insert({ provider_id: currentProviderId, full_name: emp.fullName, job_title: emp.position });
          if (staffError) throw staffError;
        }
      }

      // success
      console.log("Provider saved successfully");
      setShowConfirmModal(false);
      // navigate to next step (service setup)
      navigate("/service-setup");
    } catch (err) {
      console.error("Submission error:", err);
      setValidationErrors({ general: err.message || "Submission failed. Please try again." });
      setShowConfirmModal(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFilePreview = (file, url) => {
    if (url) {
      // existing URL (image or document)
      if (/\.(jpe?g|png|gif|webp|avif|svg)$/i.test(url)) {
        return <img src={url} alt="preview" className="preview-img" />;
      }
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="preview-link">
          <FileText size={16} /> View file
        </a>
      );
    }
    if (file) {
      // preview for new file
      if (file.type && file.type.startsWith("image/")) {
        const objectUrl = URL.createObjectURL(file);
        return <img src={objectUrl} alt="preview" className="preview-img" onLoad={() => URL.revokeObjectURL(objectUrl)} />;
      }
      return (
        <span className="preview-link">
          <FileText size={16} /> {file.name}
        </span>
      );
    }
    return <span className="preview-none">No file</span>;
  };

  if (isLoading) {
    return (
      <>
        <LoggedInNavbar hideBecomeProvider={true} />
        <div className="apply-provider-wrapper">
          <div style={{ padding: 60, textAlign: "center" }}>Loading…</div>
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

        {validationErrors.general && <div className="form-error">{validationErrors.general}</div>}

        <form className="apply-provider-form" onSubmit={handleFormSubmit}>
          {/* Business Info */}
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
                <label>Mobile Number *</label>
                <input type="tel" name="businessMobile" value={businessInfo.businessMobile} onChange={handleBusinessChange} />
                {validationErrors.businessMobile && <small className="error">{validationErrors.businessMobile}</small>}
              </div>
            </div>

            <div className="form-group">
              <label>Service Type *</label>
              <input type="text" name="typeOfService" value={businessInfo.typeOfService} disabled />
            </div>

            <div className="form-group">
              <label>Social Media URL</label>
              <input type="url" name="socialMediaUrl" value={businessInfo.socialMediaUrl} onChange={handleBusinessChange} />
            </div>

            <div className="form-group">
              <label>Operating Hours *</label>
              {businessInfo.operatingHours.map((slot, i) => (
                <div key={i} className="operating-slot">
                  <div className="day-buttons">
                    {daysOfWeekFull.map((d, idx) => {
                      const disabled = isDayDisabled(i, d);
                      return (
                        <button key={d} type="button" className={`day-btn ${slot.days.includes(d) ? "active" : ""} ${disabled ? "disabled" : ""}`} onClick={() => toggleDay(i, d)} disabled={disabled}>
                          {daysOfWeekShort[idx]}
                        </button>
                      );
                    })}
                  </div>

                  <div className="time-inputs">
                    <input type="time" value={slot.startTime} onChange={(e) => handleTimeChange(i, "startTime", e.target.value)} />
                    <span>to</span>
                    <input type="time" value={slot.endTime} onChange={(e) => handleTimeChange(i, "endTime", e.target.value)} />
                    {businessInfo.operatingHours.length > 1 && (
                      <button type="button" onClick={() => removeTimeSlot(i)} className="remove-btn" title="Remove slot"><X size={14} /></button>
                    )}
                  </div>
                </div>
              ))}

              {canAddMoreSlots() && <button type="button" className="add-btn" onClick={addTimeSlot}>+ Add Slot</button>}
              {validationErrors.operatingHours && <small className="error">{validationErrors.operatingHours}</small>}
            </div>
          </section>

          {/* Address */}
          <section className="form-section">
            <h2>Business Address</h2>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Street / House No *</label>
                <input type="text" name="houseStreet" value={businessInfo.houseStreet} onChange={handleBusinessChange} />
                {validationErrors.houseStreet && <small className="error">{validationErrors.houseStreet}</small>}
              </div>
              <div className="form-group">
                <label>Barangay *</label>
                <input type="text" name="barangay" value={businessInfo.barangay} onChange={handleBusinessChange} />
                {validationErrors.barangay && <small className="error">{validationErrors.barangay}</small>}
              </div>
              <div className="form-group">
                <label>City / Municipality *</label>
                <input type="text" name="city" value={businessInfo.city} onChange={handleBusinessChange} />
                {validationErrors.city && <small className="error">{validationErrors.city}</small>}
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label>Province *</label>
                <input type="text" name="province" value={businessInfo.province} onChange={handleBusinessChange} />
                {validationErrors.province && <small className="error">{validationErrors.province}</small>}
              </div>
              <div className="form-group">
                <label>Postal Code *</label>
                <input type="text" name="postalCode" value={businessInfo.postalCode} onChange={handleBusinessChange} />
                {validationErrors.postalCode && <small className="error">{validationErrors.postalCode}</small>}
              </div>
              <div className="form-group">
                <label>Country *</label>
                <input type="text" name="country" value={businessInfo.country} disabled />
              </div>
            </div>
          </section>

          {/* Documents */}
          <section className="form-section">
            <h2>Business Documents</h2>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Waiver *</label>
                <label className="file-btn">
                  <Upload size={18} />
                  <span>Choose File</span>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileSelect(setWaiverFile, e, 2, "waiverFile")} hidden />
                </label>
                <div className="file-preview-small">
                  {getFilePreview(waiverFile, existingWaiverUrl)}
                </div>
                {validationErrors.waiverFile && <small className="error">{validationErrors.waiverFile}</small>}
              </div>

              <div className="form-group">
                <label>Images of Facilities *</label>
                <label className="file-btn">
                  <Upload size={18} />
                  <span>Choose Files</span>
                  <input type="file" accept="image/*" multiple onChange={(e) => handleMultiFileSelect(setFacilityImages, facilityImages, e, 3, "facilityImages", existingFacilityImages.length)} hidden />
                </label>
                <div className="file-list">
                  {existingFacilityImages.map((img) => (
                    <div key={img.id} className="file-item">
                      <ImageIcon size={14} /> <a href={img.image_url} target="_blank" rel="noreferrer">{getFileNameFromUrl(img.image_url)}</a>
                      <button type="button" className="delete-existing-btn" onClick={() => removeExistingFile("image", img.id, img.image_url)} title="Remove existing image"><X size={12} /></button>
                    </div>
                  ))}
                  {facilityImages.map((f, idx) => (
                    <div key={`new-f-${idx}`} className="file-item">
                      <ImageIcon size={14} /> {f.name}
                      <button type="button" onClick={() => removeFile(setFacilityImages, idx)}><X size={12} /></button>
                    </div>
                  ))}
                </div>
                {validationErrors.facilityImages && <small className="error">{validationErrors.facilityImages}</small>}
              </div>

              <div className="form-group">
                <label>Payment Channel *</label>
                <label className="file-btn">
                  <Upload size={18} />
                  <span>Choose Files</span>
                  <input type="file" accept="image/*" multiple onChange={(e) => handleMultiFileSelect(setPaymentChannelFiles, paymentChannelFiles, e, 3, "paymentChannelFiles", existingPaymentChannels.length)} hidden />
                </label>
                <div className="file-list">
                  {existingPaymentChannels.map((p) => (
                    <div key={p.id} className="file-item">
                      <ImageIcon size={14} /> <a href={p.file_url} target="_blank" rel="noreferrer">{getFileNameFromUrl(p.file_url)}</a>
                      <button type="button" className="delete-existing-btn" onClick={() => removeExistingFile("payment", p.id, p.file_url)} title="Remove existing payment"><X size={12} /></button>
                    </div>
                  ))}
                  {paymentChannelFiles.map((f, idx) => (
                    <div key={`new-p-${idx}`} className="file-item">
                      <ImageIcon size={14} /> {f.name}
                      <button type="button" onClick={() => removeFile(setPaymentChannelFiles, idx)}><X size={12} /></button>
                    </div>
                  ))}
                </div>
                {validationErrors.paymentChannelFiles && <small className="error">{validationErrors.paymentChannelFiles}</small>}
              </div>

              <div className="form-group">
                <label>Business Permit *</label>
                <label className="file-btn">
                  <Upload size={18} />
                  <span>Choose File</span>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileSelect(setBusinessPermitFile, e, 2, "businessPermitFile")} hidden />
                </label>
                <div className="file-preview-small">{getFilePreview(businessPermitFile, existingPermitUrl)}</div>
                {validationErrors.businessPermitFile && <small className="error">{validationErrors.businessPermitFile}</small>}
              </div>
            </div>
          </section>

          {/* Employees */}
          <section className="form-section">
            <h2>Employee/s Information</h2>
            {employees.map((emp, idx) => (
              <div className="employee-row" key={idx}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input type="text" value={emp.fullName} onChange={(e) => handleEmployeeChange(idx, "fullName", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Position *</label>
                    <div className="input-with-btn">
                      <input type="text" value={emp.position} onChange={(e) => handleEmployeeChange(idx, "position", e.target.value)} />
                      {employees.length > 1 && (
                        <button type="button" onClick={() => removeEmployee(idx)} className="remove-btn"><X size={14} /></button>
                      )}
                    </div>
                  </div>
                </div>
                {validationErrors[`employee_${idx}`] && <small className="error">{validationErrors[`employee_${idx}`]}</small>}
              </div>
            ))}

            <button type="button" className="add-btn" onClick={addEmployee}>+ Add Employee</button>
          </section>

          <div className="form-actions">
            <button type="submit" className="btn-primary">Proceed</button>
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
          waiverFile,
          existingWaiverUrl,
          facilityImages,
          existingFacilityImages,
          paymentChannelFiles,
          existingPaymentChannels,
          businessPermitFile,
          existingPermitUrl,
          employees,
        }}
      />

      <Footer />
    </>
  );

  // small helper to show friendly filename from URL
  function getFileNameFromUrl(url) {
    if (!url) return "";
    try {
      const parts = url.split("/");
      const last = parts[parts.length - 1];
      // strip timestamp prefix if inserted by storage upload pattern
      const nameParts = last.split("_").slice(1);
      return decodeURIComponent((nameParts.length ? nameParts.join("_") : last));
    } catch {
      return url;
    }
  }
}
