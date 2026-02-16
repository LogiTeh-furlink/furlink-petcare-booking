import React, { useState, useEffect } from "react";
import { X, Upload, FileText, CheckCircle, AlertCircle, Trash2, Plus, MapPin, Users, FileCheck, Ban } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LocationPicker from "../../components/Map/LocationPicker";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { supabase } from "../../config/supabase";
import "./ApplyProvider.css";

/* =========================================
   CONFIRMATION MODAL COMPONENT (UNCHANGED)
   ========================================= */
const ConfirmationModal = ({ isOpen, onClose, onConfirm, data, files, isSubmitting }) => {
  if (!isOpen) return null;

  const getFileName = (fileOrUrl) => {
    if (!fileOrUrl) return "None";
    if (fileOrUrl instanceof File) return fileOrUrl.name;
    if (typeof fileOrUrl === 'string') {
        try {
            const decoded = decodeURIComponent(fileOrUrl);
            const baseName = decoded.split('/').pop(); 
            return baseName.replace(/^\d+_/, ''); 
        } catch (e) { return "Existing File"; }
    }
    return "File";
  };

  const finalFacilities = [
    ...(files.existingFacilityImages || []).map(f => ({ name: getFileName(f.image_url), status: 'Existing' })),
    ...(files.facilityImages || []).map(f => ({ name: f.name, status: 'New' }))
  ];

  const finalPayments = [
    ...(files.existingPaymentChannels || []).map(f => ({ name: getFileName(f.file_url), status: 'Existing' })),
    ...(files.paymentChannelFiles || []).map(f => ({ name: f.name, status: 'New' }))
  ];

  let waiverInfo = { name: "None", status: "" };
  if (files.waiverFile) {
    waiverInfo = { name: files.waiverFile.name, status: "New" };
  } else if (files.existingWaiverUrl) {
    waiverInfo = { name: getFileName(files.existingWaiverUrl), status: "Existing" };
  }

  let permitInfo = { name: "Missing", status: "Missing" };
  if (files.businessPermitFile) {
    permitInfo = { name: files.businessPermitFile.name, status: "New" };
  } else if (files.existingPermitUrl) {
    permitInfo = { name: getFileName(files.existingPermitUrl), status: "Existing" };
  }

  const hoursDisplay = (data.operatingHours || []).map(slot => 
    `${slot.days.join(", ")} (${slot.startTime} - ${slot.endTime})`
  ).join("; ");

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">Review Application</h2>
          <button onClick={onClose} disabled={isSubmitting} className="modal-close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="review-grid">
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
            </div>

            <div className="review-group">
              <h4><MapPin size={14}/> Location</h4>
              <div className="review-row"><span className="review-label">Street:</span> <span className="review-value">{data.houseStreet}</span></div>
              <div className="review-row"><span className="review-label">Barangay:</span> <span className="review-value">{data.barangay}</span></div>
              <div className="review-row"><span className="review-label">City:</span> <span className="review-value">{data.city}</span></div>
              <div className="review-row"><span className="review-label">Province:</span> <span className="review-value">{data.province}</span></div>
              <div className="review-row"><span className="review-label">Postal:</span> <span className="review-value">{data.postalCode}</span></div>
              <div className="review-row"><span className="review-label">Country:</span> <span className="review-value">{data.country}</span></div>
              <div className="review-row">
                  <span className="review-label">Latitude:</span> 
                  <span className="review-value">{data.latitude ? data.latitude.toFixed(6) : "N/A"}</span>
              </div>
              <div className="review-row">
                  <span className="review-label">Longitude:</span> 
                  <span className="review-value">{data.longitude ? data.longitude.toFixed(6) : "N/A"}</span>
              </div>
              <div className="review-row"><span className="review-label">Map Link:</span> <span className="review-value">{data.googleMapUrl || "N/A"}</span></div>
          </div>

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

            <div className="review-group">
                <h4><FileCheck size={14}/> Attachments</h4>
                <div className="review-row"><span className="review-label">Business Permit:</span></div>
                <ul className="review-list">
                    <li>
                        <span className={`review-file-tag tag-${permitInfo.status.toLowerCase()}`}>{permitInfo.status}</span>
                        {permitInfo.name}
                    </li>
                </ul>
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
                <div className="review-row" style={{marginTop:'10px'}}><span className="review-label">Facilities ({finalFacilities.length}):</span></div>
                <ul className="review-list">
                    {finalFacilities.map((f, i) => (
                        <li key={i}>
                            <span className={`review-file-tag tag-${f.status.toLowerCase()}`}>{f.status}</span>
                            {f.name}
                        </li>
                    ))}
                </ul>
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
          <button onClick={onClose} disabled={isSubmitting} className="btn-cancel">Go Back & Edit</button>
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

  const formatCityStandard = (cityStr) => {
    if (!cityStr) return "";
    let baseName = cityStr.toLowerCase().replace(/\bcity\b/gi, "").trim();
    if (baseName === "makti") baseName = "makati"; 
    const capitalized = baseName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return `${capitalized} City`;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [providerId, setProviderId] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isReapplying, setIsReapplying] = useState(false);
  
  // ⭐ SUSPENSION STATE
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionDate, setSuspensionDate] = useState(null);

  const [businessInfo, setBusinessInfo] = useState({
    businessName: "",
    description: "",
    businessEmail: "",
    businessMobile: "",
    socialMediaUrl: "",
    googleMapUrl: "", 
    typeOfService: "Pet Grooming",
    operatingHours: [{ 
        days: [], 
        startTime: "09:00", 
        endTime: "17:00",
        slotDurationHours: 1,
        slotDurationMinutes: 0,
        capacityPerSlot: 1
    }],
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

  const isWithinPhilippines = (lat, lng) => lat >= 4.0 && lat <= 21.5 && lng >= 116.0 && lng <= 127.0;

  const handleLocationChange = async (lat, lng) => {
    if (isSuspended) return; // Guard
    if (!isWithinPhilippines(lat, lng)) {
      alert("Location must be in the Philippines.");
      return;
    }
    const genUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    setBusinessInfo(prev => ({ ...prev, latitude: lat, longitude: lng, googleMapUrl: genUrl }));
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`, { headers: { 'User-Agent': 'FurLinkPetCareApp/1.0' } });
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        setBusinessInfo(prev => ({
          ...prev,
          houseStreet: addr.road ? `${addr.house_number || ''} ${addr.road}`.trim() : prev.houseStreet,
          barangay: addr.suburb || addr.neighbourhood || addr.village || prev.barangay,
          city: formatCityStandard(addr.city || addr.town || addr.municipality || ""),
          province: addr.state || addr.region || prev.province,
          postalCode: addr.postcode || prev.postalCode
        }));
      }
    } catch (e) { console.error("Reverse geocoding error:", e); }
  };

  const updatePinFromAddress = async (updatedInfo) => {
    if (isSuspended) return; // Guard
    const { houseStreet, barangay, city, province } = updatedInfo;
    if (!houseStreet && !barangay && !city) return;
    const query = `${houseStreet}, ${barangay}, ${city}, ${province}, Philippines`;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, { headers: { 'User-Agent': 'FurLinkPetCareApp/1.0' } });
      const data = await response.json();
      if (data && data.length > 0) {
        const nLat = parseFloat(data[0].lat);
        const nLng = parseFloat(data[0].lon);
        if (isWithinPhilippines(nLat, nLng)) {
          setBusinessInfo(prev => ({ ...prev, latitude: nLat, longitude: nLng, googleMapUrl: `https://www.google.com/maps/search/?api=1&query=${nLat},${nLng}` }));
        }
      }
    } catch (e) { console.error("Manual address geocoding error:", e); }
  };

  const daysOfWeekShort = ["S", "M", "T", "W", "T", "F", "S"];
  const daysOfWeekFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const positionOptions = ["Business Owner", "Pet Stylist", "Staff"];

  useEffect(() => {
    const loadProviderData = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) return;

        // ⭐ CHECK SUSPENSION STATUS
        const { data: profile } = await supabase.from("profiles").select("suspension_end_date").eq("id", user.id).single();
        if (profile?.suspension_end_date) {
            const endDate = new Date(profile.suspension_end_date);
            if (endDate > new Date()) {
                setIsSuspended(true);
                setSuspensionDate(endDate);
            }
        }

        const { data: providerData } = await supabase.from("service_providers").select("*").eq("user_id", user.id).maybeSingle(); 

        if (providerData) {
            setProviderId(providerData.id);
            setIsReapplying(providerData.status === 'rejected');
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
                if (!grouped[key]) grouped[key] = { days: [], startTime: h.start_time, endTime: h.end_time, slotDurationHours: Math.floor(h.slot_interval_minutes / 60), slotDurationMinutes: h.slot_interval_minutes % 60, capacityPerSlot: h.slot_capacity };
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
            if (staff && staff.length > 0) setEmployees(staff.map(s => ({ fullName: s.full_name, position: s.job_title })));
        }
      } catch (err) { console.error("Load error:", err); } finally { setIsLoading(false); }
    };
    loadProviderData();
  }, []);

  const handleBusinessChange = (e) => {
    if (isSuspended) return; // Guard
    const { name, value } = e.target;
    if (name === "description" && value.length > 500) return;
    if (name === "googleMapUrl") {
        setBusinessInfo(prev => ({ ...prev, [name]: value }));
        const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)|q=(-?\d+\.\d+),(-?\d+\.\d+)/;
        const match = value.match(regex);
        if (match) {
            const lat = parseFloat(match[1] || match[3]);
            const lng = parseFloat(match[2] || match[4]);
            if (isWithinPhilippines(lat, lng)) handleLocationChange(lat, lng);
        }
        return;
    }
    if (name === "businessMobile" || name === "postalCode") {
      const nums = value.replace(/\D/g, "");
      if ((name === "businessMobile" && nums.length <= 11) || (name === "postalCode" && nums.length <= 4)) {
        setBusinessInfo(prev => ({ ...prev, [name]: nums }));
      }
      return;
    }
    setBusinessInfo((prev) => ({ ...prev, [name]: value }));
  };

  const toggleDay = (slotIndex, day) => {
    if (isSuspended) return;
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

  const isDayDisabled = (slotIndex, day) => isSuspended || businessInfo.operatingHours.some((slot, i) => i !== slotIndex && slot.days.includes(day));
  const addTimeSlot = () => !isSuspended && setBusinessInfo((prev) => ({ ...prev, operatingHours: [...prev.operatingHours, { days: [], startTime: "09:00", endTime: "17:00", slotDurationHours: 1, slotDurationMinutes: 0, capacityPerSlot: 1 }] }));
  const removeTimeSlot = (index) => !isSuspended && setBusinessInfo((prev) => ({ ...prev, operatingHours: prev.operatingHours.filter((_, i) => i !== index) }));
  const handleTimeChange = (slotIndex, type, value) => {
    if (isSuspended) return;
    setBusinessInfo((prev) => ({ ...prev, operatingHours: prev.operatingHours.map((slot, i) => (i === slotIndex ? { ...slot, [type]: value } : slot)) }));
  };

  const handleFileSelect = (setter, e, maxSizeMB, fieldName) => {
    if (isSuspended) return;
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
    if (isSuspended) return;
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

  const removeFile = (setter, index) => !isSuspended && setter((prev) => prev.filter((_, i) => i !== index));
  const removeSingleFile = (fileSetter, urlSetter) => { if (isSuspended) return; fileSetter(null); urlSetter(null); };

  const handleEmployeeChange = (index, field, value) => !isSuspended && setEmployees((prev) => prev.map((emp, i) => (i === index ? { ...emp, [field]: value } : emp)));
  const addEmployee = () => !isSuspended && setEmployees((prev) => [...prev, { fullName: "", position: "" }]);
  const removeEmployee = (index) => !isSuspended && setEmployees((prev) => prev.filter((_, i) => i !== index));

  const validateForm = async () => {
    const errors = {};
    if (!businessInfo.businessName.trim()) { errors.businessName = "Business Name is required"; } 
    else {
        const { data: existingBusiness } = await supabase.from("service_providers").select("id").eq("business_name", businessInfo.businessName.trim()).neq("id", providerId || "00000000-0000-0000-0000-000000000000").maybeSingle();
        if (existingBusiness) { errors.businessName = "This business name is already registered. Please choose another."; }
    }
    if (!businessInfo.description.trim()) errors.description = "Description is required";
    if (!businessInfo.businessEmail.trim()) errors.businessEmail = "Email is required";
    if (!/^09\d{9}$/.test(businessInfo.businessMobile)) errors.businessMobile = "Must be a valid PH mobile number";
    if (businessInfo.socialMediaUrl && !/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?(\?.*)?$/.test(businessInfo.socialMediaUrl)) errors.socialMediaUrl = "Must be a valid URL";
    if (!businessInfo.googleMapUrl.trim()) { errors.googleMapUrl = "Google Map Link is required"; } 
    else if (!/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?(\?.*)?$/.test(businessInfo.googleMapUrl)) { errors.googleMapUrl = "Must be a valid URL"; }
    if (!businessInfo.operatingHours || businessInfo.operatingHours.length === 0) { errors.operatingHours = "At least one operating hour slot is required"; } 
    else { businessInfo.operatingHours.forEach(slot => { if(slot.days.length === 0) errors.operatingHours = "Select at least one day for each slot"; }); }
    ["houseStreet", "barangay", "city", "province"].forEach((field) => { if (!businessInfo[field] || !businessInfo[field].trim()) errors[field] = "Required"; });
    if (!/^\d{4}$/.test(businessInfo.postalCode)) errors.postalCode = "Invalid postal code";
    if (facilityImages.length === 0 && existingFacilityImages.length === 0) errors.facilityImages = "Required";
    if (paymentChannelFiles.length === 0 && existingPaymentChannels.length === 0) errors.paymentChannelFiles = "Required";
    if (!businessPermitFile && !existingPermitUrl) errors.businessPermitFile = "Required";
    if (employees.length === 0) errors.employees = "Required";
    employees.forEach((emp, i) => { if (!emp.fullName.trim()) errors[`employee_${i}_name`] = "Required"; if (!emp.position.trim()) errors[`employee_${i}_pos`] = "Required"; });
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e) => {
      e.preventDefault();
      if (isSuspended) return; // Guard
      const isValid = await validateForm(); 
      if (!isValid) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      setShowConfirmModal(true);
  };

  const getFilePathFromUrl = (url) => {
    if (!url) return null;
    try { const u = new URL(url); const match = u.pathname.match(/\/storage\/v1\/object\/public\/[^\/]+\/(.+)$/); return match ? decodeURIComponent(match[1]) : null; } catch { return null; }
  };

  const removeExistingFile = async (type, id, fileUrl) => {
    if (isSuspended) return;
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
      setValidationErrors((prev) => { const newErrors = { ...prev }; delete newErrors.general; return newErrors; });
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user found");
        const waiverUrl = waiverFile ? await uploadFileToStorage(user.id, "waivers", waiverFile) : (existingWaiverUrl || null);
        const permitUrl = businessPermitFile ? await uploadFileToStorage(user.id, "permits", businessPermitFile) : (existingPermitUrl || null);
        const newFacilityUrls = [];
        for (const f of facilityImages) { const u = await uploadFileToStorage(user.id, "facilities", f); if (u) newFacilityUrls.push(u); }
        const newPaymentUrls = [];
        for (const f of paymentChannelFiles) { const u = await uploadFileToStorage(user.id, "payments", f); if (u) newPaymentUrls.push(u); }

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
          waiver_url: waiverUrl,
          status: 'pending', 
          rejection_reasons: null, 
          updated_at: new Date().toISOString(),
        };

        const { data: upsertData, error: upsertError } = await supabase.from("service_providers").upsert(payload, { onConflict: 'user_id' }).select().single();
        if (upsertError) throw upsertError;
        const currentProviderId = upsertData.id;
        await Promise.all([supabase.from("service_provider_hours").delete().eq("provider_id", currentProviderId), supabase.from("service_provider_staff").delete().eq("provider_id", currentProviderId)]);

        const hoursPayload = [];
        businessInfo.operatingHours.forEach(slot => {
          const totalMinutes = (slot.slotDurationHours * 60) + slot.slotDurationMinutes;
          slot.days.forEach(day => {
            hoursPayload.push({ provider_id: currentProviderId, day_of_week: day, start_time: slot.startTime, end_time: slot.endTime, slot_interval_minutes: totalMinutes, slot_capacity: slot.capacityPerSlot });
          });
        });
        if (hoursPayload.length > 0) { const { error: hError } = await supabase.from("service_provider_hours").insert(hoursPayload); if (hError) throw hError; }
        if (newFacilityUrls.length > 0) { const imgPayload = newFacilityUrls.map(url => ({ provider_id: currentProviderId, image_url: url })); await supabase.from("service_provider_images").insert(imgPayload); }
        if (newPaymentUrls.length > 0) { const payPayload = newPaymentUrls.map(url => ({ provider_id: currentProviderId, method_type: "QR", file_url: url })); await supabase.from("service_provider_payments").insert(payPayload); }
        if (businessPermitFile) { await supabase.from("service_provider_permits").delete().eq("provider_id", currentProviderId); await supabase.from("service_provider_permits").insert({ provider_id: currentProviderId, permit_type: "Business Permit", file_url: permitUrl }); }
        const staffPayload = employees.map(emp => ({ provider_id: currentProviderId, full_name: emp.fullName, job_title: emp.position }));
        if (staffPayload.length > 0) await supabase.from("service_provider_staff").insert(staffPayload);

        setShowConfirmModal(false);
        navigate("/service-setup");
      } catch (err) {
        setValidationErrors((prev) => ({ ...prev, general: "Submission failed: " + (err.message || "An unexpected error occurred.") }));
        setShowConfirmModal(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div className="loading-screen">Loading Application...</div>;

  return (
    <>
      <LoggedInNavbar hideBecomeProvider={true} />
      <div className="apply-provider-wrapper">
        <h1 className="page-title">Service Provider Application</h1>

        <div className="terms-info-section">
            <div className="terms-info-content">
                <FileText className="terms-icon" size={20} />
                <p>
                    By applying to become a partner, you agree to the{" "}
                    <strong>
                        <a 
                            href="https://mdhudfatvdipxwufcbis.supabase.co/storage/v1/object/public/agreements/terms_sp.pdf" 
                            target="_blank" 
                            rel="noreferrer"
                            className="terms-link-highlight"
                        >
                            Terms and Conditions for Service Providers
                        </a>
                    </strong>
                    . Please review these policies carefully as they govern your business operations on <i>furlink</i>.
                </p>
            </div>
        </div>

        {/* ⭐ SUSPENSION READ-ONLY BANNER */}
        {isSuspended && (
          <div className="error-banner" style={{ backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', marginBottom: '25px' }}>
            <Ban size={18} />
            <span><strong>Application Restricted:</strong> Your account is currently suspended until {suspensionDate.toLocaleDateString()}. You can view your current application data but cannot submit or modify it.</span>
          </div>
        )}

        {validationErrors.general && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{validationErrors.general}</span>
          </div>
        )}

        <form className="apply-provider-form" onSubmit={handleFormSubmit}>
          <section className="form-section">
            <h2>Business Information</h2>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Business Name*</label>
                <input 
                  type="text" 
                  name="businessName" 
                  value={businessInfo.businessName} 
                  onChange={handleBusinessChange} 
                  readOnly={isSuspended}
                  className={`${validationErrors.businessName ? "error-input" : ""} ${isSuspended ? "input-disabled" : ""}`} 
                />
                {validationErrors.businessName && <small className="error">{validationErrors.businessName}</small>}
              </div>
              <div className="form-group">
                <label>Service Type</label>
                <input type="text" name="typeOfService" value={businessInfo.typeOfService} disabled className="input-disabled" />
              </div>
            </div>

            <div className="form-group-full-width">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ margin: 0 }}>Business Description*</label>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: businessInfo.description.length >= 500 ? '#ef4444' : '#64748b' }}>
                  {businessInfo.description.length}/500
                </span>
              </div>
              <textarea 
                name="description" 
                value={businessInfo.description} 
                onChange={handleBusinessChange} 
                readOnly={isSuspended}
                placeholder="Describe your business and services..." 
                className={`${validationErrors.description ? "error-input" : ""} ${isSuspended ? "input-disabled" : ""}`}
              />
              {validationErrors.description && <small className="error">{validationErrors.description}</small>}
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Email*</label>
                <input 
                  type="email" 
                  name="businessEmail" 
                  value={businessInfo.businessEmail} 
                  onChange={handleBusinessChange} 
                  readOnly={isSuspended}
                  className={`${validationErrors.businessEmail ? "error-input" : ""} ${isSuspended ? "input-disabled" : ""}`}
                />
                {validationErrors.businessEmail && <small className="error">{validationErrors.businessEmail}</small>}
              </div>
              <div className="form-group">
                <label>Mobile Number*</label>
                <input 
                  type="tel" 
                  name="businessMobile" 
                  value={businessInfo.businessMobile} 
                  onChange={handleBusinessChange} 
                  readOnly={isSuspended}
                  placeholder="0912 345 6789" 
                  className={`${validationErrors.businessMobile ? "error-input" : ""} ${isSuspended ? "input-disabled" : ""}`}
                />
                {validationErrors.businessMobile && <small className="error">{validationErrors.businessMobile}</small>}
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Social Media URL</label>
                <input type="url" name="socialMediaUrl" value={businessInfo.socialMediaUrl} onChange={handleBusinessChange} readOnly={isSuspended} placeholder="https://facebook.com/..." className={isSuspended ? "input-disabled" : ""}/>
              </div>
              <div className="form-group">
                <label>Google Map URL*</label>
                <input 
                  type="url" 
                  name="googleMapUrl" 
                  value={businessInfo.googleMapUrl} 
                  onChange={handleBusinessChange} 
                  readOnly={isSuspended}
                  className={`${validationErrors.googleMapUrl ? "error-input" : ""} ${isSuspended ? "input-disabled" : ""}`} 
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '20px' }}>
              <label style={{ fontWeight: '600', marginBottom: '10px', display: 'block' }}>Shop Location*</label>
              <div style={{ height: "400px", borderRadius: "12px", overflow: "hidden", border: validationErrors.latitude ? "2px solid #ef4444" : "1px solid #dbeafe" }}>
                <LocationPicker lat={businessInfo.latitude} lng={businessInfo.longitude} onLocationChange={handleLocationChange} previewOnly={isSuspended} />
              </div>
            </div>
          </section>

          <section className="form-section">
            <h2>Business Address</h2>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Street*</label>
                <input type="text" name="houseStreet" value={businessInfo.houseStreet} onChange={handleBusinessChange} readOnly={isSuspended} onBlur={() => updatePinFromAddress(businessInfo)} className={`${validationErrors.houseStreet ? "error-input" : ""} ${isSuspended ? "input-disabled" : ""}`} />
              </div>
              <div className="form-group">
                <label>Barangay*</label>
                <input type="text" name="barangay" value={businessInfo.barangay} onChange={handleBusinessChange} readOnly={isSuspended} onBlur={() => updatePinFromAddress(businessInfo)} className={`${validationErrors.barangay ? "error-input" : ""} ${isSuspended ? "input-disabled" : ""}`} />
              </div>
              <div className="form-group">
                <label>City*</label>
                <input type="text" name="city" value={businessInfo.city} onChange={handleBusinessChange} readOnly={isSuspended} onBlur={(e) => { if(!isSuspended) { const f = formatCityStandard(e.target.value); const updated = { ...businessInfo, city: f }; setBusinessInfo(updated); updatePinFromAddress(updated); }}} className={`${validationErrors.city ? "error-input" : ""} ${isSuspended ? "input-disabled" : ""}`} />
              </div>
              <div className="form-group">
                <label>Province*</label>
                <input type="text" name="province" value={businessInfo.province} onChange={handleBusinessChange} readOnly={isSuspended} onBlur={() => updatePinFromAddress(businessInfo)} className={`${validationErrors.province ? "error-input" : ""} ${isSuspended ? "input-disabled" : ""}`}/>
              </div>
              <div className="form-group">
                <label>Postal Code*</label>
                <input type="text" name="postalCode" value={businessInfo.postalCode} onChange={handleBusinessChange} readOnly={isSuspended} maxLength={4} onBlur={() => updatePinFromAddress(businessInfo)} className={`${validationErrors.postalCode ? "error-input" : ""} ${isSuspended ? "input-disabled" : ""}`} />
              </div>
              <div className="form-group">
                <label>Country</label>
                <input type="text" name="country" value={businessInfo.country} disabled className="input-disabled" />
              </div>
            </div>
          </section>

          <section className="form-section">
            <h2>Operating Hours & Capacity</h2>
            <div className="form-group operating-hours-container">
            {businessInfo.operatingHours.map((slot, i) => (
              <div key={i} className="operating-slot-enhanced">
                <div className="day-buttons">
                  {daysOfWeekFull.map((d, idx) => (
                    <button key={d} type="button" 
                      className={`day-btn ${slot.days.includes(d) ? "active" : ""} ${isDayDisabled(i, d) ? "disabled" : ""}`} 
                      onClick={() => toggleDay(i, d)} disabled={isDayDisabled(i, d)}>
                      {daysOfWeekShort[idx]}
                    </button>
                  ))}
                </div>

                <div className="time-config-row-single">
                  <div className="input-unit">
                    <label>Hours:</label>
                    <div className="time-inputs-compact">
                      <input type="time" value={slot.startTime} onChange={(e) => handleTimeChange(i, "startTime", e.target.value)} readOnly={isSuspended} className={isSuspended ? "input-disabled" : ""}/>
                      <span>-</span>
                      <input type="time" value={slot.endTime} onChange={(e) => handleTimeChange(i, "endTime", e.target.value)} readOnly={isSuspended} className={isSuspended ? "input-disabled" : ""}/>
                    </div>
                  </div>

                  <div className="input-unit">
                    <label>Slot Every:</label>
                    <div className="duration-inputs-compact">
                      <input type="number" min="0" value={slot.slotDurationHours} onChange={(e) => handleTimeChange(i, "slotDurationHours", parseInt(e.target.value) || 0)} readOnly={isSuspended} className={isSuspended ? "input-disabled" : ""}/>
                      <span>hr</span>
                      <input type="number" min="0" value={slot.slotDurationMinutes} onChange={(e) => handleTimeChange(i, "slotDurationMinutes", parseInt(e.target.value) || 0)} readOnly={isSuspended} className={isSuspended ? "input-disabled" : ""}/>
                      <span>min</span>
                    </div>
                  </div>

                  <div className="input-unit">
                    <label>Capacity:</label>
                    <div className="capacity-input-compact">
                      <input type="number" min="1" value={slot.capacityPerSlot} onChange={(e) => handleTimeChange(i, "capacityPerSlot", parseInt(e.target.value) || 1)} readOnly={isSuspended} className={isSuspended ? "input-disabled" : ""}/>
                      <span>pets</span>
                    </div>
                  </div>

                  {!isSuspended && businessInfo.operatingHours.length > 1 && (
                    <button type="button" onClick={() => removeTimeSlot(i)} className="remove-inline-btn">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!isSuspended && <button type="button" className="add-btn" onClick={addTimeSlot}><Plus size={16} /> Add Different Schedule</button>}
          </div>
          </section>

          <section className="form-section">
            <h2>Employee Information</h2>
            {employees.map((emp, idx) => (
              <div className="employee-row" key={idx}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Full Name*</label>
                    <input type="text" value={emp.fullName} onChange={(e) => handleEmployeeChange(idx, "fullName", e.target.value)} readOnly={isSuspended} className={isSuspended ? "input-disabled" : ""}/>
                    {validationErrors[`employee_${idx}_name`] && <small className="error">{validationErrors[`employee_${idx}_name`]}</small>}
                  </div>
                  <div className="form-group">
                    <label>Position*</label>
                    <div className="input-with-btn">
                      <select value={emp.position} onChange={(e) => handleEmployeeChange(idx, "position", e.target.value)} disabled={isSuspended} className={isSuspended ? "input-disabled" : ""}>
                        <option value="">Select Position</option>
                        {positionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      {!isSuspended && employees.length > 1 && (
                        <button type="button" onClick={() => removeEmployee(idx)} className="remove-btn"><Trash2 size={16} /></button>
                      )}
                    </div>
                    {validationErrors[`employee_${idx}_pos`] && <small className="error">{validationErrors[`employee_${idx}_pos`]}</small>}
                  </div>
                </div>
              </div>
            ))}
            {!isSuspended && <button type="button" className="add-btn" onClick={addEmployee}><Plus size={16} /> Add Employee</button>}
          </section>

          <section className="form-section">
            <h2>Documents & Uploads</h2>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Waiver</label>
                {!isSuspended && (
                  <label className="file-btn"><Upload size={18} /> <span>Select File</span><input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileSelect(setWaiverFile, e, 1, "waiverFile")} hidden /></label>
                )}
                <div className="file-preview-small">
                  {waiverFile ? <span>{waiverFile.name} {!isSuspended && <X size={14} onClick={() => setWaiverFile(null)} />}</span> : existingWaiverUrl ? <span><a href={existingWaiverUrl} target="_blank" rel="noreferrer">View Existing</a> {!isSuspended && <X size={14} onClick={() => removeSingleFile(setWaiverFile, setExistingWaiverUrl)} />}</span> : null}
                </div>
              </div>
              <div className="form-group">
                <label>Business Permit*</label>
                {!isSuspended && (
                  <label className="file-btn"><Upload size={18} /> <span>Select File</span><input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileSelect(setBusinessPermitFile, e, 1, "businessPermitFile")} hidden /></label>
                )}
                <div className="file-preview-small">
                  {businessPermitFile ? <span>{businessPermitFile.name} {!isSuspended && <X size={14} onClick={() => setBusinessPermitFile(null)} />}</span> : existingPermitUrl ? <span><a href={existingPermitUrl} target="_blank" rel="noreferrer">View Existing</a> {!isSuspended && <X size={14} onClick={() => removeSingleFile(setBusinessPermitFile, setExistingPermitUrl)} />}</span> : null}
                </div>
              </div>
            </div>
            <div className="form-grid-2">
                <div className="form-group">
                  <label>Facility Images*</label>
                  {!isSuspended && (
                    <label className="file-btn"><Upload size={18} /> <span>Select Images</span><input type="file" accept=".jpg,.jpeg,.png" multiple onChange={(e) => handleMultiFileSelect(setFacilityImages, facilityImages, e, 3, "facilityImages", existingFacilityImages.length, 2)} hidden /></label>
                  )}
                  <div className="file-list">
                    {existingFacilityImages.map(img => (<div key={img.id} className="file-item"><FileText size={14} /> Existing Img {!isSuspended && <button type="button" onClick={() => removeExistingFile("image", img.id, img.image_url)}><X size={12} /></button>}</div>))}
                    {facilityImages.map((f, i) => (<div key={i} className="file-item"><FileText size={14} /> {f.name}{!isSuspended && <button type="button" onClick={() => removeFile(setFacilityImages, i)}><X size={12} /></button>}</div>))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Payment QR*</label>
                  {!isSuspended && (
                    <label className="file-btn"><Upload size={18} /> <span>Select QR Images</span><input type="file" accept=".jpg,.jpeg,.png" multiple onChange={(e) => handleMultiFileSelect(setPaymentChannelFiles, paymentChannelFiles, e, 3, "paymentChannelFiles", existingPaymentChannels.length, 2)} hidden /></label>
                  )}
                  <div className="file-list">
                    {existingPaymentChannels.map(img => (<div key={img.id} className="file-item"><FileText size={14} /> Existing QR {!isSuspended && <button type="button" onClick={() => removeExistingFile("payment", img.id, img.file_url)}><X size={12} /></button>}</div>))}
                    {paymentChannelFiles.map((f, i) => (<div key={i} className="file-item"><FileText size={14} /> {f.name}{!isSuspended && <button type="button" onClick={() => removeFile(setPaymentChannelFiles, i)}><X size={12} /></button>}</div>))}
                  </div>
                </div>
            </div>
          </section>

          <div className="form-actions">
            <button 
              type="submit" 
              className={`btn-primary ${isSuspended ? "btn-suspended" : ""}`} 
              disabled={isSubmitting || isSuspended}
              style={isSuspended ? { backgroundColor: '#94a3b8', cursor: 'not-allowed' } : {}}
            >
              {isSubmitting ? "Processing..." : isSuspended ? "Application Restricted (Suspended)" : "Review Application"}
            </button>
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