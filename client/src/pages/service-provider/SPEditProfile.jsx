// src/pages/service-provider/SPEditProfile.jsx
import React, { useEffect, useState, useRef } from "react";
// FIX: Removed 'File' from imports to prevent conflict with browser's File API
import { 
  X, Upload, FileText, CheckCircle, AlertCircle, 
  Trash2, Plus, ArrowLeft, AlertTriangle, MapPin, 
  Users, FileCheck, Eye, Image as ImageIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { supabase } from "../../config/supabase";
import "./SPEditProfile.css";

/* =========================================
   HELPER COMPONENTS
   ========================================= */

// 1. FILE PREVIEW MODAL
const FilePreviewModal = ({ isOpen, file, onClose }) => {
    if (!isOpen || !file) return null;

    const srcLower = typeof file.src === 'string' ? file.src.toLowerCase() : '';
    const isPdf = file.type === 'pdf' || srcLower.includes('.pdf') || (file.fileObj?.type === 'application/pdf');
    const isDoc = file.type === 'doc' || srcLower.match(/\.(doc|docx)$/) || (file.fileObj?.name?.match(/\.(doc|docx)$/));
    const isLocalBlob = srcLower.startsWith('blob:');

    const renderContent = () => {
        if (isPdf) {
            return <iframe src={file.src} className="lightbox-frame" title="PDF Preview" />;
        }
        if (isDoc) {
            if (isLocalBlob) {
                return (
                    <div className="lightbox-placeholder">
                        <FileText size={64} color="#9ca3af" />
                        <h3>Preview Unavailable</h3>
                        <p>Newly selected Word documents cannot be previewed until saved.</p>
                    </div>
                );
            }
            const encodedUrl = encodeURIComponent(file.src);
            return (
                <iframe 
                    src={`https://docs.google.com/gview?url=${encodedUrl}&embedded=true`} 
                    className="lightbox-frame" 
                    title="Document Preview"
                />
            );
        }
        return <img src={file.src} alt="Preview" className="lightbox-image" />;
    };

    return (
        <div className="lightbox-overlay" onClick={onClose}>
            <div className="lightbox-content" onClick={e => e.stopPropagation()}>
                <button className="lightbox-close" onClick={onClose}><X size={32}/></button>
                {renderContent()}
            </div>
        </div>
    );
};

// 2. GALLERY ITEM
const GalleryItem = ({ file, onDelete, onExpand }) => {
    let previewSrc = null;
    let fileName = "File";
    let isDoc = false; 
    let isPdf = false;
    let isWord = false;

    // Use native File check safe from shadowing
    if (file.url) {
        previewSrc = file.url; 
        fileName = "Existing Document";
        const lowerUrl = file.url.toLowerCase();
        if (lowerUrl.includes('.pdf')) { isDoc = true; isPdf = true; }
        else if (lowerUrl.match(/\.(doc|docx)$/)) { isDoc = true; isWord = true; }
    } else if (file instanceof window.File) { // Force use of window.File to be safe
        previewSrc = URL.createObjectURL(file);
        fileName = file.name;
        if (file.type === "application/pdf") { isDoc = true; isPdf = true; }
        else if (file.name.match(/\.(doc|docx)$/)) { isDoc = true; isWord = true; }
    }

    const handleExpand = () => {
        const type = isPdf ? 'pdf' : (isWord ? 'doc' : 'image');
        onExpand({ src: previewSrc, type: type, fileObj: file });
    };

    return (
        <div className={`file-preview-card ${isDoc ? 'doc-type' : ''}`} onClick={handleExpand}>
            <button className="btn-delete-file" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                <X size={14} />
            </button>
            {isDoc ? (
                <div className="doc-preview-container">
                    <FileText size={32} color="#6b7280"/>
                    <span className="doc-name">{fileName}</span>
                    <span style={{fontSize:'0.6rem', color:'#9ca3af', marginTop:'2px'}}>Click to Preview</span>
                </div>
            ) : (
                <img src={previewSrc} alt="preview" />
            )}
            <div className="preview-overlay">
                <div className="btn-expand"><Eye size={20}/></div>
            </div>
        </div>
    );
};

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

const GenericConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content final-confirm-modal">
                <div className="modal-header-center">
                    <AlertTriangle size={48} className="modal-icon-error" />
                    <h2>{title}</h2>
                </div>
                <div className="modal-body-center"><p>{message}</p></div>
                <div className="modal-footer-center">
                    <button className="btn-modal-cancel" onClick={onClose}>Cancel</button>
                    <button className="btn-modal-confirm" onClick={onConfirm}>Yes, Delete</button>
                </div>
            </div>
        </div>
    );
};

