import React, { useEffect, useState, useRef } from "react";
import { X, Upload, FileText, CheckCircle, AlertCircle, Trash2, Plus, ArrowLeft, AlertTriangle, MapPin, Clock, Users, FileCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { supabase } from "../../config/supabase";
import "./SPEditProfile.css";

// ... (Keep SimpleAlertModal and FinalConfirmationModal exactly the same as before) ...
// ... (Paste the Modals here from previous code if copy-pasting full file, otherwise they are unchanged) ...

// --- 1. SIMPLE ALERT MODAL ---
const SimpleAlertModal = ({ isOpen, onClose, title, message, type = "error" }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content simple-alert">
        <div className={`alert-header ${type}`}>
            {type === 'error' ? <AlertCircle size={24} /> : <CheckCircle size={24}/>}
            <h3>{title}</h3>
        </div>
        <p>{message}</p>
        <button onClick={onClose} className="btn-alert-ok">OK</button>
      </div>
    </div>
  );
};

// --- 2. CONFIRMATION MODAL ---
const FinalConfirmationModal = ({ isOpen, onClose, onConfirm, status, errorMessage, onNavigateManage }) => {
  if (!isOpen) return null;

  if (status === 'success') {
    return (
      <div className="modal-overlay">
        <div className="modal-content final-confirm-modal success">
          <div className="modal-header-center">
            <CheckCircle size={56} className="modal-icon-success" />
            <h2>Profile Updated!</h2>
          </div>
          <div className="modal-body-center">
            <p>Your business information has been successfully updated.</p>
          </div>
          <div className="modal-footer-center">
            <button className="btn-modal-dashboard" onClick={onNavigateManage}>
              Back to Manage Listing
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
          <p>Are you sure you want to update your business profile?</p>
        </div>
        <div className="modal-footer-center">
          <button className="btn-modal-cancel" onClick={onClose} disabled={status === 'submitting'}>
            Cancel
          </button>
          <button className="btn-modal-confirm" onClick={onConfirm} disabled={status === 'submitting'}>
            {status === 'submitting' ? "Saving..." : "Yes, Update Profile"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function SPEditProfile() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loadingData, setLoadingData] = useState(true);
  const [providerId, setProviderId] = useState(null);
  
  // --- FORM STATE ---
  const [businessInfo, setBusinessInfo] = useState({
    businessName: "", businessEmail: "", businessMobile: "", socialMediaUrl: "",
    typeOfService: "", houseStreet: "", barangay: "", city: "", province: "", postalCode: "", country: "Philippines",
    operatingHours: []
  });

  const [newFiles, setNewFiles] = useState({ waiver: null, permit: null, facilities: [], payments: [] });
  const [existingFiles, setExistingFiles] = useState({ waiverUrl: null, permit: null, facilities: [], payments: [] });

  const [filesToDelete, setFilesToDelete] = useState([]); 
  const [deletedStaffIds, setDeletedStaffIds] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  const [validationErrors, setValidationErrors] = useState({});
  
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState('idle');
  const [submissionError, setSubmissionError] = useState('');
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'error' });

  const daysOfWeekFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const daysOfWeekShort = ["S", "M", "T", "W", "T", "F", "S"];
  const positionOptions = ["Business Owner", "Pet Stylist", "Staff"];

  // --- 1. FETCH DATA (Unchanged from previous logic) ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/login");

        const { data: provider } = await supabase.from("service_providers").select("*").eq("user_id", user.id).single();

        if (provider) {
            setProviderId(provider.id);
            const { data: hours } = await supabase.from("service_provider_hours").select("*").eq("provider_id", provider.id);
            let groupedHours = [];
            if (hours) {
                const grouped = {};
                hours.forEach((h) => {
                    const key = `${h.start_time}-${h.end_time}`;
                    if (!grouped[key]) grouped[key] = { 
                        id: h.id, tempId: Math.random().toString(), days: [], startTime: h.start_time, endTime: h.end_time
                    };
                    grouped[key].days.push(h.day_of_week);
                });
                groupedHours = Object.values(grouped);
            }

            setBusinessInfo({
                businessName: provider.business_name,
                businessEmail: provider.business_email,
                businessMobile: provider.business_mobile,
                socialMediaUrl: provider.social_media_url || "",
                typeOfService: provider.type_of_service,
                houseStreet: provider.house_street,
                barangay: provider.barangay,
                city: provider.city,
                province: provider.province,
                postalCode: provider.postal_code,
                country: provider.country,
                operatingHours: groupedHours
            });

            setExistingFiles(prev => ({ ...prev, waiverUrl: provider.waiver_url }));

            const { data: imgs } = await supabase.from("service_provider_images").select("*").eq("provider_id", provider.id);
            if (imgs) setExistingFiles(prev => ({ ...prev, facilities: imgs }));

            const { data: pays } = await supabase.from("service_provider_payments").select("*").eq("provider_id", provider.id);
            if (pays) setExistingFiles(prev => ({ ...prev, payments: pays }));

            const { data: perms } = await supabase.from("service_provider_permits").select("*").eq("provider_id", provider.id);
            if (perms && perms.length > 0) setExistingFiles(prev => ({ ...prev, permit: perms[0] }));

            const { data: stf } = await supabase.from("service_provider_staff").select("*").eq("provider_id", provider.id);
            if (stf) {
                setEmployees(stf.map(s => ({ id: s.id, tempId: `stf_${s.id}`, fullName: s.full_name, position: s.job_title })));
            }
        }
      } catch (err) { console.error(err); } finally { setLoadingData(false); }
    };
    fetchData();
  }, [navigate]);

  // --- HANDLERS (Same as before) ---
  const showAlert = (title, message) => setAlertModal({ isOpen: true, title, message, type: 'error' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "businessMobile" || name === "postalCode") {
        const num = value.replace(/\D/g, "");
        if (name === "postalCode" && num.length > 4) return;
        if (name === "businessMobile" && num.length > 11) return;
        setBusinessInfo(prev => ({ ...prev, [name]: num }));
    } else {
        setBusinessInfo(prev => ({ ...prev, [name]: value }));
    }
  };

  const toggleDay = (slotIndex, day) => {
    setBusinessInfo(prev => ({
        ...prev,
        operatingHours: prev.operatingHours.map((slot, i) => 
            i === slotIndex ? { ...slot, days: slot.days.includes(day) ? slot.days.filter(d => d !== day) : [...slot.days, day] } : slot
        )
    }));
  };
  const addTimeSlot = () => setBusinessInfo(prev => ({ ...prev, operatingHours: [...prev.operatingHours, { tempId: Date.now(), days: [], startTime: "09:00", endTime: "17:00" }] }));
  const removeTimeSlot = (index) => setBusinessInfo(prev => ({ ...prev, operatingHours: prev.operatingHours.filter((_, i) => i !== index) }));
  const handleTimeChange = (index, field, val) => setBusinessInfo(prev => ({ ...prev, operatingHours: prev.operatingHours.map((s, i) => i === index ? { ...s, [field]: val } : s) }));
  
  const handleEmpChange = (index, field, val) => setEmployees(prev => prev.map((e, i) => i === index ? { ...e, [field]: val } : e));
  const addEmployee = () => setEmployees(prev => [...prev, { tempId: `new_${Date.now()}`, fullName: "", position: "" }]);
  const removeEmployee = (index) => {
    const emp = employees[index];
    if (emp.id) setDeletedStaffIds(prev => [...prev, emp.id]);
    setEmployees(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = (field, e, maxMB) => {
    if (e.target.files[0]) {
        if (e.target.files[0].size > maxMB * 1024 * 1024) return showAlert("File Too Large", `Max size ${maxMB}MB`);
        setNewFiles(prev => ({ ...prev, [field]: e.target.files[0] }));
    }
  };

  const handleMultiFileSelect = (field, e, maxMB) => {
    if (e.target.files) {
        const files = Array.from(e.target.files).filter(f => f.size <= maxMB * 1024 * 1024);
        setNewFiles(prev => ({ ...prev, [field]: [...prev[field], ...files] }));
    }
  };

  const markExistingDelete = (type, id, url) => {
    if(!window.confirm("Delete this file? It will be removed on save.")) return;
    setFilesToDelete(prev => [...prev, { type, id, url }]);
    if (type === 'waiver') setExistingFiles(prev => ({ ...prev, waiverUrl: null }));
    if (type === 'permit') setExistingFiles(prev => ({ ...prev, permit: null }));
    if (type === 'image') setExistingFiles(prev => ({ ...prev, facilities: prev.facilities.filter(f => f.id !== id) }));
    if (type === 'payment') setExistingFiles(prev => ({ ...prev, payments: prev.payments.filter(f => f.id !== id) }));
  };

  const removeNewFile = (field, index) => {
      if (field === 'waiver' || field === 'permit') setNewFiles(prev => ({...prev, [field]: null}));
      else setNewFiles(prev => ({...prev, [field]: prev[field].filter((_, i) => i !== index)}));
  };

  const validate = () => {
    const errs = {};
    if (!businessInfo.businessName.trim()) errs.businessName = "Required";
    if (!businessInfo.businessEmail.trim()) errs.businessEmail = "Required";
    if (!/^09\d{9}$/.test(businessInfo.businessMobile)) errs.businessMobile = "Invalid PH Number";
    if (!/^\d{4}$/.test(businessInfo.postalCode)) errs.postalCode = "Invalid Postal Code";
    
    const hasPermit = existingFiles.permit || newFiles.permit;
    if (!hasPermit) errs.permit = "Business Permit is required";

    const totalImages = existingFiles.facilities.length + newFiles.facilities.length;
    if (totalImages === 0) errs.images = "At least 1 image required";

    const totalPayments = existingFiles.payments.length + newFiles.payments.length;
    if (totalPayments === 0) errs.payments = "Payment method required";

    setValidationErrors(errs);
    if (Object.keys(errs).length > 0) {
        showAlert("Incomplete Information", "Please check the form for errors.");
        return false;
    }
    return true;
  };

  const handleUpdateClick = () => {
    if (validate()) { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const uploadFile = async (userId, folder, file) => {
    const path = `${userId}/${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const { error } = await supabase.storage.from("service_provider_uploads").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("service_provider_uploads").getPublicUrl(path);
    return data.publicUrl;
  };

  const getFilePath = (url) => {
     try { const u = new URL(url); const m = u.pathname.match(/\/storage\/v1\/object\/public\/[^\/]+\/(.+)$/); return m ? decodeURIComponent(m[1]) : null; } catch { return null; }
  };

  const saveChangesToDB = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        for (const del of filesToDelete) {
            const path = getFilePath(del.url);
            if (path) await supabase.storage.from("service_provider_uploads").remove([path]);
            if (del.type === 'image') await supabase.from("service_provider_images").delete().eq("id", del.id);
            if (del.type === 'payment') await supabase.from("service_provider_payments").delete().eq("id", del.id);
            if (del.type === 'permit') await supabase.from("service_provider_permits").delete().eq("id", del.id);
        }

        if (deletedStaffIds.length > 0) await supabase.from("service_provider_staff").delete().in("id", deletedStaffIds);
        await supabase.from("service_provider_hours").delete().eq("provider_id", providerId);

        const newWaiverUrl = newFiles.waiver ? await uploadFile(user.id, "waivers", newFiles.waiver) : null;
        const newPermitUrl = newFiles.permit ? await uploadFile(user.id, "permits", newFiles.permit) : null;
        
        const newImgUrls = [];
        for (const f of newFiles.facilities) newImgUrls.push(await uploadFile(user.id, "facilities", f));
        const newPayUrls = [];
        for (const f of newFiles.payments) newPayUrls.push(await uploadFile(user.id, "payments", f));

        const providerUpdates = {
            business_name: businessInfo.businessName,
            business_email: businessInfo.businessEmail,
            business_mobile: businessInfo.businessMobile,
            social_media_url: businessInfo.socialMediaUrl,
            house_street: businessInfo.houseStreet,
            barangay: businessInfo.barangay,
            city: businessInfo.city,
            province: businessInfo.province,
            postal_code: businessInfo.postalCode,
            updated_at: new Date().toISOString()
        };
        if (newWaiverUrl) providerUpdates.waiver_url = newWaiverUrl;
        else if (filesToDelete.some(f => f.type === 'waiver')) providerUpdates.waiver_url = null;

        await supabase.from("service_providers").update(providerUpdates).eq("id", providerId);

        if (newPermitUrl) {
            await supabase.from("service_provider_permits").delete().eq("provider_id", providerId);
            await supabase.from("service_provider_permits").insert({ provider_id: providerId, permit_type: "Business Permit", file_url: newPermitUrl });
        }

        for (const url of newImgUrls) await supabase.from("service_provider_images").insert({ provider_id: providerId, image_url: url });
        for (const url of newPayUrls) await supabase.from("service_provider_payments").insert({ provider_id: providerId, method_type: "QR", file_url: url });

        const hoursPayload = [];
        businessInfo.operatingHours.forEach(slot => {
            slot.days.forEach(day => {
                hoursPayload.push({ provider_id: providerId, day_of_week: day, start_time: slot.startTime, end_time: slot.endTime });
            });
        });
        if (hoursPayload.length) await supabase.from("service_provider_hours").insert(hoursPayload);

        for (const emp of employees) {
            if (emp.fullName.trim()) {
                const staffPayload = { provider_id: providerId, full_name: emp.fullName, job_title: emp.position };
                if (emp.id) await supabase.from("service_provider_staff").update(staffPayload).eq("id", emp.id);
                else await supabase.from("service_provider_staff").insert(staffPayload);
            }
        }
        return { success: true };
    } catch (err) {
        return { success: false, message: err.message };
    }
  };

  const handleFinalSubmit = async () => {
    setSubmissionStatus('submitting');
    const result = await saveChangesToDB();
    if (result.success) setSubmissionStatus('success');
    else {
        setSubmissionStatus('error');
        setSubmissionError(result.message);
    }
  };

  if (loadingData) return <div className="sp-loading">Loading Profile...</div>;

  /* ================= VIEW 1: EDIT FORM ================= */
  if (step === 1) {
    return (
      <>
        <LoggedInNavbar />
        <div className="sp-edit-profile-container">
            <div className="header-row">
                <button className="back-link" onClick={() => navigate("/service/manage-listing")}>
                    <ArrowLeft size={16} /> Cancel & Exit
                </button>
                <h1>Edit Business Profile</h1>
            </div>

            <form className="edit-form" onSubmit={(e) => e.preventDefault()}>
                {/* Form content same as before, omitted for brevity since logic is identical to previous correct version */}
                <div className="form-section">
                    <h3>Basic Information</h3>
                    <div className="form-grid-2">
                        <div className="form-group"><label>Business Name</label><input name="businessName" value={businessInfo.businessName} onChange={handleInputChange} className={validationErrors.businessName ? 'error-input' : ''}/></div>
                        <div className="form-group"><label>Service Type</label><input value={businessInfo.typeOfService} disabled className="input-disabled"/></div>
                        <div className="form-group"><label>Email</label><input name="businessEmail" value={businessInfo.businessEmail} onChange={handleInputChange}/></div>
                        <div className="form-group"><label>Mobile</label><input name="businessMobile" value={businessInfo.businessMobile} onChange={handleInputChange}/></div>
                        <div className="form-group full-width"><label>Social Media</label><input name="socialMediaUrl" value={businessInfo.socialMediaUrl} onChange={handleInputChange}/></div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>Address</h3>
                    <div className="form-grid-2">
                        <div className="form-group"><label>Street</label><input name="houseStreet" value={businessInfo.houseStreet} onChange={handleInputChange}/></div>
                        <div className="form-group"><label>Barangay</label><input name="barangay" value={businessInfo.barangay} onChange={handleInputChange}/></div>
                        <div className="form-group"><label>City</label><input name="city" value={businessInfo.city} onChange={handleInputChange}/></div>
                        <div className="form-group"><label>Province</label><input name="province" value={businessInfo.province} onChange={handleInputChange}/></div>
                        <div className="form-group"><label>Postal Code</label><input name="postalCode" value={businessInfo.postalCode} onChange={handleInputChange}/></div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>Operating Hours</h3>
                    {businessInfo.operatingHours.map((slot, i) => (
                        <div key={slot.tempId} className="time-slot-row">
                            <div className="days-selector">
                                {daysOfWeekShort.map((d, idx) => (
                                    <button key={d} className={`day-pill ${slot.days.includes(daysOfWeekFull[idx]) ? 'active' : ''}`}
                                        onClick={() => toggleDay(i, daysOfWeekFull[idx])}>{d}</button>
                                ))}
                            </div>
                            <input type="time" value={slot.startTime} onChange={(e) => handleTimeChange(i, 'startTime', e.target.value)} />
                            <span>to</span>
                            <input type="time" value={slot.endTime} onChange={(e) => handleTimeChange(i, 'endTime', e.target.value)} />
                            <button className="btn-remove-slot" onClick={() => removeTimeSlot(i)}><Trash2 size={16}/></button>
                        </div>
                    ))}
                    <button className="btn-add-small" onClick={addTimeSlot}><Plus size={14}/> Add Slot</button>
                </div>

                <div className="form-section">
                    <h3>Employees</h3>
                    {employees.map((emp, i) => (
                        <div key={emp.tempId} className="emp-row">
                            <input placeholder="Full Name" value={emp.fullName} onChange={(e) => handleEmpChange(i, 'fullName', e.target.value)}/>
                            <select value={emp.position} onChange={(e) => handleEmpChange(i, 'position', e.target.value)}>
                                {positionOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                            <button className="btn-remove-slot" onClick={() => removeEmployee(i)}><Trash2 size={16}/></button>
                        </div>
                    ))}
                    <button className="btn-add-small" onClick={addEmployee}><Plus size={14}/> Add Employee</button>
                </div>

                <div className="form-section">
                    <h3>Documents</h3>
                    <div className="existing-files-list">
                        {existingFiles.waiverUrl && <div className="file-chip existing"><FileText size={14}/> Waiver <X size={14} className="del-x" onClick={() => markExistingDelete('waiver', null, existingFiles.waiverUrl)}/></div>}
                        {existingFiles.permit && <div className="file-chip existing"><FileText size={14}/> Permit <X size={14} className="del-x" onClick={() => markExistingDelete('permit', existingFiles.permit.id, existingFiles.permit.file_url)}/></div>}
                        {existingFiles.facilities.map(f => <div key={f.id} className="file-chip existing"><FileText size={14}/> Facility <X size={14} className="del-x" onClick={() => markExistingDelete('image', f.id, f.image_url)}/></div>)}
                        {existingFiles.payments.map(f => <div key={f.id} className="file-chip existing"><FileText size={14}/> QR <X size={14} className="del-x" onClick={() => markExistingDelete('payment', f.id, f.file_url)}/></div>)}
                    </div>
                    <div className="form-group"><label>New Waiver</label><input type="file" onChange={(e) => handleFileSelect('waiver', e, 2)}/></div>
                    <div className="form-group"><label>New Permit</label><input type="file" onChange={(e) => handleFileSelect('permit', e, 2)}/></div>
                    <div className="form-group"><label>Add Facility Images</label><input type="file" multiple onChange={(e) => handleMultiFileSelect('facilities', e, 2)}/></div>
                    <div className="form-group"><label>Add Payment QR</label><input type="file" multiple onChange={(e) => handleMultiFileSelect('payments', e, 2)}/></div>
                </div>

                <div className="action-footer">
                    <button className="btn-update-review" onClick={handleUpdateClick}>Update & Review</button>
                </div>
            </form>

            <SimpleAlertModal isOpen={alertModal.isOpen} onClose={() => setAlertModal({...alertModal, isOpen: false})} title={alertModal.title} message={alertModal.message} type={alertModal.type}/>
            
            <FinalConfirmationModal 
                isOpen={showFinalModal} 
                onClose={() => setShowFinalModal(false)} 
                onConfirm={handleFinalSubmit} 
                status={submissionStatus} 
                errorMessage={submissionError}
                onNavigateManage={() => navigate("/service/manage-listing")}
            />
        </div>
        <Footer />
      </>
    );
  }

  /* ================= VIEW 2: REVIEW ================= */
  return (
    <>
      <LoggedInNavbar />
      <div className="sp-edit-profile-container">
        <div className="header-row">
            <h1>Review Updates</h1>
        </div>

        <div className="review-card-container">
            <div className="review-section">
                <h2><MapPin size={20} /> Business Information</h2>
                <div className="review-grid">
                    <div className="review-item">
                        <label>Business Name</label>
                        <p>{businessInfo.businessName}</p>
                    </div>
                    <div className="review-item">
                        <label>Contact</label>
                        <p>{businessInfo.businessEmail} <br/> {businessInfo.businessMobile}</p>
                    </div>
                    <div className="review-item full">
                        <label>Address</label>
                        <p>{businessInfo.houseStreet}, {businessInfo.barangay}, {businessInfo.city}, {businessInfo.province}</p>
                    </div>
                </div>
            </div>

            <div className="review-section">
                <h2><Clock size={20} /> Operating Hours</h2>
                <div className="review-hours-list">
                    {businessInfo.operatingHours.map((slot, i) => (
                        <div key={i} className="review-hour-row">
                            <span className="review-days">{slot.days.join(", ")}</span>
                            <span className="review-time">{slot.startTime} - {slot.endTime}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="review-section">
                <h2><Users size={20} /> Employees</h2>
                <div className="review-staff-list">
                    {employees.map((emp) => (
                        <div key={emp.tempId} className="review-staff-chip">
                            <strong>{emp.fullName}</strong>
                            <span>{emp.position}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="review-section">
                <h2><FileCheck size={20} /> File Changes</h2>
                <div className="review-files-status">
                    {filesToDelete.length > 0 && (
                        <div className="file-status-row delete">
                            <Trash2 size={16} />
                            <span>Removing {filesToDelete.length} existing file(s)</span>
                        </div>
                    )}
                    {newFiles.waiver && <div className="file-status-row add"><Plus size={16}/> New Waiver</div>}
                    {newFiles.permit && <div className="file-status-row add"><Plus size={16}/> New Permit</div>}
                    {newFiles.facilities.length > 0 && <div className="file-status-row add"><Plus size={16}/> {newFiles.facilities.length} New Image(s)</div>}
                    {newFiles.payments.length > 0 && <div className="file-status-row add"><Plus size={16}/> {newFiles.payments.length} New Payment QR(s)</div>}
                    
                    {filesToDelete.length === 0 && !newFiles.waiver && !newFiles.permit && newFiles.facilities.length === 0 && newFiles.payments.length === 0 && (
                        <div className="file-status-row no-change">No changes to files</div>
                    )}
                </div>
            </div>
        </div>

        <div className="action-footer">
            <button className="btn-back-edit" onClick={() => setStep(1)}>Back to Edit</button>
            <button className="btn-final-submit" onClick={() => setShowFinalModal(true)}>Submit Updates</button>
        </div>

        <FinalConfirmationModal 
            isOpen={showFinalModal} 
            onClose={() => setShowFinalModal(false)} 
            onConfirm={handleFinalSubmit} 
            status={submissionStatus} 
            errorMessage={submissionError}
            onNavigateManage={() => navigate("/service/manage-listing")}
        />
      </div>
      <Footer />
    </>
  );
}