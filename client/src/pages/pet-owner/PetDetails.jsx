import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { 
  Calendar, Weight, Activity, Cat, AlertCircle,
  UploadCloud, FileText, Trash2, Plus, ArrowRight,
  CreditCard, ArrowLeft, ChevronDown, ChevronUp, X, Maximize2, Minus, Tag
} from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./PetDetails.css";

const BEHAVIOR_OPTIONS = ["Friendly / Social", "Aggressive / Reactive", "Anxious / Nervous", "High Energy", "House Trained"];

const PetDetails = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  
  const [petsData, setPetsData] = useState([]);
  const [providerServices, setProviderServices] = useState([]);
  const [availablePetTypes, setAvailablePetTypes] = useState([]);
  const [showPolicies, setShowPolicies] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // NEW: State for Full View Modal
  const [selectedImage, setSelectedImage] = useState(null);

  const initialProviderId = state?.providerId || sessionStorage.getItem('current_provider_id');

  const triggerError = (msg) => alert(msg);

  const formatLongDate = (dateStr) => {
    if (!dateStr) return "Select Date";
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatTime12h = (timeStr) => {
    if (!timeStr) return "Select Time";
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${minutes} ${ampm}`;
  };

  const getEmptyPet = (type = "Dog") => ({
    services: [{ id: "", service_name: "", service_type: "", price: "0.00" }],
    pet_name: "", pet_type: type, breed: "", gender: "Male", birth_date: "", weight_kg: "",
    calculated_size: "Auto-calc", behavior: [], vaccine_file: null, vaccine_preview: null,
    illness_file: null, illness_preview: null, total_price: 0, grooming_specifications: "", emergency_consent: false
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from('services').select(`*, service_options(*)`).eq('provider_id', initialProviderId);
      setProviderServices(data || []);

      const types = new Set();
      data?.forEach(s => s.service_options?.forEach(opt => {
        if(opt.pet_type === 'dog-cat') { types.add("Dog"); types.add("Cat"); }
        else { types.add(opt.pet_type.charAt(0).toUpperCase() + opt.pet_type.slice(1)); }
      }));
      const typeList = Array.from(types);
      setAvailablePetTypes(typeList.length > 0 ? typeList : ["Dog", "Cat"]);

      const count = state?.numberOfPets || 1;
      setPetsData(Array.from({ length: count }, () => getEmptyPet(typeList[0] || "Dog")));
      setLoading(false);
    };
    fetchData();
  }, [initialProviderId, state]);

  const validateForm = () => {
    setAttemptedSubmit(true); 
    const isAllValid = petsData.every(pet => 
      pet.services.length > 0 && 
      pet.services.every(s => s.id !== "") && // All selected
      pet.pet_name.trim() && 
      pet.breed.trim() && 
      pet.birth_date && 
      pet.weight_kg && 
      pet.vaccine_file
    );
    return { valid: isAllValid };
  };

  const uploadFile = async (file, path) => {
    const ext = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${ext}`;
    const fullPath = `${path}/${fileName}`;
    
    const { error } = await supabase.storage
      .from('pet_documents')
      .upload(fullPath, file);
      
    if (error) throw error;

    const { data } = supabase.storage
      .from('pet_documents')
      .getPublicUrl(fullPath);
      
    return data.publicUrl;
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User session not found.");

      // 1. Create the main booking record
      const { data: booking, error: bError } = await supabase
        .from('bookings')
        .insert([{
          user_id: user.id,
          provider_id: initialProviderId,
          booking_date: state?.bookingDate,
          time_slot: state?.bookingTime,
          total_estimated_price: calculateGrandTotal(),
          status: 'pending'
        }])
        .select()
        .single();

      if (bError) throw bError;

      // 2. Process each pet (Upload files + Save to DB)
      // Note: Using a single loop to keep everything aligned
      for (let i = 0; i < petsData.length; i++) {
        const pet = petsData[i];
        const storagePath = `${user.id}/${booking.id}/pet_${i}`;
        
        let vUrl = null;
        let iUrl = null;

        // Upload Vaccine Record
        if (pet.vaccine_file) {
          vUrl = await uploadFile(pet.vaccine_file, storagePath);
        }

        // Upload Illness Record (if exists)
        if (pet.illness_file) {
          iUrl = await uploadFile(pet.illness_file, storagePath);
        }

        // 3. Save Pet details to database
        const { error: pError } = await supabase
          .from('booking_pets')
          .insert([{
            booking_id: booking.id,
            pet_name: pet.pet_name,
            pet_type: pet.pet_type,
            breed: pet.breed,
            gender: pet.gender,
            weight_kg: parseFloat(pet.weight_kg),
            birth_date: pet.birth_date,
            calculated_size: pet.calculated_size,
            behavior: Array.isArray(pet.behavior) ? pet.behavior.join(', ') : pet.behavior,
            vaccine_card_url: vUrl,
            illness_proof_url: iUrl,
            grooming_specifications: `Services: ${pet.services.map(s => s.service_name).join(', ')}. ${pet.grooming_specifications}`,
            emergency_consent: pet.emergency_consent
          }]);

        if (pError) throw pError;
      }

      // Success!
      // 1. Close the modal
      setShowSummaryModal(false);

      // 2. Redirect to Dashboard
      // Ensure your route is "/dashboard" as defined in your App.jsx
      navigate("/dashboard", { 
        state: { 
          success: true, 
          message: "Booking confirmed successfully!" 
        } 
      });

    } catch (error) {
      console.error("Submission error:", error);
      // Only trigger the alert if there is a real message, otherwise show a fallback
      const errorMsg = error?.message || "An unexpected error occurred. Please try again.";
      triggerError(errorMsg);
    } finally {
      setLoading(false);
    }
  };
  
  const updatePetInfo = (index, field, value) => {
    setPetsData(prev => {
      const newPets = [...prev];
      newPets[index][field] = value;

      if (field === "weight_kg" || field === "pet_type") {
        const weight = parseFloat(newPets[index].weight_kg) || 0;
        newPets[index].calculated_size = weight > 20 ? "Large" : weight > 10 ? "Medium" : "Small";

        // REAL-TIME PRICE UPDATE: Re-check prices for all selected services
        newPets[index].services = newPets[index].services.map(srv => {
          if (!srv.id) return srv;
          const { price } = getServicePriceAndSize(srv.id, newPets[index].pet_type, weight);
          return { ...srv, price };
        });

        // Update total_price display
        newPets[index].total_price = newPets[index].services.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
      }
      return newPets;
    });
  };

  const handleFileUpload = (index, field, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
        triggerError("Invalid file type. Please upload a PNG or JPG image.");
        return;
    }

    if (file.size > 1 * 1024 * 1024) {
        triggerError("File is too large. Maximum size is 1MB.");
        return;
    }

    updatePetInfo(index, `${field}_file`, file);
    updatePetInfo(index, `${field}_preview`, URL.createObjectURL(file));
  };

  const getFilteredOptions = (currentPet, currentServiceId) => {
    // 1. Get IDs of all services already picked for this pet (except the one being edited)
    const selectedIds = currentPet.services
      .map(s => s.id)
      .filter(id => id !== "" && id !== currentServiceId);

    // 2. Check if a Packaged Service is already in the list
    const hasPackage = currentPet.services.some(s => 
      s.id !== currentServiceId && s.service_type?.toLowerCase().includes('packaged')
    );

    return providerServices.filter(service => {
      // Rule A: Don't show services already picked
      if (selectedIds.includes(service.id)) return false;

      // Rule B: If a package is picked, hide all other "Packaged Service" options
      if (hasPackage && service.type?.toLowerCase().includes('packaged')) return false;

      return true;
    });
  };

    const handleServiceSelect = (petIndex, serviceIndex, e) => {
    const selectedId = e.target.value;
    const sObj = providerServices.find(s => s.id === selectedId);
    
    // Check if adding a duplicate packaged service
    if (sObj?.type?.toLowerCase().includes('package')) {
      const hasExistingPackage = petsData[petIndex].services.some(
        (s, idx) => idx !== serviceIndex && s.service_type?.toLowerCase().includes('package')
      );
      if (hasExistingPackage) {
        triggerError("Only one Packaged Service is allowed per pet.");
        return; 
      }
    }

    setPetsData(prev => {
      const newPetsData = [...prev];
      const targetPet = { ...newPetsData[petIndex] };
      
      // Get price based on current weight/type
      const { price, size } = getServicePriceAndSize(selectedId, targetPet.pet_type, targetPet.weight_kg);

      targetPet.services[serviceIndex] = {
        id: selectedId,
        service_name: sObj?.name || "",
        service_type: sObj?.type?.toLowerCase().includes('package') ? 'Packaged Service' : 'Individual Service',
        price: price // Real-time price from helper
      };

      // Update Pet Total
      targetPet.total_price = targetPet.services.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
      newPetsData[petIndex] = targetPet;
      return newPetsData;
    });
  };


    const getServicePriceAndSize = (serviceId, petType, weight) => {
    const service = providerServices.find(s => s.id === serviceId);
    if (!service || !service.service_options) return { price: "0.00", size: "", matched: false };
    
    const userType = (petType || "Dog").toLowerCase();
    const w = parseFloat(weight) || 0;

    const perfectMatch = service.service_options.find(opt => {
      const dbType = (opt.pet_type || "").toLowerCase();
      const isTypeMatch = dbType === userType || dbType === 'dog-cat';
      
      // Basis logic for weight range
      const range = (opt.weight_range || "").replace(/\s+/g, '').toUpperCase();
      let isWeightMatch = true;
      if (range.includes('-')) {
        const parts = range.split('-');
        isWeightMatch = w >= parseFloat(parts[0]) && w <= parseFloat(parts[1]);
      } else if (range.includes('+')) {
        isWeightMatch = w >= parseFloat(range.replace('+', ''));
      }
      return isTypeMatch && isWeightMatch;
    });

    return perfectMatch 
      ? { price: parseFloat(perfectMatch.price).toFixed(2), size: perfectMatch.size, matched: true }
      : { price: "0.00", size: "N/A", matched: false };
  };

  const getAvailableOptions = (petIndex, currentServiceRowIndex) => {
    const currentPet = petsData[petIndex];
    const currentServiceId = currentPet.services[currentServiceRowIndex]?.id;

    const selectedIds = currentPet.services
      .map(s => s.id)
      .filter(id => id !== "" && id !== currentServiceId);

    const hasPackage = currentPet.services.some((s, idx) => 
      idx !== currentServiceRowIndex && s.service_type?.toLowerCase().includes('packaged')
    );

    return providerServices.filter(s => {
      if (selectedIds.includes(s.id)) return false;
      if (hasPackage && s.type?.toLowerCase().includes('packaged')) return false;
      return true;
    });
  };

  const handleAddServiceRow = (petIndex) => {
    const pet = petsData[petIndex];
    const lastService = pet.services[pet.services.length - 1];

    // Check if the last row is empty to prevent spamming empty fields
    if (lastService && lastService.id === "") {
      // We set a local error state on the pet to show near the field instead of an alert
      setPetsData(prev => {
        const newPets = [...prev];
        newPets[petIndex].service_error = "Please select a service before adding another.";
        return newPets;
      });
      return;
    }

    setPetsData(prev => {
      const newPets = [...prev];
      // Clear the error and add exactly one new row
      newPets[petIndex].service_error = null;
      newPets[petIndex].services = [
        ...newPets[petIndex].services,
        { id: "", service_name: "", service_type: "", price: "0.00" }
      ];
      return newPets;
    });
  };

  const handleRemoveServiceRow = (petIndex, serviceIndex) => {
    setPetsData(prev => {
      const newPets = [...prev];
      newPets[petIndex].services = newPets[petIndex].services.filter((_, idx) => idx !== serviceIndex);
      newPets[petIndex].total_price = newPets[petIndex].services.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
      return newPets;
    });
  };

  // NEW: Remove File Handler
  const handleRemoveFile = (index, field) => {
    const previewUrl = petsData[index][`${field}_preview`];
    if (previewUrl) URL.revokeObjectURL(previewUrl); // Clean up memory
    updatePetInfo(index, `${field}_file`, null);
    updatePetInfo(index, `${field}_preview`, null);
  };

  const calculateGrandTotal = () => petsData.reduce((acc, p) => acc + p.total_price, 0);

  return (
    <div className="pet-details-page">
      <Header />
      <main className="pet-details-container">
        
        {/* HEADER */}
        <div className="header-top-nav">
            <button onClick={() => navigate(-1)} className="btn-back-square"><ArrowLeft size={22}/></button>
            <h1 className="centered-page-title">Pet Information</h1>
            <div className="spacer-right"></div>
        </div>

        {/* SUMMARY AREA */}
        <div className="summary-info-grid">
            <div className="info-left">
                <div className="main-datetime">
                    <Calendar size={18} className="icon-gap" /> {formatLongDate(state?.bookingDate)} at {formatTime12h(state?.bookingTime)}
                </div>
                <div className="main-total-price">
                    Total Amount: ₱{calculateGrandTotal().toFixed(2)}
                </div>
            </div>
            <div className="info-right">
                <div className="main-downpayment">
                    <CreditCard size={18} className="icon-gap" /> 30% Down Payment: <strong>₱{(calculateGrandTotal() * 0.3).toFixed(2)}</strong>
                </div>
                <button 
                  className="btn-proceed-large" 
                  onClick={() => {
                    const result = validateForm();
                    if (result.valid) setShowSummaryModal(true);
                    else triggerError(result.msg);
                  }}
                >
                  Proceed to Summary <ArrowRight size={18}/>
                </button>
            </div>
        </div>
        {/* POLICIES SECTION */}
        <div className="policies-container">
            <button className="policies-toggle-bar" onClick={() => setShowPolicies(!showPolicies)}>
                <div className="label-flex"><AlertCircle size={20}/> Booking Policies & Conditions</div>
                {showPolicies ? <ChevronUp /> : <ChevronDown />}
            </button>
            {showPolicies && (
                <div className="policies-body">
                    <div className="policy-item"><strong>1. Booking & Vaccination:</strong> All pets must have valid proof of vaccination.</div>
                    <div className="policy-item"><strong>2. Non-Refundable Down Payment:</strong> 30% down payment is required to secure slot.</div>
                    <div className="policy-item"><strong>3. Aggressive Behavior:</strong> Owners must accurately disclose pet behavior.</div>
                    <div className="policy-item"><strong>4. Late Arrivals:</strong> Rescheduling may occur for arrivals 15+ mins late.</div>
                </div>
            )}
        </div>

       {/* PET FORMS GRID */}
        <div className="pet-cards-grid">
            {petsData.map((pet, index) => (
                <div key={index} className="pet-card-wrapper">
                    <div className="card-top-bar">
                        <span className="pet-count-label">Pet #{index + 1}</span>
                        <div className="card-actions">
                            <span className="individual-price">₱{pet.total_price.toFixed(2)}</span>
                            {petsData.length > 1 && (
                                <button type="button" className="circle-btn delete" onClick={() => setPetsData(petsData.filter((_, i) => i !== index))}><Trash2 size={16}/></button>
                            )}
                            <button type="button" className="circle-btn add" onClick={() => setPetsData([...petsData, getEmptyPet(availablePetTypes[0])])}><Plus size={16}/></button>
                        </div>
                    </div>

                    <div className="card-form-body">
                        {/* --- SERVICE SELECTION SECTION --- */}
                        <div className="form-section-label" style={{ fontWeight: '600', marginBottom: '10px', color: '#0E2679' }}>
                            Service Selection
                        </div>

                        <div className="service-rows-container">
                          {pet.services.map((service, sIndex) => {
                            const availableOptions = getAvailableOptions(index, sIndex);

                            return (
                              <div key={sIndex} className="service-selection-row" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
                                <div className={`input-group ${attemptedSubmit && !service.id ? 'field-error' : ''}`} style={{ flex: 1 }}>
                                  <label className="form-label">
                                    {sIndex === 0 && <Tag size={14} className="label-icon" />}
                                    {service.id 
                                      ? `${service.service_name} (${service.service_type})` 
                                      : `Select Service ${sIndex + 1} *`}
                                  </label>
                                  
                                  <div className="service-input-group" style={{ display: 'flex', gap: '8px' }}>
                                    <div className="select-wrapper" style={{ flex: 1 }}>
                                      <select className="form-input" value={service.id} onChange={(e) => handleServiceSelect(index, sIndex, e)}>
                                        <option value="">Choose a Service</option>
                                        {availableOptions.map(s => (
                                          <option key={s.id} value={s.id}>
                                            {s.name} ({s.type.toLowerCase().includes('package') ? 'Packaged Service' : 'Individual Service'})
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="service-row-actions" style={{ display: 'flex', gap: '5px' }}>
                                      {/* Only show PLUS if this is the last row to prevent bulk adding */}
                                      {sIndex === pet.services.length - 1 ? (
                                        <button type="button" className="circle-btn add" onClick={() => handleAddServiceRow(index)}>
                                          <Plus size={14} />
                                        </button>
                                      ) : null}

                                      {pet.services.length > 1 && (
                                        <button type="button" className="circle-btn delete" onClick={() => handleRemoveServiceRow(index, sIndex)}>
                                          <Minus size={14} />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {service.id && (
                                    <div className="service-price-hint" style={{ fontSize: '0.8rem', marginTop: '4px', color: '#2563eb', fontWeight: '600' }}>
                                      Price: ₱{service.price}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* INLINE ERROR DISPLAY */}
                          {pet.service_error && (
                            <div className="inline-error-msg" style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <AlertCircle size={14} /> {pet.service_error}
                            </div>
                          )}
                        </div>

                        <hr style={{ margin: '20px 0', border: '0', borderTop: '1px solid #eee' }} />

                        {/* --- PET INFORMATION SECTION --- */}
                        <div className="form-section-label" style={{ fontWeight: '600', marginBottom: '10px', color: '#0E2679' }}>
                            Pet Information
                        </div>

                        <div className="form-row-2">
                            <div className="input-group">
                                <label>Pet Type <span className="required-star">*</span></label>
                                <select value={pet.pet_type} onChange={(e) => updatePetInfo(index, 'pet_type', e.target.value)}>
                                    {availablePetTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className={`input-group ${attemptedSubmit && !pet.pet_name.trim() ? 'field-error' : ''}`}>
                                <label>Pet's Name <span className="required-star">*</span></label>
                                <input type="text" placeholder="Pet Name" value={pet.pet_name} onChange={(e) => updatePetInfo(index, 'pet_name', e.target.value)} />
                                {attemptedSubmit && !pet.pet_name.trim() && <span className="error-text" style={{color: 'red', fontSize: '11px'}}>Name is required</span>}
                            </div>
                        </div>

                        <div className="form-row-2">
                            <div className={`input-group ${attemptedSubmit && !pet.breed.trim() ? 'field-error' : ''}`}>
                                <label>Breed <span className="required-star">*</span></label>
                                <input type="text" placeholder="Breed" value={pet.breed} onChange={(e) => updatePetInfo(index, 'breed', e.target.value)} />
                                {attemptedSubmit && !pet.breed.trim() && <span className="error-text" style={{color: 'red', fontSize: '11px'}}>Breed is required</span>}
                            </div>
                            <div className="input-group">
                                <label>Gender <span className="required-star">*</span></label>
                                <select value={pet.gender} onChange={(e) => updatePetInfo(index, 'gender', e.target.value)}>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row-2">
                            <div className={`input-group ${attemptedSubmit && !pet.birth_date ? 'field-error' : ''}`}>
                                <label>Date of Birth <span className="required-star">*</span></label>
                                <input type="date" max={new Date().toISOString().split("T")[0]} value={pet.birth_date} onChange={(e) => updatePetInfo(index, 'birth_date', e.target.value)} />
                                {attemptedSubmit && !pet.birth_date && <span className="error-text" style={{color: 'red', fontSize: '11px'}}>DOB is required</span>}
                            </div>
                            <div className={`input-group ${attemptedSubmit && (!pet.weight_kg || parseFloat(pet.weight_kg) <= 0) ? 'field-error' : ''}`}>
                                <label>Weight (kg) <span className="required-star">*</span></label>
                                <input type="number" placeholder="0.0" value={pet.weight_kg} onChange={(e) => updatePetInfo(index, 'weight_kg', e.target.value)} />
                                {attemptedSubmit && (!pet.weight_kg || parseFloat(pet.weight_kg) <= 0) && <span className="error-text" style={{color: 'red', fontSize: '11px'}}>Valid weight is required</span>}
                            </div>
                        </div>

                        <div className="realtime-size-display">
                            Calculated Size: <span>{pet.calculated_size}</span>
                        </div>

                        <div className="behavior-container">
                            <label className="sub-label">Pet Behavior <span className="required-star">*</span></label>
                            <div className="behavior-row-5">
                                {BEHAVIOR_OPTIONS.map(opt => (
                                    <label key={opt} className="check-item">
                                        <input 
                                            type="checkbox" 
                                            checked={(pet.behavior || []).includes(opt)} 
                                            onChange={(e) => {
                                                const currentBehavior = Array.isArray(pet.behavior) ? pet.behavior : [];
                                                const newBehavior = e.target.checked 
                                                    ? [...currentBehavior, opt] 
                                                    : currentBehavior.filter(b => b !== opt);
                                                updatePetInfo(index, 'behavior', newBehavior);
                                            }} 
                                        /> {opt}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="medical-uploads-container">
                            <label className="sub-label">Medical Records</label>
                            <div className="upload-buttons-flex">
                                <div className={`upload-btn-wrap ${attemptedSubmit && !pet.vaccine_file ? 'upload-error' : ''}`}>
                                    {!pet.vaccine_preview ? (
                                        <label className="upload-btn vaccine">
                                            <input type="file" accept=".png, .jpg, .jpeg" onChange={(e) => handleFileUpload(index, 'vaccine', e)} hidden />
                                            <UploadCloud size={18} /> Vaccine Record <span className="required-star">*</span>
                                        </label>
                                    ) : (
                                        <div className="preview-container">
                                            <img src={pet.vaccine_preview} className="mini-preview" onClick={() => setSelectedImage(pet.vaccine_preview)} alt="prev"/>
                                            <button type="button" className="remove-img-btn" onClick={() => handleRemoveFile(index, 'vaccine')}><X size={14}/></button>
                                        </div>
                                    )}
                                    {attemptedSubmit && !pet.vaccine_file && <span className="error-text" style={{color: 'red', fontSize: '10px', display: 'block', textAlign: 'center'}}>Required</span>}
                                </div>

                                <div className="upload-btn-wrap">
                                    {!pet.illness_preview ? (
                                        <label className="upload-btn illness">
                                            <input type="file" accept=".png, .jpg, .jpeg" onChange={(e) => handleFileUpload(index, 'illness', e)} hidden />
                                            <FileText size={18} /> Illness Record
                                        </label>
                                    ) : (
                                        <div className="preview-container">
                                            <img src={pet.illness_preview} className="mini-preview" onClick={() => setSelectedImage(pet.illness_preview)} alt="prev"/>
                                            <button type="button" className="remove-img-btn" onClick={() => handleRemoveFile(index, 'illness')}><X size={14}/></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="specifications-container" style={{ marginTop: '20px' }}>
                            <label className="sub-label">Grooming Specifications</label>
                            <textarea className="spec-textarea" maxLength={500} value={pet.grooming_specifications || ""} onChange={(e) => updatePetInfo(index, 'grooming_specifications', e.target.value)} style={{ width: '100%', minHeight: '100px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} />
                        </div>

                        <div className="emergency-consent-container" style={{ marginTop: '15px' }}>
                            <label style={{ display: 'flex', gap: '10px', fontSize: '13px' }}>
                                <input type="checkbox" checked={pet.emergency_consent} onChange={(e) => updatePetInfo(index, 'emergency_consent', e.target.checked)} />
                                <span>I agree that in a critical emergency, the Provider has permission to transport my pet to the nearest emergency facility.</span>
                            </label>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* NEW: IMAGE FULL VIEW MODAL */}
        {selectedImage && (
          <div className="image-fullview-overlay" onClick={() => setSelectedImage(null)}>
            <div className="fullview-content" onClick={(e) => e.stopPropagation()}>
              <button className="close-fullview" onClick={() => setSelectedImage(null)}><X size={24}/></button>
              <img src={selectedImage} alt="Full view" className="fullview-img" />
            </div>
          </div>
        )}

        {/* --- SUMMARY MODAL --- */}
        {showSummaryModal && (
          <div className="summary-modal-overlay">
            <div className="summary-modal-content">
              <div className="modal-header">
                <h2>Booking Summary</h2>
                <button className="close-modal" onClick={() => setShowSummaryModal(false)}><X size={24}/></button>
              </div>

              <div className="modal-body">
                <div className="summary-section">
                  <h3><Calendar size={18} /> Schedule</h3>
                  <p>{formatLongDate(state?.bookingDate)} at {formatTime12h(state?.bookingTime)}</p>
                </div>

                <div className="summary-section">
                  <h3><Cat size={18} /> Pet Details</h3>
                  {petsData.map((p, i) => (
                    <div key={i} className="pet-summary-item">
                      <div className="summary-row">
                        <strong>Pet #{i + 1}: {p.pet_name || "Unnamed"}</strong>
                        <span>₱{p.total_price.toFixed(2)}</span>
                      </div>
                      <p className="summary-subtext">{p.breed} • {p.gender} • {p.calculated_size}</p>
                      
                      {p.grooming_specifications && (
                        <div className="summary-note">
                          <strong>Notes:</strong> {p.grooming_specifications}
                        </div>
                      )}
                      
                      <div className={`consent-badge ${p.emergency_consent ? 'granted' : 'none'}`}>
                        {p.emergency_consent ? "✓ Emergency Consent Granted" : "✕ No Emergency Consent"}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="summary-total-box">
                  <div className="total-row">
                    <span>Grand Total:</span>
                    <strong>₱{calculateGrandTotal().toFixed(2)}</strong>
                  </div>
                  <div className="total-row downpayment">
                    <span>30% Down Payment:</span>
                    <strong>₱{(calculateGrandTotal() * 0.3).toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-cancel-modal" onClick={() => setShowSummaryModal(false)}>Edit Details</button>
                <button 
                  className="btn-confirm-booking" 
                  onClick={handleFinalSubmit}
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Confirm Booking"} <ArrowRight size={18} className="icon-left"/>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default PetDetails;