const FinalConfirmationModal = ({ isOpen, onClose, onConfirm, status, errorMessage, onNavigateManage }) => {
    if (!isOpen) return null;
    if (status === 'success') {
      return (
        <div className="modal-overlay">
          <div className="modal-content final-confirm-modal success">
            <div className="modal-header-center"><CheckCircle size={56} className="modal-icon-success" /><h2>Profile Updated!</h2></div>
            <div className="modal-body-center"><p>Your business information has been successfully updated.</p></div>
            <div className="modal-footer-center"><button className="btn-modal-dashboard" onClick={onNavigateManage}>Back to Manage Listing</button></div>
          </div>
        </div>
      );
    }
    if (status === 'error') {
      return (
        <div className="modal-overlay">
          <div className="modal-content final-confirm-modal error">
            <div className="modal-header-center"><AlertTriangle size={56} className="modal-icon-error" /><h2>Update Failed</h2></div>
            <div className="modal-body-center"><p>We encountered an issue saving your changes.</p><div className="error-box">{errorMessage}</div></div>
            <div className="modal-footer-center"><button className="btn-modal-cancel" onClick={onClose}>Back</button></div>
          </div>
        </div>
      );
    }
    return (
      <div className="modal-overlay">
        <div className="modal-content final-confirm-modal">
          <div className="modal-header-center"><CheckCircle size={48} className="modal-icon-brand" /><h2>Confirm Changes</h2></div>
          <div className="modal-body-center"><p>Are you sure you want to update your business profile?</p></div>
          <div className="modal-footer-center">
            <button className="btn-modal-cancel" onClick={onClose} disabled={status === 'submitting'}>Cancel</button>
            <button className="btn-modal-confirm" onClick={onConfirm} disabled={status === 'submitting'}>{status === 'submitting' ? "Saving..." : "Yes, Update Profile"}</button>
          </div>
        </div>
      </div>
    );
};

