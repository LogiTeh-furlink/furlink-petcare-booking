import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { 
  Plus, Trash2, Edit2, PawPrint, Calendar, Dog, Cat, 
  ArrowLeft, UploadCloud, X, CheckCircle, AlertCircle
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
            {/* TOP LEFT: Core Details & Behavior */}
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

            {/* TOP RIGHT: Physical & Grooming */}
            <div className="summary-box top-right">
                <div className="info-item-row"><label>Sex:</label> <span>{data.gender}</span></div>
                <div className="info-item-row"><label>DOB:</label> <span>{new Date(data.birth_date).toLocaleDateString()}</span></div>
                <div className="info-item-row"><label>Weight:</label> <span>{data.weight_kg} kg</span></div>
                <div className="grooming-summary-box">
                <label>Grooming Notes:</label>
                <p>{data.grooming_specifications || "No specific instructions provided."}</p>
                </div>
            </div>

            {/* BOTTOM LEFT: Vaccine Photo */}
            <div className="summary-box bottom-left">
                <h4>Vaccine Record</h4>
                <div className="summary-image-container">
                <img src={previews.vaccine} alt="Vaccine Record" />
                </div>
            </div>

            {/* BOTTOM RIGHT: Illness Photo */}
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

            {/* Emergency Footer */}
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

const MyPets = () => {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPetId, setEditingPetId] = useState(null);
  const [showSummary, setShowSummary] = useState(false); // New State

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

  useEffect(() => { fetchPets(); }, []);

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

  // Step 1: Open Summary Modal instead of saving
  const handleOpenSummary = (e) => {
    e.preventDefault();
    if (!vaccineFile && !formData.vaccine_card_url) {
        alert("Vaccine record photo is required.");
        return;
    }
    setShowSummary(true);
  };

  // Step 2: Confirmed in Modal, now save to DB
const handleConfirmSubmit = async () => {
setLoading(true);
try {
    const { data: { user } } = await supabase.auth.getUser();
    let vaccineUrl = formData.vaccine_card_url;
    let illnessUrl = formData.illness_proof_url;

    if (vaccineFile) vaccineUrl = await uploadToBucket(vaccineFile, user.id, formData.name, "vaccine");
    if (illnessFile) illnessUrl = await uploadToBucket(illnessFile, user.id, formData.name, "illness");

    // ONLY include columns that exist in your SQL table
    const payload = { 
    owner_id: user.id,
    name: formData.name,
    pet_type: formData.pet_type,
    breed: formData.breed,
    gender: formData.gender,
    birth_date: formData.birth_date,
    weight_kg: parseFloat(formData.weight_kg),
    behavior: formData.behavior.join(", "), // Array to String
    vaccine_card_url: vaccineUrl,
    illness_proof_url: illnessUrl,
    // Note: grooming_specifications and emergency_consent are excluded 
    // because they are NOT in your registered_pets table schema
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
    alert("Pet saved successfully!");
} catch (err) {
    console.error("Save Error:", err);
    alert("Failed to save: " + err.message);
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
  };

  const openEdit = (pet) => {
    setFormData({ ...pet, behavior: pet.behavior ? pet.behavior.split(", ") : [] });
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

  const handleDelete = async (id) => {
    if (window.confirm("Remove this pet profile permanently?")) {
      const { error } = await supabase.from("registered_pets").delete().eq("id", id);
      if (!error) fetchPets();
    }
  };

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
              
              {/* Form Inputs (Pet Name, Type, etc. - keep your existing input JSX) */}
              <div className="form-group">
                <label>Pet Name <span className="required-star">*</span></label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Buddy" />
              </div>

              {/* Optimized Density Row */}
                <div className="form-row-dense">
                    <div className="form-group">
                        <label>Type <span className="required-star">*</span></label>
                        <select value={formData.pet_type} onChange={e => setFormData({...formData, pet_type: e.target.value})}>
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

                    <div className="form-group">
                        <label>Date of Birth <span className="required-star">*</span></label>
                        <input 
                            type="date" 
                            required 
                            max={today} 
                            value={formData.birth_date} 
                            onChange={e => setFormData({...formData, birth_date: e.target.value})} 
                        />
                    </div>

                    <div className="form-group">
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

              <div className="form-group">
                <label>Breed <span className="required-star">*</span></label>
                <input required value={formData.breed} onChange={e => setFormData({...formData, breed: e.target.value})} placeholder="Shih Tzu" />
              </div>

              <div className="form-group">
                <label>Pet Behavior</label>
                <div className="behavior-grid">
                  {BEHAVIOR_OPTIONS.map(opt => (
                    <button type="button" key={opt} className={`behavior-tag ${formData.behavior.includes(opt) ? 'active' : ''}`} onClick={() => toggleBehavior(opt)}>{opt}</button>
                  ))}
                </div>
              </div>

              <div className="upload-section">
                    {/* Vaccine Record Box */}
                    <div className="form-group">
                        <label>Vaccine Record <span className="required-star">*</span></label>
                        <div className="file-upload-box">
                        {previews.vaccine ? (
                            <div className="preview-container">
                            <img src={previews.vaccine} alt="Preview" className="file-preview" />
                            <button type="button" className="btn-remove-photo" onClick={() => removeFile('vaccine')}>
                                <X size={16} />
                            </button>
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

                    {/* Illness Record Box */}
                    <div className="form-group">
                        <label>Illness Record (Optional)</label>
                        <div className="file-upload-box">
                        {previews.illness ? (
                            <div className="preview-container">
                            <img src={previews.illness} alt="Preview" className="file-preview" />
                            <button type="button" className="btn-remove-photo" onClick={() => removeFile('illness')}>
                                <X size={16} />
                            </button>
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
                <label>Grooming Specifications (Optional)</label>
                <textarea value={formData.grooming_specifications} onChange={e => setFormData({...formData, grooming_specifications: e.target.value})} placeholder="Specific instructions..." />
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
                  <div key={pet.id} className="pet-master-card">
                    <div className="card-header">
                      {pet.pet_type === "Dog" ? <Dog size={28} color="#0E2679" /> : <Cat size={28} color="#0E2679" />}
                      <div className="card-actions">
                        <button onClick={() => openEdit(pet)} className="action-btn edit"><Edit2 size={16}/></button>
                        <button onClick={() => { if(window.confirm("Delete pet profile?")) handleDelete(pet.id); }} className="action-btn delete"><Trash2 size={16}/></button>
                      </div>
                    </div>
                    <div className="card-body">
                      <h3>{pet.name}</h3>
                      <div className="pet-meta-item"><PawPrint size={14} /> <span>{pet.breed}</span></div>
                      <div className="pet-meta-item"><Calendar size={14} /> <span>{new Date(pet.birth_date).toLocaleDateString()}</span></div>
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

      <PetSummaryModal 
        isOpen={showSummary} 
        onClose={() => setShowSummary(false)} 
        onConfirm={handleConfirmSubmit} 
        data={formData}
        previews={previews}
        loading={loading}
      />

      <Footer />
    </div>
  );
};

export default MyPets;