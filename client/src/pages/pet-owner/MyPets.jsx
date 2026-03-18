import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { 
  Plus, Trash2, Edit2, PawPrint, Calendar, Dog, Cat, 
  ArrowLeft, UploadCloud, X, CheckCircle, AlertCircle,
  Clock, ChevronRight, ClipboardList
} from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./MyPets.css";

const BEHAVIOR_OPTIONS = [
  "Friendly / Social", "Aggressive / Reactive", 
  "Anxious / Nervous", "High Energy", "House Trained"
];

// --- SUMMARY MODAL COMPONENT ---
const PetSummaryModal = ({ isOpen, onClose, onConfirm, data, previews, loading }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content summary-modal">
        <div className="modal-header">
          <h2>Confirm Registration</h2>
          <button className="close-x" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body summary-grid-layout">
          <div className="summary-box top-left">
            <div className="info-item-row"><label>Name:</label> <span>{data.name}</span></div>
            <div className="info-item-row"><label>Type:</label> <span>{data.pet_type}</span></div>
            <div className="info-item-row"><label>Breed:</label> <span>{data.breed}</span></div>
            <div className="behavior-summary-box">
              <label>Behavior:</label>
              <div className="mini-tag-container">
                {data.behavior.length > 0 ? data.behavior.map(b => (
                  <span key={b} className="summary-tag">{b}</span>
                )) : <span>None</span>}
              </div>
            </div>
          </div>
          <div className="summary-box top-right">
            <div className="info-item-row"><label>Sex:</label> <span>{data.gender}</span></div>
            <div className="info-item-row"><label>DOB:</label> <span>{new Date(data.birth_date).toLocaleDateString()}</span></div>
            <div className="info-item-row"><label>Weight:</label> <span>{data.weight_kg} kg</span></div>
            <div className="grooming-summary-box">
              <label>Grooming Notes:</label>
              <p>{data.grooming_specifications || "No specific instructions provided."}</p>
            </div>
          </div>
          <div className="summary-box bottom-left">
            <h4>Vaccine Record</h4>
            <div className="summary-image-container">
              <img src={previews.vaccine} alt="Vaccine Record" />
            </div>
          </div>
          <div className="summary-box bottom-right">
            <h4>Illness Record</h4>
            <div className="summary-image-container">
              {previews.illness ? (
                <img src={previews.illness} alt="Illness Record" />
              ) : (
                <div className="no-data-placeholder">No illness record attached</div>
              )}
            </div>
          </div>
        </div>
        <div className="emergency-consent-footer">
          <CheckCircle size={14} color={data.emergency_consent ? "#10b981" : "#94a3b8"} />
          <span>Emergency Transport: {data.emergency_consent ? "Authorized" : "Not Authorized"}</span>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn-confirm" onClick={onConfirm} disabled={loading}>
            {loading ? "Saving..." : "Confirm & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- SUCCESS MODAL COMPONENT ---
const SuccessModal = ({ isOpen, onClose, message }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content status-modal">
        <div className="success-icon-wrapper">
          <CheckCircle size={60} color="#10b981" />
        </div>
        <h2>Success!</h2>
        <p>{message}</p>
        <button className="btn-confirm" onClick={onClose}>Great!</button>
      </div>
    </div>
  );
};

// --- DELETE CONFIRMATION MODAL ---
const DeleteConfirmModal = ({ isOpen, petName, onCancel, onConfirm, loading }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content status-modal delete-confirm-modal">
        <div className="delete-icon-wrapper">
          <AlertCircle size={60} color="#ef4444" />
        </div>
        <h2>Remove Pet Profile?</h2>
        <p>
          Are you sure you want to permanently remove <strong>{petName}</strong>'s profile? 
          This action cannot be undone.
        </p>
        <div className="modal-footer-row">
          <button className="btn-cancel" onClick={onCancel} disabled={loading}>Keep Pet</button>
          <button className="btn-delete-confirm" onClick={onConfirm} disabled={loading}>
            {loading ? "Removing..." : "Yes, Remove"}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- DELETE SUCCESS MODAL ---
const DeleteSuccessModal = ({ isOpen, onClose, petName }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content status-modal">
        <div className="success-icon-wrapper">
          <CheckCircle size={60} color="#10b981" />
        </div>
        <h2>Profile Removed</h2>
        <p><strong>{petName}</strong>'s profile has been permanently deleted.</p>
        <button className="btn-confirm" onClick={onClose}>Done</button>
      </div>
    </div>
  );
};

// --- PET BOOKING HISTORY VIEW ---
const PetBookingHistoryView = ({ pet, onBack }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); // Add this to handle redirection

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("bookings")
          .select(`
            id,
            booking_date,
            time_slot,
            status,
            service_providers ( business_name ),
            booking_pets!inner (
              id,
              registered_pet_id,
              booking_services (
                service_name,
                price
              )
            )
          `)
          .eq("booking_pets.registered_pet_id", pet.id)
          .order("booking_date", { ascending: false });

        if (error) throw error;

        // ⭐ Calculation Logic: Sum only the services for THIS specific pet
        const formattedData = (data || []).map(b => {
          const petEntry = b.booking_pets.find(bp => bp.registered_pet_id === pet.id);
          const petServices = petEntry?.booking_services || [];
          const petTotal = petServices.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);

          return {
            ...b,
            petSpecificServices: petServices,
            petSpecificTotal: petTotal
          };
        });

        setBookings(formattedData);
      } catch (err) {
        console.error("Failed to fetch bookings:", err.message);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [pet.id]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: 'short', year: "numeric", month: "short", day: "numeric"
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(':');
    const hr = parseInt(h);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    return `${hr % 12 || 12}:${m} ${ampm}`;
  };

  const getStatusClass = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "completed") return "status-completed";
    if (s === "confirmed" || s === "paid") return "status-confirmed";
    if (s === "cancelled" || s === "rejected" || s === "void") return "status-cancelled";
    return "status-pending";
  };

  return (
    <div className="booking-history-wrapper">
      <button className="btn-back-text" onClick={onBack}>
        <ArrowLeft size={16} /> Back to My Pets
      </button>

      <div className="booking-history-header">
        <div className="booking-pet-avatar">
          {pet.pet_type === "Dog" ? <Dog size={32} color="#0E2679" /> : <Cat size={32} color="#0E2679" />}
        </div>
        <div>
          <h2>{pet.name}'s History</h2>
          <p className="subtitle">{pet.breed} · {pet.gender}</p>
        </div>
      </div>

      {loading ? (
        <div className="bookings-loading">
          <div className="loading-spinner" />
          <p>Retrieving past visits...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty-bookings-container">
          <ClipboardList size={72} strokeWidth={1} style={{ opacity: 0.2, marginBottom: "1rem" }} />
          <h3>No records found</h3>
          <p>Once {pet.name} visits a service provider, the history will appear here.</p>
        </div>
      ) : (
        <div className="bookings-list">
          {bookings.map((booking) => (
            <div 
              key={booking.id} 
              className="history-card clickable-history-card"
              onClick={() => navigate("/booking-history")} 
              title="Click to view full booking details"
            >
              <div className="history-card-top">
                <div className={`status-pill ${getStatusClass(booking.status)}`}>
                  {booking.status?.toUpperCase() || "PENDING"}
                </div>
                <div className="history-time-meta">
                  <Calendar size={14} /> <span>{formatDate(booking.booking_date)}</span>
                  <Clock size={14} style={{ marginLeft: '12px' }} /> <span>{formatTime(booking.time_slot)}</span>
                </div>
              </div>

              <div className="history-card-main">
                <div className="provider-info-block">
                  <label>Service Provider</label>
                  <h4>{booking.service_providers?.business_name || "FurLink Partner"}</h4>
                </div>

                <div className="services-info-block">
                  <label>Services Availed</label>
                  <div className="history-tags-container">
                    {booking.petSpecificServices.map((s, idx) => (
                      <span key={idx} className="history-service-tag">{s.service_name}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="history-card-footer">
                <span className="total-label">Pet Service Total:</span>
                <span className="total-value">₱{booking.petSpecificTotal.toFixed(2)}</span>
                <div className="view-details-hint">
                   <span>View Details</span> <ChevronRight size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- HELPER: compare two form states to detect real changes ---
const hasFormChanged = (original, current, vaccineFile, illnessFile) => {
  if (vaccineFile || illnessFile) return true;
  const fields = [
    "name", "pet_type", "breed", "gender", "birth_date",
    "weight_kg", "grooming_specifications", "emergency_consent"
  ];
  for (const field of fields) {
    if (String(original[field] ?? "") !== String(current[field] ?? "")) return true;
  }
  // Compare behavior arrays
  const origBehavior = Array.isArray(original.behavior)
    ? original.behavior.slice().sort().join(",")
    : (original.behavior || "").split(", ").sort().join(",");
  const currBehavior = current.behavior.slice().sort().join(",");
  if (origBehavior !== currBehavior) return true;
  return false;
};

const MyPets = () => {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPetId, setEditingPetId] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Delete modal states
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, name }
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [deletedPetName, setDeletedPetName] = useState("");

  // Booking history view
  const [selectedPet, setSelectedPet] = useState(null);

  // Tracks the original snapshot of a pet being edited
  const [originalFormData, setOriginalFormData] = useState(null);

  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [validationBreeds, setValidationBreeds] = useState({ Dog: [], Cat: [] });

  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    name: "", pet_type: "Dog", breed: "", gender: "Male",
    birth_date: "", weight_kg: "", behavior: [], 
    grooming_specifications: "", emergency_consent: false,
    vaccine_card_url: "", illness_proof_url: ""
  });

  const [vaccineFile, setVaccineFile] = useState(null);
  const [illnessFile, setIllnessFile] = useState(null);
  const [previews, setPreviews] = useState({ vaccine: null, illness: null });

  useEffect(() => {
    const fetchBreeds = async () => {
      try {
        const fullLists = { 
          Dog: ["Mixed Breed", "Unknown", "Aspin", "Askal"], 
          Cat: ["Mixed Breed", "Unknown", "Puspin", "Pusakal"] 
        };
        const [dogRes, catRes] = await Promise.all([
          fetch('https://dog.ceo/api/breeds/list/all'),
          fetch('https://api.thecatapi.com/v1/breeds')
        ]);
        if (dogRes.ok) {
          const dogData = await dogRes.json();
          const dogs = Object.keys(dogData.message).map(b => b.charAt(0).toUpperCase() + b.slice(1));
          fullLists.Dog = [...new Set([...fullLists.Dog, ...dogs])];
        }
        if (catRes.ok) {
          const catData = await catRes.json();
          const cats = catData.map(c => c.name);
          fullLists.Cat = [...new Set([...fullLists.Cat, ...cats])];
        }
        setValidationBreeds(fullLists);
      } catch (error) { 
        console.error("Breed API error:", error); 
      }
    };
    fetchBreeds();
    fetchPets();
  }, []);

  const getFilteredBreeds = () => {
    const list = validationBreeds[formData.pet_type] || [];
    if (!formData.breed) return list.slice(0, 20);
    return list
      .filter(b => b.toLowerCase().includes(formData.breed.toLowerCase()))
      .slice(0, 15);
  };

  const isValidBreed = (breedInput, type) => {
    if (!breedInput || !breedInput.trim()) return false;
    const list = validationBreeds[type];
    if (!list || list.length === 0) return true;
    return list.some(b => b.toLowerCase() === breedInput.trim().toLowerCase());
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert("Only JPG or PNG images are allowed.");
      return;
    }
    if (file.size > 1048576) {
      alert("File size exceeds 1MB limit.");
      return;
    }
    if (type === "vaccine") {
      setVaccineFile(file);
      setPreviews(prev => ({ ...prev, vaccine: URL.createObjectURL(file) }));
    } else {
      setIllnessFile(file);
      setPreviews(prev => ({ ...prev, illness: URL.createObjectURL(file) }));
    }
  };

  const uploadToBucket = async (file, ownerId, petName, folder) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${petName}_${folder}_${Date.now()}.${fileExt}`;
    const filePath = `${ownerId}/${fileName}`;
    const { error } = await supabase.storage.from("pet_documents").upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("pet_documents").getPublicUrl(filePath);
    return publicUrl;
  };

  const fetchPets = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("registered_pets")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPets(data || []);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSummary = (e) => {
    e.preventDefault();
    setAttemptedSubmit(true);

    const isBreedValid = isValidBreed(formData.breed, formData.pet_type);
    const hasVaccine = vaccineFile || formData.vaccine_card_url;
    const hasName = formData.name.trim() !== "";
    const hasWeight = formData.weight_kg !== "" && parseFloat(formData.weight_kg) > 0;
    const hasDOB = formData.birth_date !== "";
    const hasBehavior = formData.behavior.length > 0;

    if (!isBreedValid || !hasVaccine || !hasName || !hasWeight || !hasDOB || !hasBehavior) {
      return; 
    }

    setShowSummary(true);
  };

  const handleConfirmSubmit = async () => {
    // If editing, check if anything actually changed
    if (editingPetId && originalFormData) {
      const changed = hasFormChanged(originalFormData, formData, vaccineFile, illnessFile);
      if (!changed) {
        setShowSummary(false);
        return; // Nothing changed — don't show success modal
      }
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let vaccineUrl = formData.vaccine_card_url;
      let illnessUrl = formData.illness_proof_url;

      if (vaccineFile) vaccineUrl = await uploadToBucket(vaccineFile, user.id, formData.name, "vaccine");
      if (illnessFile) illnessUrl = await uploadToBucket(illnessFile, user.id, formData.name, "illness");

      const payload = { 
        owner_id: user.id,
        name: formData.name,
        pet_type: formData.pet_type,
        breed: formData.breed,
        gender: formData.gender,
        birth_date: formData.birth_date,
        weight_kg: parseFloat(formData.weight_kg),
        behavior: formData.behavior.join(", "),
        vaccine_card_url: vaccineUrl,
        illness_proof_url: illnessUrl,
        grooming_specifications: formData.grooming_specifications,
        emergency_consent: formData.emergency_consent
      };

      let result;
      if (editingPetId) {
        result = await supabase.from("registered_pets").update(payload).eq("id", editingPetId);
      } else {
        result = await supabase.from("registered_pets").insert([payload]);
      }

      if (result.error) throw result.error;
      
      setShowSummary(false);
      setShowForm(false);
      resetForm();
      fetchPets();
      setSuccessMessage(editingPetId ? "Pet profile updated successfully!" : "Pet successfully added to your records!");
      setShowSuccess(true);
    } catch (err) {
      console.error("Save Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleBehavior = (opt) => {
    setFormData(prev => ({
      ...prev,
      behavior: prev.behavior.includes(opt) ? prev.behavior.filter(i => i !== opt) : [...prev.behavior, opt]
    }));
  };

  const resetForm = () => {
    setFormData({ name: "", pet_type: "Dog", breed: "", gender: "Male", birth_date: "", weight_kg: "", behavior: [], grooming_specifications: "", emergency_consent: false, vaccine_card_url: "", illness_proof_url: "" });
    setVaccineFile(null); setIllnessFile(null);
    setPreviews({ vaccine: null, illness: null });
    setEditingPetId(null);
    setAttemptedSubmit(false);
    setOriginalFormData(null);
  };

  const openEdit = (pet) => {
    const behaviorArray = pet.behavior ? pet.behavior.split(", ") : [];
    const fd = { ...pet, behavior: behaviorArray };
    setFormData(fd);
    setOriginalFormData({ ...pet, behavior: behaviorArray }); // snapshot for comparison
    setEditingPetId(pet.id);
    setPreviews({ vaccine: pet.vaccine_card_url, illness: pet.illness_proof_url });
    setShowForm(true);
  };

  const removeFile = (type) => {
    if (type === "vaccine") {
      setVaccineFile(null);
      setPreviews(prev => ({ ...prev, vaccine: null }));
      setFormData(prev => ({ ...prev, vaccine_card_url: "" }));
    } else {
      setIllnessFile(null);
      setPreviews(prev => ({ ...prev, illness: null }));
      setFormData(prev => ({ ...prev, illness_proof_url: "" }));
    }
  };

  // Open delete confirmation modal instead of window.confirm
  const handleDeleteClick = (e, pet) => {
    e.stopPropagation(); // prevent card click from triggering
    setDeleteTarget({ id: pet.id, name: pet.name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("registered_pets").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      setDeletedPetName(deleteTarget.name);
      setDeleteTarget(null);
      setShowDeleteSuccess(true);
      fetchPets();
    } catch (err) {
      console.error("Delete error:", err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEditClick = (e, pet) => {
    e.stopPropagation(); // prevent card click from opening booking history
    openEdit(pet);
  };

  const handleCardClick = (pet) => {
    setSelectedPet(pet);
  };

  // --- Booking History View ---
  if (selectedPet) {
    return (
      <div className="my-pets-page">
        <Header />
        <main className="pets-main-container">
          <PetBookingHistoryView pet={selectedPet} onBack={() => setSelectedPet(null)} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="my-pets-page">
      <Header />
      <main className="pets-main-container">
        <div className="pets-header-section">
          <div>
            <h1>{showForm ? (editingPetId ? "Update Profile" : "Register New Pet") : "My Registered Pets"}</h1>
            <p className="subtitle">Manage your pets' permanent records here.</p>
          </div>
          {!showForm && pets.length > 0 && (
            <button className="btn-primary-add" onClick={() => setShowForm(true)}>
              <Plus size={20} /> Add Pet
            </button>
          )}
        </div>

        {showForm ? (
          <div className="pet-form-wrapper">
            <button className="btn-back-text" onClick={() => { setShowForm(false); resetForm(); }}>
              <ArrowLeft size={16} /> Back to List
            </button>
            <form className="registration-form-grid" onSubmit={handleOpenSummary}>
  
              <div className={`form-group ${attemptedSubmit && !formData.name.trim() ? 'field-error' : ''}`}>
                <label>Pet Name <span className="required-star">*</span></label>
                <input 
                  required 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="Buddy" 
                />
              </div>

              <div className="form-row-dense">
                <div className="form-group">
                  <label>Type <span className="required-star">*</span></label>
                  <select value={formData.pet_type} onChange={e => setFormData({...formData, pet_type: e.target.value, breed: ""})}>
                    <option value="Dog">Dog</option>
                    <option value="Cat">Cat</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Gender <span className="required-star">*</span></label>
                  <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className={`form-group ${attemptedSubmit && !formData.birth_date ? 'field-error' : ''}`}>
                  <label>Date of Birth <span className="required-star">*</span></label>
                  <input 
                    type="date" 
                    required 
                    max={today} 
                    value={formData.birth_date} 
                    onChange={e => setFormData({...formData, birth_date: e.target.value})} 
                  />
                </div>
                <div className={`form-group ${attemptedSubmit && (!formData.weight_kg || parseFloat(formData.weight_kg) <= 0) ? 'field-error' : ''}`}>
                  <label>Weight (kg) <span className="required-star">*</span></label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    required 
                    value={formData.weight_kg} 
                    onChange={e => setFormData({...formData, weight_kg: e.target.value})} 
                    placeholder="0.00" 
                  />
                </div>
              </div>

              <div className={`form-group ${attemptedSubmit && !isValidBreed(formData.breed, formData.pet_type) ? 'field-error' : ''}`}>
                <label>Breed <span className="required-star">*</span></label>
                <input 
                  list="breed-suggestions"
                  required 
                  value={formData.breed} 
                  onChange={e => setFormData({...formData, breed: e.target.value})} 
                  placeholder="Type to search breed..." 
                />
                <datalist id="breed-suggestions">
                  {getFilteredBreeds().map((breed, i) => (
                    <option key={i} value={breed} />
                  ))}
                </datalist>
              </div>

              <div className={`form-group ${attemptedSubmit && formData.behavior.length === 0 ? 'field-error' : ''}`}>
                <label>Pet Behavior <span className="required-star">*</span></label>
                <div className="behavior-grid">
                  {BEHAVIOR_OPTIONS.map(opt => (
                    <button 
                      type="button" 
                      key={opt} 
                      className={`behavior-tag ${formData.behavior.includes(opt) ? 'active' : ''}`} 
                      onClick={() => toggleBehavior(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {attemptedSubmit && formData.behavior.length === 0 && (
                  <span className="error-hint" style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    Please select at least one behavior trait.
                  </span>
                )}
              </div>

              <div className="upload-section">
                <div className="form-group">
                  <label>Vaccine Record <span className="required-star">*</span></label>
                  <div className={`file-upload-box ${attemptedSubmit && !vaccineFile && !formData.vaccine_card_url ? 'upload-error' : ''}`}>
                    {previews.vaccine ? (
                      <div className="preview-container">
                        <img src={previews.vaccine} alt="Preview" className="file-preview" />
                        <button type="button" className="btn-remove-photo" onClick={() => removeFile('vaccine')}><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="upload-placeholder" onClick={() => document.getElementById('vaxInput').click()}>
                        <UploadCloud size={30} />
                        <p>Upload Vaccine Photo</p>
                      </div>
                    )}
                    <input type="file" id="vaxInput" hidden accept="image/png, image/jpeg" onChange={e => handleFileChange(e, 'vaccine')} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Illness Record (Optional)</label>
                  <div className="file-upload-box">
                    {previews.illness ? (
                      <div className="preview-container">
                        <img src={previews.illness} alt="Preview" className="file-preview" />
                        <button type="button" className="btn-remove-photo" onClick={() => removeFile('illness')}><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="upload-placeholder" onClick={() => document.getElementById('illInput').click()}>
                        <UploadCloud size={30} />
                        <p>Upload Illness Photo</p>
                      </div>
                    )}
                    <input type="file" id="illInput" hidden accept="image/png, image/jpeg" onChange={e => handleFileChange(e, 'illness')} />
                  </div>
                </div>
              </div>

              <div className="form-group full-width">
                <div className="label-with-counter">
                  <label>Grooming Specifications (Optional)</label>
                  <span className={`char-counter ${(formData.grooming_specifications?.length || 0) >= 500 ? 'limit-reached' : ''}`}>
                    {formData.grooming_specifications?.length || 0} / 500
                  </span>
                </div>
                <textarea 
                  value={formData.grooming_specifications} 
                  onChange={e => setFormData({...formData, grooming_specifications: e.target.value})} 
                  placeholder="Specific instructions..." 
                  maxLength={500}
                />
              </div>

              <div className="checkbox-group">
                <input type="checkbox" id="emergency" checked={formData.emergency_consent} onChange={e => setFormData({...formData, emergency_consent: e.target.checked})} />
                <label htmlFor="emergency">I agree that in a critical emergency, the Provider has permission to transport my pet to the nearest facility.</label>
              </div>

              <button type="submit" className="btn-submit-pet" disabled={loading}>
                {editingPetId ? "Review Changes" : "Register Pet"}
              </button>
            </form>
          </div>
        ) : (
          <div className="pets-content-area">
            {pets.length > 0 ? (
              <div className="pets-grid">
                {pets.map((pet) => (
                  <div 
                    key={pet.id} 
                    className="pet-master-card pet-master-card--clickable"
                    onClick={() => handleCardClick(pet)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && handleCardClick(pet)}
                  >
                    <div className="card-header">
                      {pet.pet_type === "Dog" ? <Dog size={28} color="#0E2679" /> : <Cat size={28} color="#0E2679" />}
                      <div className="card-actions">
                        <button 
                          onClick={(e) => handleEditClick(e, pet)} 
                          className="action-btn edit"
                          title="Edit pet"
                        >
                          <Edit2 size={16}/>
                        </button>
                        <button 
                          onClick={(e) => handleDeleteClick(e, pet)} 
                          className="action-btn delete"
                          title="Delete pet"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </div>
                    <div className="card-body">
                      <h3>{pet.name}</h3>
                      <div className="pet-meta-item"><PawPrint size={14} /> <span>{pet.breed}</span></div>
                      <div className="pet-meta-item"><Calendar size={14} /> <span>{new Date(pet.birth_date).toLocaleDateString()}</span></div>
                    </div>
                    <div className="card-footer-hint">
                      <Clock size={12} />
                      <span>View booking history</span>
                      <ChevronRight size={12} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-pets-container">
                <PawPrint size={80} strokeWidth={1} style={{ opacity: 0.2, marginBottom: '20px' }} />
                <h2>No Pets Registered</h2>
                <p>Register your pets once to save time on your next booking.</p>
                <button className="btn-initial-register" onClick={() => setShowForm(true)}>Register My First Pet</button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals rendered outside main so they always show */}
      <PetSummaryModal 
        isOpen={showSummary} 
        onClose={() => setShowSummary(false)} 
        onConfirm={handleConfirmSubmit} 
        data={formData}
        previews={previews}
        loading={loading}
      />

      <SuccessModal 
        isOpen={showSuccess} 
        onClose={() => setShowSuccess(false)} 
        message={successMessage}
      />

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        petName={deleteTarget?.name}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />

      <DeleteSuccessModal
        isOpen={showDeleteSuccess}
        onClose={() => setShowDeleteSuccess(false)}
        petName={deletedPetName}
      />

      <Footer />
    </div>
  );
};

export default MyPets;