const ReviewChangesModal = ({ isOpen, onClose, onConfirm, data, files, employees, filesToDelete, existingFiles }) => {
    if (!isOpen) return null;

    const getFileName = (fileOrUrl) => {
        if (!fileOrUrl) return "None";
        // Safe check using window.File
        if (fileOrUrl instanceof window.File) return fileOrUrl.name;
        
        let url = typeof fileOrUrl === 'string' ? fileOrUrl : (fileOrUrl.file_url || fileOrUrl.image_url);
        if (!url) return "Existing File";
        
        try {
            const decoded = decodeURIComponent(url);
            const baseName = decoded.split('/').pop(); 
            return baseName.replace(/^\d+_/, ''); 
        } catch (e) {
            return "Existing File";
        }
    };

    const finalFacilities = [
        ...existingFiles.facilities.filter(f => !filesToDelete.some(d => d.id === f.id)).map(f => ({ name: getFileName(f), status: 'Existing' })),
        ...files.facilities.map(f => ({ name: f.name, status: 'New' }))
    ];

    const finalPayments = [
        ...existingFiles.payments.filter(f => !filesToDelete.some(d => d.id === f.id)).map(f => ({ name: getFileName(f), status: 'Existing' })),
        ...files.payments.map(f => ({ name: f.name, status: 'New' }))
    ];

    let waiverInfo = { name: "None", status: "" };
    if (files.waiver) {
        waiverInfo = { name: files.waiver.name, status: "New" };
    } else if (existingFiles.waiverUrl && !filesToDelete.some(f => f.url === existingFiles.waiverUrl)) {
        waiverInfo = { name: getFileName(existingFiles.waiverUrl), status: "Existing" };
    }

    let permitInfo = { name: "Missing", status: "" };
    if (files.permit) {
        permitInfo = { name: files.permit.name, status: "New" };
    } else if (existingFiles.permit && !filesToDelete.some(f => f.id === existingFiles.permit.id)) {
        permitInfo = { name: getFileName(existingFiles.permit), status: "Existing" };
    }

    return (
      <div className="modal-overlay">
        <div className="modal-content review-modal" style={{maxWidth: '600px'}}>
            <div className="modal-header">
                <h2>Review Updates</h2>
                <button onClick={onClose}><X size={20}/></button>
            </div>
            <div className="modal-scroll-body">
                <div className="review-grid">
                    
                    {/* BUSINESS INFO */}
                    <div className="review-group">
                        <h4><MapPin size={14}/> Business Information</h4>
                        <div className="review-row"><span className="review-label">Business Name:</span> <span className="review-value">{data.businessName}</span></div>
                        <div className="review-row"><span className="review-label">Email:</span> <span className="review-value">{data.businessEmail}</span></div>
                        <div className="review-row"><span className="review-label">Mobile:</span> <span className="review-value">{data.businessMobile}</span></div>
                        <div className="review-row" style={{display:'block'}}>
                            <span className="review-label">Description:</span>
                            <span className="review-value long-text">{data.description}</span>
                        </div>
                        <div className="review-row"><span className="review-label">Social Media:</span> <span className="review-value">{data.socialMediaUrl || "N/A"}</span></div>
                        <div className="review-row"><span className="review-label">Google Maps:</span> <span className="review-value">{data.googleMapUrl || "N/A"}</span></div>
                    </div>

                    {/* ADDRESS */}
                    <div className="review-group">
                        <h4><MapPin size={14}/> Location</h4>
                        <div className="review-row"><span className="review-label">Street/House:</span> <span className="review-value">{data.houseStreet}</span></div>
                        <div className="review-row"><span className="review-label">Barangay:</span> <span className="review-value">{data.barangay}</span></div>
                        <div className="review-row"><span className="review-label">City:</span> <span className="review-value">{data.city}</span></div>
                        <div className="review-row"><span className="review-label">Province:</span> <span className="review-value">{data.province}</span></div>
                        <div className="review-row"><span className="review-label">Postal Code:</span> <span className="review-value">{data.postalCode}</span></div>
                        <div className="review-row"><span className="review-label">Country:</span> <span className="review-value">{data.country}</span></div>
                    </div>

                    {/* EMPLOYEES */}
                    <div className="review-group">
                        <h4><Users size={14}/> Employees</h4>
                        <ul className="review-list">
                            {employees.map((e, idx) => (
                                <li key={e.tempId || idx}>
                                    <strong>{e.fullName}</strong> — <span style={{color:'var(--text-muted)'}}>{e.position}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* ATTACHMENTS */}
                    <div className="review-group">
                        <h4><FileCheck size={14}/> Attachments</h4>
                        <div className="review-row"><span className="review-label">Business Permit:</span></div>
                        <ul className="review-list">
                            <li><span className={`review-file-tag tag-${permitInfo.status.toLowerCase()}`}>{permitInfo.status}</span> {permitInfo.name}</li>
                        </ul>

                        <div className="review-row" style={{marginTop:'10px'}}><span className="review-label">Waiver:</span></div>
                        <ul className="review-list">
                            {waiverInfo.name !== "None" ? (
                                <li><span className={`review-file-tag tag-${waiverInfo.status.toLowerCase()}`}>{waiverInfo.status}</span> {waiverInfo.name}</li>
                            ) : (<li style={{fontStyle:'italic', color:'#9ca3af'}}>No waiver uploaded</li>)}
                        </ul>

                        <div className="review-row" style={{marginTop:'10px'}}><span className="review-label">Facilities ({finalFacilities.length}):</span></div>
                        <ul className="review-list">
                            {finalFacilities.map((f, i) => (
                                <li key={i}><span className={`review-file-tag tag-${f.status.toLowerCase()}`}>{f.status}</span> {f.name}</li>
                            ))}
                        </ul>

                        <div className="review-row" style={{marginTop:'10px'}}><span className="review-label">Payment QR ({finalPayments.length}):</span></div>
                        <ul className="review-list">
                            {finalPayments.map((f, i) => (
                                <li key={i}><span className={`review-file-tag tag-${f.status.toLowerCase()}`}>{f.status}</span> {f.name}</li>
                            ))}
                        </ul>
                    </div>
                </div>
                
                <div className="review-note" style={{marginTop:'1.5rem', textAlign:'center', fontSize:'0.85rem', color:'#6b7280'}}>
                    <AlertCircle size={14} style={{display:'inline', marginBottom:'-2px'}}/> Please double-check all details before submitting.
                </div>
            </div>

            <div className="modal-footer">
                <button className="btn-cancel" onClick={onClose}>Back to Edit</button>
                <button className="btn-confirm" onClick={onConfirm}>Confirm & Update</button>
            </div>
        </div>
      </div>
    );
};

/* =========================================
   MAIN COMPONENT
   ========================================= */
export default function SPEditProfile() {
  const navigate = useNavigate();
  const [loadingData, setLoadingData] = useState(true);
  const [providerId, setProviderId] = useState(null);
  
  const waiverRef = useRef(null);
  const permitRef = useRef(null);
  const facilitiesRef = useRef(null);
  const paymentRef = useRef(null);
  const [previewModal, setPreviewModal] = useState({ isOpen: false, file: null });

  const [businessInfo, setBusinessInfo] = useState({
    businessName: "", description: "", businessEmail: "", businessMobile: "", 
    socialMediaUrl: "", googleMapUrl: "", typeOfService: "", houseStreet: "", 
    barangay: "", city: "", province: "", postalCode: "", country: "Philippines",
    operatingHours: []
  });

  const [newFiles, setNewFiles] = useState({ waiver: null, permit: null, facilities: [], payments: [] });
  const [existingFiles, setExistingFiles] = useState({ waiverUrl: null, permit: null, facilities: [], payments: [] });
  const [filesToDelete, setFilesToDelete] = useState([]); 
  const [employees, setEmployees] = useState([]);
  const [deletedStaffIds, setDeletedStaffIds] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});
  
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState('idle');
  const [submissionError, setSubmissionError] = useState('');
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'error' });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const positionOptions = ["Business Owner", "Pet Stylist", "Staff"];

  // --- FETCH DATA ---
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
            if (hours && hours.length > 0) {
                const grouped = {};
                hours.forEach((h) => {
                    const key = `${h.start_time}-${h.end_time}`;
                    if (!grouped[key]) grouped[key] = { tempId: Math.random().toString(), days: [], startTime: h.start_time, endTime: h.end_time };
                    grouped[key].days.push(h.day_of_week);
                });
                groupedHours = Object.values(grouped);
            }

            setBusinessInfo({
                businessName: provider.business_name || "", description: provider.description || "",
                businessEmail: provider.business_email || "", businessMobile: provider.business_mobile || "",
                socialMediaUrl: provider.social_media_url || "", googleMapUrl: provider.google_map_url || "",
                typeOfService: provider.type_of_service || "", houseStreet: provider.house_street || "",
                barangay: provider.barangay || "", city: provider.city || "", province: provider.province || "",
                postalCode: provider.postal_code || "", country: provider.country || "Philippines",
                operatingHours: groupedHours.length > 0 ? groupedHours : [{ tempId: Date.now(), days: [], startTime: "09:00", endTime: "17:00" }]
            });

            setExistingFiles(prev => ({ ...prev, waiverUrl: provider.waiver_url }));
            const { data: imgs } = await supabase.from("service_provider_images").select("*").eq("provider_id", provider.id);
            if (imgs) setExistingFiles(prev => ({ ...prev, facilities: imgs }));
            const { data: pays } = await supabase.from("service_provider_payments").select("*").eq("provider_id", provider.id);
            if (pays) setExistingFiles(prev => ({ ...prev, payments: pays }));
            const { data: perms } = await supabase.from("service_provider_permits").select("*").eq("provider_id", provider.id);
            if (perms && perms.length > 0) setExistingFiles(prev => ({ ...prev, permit: perms[0] }));
            
            const { data: stf } = await supabase.from("service_provider_staff").select("*").eq("provider_id", provider.id);
            setEmployees(stf ? stf.map(s => ({ id: s.id, tempId: `stf_${s.id}`, fullName: s.full_name, position: s.job_title })) : [{ tempId: Date.now(), fullName: "", position: "" }]);
        }
      } catch (err) { console.error(err); } finally { setLoadingData(false); }
    };
    fetchData();
  }, [navigate]);

  const showAlert = (title, message) => setAlertModal({ isOpen: true, title, message, type: 'error' });
  const confirmDelete = (title, message, action) => setDeleteConfirmModal({ isOpen: true, title, message, onConfirm: () => { action(); setDeleteConfirmModal({isOpen:false}); } });
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "businessMobile" || name === "postalCode") {
        const nums = value.replace(/\D/g, "");
        if ((name === "businessMobile" && nums.length > 11) || (name === "postalCode" && nums.length > 4)) return;
        setBusinessInfo(prev => ({ ...prev, [name]: nums }));
    } else {
        if (name === "description" && value.length > 500) return;
        setBusinessInfo(prev => ({ ...prev, [name]: value }));
    }
  };

  const isDayDisabled = (slotIndex, day) => businessInfo.operatingHours.some((slot, i) => i !== slotIndex && slot.days.includes(day));
  const toggleDay = (slotIndex, day) => {
    if (isDayDisabled(slotIndex, day) && !businessInfo.operatingHours[slotIndex].days.includes(day)) return;
    setBusinessInfo(prev => ({ ...prev, operatingHours: prev.operatingHours.map((slot, i) => i === slotIndex ? { ...slot, days: slot.days.includes(day) ? slot.days.filter(d => d !== day) : [...slot.days, day] } : slot) }));
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
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (file.size > maxMB * 1024 * 1024) {
            setValidationErrors((prev) => ({ ...prev, [field]: `File size must not exceed ${maxMB}MB.` }));
            e.target.value = ""; return;
        }
        setValidationErrors((prev) => { const u = { ...prev }; delete u[field]; return u; });
        setNewFiles(prev => ({ ...prev, [field]: file }));
    }
  };

  const handleMultiFileSelect = (field, e, maxFiles, maxMB) => {
    if (e.target.files) {
        const files = Array.from(e.target.files);
        let existingCount = 0;
        if(field === 'facilities') existingCount = existingFiles.facilities.filter(f => !filesToDelete.some(d => d.id === f.id)).length;
        if(field === 'payments') existingCount = existingFiles.payments.filter(f => !filesToDelete.some(d => d.id === f.id)).length;
        
        if (existingCount + newFiles[field].length + files.length > maxFiles) {
             setValidationErrors((prev) => ({ ...prev, [field]: `Limit reached (${maxFiles} files).` }));
             e.target.value = ""; return;
        }
        setValidationErrors((prev) => { const u = { ...prev }; delete u[field]; return u; });
        setNewFiles(prev => ({ ...prev, [field]: [...prev[field], ...files] }));
        e.target.value = "";
    }
  };

  const markExistingDelete = (type, id, url) => confirmDelete("Delete File", "Remove this file?", () => setFilesToDelete(prev => [...prev, { type, id, url }]));
  const removeNewFile = (field, index) => {
      if (field === 'waiver' || field === 'permit') setNewFiles(prev => ({...prev, [field]: null}));
      else setNewFiles(prev => ({...prev, [field]: prev[field].filter((_, i) => i !== index)}));
  };

  const validate = () => {
    const errs = {};
    if (!businessInfo.businessName.trim()) errs.businessName = "Required";
    if (!businessInfo.description.trim()) errs.description = "Required";
    if (!businessInfo.businessEmail.trim()) errs.businessEmail = "Required";
    if (!/^09\d{9}$/.test(businessInfo.businessMobile)) errs.businessMobile = "Invalid PH Mobile";
    ["houseStreet", "barangay", "city", "province"].forEach(f => { if(!businessInfo[f]?.trim()) errs[f] = "Required"; });
    if (!/^\d{4}$/.test(businessInfo.postalCode)) errs.postalCode = "Invalid";
    if (!businessInfo.operatingHours.length) errs.operatingHours = "Required";
    if (!employees.length) errs.employees = "Required";
    employees.forEach((e, i) => { if(!e.fullName.trim() || !e.position.trim()) errs[`emp_${i}_name`] = "Incomplete"; });

    const hasExistingPermit = existingFiles.permit && !filesToDelete.some(d => d.type === 'permit');
    if (!hasExistingPermit && !newFiles.permit) errs.permit = "Required";

    const netImages = existingFiles.facilities.filter(f => !filesToDelete.some(d => d.id === f.id)).length + newFiles.facilities.length;
    if (netImages === 0) errs.facilities = "Required";
    const netPayments = existingFiles.payments.filter(f => !filesToDelete.some(d => d.id === f.id)).length + newFiles.payments.length;
    if (netPayments === 0) errs.payments = "Required";

    setValidationErrors(errs);
    if (Object.keys(errs).length) { showAlert("Errors Found", "Please check highlighted fields."); return false; }
    return true;
  };

  const handleUpdateClick = () => { if (validate()) setShowReviewModal(true); else window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleReviewConfirm = () => { setShowReviewModal(false); setShowFinalModal(true); };

  const uploadFile = async (userId, folder, file) => {
    const path = `${userId}/${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const { error } = await supabase.storage.from("service_provider_uploads").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("service_provider_uploads").getPublicUrl(path);
    return data.publicUrl;
  };
  const getFilePath = (url) => { try { const u = new URL(url); const m = u.pathname.match(/\/storage\/v1\/object\/public\/[^\/]+\/(.+)$/); return m ? decodeURIComponent(m[1]) : null; } catch { return null; } };

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
        if (deletedStaffIds.length) await supabase.from("service_provider_staff").delete().in("id", deletedStaffIds);
        await supabase.from("service_provider_hours").delete().eq("provider_id", providerId);

        const newWaiverUrl = newFiles.waiver ? await uploadFile(user.id, "waivers", newFiles.waiver) : null;
        const newPermitUrl = newFiles.permit ? await uploadFile(user.id, "permits", newFiles.permit) : null;
        const newImgUrls = []; for (const f of newFiles.facilities) newImgUrls.push(await uploadFile(user.id, "facilities", f));
        const newPayUrls = []; for (const f of newFiles.payments) newPayUrls.push(await uploadFile(user.id, "payments", f));

        const providerUpdates = {
            business_name: businessInfo.businessName, business_email: businessInfo.businessEmail,
            business_mobile: businessInfo.businessMobile, description: businessInfo.description,
            social_media_url: businessInfo.socialMediaUrl, google_map_url: businessInfo.googleMapUrl,
            house_street: businessInfo.houseStreet, barangay: businessInfo.barangay,
            city: businessInfo.city, province: businessInfo.province, postal_code: businessInfo.postalCode,
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
        businessInfo.operatingHours.forEach(s => s.days.forEach(d => hoursPayload.push({ provider_id: providerId, day_of_week: d, start_time: s.startTime, end_time: s.endTime })));
        if (hoursPayload.length) await supabase.from("service_provider_hours").insert(hoursPayload);

        for (const emp of employees) {
            if (emp.fullName.trim()) {
                const p = { provider_id: providerId, full_name: emp.fullName, job_title: emp.position };
                if (emp.id && !emp.id.toString().startsWith("new_")) await supabase.from("service_provider_staff").update(p).eq("id", emp.id);
                else await supabase.from("service_provider_staff").insert(p);
            }
        }
        return { success: true };
    } catch (err) { console.error(err); return { success: false, message: err.message }; }
  };

  const handleFinalSubmit = async () => {
    setSubmissionStatus('submitting');
    const result = await saveChangesToDB();
    if (result.success) setSubmissionStatus('success');
    else { setSubmissionStatus('error'); setSubmissionError(result.message); }
  };

  if (loadingData) return <div className="sp-loading">Loading...</div>;

  return (
    <>
      <LoggedInNavbar />
      <div className="sp-edit-profile-container">
          <div className="header-row">
              <button className="back-link" onClick={() => navigate("/service/manage-listing")}><ArrowLeft size={16} /></button>
              <h1>Edit Business Profile</h1>
          </div>

          <form className="edit-form" onSubmit={(e) => e.preventDefault()}>
              <div className="form-section">
                  <h3><FileText size={18}/> Basic Information</h3>
                  <div className="form-grid-2">
                      <div className="form-group"><label>Business Name *</label><input name="businessName" value={businessInfo.businessName} onChange={handleInputChange} className={validationErrors.businessName ? 'error-input' : ''}/></div>
                      <div className="form-group"><label>Service Type</label><input value={businessInfo.typeOfService} disabled className="input-disabled"/></div>
                      <div className="form-group full-width"><label>Description *</label><textarea name="description" value={businessInfo.description} onChange={handleInputChange} rows={4} className={validationErrors.description ? 'error-input' : ''}/></div>
                      <div className="form-group"><label>Email *</label><input name="businessEmail" value={businessInfo.businessEmail} onChange={handleInputChange} className={validationErrors.businessEmail ? 'error-input' : ''}/></div>
                      <div className="form-group"><label>Mobile *</label><input name="businessMobile" value={businessInfo.businessMobile} onChange={handleInputChange} className={validationErrors.businessMobile ? 'error-input' : ''}/></div>
                      <div className="form-group"><label>Social Media URL</label><input name="socialMediaUrl" value={businessInfo.socialMediaUrl} onChange={handleInputChange}/></div>
                      <div className="form-group"><label>Google Map URL</label><input name="googleMapUrl" value={businessInfo.googleMapUrl} onChange={handleInputChange}/></div>
                  </div>
              </div>

              <div className="form-section">
                  <h3><MapPin size={18}/> Address</h3>
                  <div className="form-grid-2">
                      <div className="form-group"><label>Street *</label><input name="houseStreet" value={businessInfo.houseStreet} onChange={handleInputChange} className={validationErrors.houseStreet ? 'error-input' : ''}/></div>
                      <div className="form-group"><label>Barangay *</label><input name="barangay" value={businessInfo.barangay} onChange={handleInputChange} className={validationErrors.barangay ? 'error-input' : ''}/></div>
                      <div className="form-group"><label>City *</label><input name="city" value={businessInfo.city} onChange={handleInputChange} className={validationErrors.city ? 'error-input' : ''}/></div>
                      <div className="form-group"><label>Province *</label><input name="province" value={businessInfo.province} onChange={handleInputChange} className={validationErrors.province ? 'error-input' : ''}/></div>
                      <div className="form-group"><label>Postal Code *</label><input name="postalCode" value={businessInfo.postalCode} onChange={handleInputChange} className={validationErrors.postalCode ? 'error-input' : ''}/></div>
                      <div className="form-group"><label>Country</label><input value="Philippines" disabled className="input-disabled"/></div>
                  </div>
              </div>

              <div className="form-section">
                  <h3><Users size={18}/> Staff</h3>
                  {employees.map((emp, i) => (
                      <div key={emp.tempId} className="emp-row">
                          <input placeholder="Full Name" value={emp.fullName} onChange={(e) => handleEmpChange(i, 'fullName', e.target.value)} className={validationErrors[`emp_${i}_name`] ? 'error-input' : ''}/>
                          <select value={emp.position} onChange={(e) => handleEmpChange(i, 'position', e.target.value)} className={validationErrors[`emp_${i}_pos`] ? 'error-input' : ''}>
                              <option value="">Select Position...</option>
                              {positionOptions.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <button className="btn-remove-slot" onClick={() => removeEmployee(i)}><Trash2 size={16}/></button>
                      </div>
                  ))}
                  <button className="btn-add-small" onClick={addEmployee}><Plus size={14}/> Add Staff</button>
              </div>

              <div className="form-section">
                <h3><FileCheck size={18}/> Documents & Images</h3>
                
                {/* 1. WAIVER SECTION */}
                <div className="file-gallery-container">
                    <span className="gallery-label">Waiver (PDF, Doc, or Image)</span>
                    <div className="gallery-grid">
                        {existingFiles.waiverUrl && !filesToDelete.some(f => f.url === existingFiles.waiverUrl) && (
                            <GalleryItem file={{url: existingFiles.waiverUrl}} onDelete={()=>markExistingDelete('waiver', null, existingFiles.waiverUrl)} onExpand={(file)=>setPreviewModal({isOpen:true, file})}/>
                        )}
                        {newFiles.waiver && (
                            <GalleryItem file={newFiles.waiver} onDelete={()=>removeNewFile('waiver')} onExpand={(file)=>setPreviewModal({isOpen:true, file})}/>
                        )}
                        {(!newFiles.waiver && (!existingFiles.waiverUrl || filesToDelete.some(f => f.url === existingFiles.waiverUrl))) && (
                            <div className="upload-btn-card" onClick={() => waiverRef.current.click()}>
                                <Upload size={24}/><span>Upload Waiver</span>
                                <input type="file" ref={waiverRef} className="hidden-input" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => handleFileSelect('waiver', e, 5)}/>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. PERMIT SECTION */}
                <div className="file-gallery-container">
                    <span className="gallery-label">Business Permit * (PDF, Doc, or Image)</span>
                    <div className="gallery-grid">
                        {existingFiles.permit && !filesToDelete.some(f => f.id === existingFiles.permit.id) && (
                            <GalleryItem file={{url: existingFiles.permit.file_url}} onDelete={()=>markExistingDelete('permit', existingFiles.permit.id, existingFiles.permit.file_url)} onExpand={(file)=>setPreviewModal({isOpen:true, file})}/>
                        )}
                        {newFiles.permit && (
                            <GalleryItem file={newFiles.permit} onDelete={()=>removeNewFile('permit')} onExpand={(file)=>setPreviewModal({isOpen:true, file})}/>
                        )}
                        {(!newFiles.permit && (!existingFiles.permit || filesToDelete.some(f => f.id === existingFiles.permit.id))) && (
                            <div className="upload-btn-card" onClick={() => permitRef.current.click()}>
                                <Upload size={24}/><span>Upload Permit</span>
                                <input type="file" ref={permitRef} className="hidden-input" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => handleFileSelect('permit', e, 5)}/>
                            </div>
                        )}
                    </div>
                    {validationErrors.permit && <small className="error-text">{validationErrors.permit}</small>}
                </div>

                {/* 3. FACILITIES */}
                <div className="file-gallery-container">
                    <span className="gallery-label">Facility Images</span>
                    <div className="gallery-grid">
                        {existingFiles.facilities.filter(f => !filesToDelete.some(d => d.id === f.id)).map(f => (
                            <GalleryItem key={f.id} file={{url: f.image_url}} onDelete={()=>markExistingDelete('image', f.id, f.image_url)} onExpand={(file)=>setPreviewModal({isOpen:true, file})}/>
                        ))}
                        {newFiles.facilities.map((f, i) => (
                            <GalleryItem key={i} file={f} onDelete={()=>removeNewFile('facilities', i)} onExpand={(file)=>setPreviewModal({isOpen:true, file})}/>
                        ))}
                        <div className="upload-btn-card" onClick={() => facilitiesRef.current.click()}>
                            <ImageIcon size={24}/><span>Add Photos</span>
                            <input type="file" ref={facilitiesRef} className="hidden-input" accept=".jpg,.jpeg,.png" multiple onChange={(e) => handleMultiFileSelect('facilities', e, 3, 2)}/>
                        </div>
                    </div>
                    {validationErrors.facilities && <small className="error-text">{validationErrors.facilities}</small>}
                </div>

                {/* 4. PAYMENTS */}
                <div className="file-gallery-container">
                    <span className="gallery-label">Payment QR Codes</span>
                    <div className="gallery-grid">
                        {existingFiles.payments.filter(f => !filesToDelete.some(d => d.id === f.id)).map(f => (
                            <GalleryItem key={f.id} file={{url: f.file_url}} onDelete={()=>markExistingDelete('payment', f.id, f.file_url)} onExpand={(file)=>setPreviewModal({isOpen:true, file})}/>
                        ))}
                        {newFiles.payments.map((f, i) => (
                            <GalleryItem key={i} file={f} onDelete={()=>removeNewFile('payments', i)} onExpand={(file)=>setPreviewModal({isOpen:true, file})}/>
                        ))}
                        <div className="upload-btn-card" onClick={() => paymentRef.current.click()}>
                            <ImageIcon size={24}/><span>Add QR</span>
                            <input type="file" ref={paymentRef} className="hidden-input" accept=".jpg,.jpeg,.png" multiple onChange={(e) => handleMultiFileSelect('payments', e, 3, 2)}/>
                        </div>
                    </div>
                    {validationErrors.payments && <small className="error-text">{validationErrors.payments}</small>}
                </div>
              </div>

              <div className="action-footer">
                  <button className="btn-update-review" onClick={handleUpdateClick}>Update</button>
              </div>
          </form>

          {/* MODALS */}
          <FilePreviewModal isOpen={previewModal.isOpen} file={previewModal.file} onClose={() => setPreviewModal({isOpen:false, file:null})} />
          <SimpleAlertModal isOpen={alertModal.isOpen} onClose={() => setAlertModal({...alertModal, isOpen: false})} title={alertModal.title} message={alertModal.message} type={alertModal.type}/>
          <GenericConfirmModal isOpen={deleteConfirmModal.isOpen} onClose={() => setDeleteConfirmModal({...deleteConfirmModal, isOpen: false})} onConfirm={deleteConfirmModal.onConfirm} title={deleteConfirmModal.title} message={deleteConfirmModal.message}/>
          <ReviewChangesModal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} onConfirm={handleReviewConfirm} data={businessInfo} files={newFiles} employees={employees} filesToDelete={filesToDelete} existingFiles={existingFiles}/>
          <FinalConfirmationModal isOpen={showFinalModal} onClose={() => setShowFinalModal(false)} onConfirm={handleFinalSubmit} status={submissionStatus} errorMessage={submissionError} onNavigateManage={() => navigate("/service/manage-listing")}/>
      </div>
      <Footer />
    </>
  );
}