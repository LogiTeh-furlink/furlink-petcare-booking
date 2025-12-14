import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { 
  PawPrint, Calendar, Weight, 
  Dna, Activity, Tag, Cat, AlertCircle,
  UploadCloud, X, FileText, Scissors, Trash2, Plus, ArrowRight,
  Clock, FileCheck, ShieldCheck, ArrowLeft, Info
} from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./PetDetails.css";

// =========================================
// HELPER COMPONENT: DETAILED REVIEW MODAL
// =========================================
const ReviewBookingModal = ({ isOpen, onClose, onConfirm, pets, date, time, total, isSubmitting }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content review-booking-modal">
                <div className="modal-header">
                    <h2><FileCheck size={24} className="icon-brand"/> Review Booking Details</h2>
                    <p>Please double-check all information and attachments.</p>
                </div>

                <div className="review-meta-bar">
                    <div className="meta-item"><Calendar size={14}/> {date}</div>
                    <div className="meta-item"><Clock size={14}/> {time}</div>
                    <div className="meta-item total"><Tag size={14}/> Total: ₱{total.toFixed(2)}</div>
                </div>

                <div className="review-scroll-area">
                    {pets.map((pet, idx) => {
                        const validServices = pet.services.filter(s => s.id && s.service_name);

                        return (
                            <div key={idx} className="review-pet-card detailed-card">
                                <div className="review-card-header">
                                    <h3>Pet {idx + 1}: {pet.pet_name}</h3>
                                    <span className="review-price">₱{pet.total_price_display}</span>
                                </div>

                                <div className="review-grid-section">
                                    <div className="review-group full-width">
                                        <label>Selected Services</label>
                                        <div className="value highlight">
                                            {validServices.length > 0 ? (
                                                validServices.map((s, i) => (
                                                    <div key={i}>• {s.service_name} ({s.service_type}) - ₱{s.price}</div>
                                                ))
                                            ) : (
                                                <div style={{color: '#ef4444'}}>• No valid services selected</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="review-group">
                                        <label>Type & Breed</label>
                                        <div className="value">{pet.pet_type} - {pet.breed}</div>
                                    </div>
                                    <div className="review-group">
                                        <label>Gender & DOB</label>
                                        <div className="value">{pet.gender}, {pet.birth_date}</div>
                                    </div>
                                    <div className="review-group">
                                        <label>Physical</label>
                                        <div className="value">{pet.weight_kg}kg ({pet.calculated_size})</div>
                                    </div>
                                    
                                    <div className="review-group full-width">
                                        <label>Behavior Note</label>
                                        <div className="value text-block">{pet.behavior}</div>
                                    </div>
                                    {pet.grooming_specifications && (
                                        <div className="review-group full-width">
                                            <label>Grooming Specs</label>
                                            <div className="value text-block">{pet.grooming_specifications}</div>
                                        </div>
                                    )}

                                    <div className="review-divider">Attachments</div>
                                    
                                    <div className="review-file-row">
                                        <div className="file-preview-item">
                                            <span className="file-label">Vaccine Record</span>
                                            {pet.vaccine_preview ? (
                                                <div className="thumb-container">
                                                    <img src={pet.vaccine_preview} alt="Vaccine" />
                                                </div>
                                            ) : (
                                                <span className="missing-file">Missing</span>
                                            )}
                                        </div>
                                        
                                        <div className="file-preview-item">
                                            <span className="file-label">Illness Record</span>
                                            {pet.illness_preview ? (
                                                <div className="thumb-container">
                                                    <img src={pet.illness_preview} alt="Illness" />
                                                </div>
                                            ) : (
                                                <span className="no-file">None provided</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="review-consent-status">
                                        {pet.emergency_consent ? (
                                            <span className="consent-yes"><ShieldCheck size={14}/> Emergency Transport Consented</span>
                                        ) : (
                                            <span className="consent-no"><AlertCircle size={14}/> No Emergency Consent</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="modal-actions">
                    <button className="btn-modal-back" onClick={onClose} disabled={isSubmitting}>
                        Back to Edit
                    </button>
                    <button className="btn-modal-confirm" onClick={onConfirm} disabled={isSubmitting}>
                        {isSubmitting ? "Processing..." : "Submit Booking Request"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// =========================================
// MAIN COMPONENT
// =========================================
const PetDetails = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const initialProviderId = state?.providerId || sessionStorage.getItem('current_provider_id');

  const [currentUser, setCurrentUser] = useState(null); 
  const [providerServices, setProviderServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false); 
  
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [petsData, setPetsData] = useState([]); 
  const [isInitializing, setIsInitializing] = useState(true); 

  const [globalError, setGlobalError] = useState(null);
  const [globalInfo, setGlobalInfo] = useState(null); 

  const emptyPetTemplate = {
    services: [{ _tempId: Date.now(), id: "", service_name: "", service_type: "", price: "0.00" }], 
    total_price_display: "0.00",
    pet_type: "Dog", pet_name: "", birth_date: "", weight_kg: "", calculated_size: "",
    breed: "", gender: "Male", behavior: "", grooming_specifications: "",
    error: null, vaccine_file: null, vaccine_preview: null, illness_file: null, illness_preview: null, emergency_consent: false
  };

  const triggerError = (msg) => {
    setGlobalError(msg);
    setGlobalInfo(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setGlobalError(null), 8000);
  };

  const triggerInfo = (msg) => {
    setGlobalInfo(msg);
    setGlobalError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setGlobalInfo(null), 8000);
  };

  useEffect(() => {
    const initializePage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !initialProviderId) {
        setIsInitializing(false);
        return; 
      }
      setCurrentUser(user);
      sessionStorage.setItem('current_provider_id', initialProviderId);

      const userStorageKey = `booking_draft_${user.id}_${initialProviderId}`;
      const savedSession = sessionStorage.getItem(userStorageKey);
      let parsedSession = null;
      if (savedSession) {
        try { parsedSession = JSON.parse(savedSession); } catch (e) { console.error(e); }
      }

      // Helper to strip ghost images from session data
      const cleanSessionPets = (pets) => {
          if (!Array.isArray(pets)) return [];
          return pets.map(p => ({
              ...p,
              vaccine_file: null,
              vaccine_preview: null, // Clear preview string
              illness_file: null,
              illness_preview: null  // Clear preview string
          }));
      };

      if (state && state.numberOfPets !== undefined) {
          // SCENARIO 1: Coming from Listing Info (Passed State)
          const targetCount = parseInt(state.numberOfPets, 10);
          
          // CRITICAL FIX: Clean the session data BEFORE using it
          const rawSessionPets = parsedSession?.petsData || [];
          const safeSessionPets = cleanSessionPets(rawSessionPets);

          const newPetsArray = Array.from({ length: targetCount }, (_, i) => safeSessionPets[i] ? safeSessionPets[i] : { ...emptyPetTemplate });
          
          setPetsData(newPetsArray);
          // Only show info if we actually restored data
          if (rawSessionPets.length > 0) triggerInfo("Welcome back! Please re-upload your medical images.");

      } else if (parsedSession && Array.isArray(parsedSession.petsData)) {
          // SCENARIO 2: Reloading Page (No State)
          const sanitizedPets = cleanSessionPets(parsedSession.petsData);
          setPetsData(sanitizedPets);
          triggerInfo("Welcome back! Please re-upload your medical images.");
      } else {
          // SCENARIO 3: Fresh Start
          setPetsData([{ ...emptyPetTemplate }]);
      }
      setIsInitializing(false);
    };
    initializePage();
  }, [initialProviderId]); 

  const getBookingMeta = () => {
    if (state?.bookingDate && state?.bookingTime) {
        return { date: state.bookingDate, time: state.bookingTime, providerName: state.providerName };
    }
    if (currentUser && initialProviderId) {
        const userStorageKey = `booking_draft_${currentUser.id}_${initialProviderId}`;
        const saved = sessionStorage.getItem(userStorageKey);
        if (saved) {
            const parsed = JSON.parse(saved);
            return { date: parsed.date || "Date not selected", time: parsed.time || "Time not selected", providerName: parsed.providerName };
        }
    }
    return { date: "Date not selected", time: "Time not selected", providerName: "Provider" };
  };
  
  const { date: displayDate, time: displayTime } = getBookingMeta();

  useEffect(() => {
    const fetchServices = async () => {
      if (!initialProviderId) return;
      try {
        const { data, error } = await supabase.from('services').select(`id, name, type, description, service_options (id, price, size, pet_type, weight_range)`).eq('provider_id', initialProviderId);
        if (error) throw error;
        setProviderServices(data || []);
      } catch (err) { console.error(err); } finally { setLoadingServices(false); }
    };
    fetchServices();
  }, [initialProviderId]);

  const handleBackAndSave = () => {
      if (currentUser && initialProviderId && petsData.length > 0) {
          const userStorageKey = `booking_draft_${currentUser.id}_${initialProviderId}`;
          const currentStorage = sessionStorage.getItem(userStorageKey) ? JSON.parse(sessionStorage.getItem(userStorageKey)) : {};
          
          const updatedStorage = {
              ...currentStorage,
              providerId: initialProviderId,
              date: displayDate,
              time: displayTime,
              providerName: getBookingMeta().providerName,
              pets: petsData.length,
              petsData: petsData 
          };
          
          sessionStorage.setItem(userStorageKey, JSON.stringify(updatedStorage));
      }
      navigate(-1);
  };

  const isWeightInRange = (weight, rangeString) => {
    if (!rangeString || typeof rangeString !== 'string') return true; 
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

  const getServicePriceAndSize = (serviceId, petType, weight) => {
    const service = providerServices.find(s => s.id === serviceId);
    if (!service || !service.service_options) return { price: "0.00", size: "", matched: false, errorReason: null };
    
    const userType = (petType || "Dog").toLowerCase();
    
    const perfectMatch = service.service_options.find(opt => {
      const dbType = (opt.pet_type || "").toLowerCase();
      return (dbType === userType || dbType === 'dog-cat') && isWeightInRange(weight, opt.weight_range);
    });

    if (perfectMatch) {
        const rawSize = perfectMatch.size.replace(/_/g, ' ');
        const displaySize = (rawSize.toLowerCase() === 'all') ? 'Standard' : rawSize;
        return { price: parseFloat(perfectMatch.price).toFixed(2), size: displaySize, matched: true, errorReason: null };
    }

    const typeMatchExists = service.service_options.some(opt => {
        const dbType = (opt.pet_type || "").toLowerCase();
        return (dbType === userType || dbType === 'dog-cat');
    });

    if (!typeMatchExists) {
        return { price: "0.00", size: "N/A", matched: false, errorReason: `Service unavailable for ${petType}s` };
    }

    return { price: "0.00", size: "N/A", matched: false, errorReason: `Service unavailable for ${weight}kg` };
  };

  const updatePetData = (index, updates) => {
    setPetsData(prev => {
        const allPets = [...prev];
        const currentPet = { ...allPets[index], ...updates };

        let petTotalPrice = 0;
        let finalCalculatedSize = "";
        let hasError = null;

        const updatedServices = currentPet.services.map(srv => {
            if (!srv.id) return srv; 

            const { price, size, matched, errorReason } = getServicePriceAndSize(srv.id, currentPet.pet_type, currentPet.weight_kg);
            
            if (matched) {
                finalCalculatedSize = size; 
                petTotalPrice += parseFloat(price);
                return { ...srv, price };
            } else if (currentPet.weight_kg && parseFloat(currentPet.weight_kg) > 0) {
                 hasError = errorReason || `Service unavailable for this pet.`;
                 return { ...srv, price: "0.00" };
            }
            return srv;
        });

        currentPet.services = updatedServices;
        currentPet.total_price_display = petTotalPrice.toFixed(2);
        currentPet.calculated_size = finalCalculatedSize;
        currentPet.error = hasError;

        allPets[index] = currentPet;
        return allPets;
    });
  };

  const handleInputChange = (index, e) => updatePetData(index, { [e.target.name]: e.target.value });
  const handleWeightChange = (index, e) => updatePetData(index, { weight_kg: e.target.value });
  const handleConsentChange = (index, e) => setPetsData(prev => { const upd = [...prev]; upd[index].emergency_consent = e.target.checked; return upd; });

  const handleAddServiceRow = (petIndex) => {
      setPetsData(prev => {
          const newPetsData = [...prev];
          const targetPet = { ...newPetsData[petIndex] };
          const newService = { _tempId: Date.now() + Math.random(), id: "", service_name: "", service_type: "", price: "0.00" };
          targetPet.services = [...targetPet.services, newService];
          newPetsData[petIndex] = targetPet;
          return newPetsData;
      });
  };

  const handleRemoveServiceRow = (petIndex, serviceIndex) => {
      setPetsData(prev => {
          const newPetsData = [...prev];
          const targetPet = { ...newPetsData[petIndex] };
          if (targetPet.services.length > 1) {
              targetPet.services = targetPet.services.filter((_, idx) => idx !== serviceIndex);
              let total = 0;
              targetPet.services.forEach(s => total += parseFloat(s.price));
              targetPet.total_price_display = total.toFixed(2);
              newPetsData[petIndex] = targetPet;
          }
          return newPetsData;
      });
  };

  const getAvailableOptions = (petIndex, currentServiceRowIndex) => {
      const currentPet = petsData[petIndex];
      const otherRowsHavePackage = currentPet.services.some((s, idx) => {
          return idx !== currentServiceRowIndex && s.service_type && s.service_type.toLowerCase() === 'package';
      });

      return providerServices.filter(s => {
          if (otherRowsHavePackage && s.type && s.type.toLowerCase() === 'package') {
              return false;
          }
          return true;
      });
  };

  const handleServiceSelect = (petIndex, serviceIndex, e) => {
      const selectedId = e.target.value;
      const sObj = providerServices.find(s => s.id === selectedId);
      
      if (sObj?.type && sObj.type.toLowerCase() === 'package') {
          const currentPet = petsData[petIndex];
          const hasExistingPackage = currentPet.services.some(
              (s, idx) => idx !== serviceIndex && s.service_type && s.service_type.toLowerCase() === 'package'
          );
          
          if (hasExistingPackage) {
              triggerError("Only one Package service is allowed per pet.");
              return; 
          }
      }
      
      setPetsData(prev => {
          const newPetsData = [...prev];
          const targetPet = { ...newPetsData[petIndex] };
          const newServices = [...targetPet.services];

          const newServiceObj = {
              ...newServices[serviceIndex],
              id: selectedId,
              service_name: sObj ? sObj.name : "",
              service_type: sObj ? sObj.type : "",
              price: "0.00" 
          };
          
          newServices[serviceIndex] = newServiceObj;
          
          const { price, size, matched, errorReason } = getServicePriceAndSize(selectedId, targetPet.pet_type, targetPet.weight_kg);
          if (matched) {
              newServices[serviceIndex].price = price;
              targetPet.calculated_size = size;
              targetPet.error = null;
          } else if (targetPet.weight_kg && parseFloat(targetPet.weight_kg) > 0) {
              newServices[serviceIndex].price = "0.00";
              targetPet.error = errorReason || "Service unavailable for this pet.";
          }

          targetPet.services = newServices;

          let total = 0;
          targetPet.services.forEach(s => total += parseFloat(s.price));
          targetPet.total_price_display = total.toFixed(2);

          newPetsData[petIndex] = targetPet;
          return newPetsData;
      });
  };

  const handleAddPet = () => setPetsData(prev => [...prev, { ...emptyPetTemplate, services: [{_tempId: Date.now(), id: "", service_name: "", service_type: "", price: "0.00"}] }]);
  const handleRemovePet = (index) => {
    if (petsData.length === 1) { 
        triggerError("You must have at least one pet."); 
        return; 
    }
    setPetsData(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleFileUpload = (index, type, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { 
        triggerError('Invalid file format. Please upload images only.'); 
        return; 
    }
    if (file.size > 1024 * 1024) { 
        triggerError('File size too large. Maximum size is 1MB.'); 
        return; 
    }
    setPetsData(prev => { const upd = [...prev]; upd[index] = { ...upd[index], [`${type}_file`]: file, [`${type}_preview`]: URL.createObjectURL(file) }; return upd; });
    setGlobalError(null); 
  };

  const removeFile = (index, type) => {
    setPetsData(prev => {
        const upd = [...prev];
        if (upd[index][`${type}_preview`]) URL.revokeObjectURL(upd[index][`${type}_preview`]);
        upd[index] = { ...upd[index], [`${type}_file`]: null, [`${type}_preview`]: null };
        return upd;
    });
  };

  const calculateGrandTotal = () => petsData.reduce((acc, pet) => acc + parseFloat(pet.total_price_display || 0), 0);
  
  const uploadFileToSupabase = async (file, path) => {
      if (!file || !file.name) {
          throw new Error("Missing file data. Please re-upload your documents.");
      }

      const ext = file.name.split('.').pop();
      const pathName = `${path}/${Math.random().toString(36).substring(2)}_${Date.now()}.${ext}`;
      
      const { error } = await supabase.storage.from('pet_documents').upload(pathName, file);
      
      if (error) {
          console.error("Upload Error:", error);
          throw new Error("Failed to upload document. Please ensure the 'pet_documents' storage bucket exists and policies are set.");
      }
      
      const { data } = supabase.storage.from('pet_documents').getPublicUrl(pathName);
      return data.publicUrl;
  };

  const isPetFormComplete = (pet) => {
    const hasService = pet.services.some(s => s.id && s.id !== "");
    // Check if FILE OBJECT exists (not just preview string)
    const isFileValid = pet.vaccine_file && pet.vaccine_file.name;
    return (hasService && pet.pet_name.trim() && pet.breed.trim() && pet.birth_date && pet.weight_kg && parseFloat(pet.weight_kg) > 0 && pet.behavior.trim() && isFileValid && !pet.error);
  };

  const handleProceedClick = (e) => {
    e.preventDefault();
    setAttemptedSubmit(true);

    if (petsData.length === 0) { 
        triggerError("Please add at least one pet."); 
        return; 
    }

    const incompletePets = petsData.filter(pet => !isPetFormComplete(pet));
    
    if (incompletePets.length > 0) {
        const missingFile = incompletePets.find(p => !p.vaccine_file || !p.vaccine_file.name);
        if (missingFile) {
            triggerError(`Missing vaccine record for ${missingFile.pet_name || 'Pet ' + (petsData.indexOf(missingFile) + 1)}.`);
        } else {
            triggerError("Please complete all required fields (*) and select at least one valid service per pet.");
        }
        return;
    }
    
    setGlobalError(null);
    setShowReviewModal(true);
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
        if (!currentUser) throw new Error("User not logged in");
        
        const { data: booking, error: bError } = await supabase
            .from('bookings')
            .insert({
                provider_id: initialProviderId, 
                user_id: currentUser.id,
                booking_date: displayDate, 
                time_slot: displayTime, 
                status: 'pending', 
                total_estimated_price: calculateGrandTotal()
            })
            .select()
            .single();
            
        if (bError) throw bError;

        for (const [i, pet] of petsData.entries()) {
            const path = `${currentUser.id}/${booking.id}/pet_${i}`;
            
            const vUrl = await uploadFileToSupabase(pet.vaccine_file, path);
            const iUrl = pet.illness_file ? await uploadFileToSupabase(pet.illness_file, path) : null;

            const { data: pRec, error: pError } = await supabase
                .from('booking_pets')
                .insert({
                    booking_id: booking.id, 
                    pet_name: pet.pet_name, 
                    pet_type: pet.pet_type, 
                    birth_date: pet.birth_date,
                    weight_kg: pet.weight_kg, 
                    calculated_size: pet.calculated_size, 
                    breed: pet.breed, 
                    gender: pet.gender,
                    behavior: pet.behavior, 
                    grooming_specifications: pet.grooming_specifications, 
                    emergency_consent: pet.emergency_consent,
                    vaccine_card_url: vUrl,
                    illness_proof_url: iUrl
                })
                .select()
                .single();
            
            if (pError) throw pError;

            for (const srv of pet.services) {
                if (srv.id && srv.id !== "") { 
                    const { error: sError } = await supabase.from('booking_services').insert({
                        booking_pet_id: pRec.id, 
                        service_id: srv.id, 
                        service_name: srv.service_name, 
                        service_type: srv.service_type,
                        price: srv.price 
                    });
                    if (sError) throw sError;
                }
            }
        }
        
        sessionStorage.removeItem(`booking_draft_${currentUser.id}_${initialProviderId}`);
        sessionStorage.removeItem('current_provider_id');
        setShowReviewModal(false);
        navigate("/dashboard");
        
    } catch (err) { 
        console.error(err); 
        setShowReviewModal(false);
        triggerError(`Booking failed: ${err.message}`); 
    } finally { 
        setIsSubmitting(false); 
    }
  };

  const getGridClass = () => petsData.length === 1 ? "layout-1" : petsData.length === 2 ? "layout-2" : "layout-3-plus";
  if (!initialProviderId || isInitializing) return <div className="pet-details-page"><Header /><main className="pet-details-container error-state"><p>Loading booking details...</p></main><Footer /></div>;

  return (
    <div className="pet-details-page">
      <Header />
      <main className="pet-details-container">
        
        {globalError && (
            <div className="global-error-banner" style={{
                background: '#fee2e2', color: '#b91c1c', padding: '12px', 
                borderRadius: '8px', marginBottom: '16px', display: 'flex', 
                alignItems: 'center', gap: '10px', border: '1px solid #fca5a5'
            }}>
                <AlertCircle size={20} />
                <span style={{flex: 1, fontSize: '0.95rem', fontWeight: 500}}>{globalError}</span>
                <button onClick={() => setGlobalError(null)} style={{background: 'transparent', border: 'none', cursor: 'pointer', color: '#b91c1c'}}>
                    <X size={18}/>
                </button>
            </div>
        )}

        {globalInfo && (
            <div className="global-error-banner" style={{
                background: '#dbeafe', color: '#1e40af', padding: '12px', 
                borderRadius: '8px', marginBottom: '16px', display: 'flex', 
                alignItems: 'center', gap: '10px', border: '1px solid #93c5fd'
            }}>
                <Info size={20} />
                <span style={{flex: 1, fontSize: '0.95rem', fontWeight: 500}}>{globalInfo}</span>
                <button onClick={() => setGlobalInfo(null)} style={{background: 'transparent', border: 'none', cursor: 'pointer', color: '#1e40af'}}>
                    <X size={18}/>
                </button>
            </div>
        )}

        <div className="page-header-row">
            <div className="header-left-actions">
                <button onClick={handleBackAndSave} className="btn-back">
                    <ArrowLeft size={16} /> Back
                </button>
            </div>
            
            <div className="header-right-actions">
                <div className="booking-summary-badge">{displayDate} @ {displayTime}</div>
                <div className="top-price-display">
                    <span className="label">Total:</span>
                    <span className="value">₱{calculateGrandTotal().toFixed(2)}</span>
                </div>
                <button onClick={handleProceedClick} className="top-proceed-btn" disabled={isSubmitting}>
                    Proceed to Summary <ArrowRight size={16} />
                </button>
            </div>
        </div>

        <form className={`all-pets-form ${getGridClass()}`}>
            {petsData.map((pet, index) => {
                return (
                <div key={index} className={`pet-details-card ${pet.error ? 'card-has-error' : ''}`}>
                    <div className="card-header-block">
                        <h2 className="card-title">Pet {index + 1}</h2>
                        <div className="card-header-actions">
                            <span className={`card-price-tag ${pet.error ? 'text-red' : ''}`}>
                                {pet.error ? 'Check Errors' : `₱${pet.total_price_display}`}
                            </span>
                            
                            {index === petsData.length - 1 && (
                                <button type="button" className="btn-add-pet-rect" onClick={handleAddPet}>
                                    Add a pet <Plus size={16} />
                                </button>
                            )}

                            {petsData.length > 1 && (
                                <button type="button" className="icon-btn-danger" onClick={() => handleRemovePet(index)} title="Remove this pet">
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="pet-form-content">
                        <div className="form-section-label">Service Selection</div>
                        
                        <div className="service-rows-container">
                            {pet.services.map((service, sIndex) => (
                                <div key={service._tempId || sIndex} className="service-selection-row">
                                    <div className="form-group" style={{width: '100%'}}>
                                        {sIndex === 0 && (
                                            <label className="form-label">
                                                <Tag size={14} className="label-icon" /> 
                                                Select Service <span className="required-asterisk">*</span>
                                            </label>
                                        )}
                                        
                                        <div className="service-input-group">
                                            <div className="select-wrapper">
                                                <select 
                                                    className="form-input" 
                                                    value={service.id} 
                                                    onChange={(e) => handleServiceSelect(index, sIndex, e)} 
                                                    disabled={loadingServices} 
                                                    required={sIndex === 0} 
                                                >
                                                    <option value="" disabled hidden>Select Service</option>
                                                    {getAvailableOptions(index, sIndex).map(s => (
                                                        <option key={s.id} value={s.id}>
                                                            {s.name} ({s.type})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {sIndex === 0 ? (
                                                <button 
                                                    type="button" 
                                                    className="btn-action-service btn-add-service" 
                                                    onClick={() => handleAddServiceRow(index)}
                                                    title="Add another service"
                                                >
                                                    <Plus size={20} />
                                                </button>
                                            ) : (
                                                <button 
                                                    type="button" 
                                                    className="btn-action-service btn-remove-service" 
                                                    onClick={() => handleRemoveServiceRow(index, sIndex)}
                                                    title="Remove this service"
                                                >
                                                    <Minus size={20} />
                                                </button>
                                            )}
                                        </div>

                                        {service.id && (
                                            <div className="service-price-hint">
                                                <span>{service.service_type}</span>
                                                <span className="price-val">₱{service.price}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="form-section-label" style={{marginTop: '1rem'}}>Pet Information</div>
                        <div className="form-row">
                            <div className="form-group"><label className="form-label"><Cat size={14} className="label-icon" /> Pet Type <span className="required-asterisk">*</span></label><div className="select-wrapper"><select name="pet_type" className="form-input" value={pet.pet_type} onChange={(e) => handleInputChange(index, e)}><option value="Dog">Dog</option><option value="Cat">Cat</option></select></div></div>
                            <div className="form-group">
                                <label className="form-label"><PawPrint size={14} className="label-icon" /> Pet Name <span className="required-asterisk">*</span></label>
                                <input type="text" name="pet_name" className="form-input" placeholder="Pet's Name" value={pet.pet_name} onChange={(e) => handleInputChange(index, e)} maxLength={20} required />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label"><Dna size={14} className="label-icon" /> Breed <span className="required-asterisk">*</span></label>
                                <input type="text" name="breed" className="form-input" placeholder="Breed" value={pet.breed} onChange={(e) => handleInputChange(index, e)} maxLength={20} required />
                            </div>
                            <div className="form-group"><label className="form-label">Gender <span className="required-asterisk">*</span></label><div className="select-wrapper"><select name="gender" className="form-input" value={pet.gender} onChange={(e) => handleInputChange(index, e)}><option value="Male">Male</option><option value="Female">Female</option></select></div></div>
                        </div>
                        <div className="form-group"><label className="form-label"><Calendar size={14} className="label-icon" /> Birth Date <span className="required-asterisk">*</span></label><input type="date" name="birth_date" className="form-input" value={pet.birth_date} onChange={(e) => handleInputChange(index, e)} required /></div>
                        <div className="form-row">
                            <div className="form-group"><label className="form-label"><Weight size={14} className="label-icon" /> Weight (kg) <span className="required-asterisk">*</span></label><input type="number" name="weight_kg" className={`form-input ${pet.error ? 'input-error' : ''}`} placeholder="0.0" step="0.1" value={pet.weight_kg} onChange={(e) => handleWeightChange(index, e)} required /></div>
                            <div className="form-group"><label className="form-label">Size (Matched)</label><input type="text" className="form-input read-only" value={pet.calculated_size} readOnly placeholder="Auto-calc" style={{textTransform: 'capitalize'}} /></div>
                        </div>
                        {pet.error && <div className="error-banner"><AlertCircle size={16} /><span>{pet.error}</span></div>}

                        <div className="form-section-label" style={{marginTop: '1rem'}}>Medical Records</div>
                        <div className="form-row">
                            <div className="form-group"><label className="form-label">Vaccine Record <span className="required-asterisk">*</span></label><span className="upload-helper-text">Max 1MB. Image only.</span>
                                {/* Add conditional class to create red border if missing and attempted submit */}
                                {pet.vaccine_preview ? <div className="image-preview-container"><img src={pet.vaccine_preview} alt="Vaccine" className="image-preview"/><button type="button" className="remove-file-btn" onClick={()=>removeFile(index, 'vaccine')}><X size={16}/></button></div> : <label className={`upload-box ${!pet.vaccine_file && attemptedSubmit ? 'upload-error-border' : ''}`}><input type="file" accept="image/*" onChange={(e)=>handleFileUpload(index,'vaccine',e)} hidden required /><div className="upload-content" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%'}}><UploadCloud size={24} className="upload-icon"/><span>Upload</span></div></label>}
                            </div>
                            <div className="form-group"><label className="form-label">Illness Record (Optional)</label><span className="upload-helper-text">Optional. Max 1MB.</span>
                                {pet.illness_preview ? <div className="image-preview-container"><img src={pet.illness_preview} alt="Illness" className="image-preview"/><button type="button" className="remove-file-btn" onClick={()=>removeFile(index, 'illness')}><X size={16}/></button></div> : <label className="upload-box"><input type="file" accept="image/*" onChange={(e)=>handleFileUpload(index,'illness',e)} hidden /><div className="upload-content" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%'}}><FileText size={24} className="upload-icon"/><span>Upload</span></div></label>}
                            </div>
                        </div>

                        <div className="consent-form-group"><label className="consent-checkbox-label"><input type="checkbox" checked={pet.emergency_consent} onChange={(e) => handleConsentChange(index, e)} /><span>I agree that in a critical emergency, the Service Provider has my permission to place my pet in their care, and transport them to the nearest emergency facility.</span></label></div>
                        <div className="form-group" style={{marginTop:'1rem'}}>
                            <label className="form-label"><Activity size={14} className="label-icon" /> Behavior <span className="required-asterisk">*</span></label>
                            <textarea name="behavior" className="form-input textarea" value={pet.behavior} onChange={(e) => handleInputChange(index, e)} rows={2} maxLength={280} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label"><Scissors size={14} className="label-icon" /> Grooming Specs (Optional)</label>
                            <textarea name="grooming_specifications" className="form-input textarea" value={pet.grooming_specifications} onChange={(e) => handleInputChange(index, e)} rows={2} maxLength={280} />
                        </div>
                    </div>
                </div>
            )})}
        </form>

        <ReviewBookingModal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} onConfirm={handleFinalSubmit} pets={petsData} date={displayDate} time={displayTime} total={calculateGrandTotal()} isSubmitting={isSubmitting}/>
      </main>
      <Footer />
    </div>
  );
};

export default PetDetails;