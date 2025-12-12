// src/pages/pet-owner/PetDetails.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { 
  PawPrint, Calendar, Weight, 
  Dna, Activity, ChevronLeft, Tag, Cat, AlertCircle,
  UploadCloud, X, FileText, Scissors, Trash2, Plus
} from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./PetDetails.css";

const PetDetails = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const initialProviderId = state?.providerId || sessionStorage.getItem('current_provider_id');
  const STORAGE_KEY = `booking_draft_${initialProviderId}`;

  const [providerServices, setProviderServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emptyPetTemplate = {
    service_id: "", service_name: "", service_type: "", price: "0.00",
    pet_type: "Dog", pet_name: "", birth_date: "", weight_kg: "", calculated_size: "",
    breed: "", gender: "Male", behavior: "", grooming_specifications: "",
    error: null, vaccine_file: null, vaccine_preview: null, illness_file: null, illness_preview: null, emergency_consent: false
  };

  // --- INITIALIZATION LOGIC (FIXED) ---
  const initializePetsData = () => {
    // 1. Retrieve any saved session data (to preserve typed info if possible)
    let savedPets = [];
    const savedSession = sessionStorage.getItem(STORAGE_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.petsData && Array.isArray(parsed.petsData)) {
          savedPets = parsed.petsData;
        }
      } catch (e) { console.error(e); }
    }

    // 2. CHECK NAVIGATION STATE FIRST (The user's fresh selection)
    if (state && state.numberOfPets !== undefined) {
       const freshCount = parseInt(state.numberOfPets, 10);
       
       // Create an array of the requested length. 
       // If we have saved data for index i, reuse it (preserve inputs). 
       // If not, use a blank template.
       return Array.from({ length: freshCount }, (_, i) => {
          return savedPets[i] ? savedPets[i] : { ...emptyPetTemplate };
       });
    }

    // 3. If no navigation state (e.g. Page Refresh), fallback to full session data
    if (savedPets.length > 0) {
      return savedPets;
    }

    // 4. Default fallback
    return [{ ...emptyPetTemplate }];
  };

  const [petsData, setPetsData] = useState(initializePetsData);

  const getBookingMeta = () => {
    const saved = sessionStorage.getItem(STORAGE_KEY) ? JSON.parse(sessionStorage.getItem(STORAGE_KEY)) : {};
    return {
        date: state?.bookingDate || saved.date || "Date not selected",
        time: state?.bookingTime || saved.time || "Time not selected",
        providerName: state?.providerName || saved.providerName || "Provider"
    };
  };
  const { date: displayDate, time: displayTime, providerName } = getBookingMeta();

  // --- PERSISTENCE ---
  useEffect(() => {
    if (initialProviderId && petsData.length > 0) {
      const currentStorage = sessionStorage.getItem(STORAGE_KEY) ? JSON.parse(sessionStorage.getItem(STORAGE_KEY)) : {};
      const updatedStorage = {
        ...currentStorage,
        providerId: initialProviderId,
        providerName: providerName,
        date: displayDate,
        time: displayTime,
        pets: petsData.length,
        petsData: petsData
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStorage));
      sessionStorage.setItem('current_provider_id', initialProviderId);
    }
  }, [petsData, initialProviderId, displayDate, displayTime, providerName]);

  useEffect(() => {
    const fetchServices = async () => {
      if (!initialProviderId) return;
      try {
        const { data, error } = await supabase.from('services').select(`
            id, name, type, description, 
            service_options (id, price, size, pet_type, weight_range)
          `).eq('provider_id', initialProviderId);
        if (error) throw error;
        setProviderServices(data || []);
      } catch (err) { console.error(err); } finally { setLoadingServices(false); }
    };
    fetchServices();
  }, [initialProviderId]);

  // --- HANDLERS ---
  const handleBack = () => {
    navigate(`/listing/${initialProviderId}`, {
        state: {
            bookingDate: displayDate,
            bookingTime: displayTime,
            numberOfPets: petsData.length
        }
    });
  };

  // --- HELPERS (No Changes) ---
  const isWeightInRange = (weight, rangeString) => {
    if (!rangeString) return true; 
    const cleanRange = rangeString.replace(/\s+/g, '').toUpperCase();
    if (cleanRange === 'N/A' || cleanRange === 'ALL' || cleanRange === '') return true;
    const w = parseFloat(weight);
    if (isNaN(w)) return false; 
    try {
      if (cleanRange.includes('-')) {
        const parts = cleanRange.split('-');
        if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
            return w >= parseFloat(parts[0]) && w <= parseFloat(parts[1]);
        }
      }
      if (cleanRange.includes('+')) return w >= parseFloat(cleanRange.replace('+', ''));
      if (!isNaN(parseFloat(cleanRange)) && cleanRange.indexOf('-') === -1) return w === parseFloat(cleanRange);
      return false;
    } catch (e) { return false; }
  };

  const findServiceOption = (pet, services) => {
    if (!pet.service_id) return null; 
    const service = services.find(s => s.id === pet.service_id);
    if (!service || !service.service_options) return null;
    const userType = (pet.pet_type || "Dog").toLowerCase();
    return service.service_options.find(opt => {
      const dbType = (opt.pet_type || "").toLowerCase();
      return (dbType === userType || dbType === 'dog-cat') && isWeightInRange(pet.weight_kg, opt.weight_range);
    });
  };

  const updatePetDataAndPrice = (index, petUpdate) => {
    setPetsData(prev => {
        const updated = [...prev];
        let updatedPet = { ...updated[index], ...petUpdate };
        const matchedOption = findServiceOption(updatedPet, providerServices);
        if (matchedOption) {
            updatedPet.price = parseFloat(matchedOption.price).toFixed(2);
            const rawSize = matchedOption.size.replace(/_/g, ' ');
            updatedPet.calculated_size = (rawSize.toLowerCase() === 'all') ? 'Standard' : rawSize; 
            updatedPet.error = null; 
        } else {
            updatedPet.price = "0.00";
            if (updatedPet.service_id && updatedPet.weight_kg && parseFloat(updatedPet.weight_kg) > 0) {
               updatedPet.calculated_size = "N/A";
               updatedPet.error = "Service unavailable for this weight/type.";
            } else {
               updatedPet.calculated_size = ""; 
               updatedPet.error = null;
            }
        }
        updated[index] = updatedPet;
        return updated;
    });
  };

  const handleAddPet = () => setPetsData(prev => [...prev, { ...emptyPetTemplate }]);
  const handleRemovePet = (index) => setPetsData(prev => prev.filter((_, i) => i !== index));
  const handleInputChange = (index, e) => updatePetDataAndPrice(index, { [e.target.name]: e.target.value });
  const handleConsentChange = (index, e) => setPetsData(prev => { const upd = [...prev]; upd[index].emergency_consent = e.target.checked; return upd; });
  const handleWeightChange = (index, e) => updatePetDataAndPrice(index, { weight_kg: e.target.value });
  const handleServiceChange = (index, e) => {
    const sObj = providerServices.find(s => s.id === e.target.value);
    updatePetDataAndPrice(index, sObj ? { service_id: sObj.id, service_name: sObj.name, service_type: sObj.type } : { service_id: "", service_name: "", service_type: "" });
  };
  const handleFileUpload = (index, type, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Images only.'); return; }
    if (file.size > 1024 * 1024) { alert('Max 1MB.'); return; }
    setPetsData(prev => { const upd = [...prev]; upd[index] = { ...upd[index], [`${type}_file`]: file, [`${type}_preview`]: URL.createObjectURL(file) }; return upd; });
  };
  const removeFile = (index, type) => {
    setPetsData(prev => {
        const upd = [...prev];
        if (upd[index][`${type}_preview`]) URL.revokeObjectURL(upd[index][`${type}_preview`]);
        upd[index] = { ...upd[index], [`${type}_file`]: null, [`${type}_preview`]: null };
        return upd;
    });
  };
  const calculateTotal = () => petsData.reduce((acc, pet) => acc + parseFloat(pet.price || 0), 0);

  const uploadFileToSupabase = async (file, path) => {
      const ext = file.name.split('.').pop();
      const pathName = `${path}/${Math.random().toString(36).substring(2)}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('pet_documents').upload(pathName, file);
      if (error) throw error;
      const { data } = supabase.storage.from('pet_documents').getPublicUrl(pathName);
      return data.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (petsData.length === 0) return alert("Add at least one pet.");
    if (petsData.some(p => !p.service_id || !p.pet_name || !p.weight_kg || p.error || !p.vaccine_file || !p.emergency_consent)) return alert("Please complete all forms (including Vaccine & Consent).");

    setIsSubmitting(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not logged in");

        const { data: booking, error: bError } = await supabase.from('bookings').insert({
            provider_id: initialProviderId, pet_owner_id: user.id, booking_date: displayDate, time_slot: displayTime, status: 'pending', total_price: calculateTotal()
        }).select().single();
        if (bError) throw bError;

        for (const [i, pet] of petsData.entries()) {
            const path = `${user.id}/${booking.id}/pet_${i}`;
            const vUrl = await uploadFileToSupabase(pet.vaccine_file, path);
            const iUrl = pet.illness_file ? await uploadFileToSupabase(pet.illness_file, path) : null;

            const { data: pRec, error: pError } = await supabase.from('booking_pets').insert({
                booking_id: booking.id, pet_type: pet.pet_type, pet_name: pet.pet_name, birth_date: pet.birth_date,
                weight_kg: pet.weight_kg, calculated_size: pet.calculated_size, breed: pet.breed, gender: pet.gender,
                behavior: pet.behavior, grooming_specifications: pet.grooming_specifications,
                vaccine_card_url: vUrl, illness_record_url: iUrl, emergency_consent: pet.emergency_consent
            }).select().single();
            if (pError) throw pError;

            const { error: sError } = await supabase.from('booking_services').insert({
                booking_pet_id: pRec.id, service_id: pet.service_id, service_name: pet.service_name, service_type: pet.service_type, price: pet.price
            });
            if (sError) throw sError;
        }
        
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem('current_provider_id');
        alert("Booking Confirmed!");
        navigate("/dashboard");
    } catch (err) { console.error(err); alert(err.message); } finally { setIsSubmitting(false); }
  };

  // --- LAYOUT LOGIC ---
  const getGridClass = () => {
      if (petsData.length === 1) return "layout-1";
      if (petsData.length === 2) return "layout-2";
      return "layout-3-plus";
  };

  if (!initialProviderId) return <div className="pet-details-page"><Header /><main className="pet-details-container error-state"><h2>Session Expired</h2><button onClick={() => navigate("/dashboard")}>Go Home</button></main><Footer /></div>;

  return (
    <div className="pet-details-page">
      <Header />
      <main className="pet-details-container">
        <div className="page-header-row">
            <button className="back-link" onClick={handleBack}><ChevronLeft size={20} /> Back to Listing</button>
            <div className="booking-summary-badge">{displayDate} @ {displayTime}</div>
        </div>

        <form className={`all-pets-form ${getGridClass()}`}>
            {petsData.map((pet, index) => (
                <div key={index} className={`pet-details-card ${pet.error ? 'card-has-error' : ''}`}>
                    <div className="card-header-block">
                        <h2 className="card-title">Pet {index + 1}</h2>
                        <div className="card-header-actions">
                            <span className={`card-price-tag ${pet.error ? 'text-red' : ''}`}>{pet.error ? '---' : (pet.price ? `₱${parseFloat(pet.price).toFixed(2)}` : '₱0.00')}</span>
                            {petsData.length > 1 && <button type="button" className="icon-btn-danger" onClick={() => handleRemovePet(index)}><Trash2 size={18} /></button>}
                        </div>
                    </div>
                    <div className="pet-form-content">
                        {/* Service */}
                        <div className="form-section-label">Service Selection</div>
                        <div className="form-group">
                            <label className="form-label"><Tag size={14} className="label-icon" /> Choose Service</label>
                            <div className="select-wrapper">
                                <select name="service_id" className="form-input" value={pet.service_id} onChange={(e) => handleServiceChange(index, e)} disabled={loadingServices} required>
                                    <option value="">Select a service...</option>
                                    {providerServices.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="form-section-label" style={{marginTop: '1rem'}}>Pet Information</div>
                        <div className="form-row">
                            <div className="form-group"><label className="form-label"><Cat size={14} className="label-icon" /> Pet Type</label><div className="select-wrapper"><select name="pet_type" className="form-input" value={pet.pet_type} onChange={(e) => handleInputChange(index, e)}><option value="Dog">Dog</option><option value="Cat">Cat</option></select></div></div>
                            <div className="form-group"><label className="form-label"><PawPrint size={14} className="label-icon" /> Pet Name</label><input type="text" name="pet_name" className="form-input" placeholder="Pet's Name" value={pet.pet_name} onChange={(e) => handleInputChange(index, e)} required /></div>
                        </div>
                        <div className="form-row">
                            <div className="form-group"><label className="form-label"><Dna size={14} className="label-icon" /> Breed</label><input type="text" name="breed" className="form-input" placeholder="Breed" value={pet.breed} onChange={(e) => handleInputChange(index, e)} /></div>
                            <div className="form-group"><label className="form-label">Gender</label><div className="select-wrapper"><select name="gender" className="form-input" value={pet.gender} onChange={(e) => handleInputChange(index, e)}><option value="Male">Male</option><option value="Female">Female</option></select></div></div>
                        </div>
                        <div className="form-group"><label className="form-label"><Calendar size={14} className="label-icon" /> Birth Date</label><input type="date" name="birth_date" className="form-input" value={pet.birth_date} onChange={(e) => handleInputChange(index, e)} /></div>
                        <div className="form-row">
                            <div className="form-group"><label className="form-label"><Weight size={14} className="label-icon" /> Weight (kg)</label><input type="number" name="weight_kg" className={`form-input ${pet.error ? 'input-error' : ''}`} placeholder="0.0" step="0.1" value={pet.weight_kg} onChange={(e) => handleWeightChange(index, e)} required /></div>
                            <div className="form-group"><label className="form-label">Size (Matched)</label><input type="text" className="form-input read-only" value={pet.calculated_size} readOnly placeholder="Auto-calc" style={{textTransform: 'capitalize'}} /></div>
                        </div>
                        {pet.error && <div className="error-banner"><AlertCircle size={16} /><span>{pet.error}</span></div>}

                        {/* Medical */}
                        <div className="form-section-label" style={{marginTop: '1rem'}}>Medical Records</div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Vaccine Record <span className="text-red">*</span></label>
                                <span className="upload-helper-text">Max 1MB. Image only.</span>
                                {pet.vaccine_preview ? <div className="image-preview-container"><img src={pet.vaccine_preview} alt="Vaccine" className="image-preview"/><button className="remove-file-btn" onClick={()=>removeFile(index, 'vaccine')}><X size={16}/></button></div> : <label className={`upload-box ${!pet.vaccine_file && isSubmitting?'upload-error':''}`}><input type="file" accept="image/*" onChange={(e)=>handleFileUpload(index,'vaccine',e)} hidden required /><div className="upload-content"><UploadCloud size={24} className="upload-icon"/><span>Upload</span></div></label>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Illness Record</label>
                                <span className="upload-helper-text">Optional. Max 1MB.</span>
                                {pet.illness_preview ? <div className="image-preview-container"><img src={pet.illness_preview} alt="Illness" className="image-preview"/><button className="remove-file-btn" onClick={()=>removeFile(index, 'illness')}><X size={16}/></button></div> : <label className="upload-box"><input type="file" accept="image/*" onChange={(e)=>handleFileUpload(index,'illness',e)} hidden /><div className="upload-content"><FileText size={24} className="upload-icon"/><span>Upload</span></div></label>}
                            </div>
                        </div>

                        {/* Consent */}
                        <div className="consent-form-group">
                            <label className="consent-checkbox-label">
                                <input type="checkbox" checked={pet.emergency_consent} onChange={(e) => handleConsentChange(index, e)} required />
                                I agree that in a critical emergency, the Service Provider has my permission to place my pet in their care, and transport them to the nearest emergency facility.
                            </label>
                        </div>

                        <div className="form-group" style={{marginTop:'1rem'}}><label className="form-label"><Activity size={14} className="label-icon" /> Behavior</label><textarea name="behavior" className="form-input textarea" value={pet.behavior} onChange={(e) => handleInputChange(index, e)} rows={2} /></div>
                        <div className="form-group"><label className="form-label"><Scissors size={14} className="label-icon" /> Grooming Specs</label><textarea name="grooming_specifications" className="form-input textarea" value={pet.grooming_specifications} onChange={(e) => handleInputChange(index, e)} rows={2} /></div>
                    </div>
                </div>
            ))}
            <div className="add-pet-container">
                <button type="button" className="add-pet-btn" onClick={handleAddPet}><Plus size={20} /> Add Another Pet</button>
            </div>
        </form>

        <div className="payment-block">
            <div className="payment-summary">
                <span className="payment-label">Total Estimated Price</span>
                <span className="payment-total">₱{calculateTotal().toFixed(2)}</span>
            </div>
            <button onClick={handleSubmit} className="proceed-btn" disabled={isSubmitting}>
                {isSubmitting ? "Processing..." : "Proceed to Payment"}
            </button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PetDetails;