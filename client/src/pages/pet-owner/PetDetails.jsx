import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { 
  Calendar, Weight, Activity, Cat, AlertCircle,
  UploadCloud, FileText, Trash2, Plus, ArrowRight,
  CreditCard, ArrowLeft, X, 
  Maximize2, Minus, Tag, Clock, ShieldCheck, CheckCircle
} from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./PetDetails.css";

const BEHAVIOR_OPTIONS = ["Friendly / Social", "Aggressive / Reactive", "Anxious / Nervous", "High Energy", "House Trained"];

// Helper to convert file to Base64 string for Gemini
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]); 
    reader.onerror = (error) => reject(error);
  });
};

// List of styles for the dropdown
const DOG_HAIRSTYLES = ["Lion Cut", "Teddy Bear", "Summer Shave", "Poodle Show Cut", "Puppy Cut"];
const CAT_HAIRSTYLES = ["Lion Cut", "Belly Shave", "Comb Cut", "Dragon Cut", "Sanitary Cut"];

const PetDetails = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  
  const [petsData, setPetsData] = useState([]);
  const [providerServices, setProviderServices] = useState([]);
  const [availablePetTypes, setAvailablePetTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const [registeredPets, setRegisteredPets] = useState([]);
  const [showAutofillMenu, setShowAutofillMenu] = useState(null); // Tracks which pet index is opening the menu

  // --- NEW: Global Error State for Validation ---
  const [globalError, setGlobalError] = useState("");

  // --- Success Modal State ---
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // --- Payment Breakdown Toggle State ---
  const [showBreakdown, setShowBreakdown] = useState(false);

  // --- Breed Data State (Full List for Validation) ---
  const [validationBreeds, setValidationBreeds] = useState({ Dog: [], Cat: [] });

  // --- Capacity Data State ---
  const [maxSlots, setMaxSlots] = useState(1);
  const [occupiedSlots, setOccupiedSlots] = useState(0);

  // --- Fetch Breeds API ---
  useEffect(() => {
    const fetchBreeds = async () => {
      try {
        // Initialize with Standard + Local Variations
        const fullLists = { 
            Dog: ["Mixed Breed", "Unknown", "Aspin", "Askal"], 
            Cat: ["Mixed Breed", "Unknown", "Puspin", "Pusakal"] 
        };

        // 1. Fetch Dogs
        const dogRes = await fetch('https://dog.ceo/api/breeds/list/all');
        if (dogRes.ok) {
          const dogData = await dogRes.json();
          // Capitalize first letter
          const dogs = Object.keys(dogData.message).map(b => b.charAt(0).toUpperCase() + b.slice(1));
          // Merge and deduplicate
          fullLists.Dog = [...new Set([...fullLists.Dog, ...dogs])];
        }

        // 2. Fetch Cats
        const catRes = await fetch('https://api.thecatapi.com/v1/breeds');
        if (catRes.ok) {
          const catData = await catRes.json();
          const cats = catData.map(c => c.name);
          // Merge and deduplicate
          fullLists.Cat = [...new Set([...fullLists.Cat, ...cats])];
        }

        setValidationBreeds(fullLists);
      } catch (error) {
        console.error("Error fetching breed data:", error);
      }
    };
    fetchBreeds();
  }, []);

  const getBookingDetails = () => {
    if (!state?.bookingDate) return { day: "", date: "", time: "" };
    const dateObj = new Date(state.bookingDate);
    return {
      day: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
      date: dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      time: formatTime12h(state?.bookingTime)
    };
  };

  useEffect(() => {
    const fetchRegisteredPets = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("registered_pets")
        .select("*")
        .eq("owner_id", user.id);

      if (!error) setRegisteredPets(data || []);
    };
    fetchRegisteredPets();
  }, []);
  
  const handleAutofill = (petIndex, selectedPet) => {
    setPetsData(prev => {
      const newPets = [...prev];
      newPets[petIndex] = {
        ...newPets[petIndex],
        registered_pet_id: selectedPet.id,
        pet_name: selectedPet.name,
        pet_type: selectedPet.pet_type,
        breed: selectedPet.breed,
        gender: selectedPet.gender,
        birth_date: selectedPet.birth_date,
        weight_kg: selectedPet.weight_kg.toString(),
        behavior: selectedPet.behavior ? selectedPet.behavior.split(", ") : [],
        vaccine_preview: selectedPet.vaccine_card_url,
        vaccine_file: null, // We mark file as null because we are using the URL reference
        illness_preview: selectedPet.illness_proof_url,
        illness_file: null,
        grooming_specifications: selectedPet.grooming_specifications || "",
        emergency_consent: selectedPet.emergency_consent || false,
      };
      
      // Trigger the weight-based price calculation immediately for the selected pet
      const currentWeight = selectedPet.weight_kg;
      const currentType = selectedPet.pet_type;
      
      newPets[petIndex].services = newPets[petIndex].services.map(srv => {
        if (!srv.id) return srv;
        const result = getServicePriceAndSize(srv.id, currentType, currentWeight);
        if (result.matched && result.size !== "N/A") {
          newPets[petIndex].calculated_size = result.size.toUpperCase();
        }
        return { ...srv, price: result.price, matched: result.matched };
      });

      newPets[petIndex].total_price = newPets[petIndex].services.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
      return newPets;
    });
    setShowAutofillMenu(null);
  };

  // Check if breed is valid based on API lists (Case Insensitive)
  const isValidBreed = (breedInput, type) => {
    if (!breedInput || !breedInput.trim()) return false;
    
    // Check against API list (which now includes local variants)
    const list = validationBreeds[type];
    if (!list || list.length === 0) return true; // If no list loaded (e.g. Rabbit), accept anything
    
    return list.some(b => b.toLowerCase() === breedInput.trim().toLowerCase());
  };

  const formatDOB = (dateStr) => {
    if (!dateStr) return "N/A";
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
  };

  // State for Full View Modal
  const [selectedImage, setSelectedImage] = useState(null);

  const initialProviderId = state?.providerId || sessionStorage.getItem('current_provider_id');

  // Updated: Set global error text instead of alert
  const triggerError = (msg) => setGlobalError(msg);

  const handleGenerateAIHaircut = async (index) => {
    const pet = petsData[index];
    updatePetInfo(index, 'ai_error', null);

    // Weight and Breed are now the primary "Anchors" for the AI
    if (!pet.breed || !pet.weight_kg) {
      return updatePetInfo(index, 'ai_error', "Please ensure Breed and Weight are filled for accurate styling.");
    }

    updatePetInfo(index, 'ai_loading', true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-pet-haircut', {
        body: { 
          hairstyle: pet.ai_selected_style,
          petType: pet.pet_type,
          breed: pet.breed,
          weight: pet.weight_kg,
          groomingSpecs: pet.grooming_specifications || "professional cut" 
        }
      });

      if (data?.generatedImageUrl && !error) {
        // SUCCESS: Use the generated URL directly
        updatePetInfo(index, 'ai_generated_preview', data.generatedImageUrl);
      } else {
        updatePetInfo(index, 'ai_error', "Analyzing breed features... try again in a moment.");
      }
    } catch (err) {
      updatePetInfo(index, 'ai_error', "Connection reset. Retrying generation...");
    } finally {
      updatePetInfo(index, 'ai_loading', false);
    }
  };

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
    registered_pet_id: null,
    services: [{ id: "", service_name: "", service_type: "", price: "0.00" }],
    pet_name: "", pet_type: type, breed: "", gender: "Male", birth_date: "", weight_kg: "",
    calculated_size: "Auto-calc", behavior: [], vaccine_file: null, vaccine_preview: null,
    illness_file: null, illness_preview: null, total_price: 0, grooming_specifications: "", emergency_consent: false,
    ai_selected_style: "Lion Cut",
    ai_loading: false,
    ai_confirmed: false,
    ai_reference_file: null,
    ai_reference_preview: null,
    ai_generated_preview: null,
    selected_haircut: ""
  });

  // --- Fetch Initial Data (Services and Capacity) ---
  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch Services
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

      // 2. Fetch Provider Capacity for specific date/time
      if (state?.bookingDate && initialProviderId) {
        const dayName = new Date(state.bookingDate).toLocaleDateString('en-US', { weekday: 'long' });
        
        const { data: hourData } = await supabase
          .from("service_provider_hours")
          .select("slot_capacity")
          .eq("provider_id", initialProviderId)
          .eq("day_of_week", dayName)
          .single();

        const { data: bookings } = await supabase
          .from("bookings")
          .select("id")
          .eq("provider_id", initialProviderId)
          .eq("booking_date", state.bookingDate)
          .eq("time_slot", state.bookingTime)
          .not("status", "in", '("cancelled", "rejected")');

        setMaxSlots(hourData?.slot_capacity || 1);
        setOccupiedSlots(bookings?.length || 0);
      }

      setLoading(false);
    };
    fetchData();
  }, [initialProviderId, state]);

  // --- Add a new Pet Form based on capacity ---
  const handleAddPet = () => {
    const currentRemaining = maxSlots - occupiedSlots;
    if (petsData.length < currentRemaining) {
      setPetsData([...petsData, getEmptyPet(availablePetTypes[0])]);
    }
  };

  const validateForm = () => {
      setAttemptedSubmit(true);
      let errorMsg = "";
      
      const hasInvalidPets = petsData.some(pet => {
        const isBreedValid = isValidBreed(pet.breed, pet.pet_type);
        const hasVaccine = pet.vaccine_file || pet.vaccine_preview;
        const serviceSelected = pet.services.every(s => s.id);
        
        // ⭐ Strict requirement: If the service includes a haircut, style and specs are mandatory
        const haircutRequirementMet = pet.needs_haircut 
          ? (pet.selected_haircut && pet.grooming_specifications?.trim().length > 0) 
          : true;

        return !pet.pet_name.trim() || !isBreedValid || !hasVaccine || !serviceSelected || !haircutRequirementMet;
      });

      if (hasInvalidPets) {
        errorMsg = "Please complete all required fields. Services with haircuts require a style selection and grooming instructions.";
        setGlobalError(errorMsg);
        return { valid: false };
      }
      return { valid: true };
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

  // --- UPDATED CALCULATION LOGIC (VAT INCLUSIVE) ---
  // Grand Total is simply the sum of all pet service prices (which are inclusive)
  const calculateGrandTotal = () => petsData.reduce((acc, p) => acc + p.total_price, 0);
  
  // VAT is extracted from the inclusive amount: (Total * 12) / 112
  const calculateVAT = () => (calculateGrandTotal() * 12) / 112;
  
  // Base Price (Total - VAT)
  const calculateBasePrice = () => calculateGrandTotal() - calculateVAT();

  // Down Payment is 30% of the Inclusive Total
  const calculateDownPayment = () => calculateGrandTotal() * 0.30;

const handleFinalSubmit = async () => {
  setLoading(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // 1. Prepare Metadata Payload
    const bookingPayload = {
      user_id: user.id,
      provider_id: initialProviderId,
      booking_date: state?.bookingDate,
      time_slot: state?.bookingTime,
      total_estimated_price: calculateGrandTotal(),
      status: 'for approval',
      pets: petsData.map(p => ({
        registered_pet_id: p.registered_pet_id,
        pet_name: p.pet_name,
        pet_type: p.pet_type,
        breed: p.breed,
        gender: p.gender,
        weight_kg: parseFloat(p.weight_kg),
        birth_date: p.birth_date,
        calculated_size: p.calculated_size,
        behavior: Array.isArray(p.behavior) ? p.behavior.join(', ') : p.behavior,
        selected_haircut: p.selected_haircut || "Standard Grooming",
        grooming_specifications: p.grooming_specifications,
        emergency_consent: p.emergency_consent,
        vaccine_url: p.vaccine_preview,
        services: p.services 
      }))
    };

    // 2. Call Edge Function 
    // ⭐ FIX: We must send 'metadata' and 'totalAmount' keys
    const { data, error } = await supabase.functions.invoke('create-paymongo-checkout', {
      body: { 
        metadata: bookingPayload, 
        totalAmount: calculateGrandTotal() 
      }
    });

    if (error) throw error;
    if (data?.checkout_url) window.location.href = data.checkout_url;

  } catch (error) {
    console.error(error);
    triggerError("Redirect failed: " + error.message);
  } finally {
    setLoading(false);
  }
};
 const handleFinish = () => {
    navigate("/dashboard", { state: { success: true } });
 };
  
const updatePetInfo = (index, field, value) => {
    setPetsData(prev => {
        const newPets = [...prev];
        const targetPet = { ...newPets[index] };
        
        targetPet[field] = value;

        if (field === "weight_kg" || field === "pet_type") {
            const currentWeight = targetPet.weight_kg; 
            const currentType = targetPet.pet_type;
            
            // Set a default placeholder while calculating
            targetPet.calculated_size = "PENDING";

            targetPet.services = targetPet.services.map(srv => {
                if (!srv.id) return srv;
                
                const result = getServicePriceAndSize(srv.id, currentType, currentWeight);
                
                // SYNC SIZE: If a match is found, convert the provider's 'size' label to ALL CAPS
                if (result.matched && result.size !== "N/A") {
                    targetPet.calculated_size = result.size.toUpperCase();
                }
                
                return { 
                    ...srv, 
                    price: result.price, 
                    matched: result.matched 
                };
            });

            if (field === "pet_type") targetPet.breed = "";

            targetPet.total_price = targetPet.services.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
        }
        
        newPets[index] = targetPet;
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

    // ⭐ Important: Clear the preview first to ensure the system treats this as a NEW file
    updatePetInfo(index, `${field}_preview`, URL.createObjectURL(file));
    updatePetInfo(index, `${field}_file`, file);
  };

  const getFilteredOptions = (currentPet, currentServiceId) => {
    // 1. Get IDs of all services already picked for this pet (except the one being edited)
    const selectedIds = currentPet.services
      .map(s => s.id)
      .filter(id => id !== "" && id !== currentServiceId);

    // 2. Check if a Packaged Service is already in the list
    const hasPackage = currentPet.services.some(s => 
      s.id !== currentServiceId && s.service_type?.toLowerCase().includes('package')
    );

    return providerServices.filter(service => {
      // Rule A: Don't show services already picked
      if (selectedIds.includes(service.id)) return false;

      // Rule B: If a package is picked, hide all other "Packaged Service" options
      if (hasPackage && service.type?.toLowerCase().includes('package')) return false;

      return true;
    });
  };

   const handleServiceSelect = (petIndex, serviceIndex, e) => {
    const selectedId = e.target.value;
    const sObj = providerServices.find(s => s.id === selectedId);
    
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
        const updatedServices = [...targetPet.services];

        const { price, matched } = getServicePriceAndSize(selectedId, targetPet.pet_type, targetPet.weight_kg);

        updatedServices[serviceIndex] = {
            id: selectedId,
            service_name: sObj?.name || "",
            service_type: sObj?.type?.toLowerCase().includes('package') ? 'Packaged Service' : 'Individual Service',
            price: price,
            matched: matched,
            has_haircut: sObj?.has_haircut || false // ⭐ Store the haircut requirement here
        };

        targetPet.services = updatedServices;
        
        // ⭐ Check if ANY selected service for this pet needs a haircut
        targetPet.needs_haircut = updatedServices.some(s => s.has_haircut === true);

        targetPet.total_price = targetPet.services.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
        newPetsData[petIndex] = targetPet;
        return newPetsData;
    });
};


const getServicePriceAndSize = (serviceId, petType, weight) => {
    const service = providerServices.find(s => s.id === serviceId);
    if (!service || !service.service_options) return { price: 0, size: "N/A", matched: false };
    
    const userType = (petType || "Dog").toLowerCase();
    const w = parseFloat(weight) || 0;

    const match = service.service_options.find(opt => {
        const dbType = (opt.pet_type || "").toLowerCase();
        const dbSize = (opt.size || "").toUpperCase();
        
        const isTypeMatch = dbType === userType || dbType === 'dog-cat';
        if (!isTypeMatch) return false;

        if (['N/A', 'CAT', 'ALL', 'ANY', 'UNIVERSAL'].includes(dbSize)) return true;

        const range = (opt.weight_range || "").replace(/\s+/g, '').toUpperCase();
        if (range.includes('-')) {
            const [min, max] = range.split('-').map(parseFloat);
            return w >= min && w <= max;
        } else if (range.includes('+')) {
            const min = parseFloat(range.replace('+', ''));
            return w >= min;
        }
        return false;
    });

    return match 
        ? { price: parseFloat(match.price), size: match.size, matched: true }
        : { price: 0, size: "N/A", matched: false };
  };

  const handleAddServiceRow = (petIndex) => {
    const pet = petsData[petIndex];
    const lastService = pet.services[pet.services.length - 1];

    if (lastService && lastService.id === "") {
      setPetsData(prev => {
        const newPets = [...prev];
        const updatedPet = { ...newPets[petIndex] }; // Fix: Shallow copy the specific pet object to avoid React double-firing mutation
        updatedPet.service_error = "Please select a service before adding another field.";
        newPets[petIndex] = updatedPet;
        return newPets;
      });
      return;
    }

    setPetsData(prev => {
      const newPets = [...prev];
      const updatedPet = { ...newPets[petIndex] }; // Fix: Copy pet object so array spread works perfectly inside strict mode
      updatedPet.service_error = null;
      updatedPet.services = [
        ...updatedPet.services, 
        { id: "", service_name: "", service_type: "", price: "0.00" }
      ];
      newPets[petIndex] = updatedPet;
      return newPets;
    });
  };

  const handleRemoveServiceRow = (petIndex, serviceIndex) => {
      setPetsData(prev => {
          const newPets = [...prev];
          const updatedPet = { ...newPets[petIndex] };
          
          const filteredServices = updatedPet.services.filter((_, idx) => idx !== serviceIndex);
          updatedPet.services = filteredServices;
          
          // ⭐ Re-evaluate if a haircut is still needed
          updatedPet.needs_haircut = filteredServices.some(s => s.has_haircut === true);
          
          // If no longer needed, clear out haircut-related data
          if (!updatedPet.needs_haircut) {
              updatedPet.selected_haircut = "";
              updatedPet.ai_generated_preview = null;
              updatedPet.ai_confirmed = false;
          }

          updatedPet.total_price = updatedPet.services.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
          newPets[petIndex] = updatedPet;
          return newPets;
      });
  };

  // Remove File Handler
  const handleRemoveFile = (index, field) => {
    const previewUrl = petsData[index][`${field}_preview`];
    if (previewUrl) URL.revokeObjectURL(previewUrl); // Clean up memory
    updatePetInfo(index, `${field}_file`, null);
    updatePetInfo(index, `${field}_preview`, null);
  };

  const bookingInfo = getBookingDetails();

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

        {/* SUMMARY AREA (TOP BAR) */}
        <div className="booking-header-responsive">
            <div className="header-left-schedule">
                <div className="schedule-unified-box">
                    <div className="schedule-item">
                        <Clock size={16} className="text-blue" /> 
                        <span className="label">Day:</span> <strong>{bookingInfo.day}</strong>
                    </div>
                    <div className="schedule-item">
                        <Calendar size={16} className="text-red" /> 
                        <span className="label">Date:</span> <strong>{bookingInfo.date}</strong>
                    </div>
                    <div className="schedule-item">
                        <Tag size={16} className="text-green" /> 
                        <span className="label">Time:</span> <strong>{bookingInfo.time}</strong>
                    </div>
                </div>
            </div>

            <div className="header-right-action">
                <div className="action-stack">
                    <div className="price-box-mini">
                        <span className="total-label">GRAND TOTAL</span>
                        <h2 className="total-value">₱{calculateGrandTotal().toFixed(2)}</h2>
                        <span className="vat-notice-tag">VAT INCLUSIVE</span>
                    </div>
                    
                    <button 
                      className="btn-review-main" 
                      onClick={() => {
                        setGlobalError("");
                        const result = validateForm();
                        if (result.valid) setShowSummaryModal(true);
                      }}
                    >
                      Review Summary <ArrowRight size={20}/>
                    </button>
                </div>
            </div>
        </div>

        {/* --- FULL WIDTH ACTION REQUIRED BANNER --- */}
        {globalError && (
          <div className="validation-alert-banner">
            <div className="alert-content">
              <AlertCircle size={28} strokeWidth={2.5} />
              <div>
                <strong className="alert-heading">Action Required</strong>
                <p className="alert-text">{globalError}</p>
              </div>
            </div>
            <button onClick={() => setGlobalError("")} className="close-alert-btn">
              <X size={20}/>
            </button>
          </div>
        )}

       {/* PET FORMS GRID */}
        <div className="pet-cards-grid">
            {petsData.map((pet, index) => (
                <div key={index} className="pet-card-container">
                    
                    {/* EXTERNAL ADD BUTTON WRAPPER - Above the most recently added form */}
                    <div className="external-add-wrapper">
                        {index === petsData.length - 1 && petsData.length < (maxSlots - occupiedSlots) && (
                            <button type="button" className="btn-add-pet-external" onClick={handleAddPet}>
                                <Plus size={18}/> Add a pet
                            </button>
                        )}
                    </div>

                    <div className="pet-card-wrapper">
                        <div className="card-top-bar">
                            <span className="pet-count-label">Pet #{index + 1}</span>
                            <div className="card-actions">
                              <span className="individual-price">₱{pet.total_price.toFixed(2)}</span>
                              
                              {/* SHOW DELETE IF MORE THAN 1 PET */}
                              {petsData.length > 1 && (
                                <button type="button" className="circle-btn delete" onClick={() => setPetsData(petsData.filter((_, i) => i !== index))}>
                                  <Trash2 size={16}/>
                                </button>
                              )}
                          </div>
                        </div>

                        <div className="card-form-body">
                            {/* --- SERVICE SELECTION SECTION --- */}
                            <div className="form-section-label" style={{ fontWeight: '600', marginBottom: '10px', color: '#0E2679' }}>
                                Service Selection
                            </div>

                            <div className="service-rows-container">
                              {pet.services.map((service, sIndex) => {
                                const availableOptions = getFilteredOptions(pet, service.id);
                                
                                // CALCULATE MAX ROWS ALLOWED
                                // Selected + Available remaining for a hypothetical new row
                                const selectedCount = pet.services.filter(s => s.id !== "").length;
                                const optionsForNewRow = getFilteredOptions(pet, "").length;
                                const maxAllowedRows = selectedCount + optionsForNewRow;

                                // Validation flags for individual row styling
                                const isEmpty = attemptedSubmit && !service.id;
                                
                                // MODIFIED: Mismatch error now only shows on submit, OR if weight is actively filled out
                                const isMismatched = service.id && service.matched === false && (attemptedSubmit || (pet.weight_kg && parseFloat(pet.weight_kg) > 0));
                                
                                const hasError = isEmpty || isMismatched;

                                return (
                                  <div key={sIndex} className="service-selection-row" style={{ marginBottom: '20px' }}>
                                    <div className={`input-group ${hasError ? 'field-error' : ''}`} style={{ flex: 1 }}>
                                      <label className="form-label" style={{ color: hasError ? '#dc2626' : '#0E2679', fontWeight: '700' }}>
                                        {sIndex === 0 && <Tag size={14} className="label-icon" />}
                                        {service.id ? `${service.service_name} (${service.service_type})` : `Select Service ${sIndex + 1} *`}
                                      </label>

                                      <div className="service-input-group" style={{ display: 'flex', gap: '8px' }}>
                                        <select 
                                          className="form-input" 
                                          style={{
                                            flex: 1,
                                            border: hasError ? '2px solid #dc2626' : '1px solid #cbd5e1',
                                            backgroundColor: hasError ? '#fff1f1' : '#fdfdfe'
                                          }} 
                                          value={service.id} 
                                          onChange={(e) => handleServiceSelect(index, sIndex, e)}
                                        >
                                          <option value="">Choose a Service</option>
                                          {availableOptions.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                                          ))}
                                        </select>

                                        <div className="service-row-actions" style={{ display: 'flex', gap: '5px' }}>
                                          {sIndex === pet.services.length - 1 && pet.services.length < maxAllowedRows && (
                                            <button type="button" className="circle-btn add" onClick={() => handleAddServiceRow(index)}>
                                              <Plus size={14} />
                                            </button>
                                          )}
                                          {pet.services.length > 1 && (
                                            <button type="button" className="circle-btn delete" onClick={() => handleRemoveServiceRow(index, sIndex)}>
                                              <Minus size={14} />
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {/* --- INLINE ERROR MESSAGES NEAR FIELD --- */}
                                      {isEmpty && (
                                        <div className="error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '6px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <AlertCircle size={14} /> Please select a service for this slot.
                                        </div>
                                      )}

                                      {isMismatched && (
                                        <div style={{ 
                                          marginTop: '8px',
                                          padding: '10px',
                                          backgroundColor: '#fee2e2',
                                          border: '1px solid #ef4444',
                                          borderRadius: '8px',
                                          animation: 'shake 0.3s ease-in-out'
                                        }}>
                                          <span style={{ 
                                            color: '#991b1b', 
                                            fontSize: '0.8rem', 
                                            display: 'flex', 
                                            alignItems: 'flex-start', 
                                            gap: '6px', 
                                            fontWeight: '700',
                                            lineHeight: '1.4'
                                          }}>
                                            <AlertCircle size={16} style={{ marginTop: '2px', minWidth: '16px' }} /> 
                                            {pet.pet_type === "Cat" 
                                              ? "This provider has not set cat-specific pricing for this service." 
                                              : `Service Conflict: Your pet's weight (${pet.weight_kg || '0'}kg) is outside the supported range for this service.`}
                                          </span>
                                        </div>
                                      )}

                                      {/* SUCCESS PRICE HINT */}
                                      {service.id && service.matched !== false && (
                                        <div className="service-price-hint" style={{ fontSize: '0.85rem', color: '#059669', fontWeight: '700', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <CheckCircle size={14} /> Service available: ₱{parseFloat(service.price || 0).toFixed(2)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {/* ROW ERROR (e.g. Empty dropdown before adding new one) */}
                              {pet.service_error && (
                                <div style={{ 
                                  color: '#ffffff', 
                                  backgroundColor: '#dc2626',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  fontSize: '0.85rem', 
                                  marginBottom: '15px', 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '8px',
                                  fontWeight: '600',
                                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)'
                                }}>
                                  <AlertCircle size={16} /> {pet.service_error}
                                </div>
                              )}
                            </div>

                            <hr style={{ margin: '20px 0', border: '0', borderTop: '1px solid #eee' }} />

                            {registeredPets.length > 0 && (
                              <div className="autofill-container">
                                <div className="autofill-left-group">
                                  <select 
                                    className="autofill-select"
                                    onChange={(e) => {
                                      const pet = registeredPets.find(p => p.id === e.target.value);
                                      if (pet) handleAutofill(index, pet);
                                    }}
                                    value=""
                                  >
                                    <option value="" disabled>Select Registered Pet...</option>
                                    {registeredPets.map(p => (
                                      <option key={p.id} value={p.id}>{p.name} ({p.breed})</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}

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
                                {/* UPDATED BREED FIELD - FREE TEXT WITH LIMITED DATALIST */}
                                <div className={`input-group ${attemptedSubmit && (!pet.breed.trim() || !isValidBreed(pet.breed, pet.pet_type)) ? 'field-error' : ''}`}>
                                    <label>Breed <span className="required-star">*</span></label>
                                    <input 
                                      list={`breed-suggestions-${index}`} 
                                      type="text" 
                                      placeholder={pet.pet_type === "Cat" ? "e.g. Siamese or Puspin" : "e.g. Beagle or Aspin"} 
                                      value={pet.breed} 
                                      onChange={(e) => updatePetInfo(index, 'breed', e.target.value)} 
                                    />
                                    {/* Datalist only shows basic fallbacks + local options */}
                                    <datalist id={`breed-suggestions-${index}`}>
                                      <option value="Mixed Breed" />
                                      <option value="Unknown" />
                                      {pet.pet_type === "Dog" ? (
                                          <>
                                              <option value="Aspin" />
                                              <option value="Askal" />
                                          </>
                                      ) : (
                                          <>
                                              <option value="Puspin" />
                                              <option value="Pusakal" />
                                          </>
                                      )}
                                    </datalist>
                                    {attemptedSubmit && !pet.breed.trim() && <span className="error-text" style={{color: 'red', fontSize: '11px'}}>Breed is required</span>}
                                    {attemptedSubmit && pet.breed.trim() && !isValidBreed(pet.breed, pet.pet_type) && <span className="error-text" style={{color: 'red', fontSize: '11px'}}>Unrecognized breed. Check spelling or use 'Mixed Breed'.</span>}
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
                                    <input 
                                      type="number" 
                                      placeholder="0.0" 
                                      value={pet.weight_kg} 
                                      onChange={(e) => updatePetInfo(index, 'weight_kg', e.target.value)} 
                                    />
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
                                    {/* Replace the current upload-btn-wrap logic with this */}
                                    <div className={`upload-btn-wrap ${attemptedSubmit && !pet.vaccine_file && !pet.vaccine_preview ? 'upload-error-active' : ''}`}>
                                      {!pet.vaccine_preview ? (
                                          <label className={`upload-btn vaccine ${attemptedSubmit && !pet.vaccine_file && !pet.vaccine_preview ? 'urgent-red-bg' : ''}`}>
                                              <input type="file" accept=".png, .jpg, .jpeg" onChange={(e) => handleFileUpload(index, 'vaccine', e)} hidden />
                                              <UploadCloud size={18} /> 
                                              <span>Vaccine Record <span className="required-star">*</span></span>
                                          </label>
                                      ) : (
                                          <div className="preview-container">
                                              {/* This will now correctly show the autofilled URL image */}
                                              <img src={pet.vaccine_preview} className="mini-preview" onClick={() => setSelectedImage(pet.vaccine_preview)} alt="prev"/>
                                              <button type="button" className="remove-img-btn" onClick={() => handleRemoveFile(index, 'vaccine')}><X size={14}/></button>
                                          </div>
                                      )}
                                      {attemptedSubmit && !pet.vaccine_file && !pet.vaccine_preview && (
                                          <div className="urgent-error-label">
                                              <AlertCircle size={12} /> Vaccination record is required
                                          </div>
                                      )}
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

                            {/* --- CONDITIONAL GROOMING SECTION --- */}
                            {pet.needs_haircut && (
                            <>
                              {/* 1. Highlighted Manual Requirements */}
                              <div className="grooming-highlight-box">
                                  <div className="req-header">
                                      <AlertCircle size={14} /> 
                                      <span>REQUIRED GROOMING DETAILS</span>
                                  </div>
                                  
                                  <label className="sub-label-bold">Haircut Options <span className="required-star">*</span></label>
                                  <div className="haircut-selector-grid">
                                      {(pet.pet_type === "Cat" ? CAT_HAIRSTYLES : DOG_HAIRSTYLES).map(style => (
                                          <button 
                                              key={style}
                                              type="button"
                                              className={`haircut-option ${pet.selected_haircut === style ? 'active' : ''} ${attemptedSubmit && !pet.selected_haircut ? 'error-border' : ''}`}
                                              onClick={() => updatePetInfo(index, 'selected_haircut', style)}
                                          >
                                              {style}
                                          </button>
                                      ))}
                                  </div>
                                  
                                  {/* ⭐ FULL WIDTH TEXTAREA AREA */}
                                  <div className="full-width-spec-area">
                                      <label className="sub-label-bold">Grooming Specifications <span className="required-star">*</span></label>
                                      <textarea 
                                          className={`spec-textarea-large ${attemptedSubmit && !pet.grooming_specifications?.trim() ? 'error-border' : ''}`}
                                          placeholder="Please provide detailed instructions (e.g., leave the tail fluffy, trim short around the paws, avoid the ears)..."
                                          value={pet.grooming_specifications} 
                                          onChange={(e) => updatePetInfo(index, 'grooming_specifications', e.target.value)} 
                                      />
                                      {attemptedSubmit && !pet.grooming_specifications?.trim() && (
                                          <span className="error-hint-text">Specifications are required for haircut services.</span>
                                      )}
                                  </div>
                              </div>

                                {/* 2. AI Generator (Separated from Highlight) */}
                                <div className="ai-generator-standalone">
                                    <label className="sub-label-ai">AI Pet Haircut Generator (Optional Preview)</label>
                                    <div className="ai-card-box">
                                        {/* ... (Keep your existing AI rendering logic here) ... */}
                                        <button type="button" className="btn-ai-gen" onClick={() => handleGenerateAIHaircut(index)} disabled={pet.ai_loading}>
                                            {pet.ai_loading ? "AI is Designing..." : "Generate AI Style Preview"}
                                        </button>
                                        {pet.ai_generated_preview && <img src={pet.ai_generated_preview} className="ai-result-img" alt="AI Preview" />}
                                    </div>
                                </div>
                              </>
                            )}

                            <div className="emergency-consent-container" style={{ marginTop: '15px' }}>
                                <label style={{ display: 'flex', gap: '10px', fontSize: '13px' }}>
                                    <input type="checkbox" checked={pet.emergency_consent} onChange={(e) => updatePetInfo(index, 'emergency_consent', e.target.checked)} />
                                    <span>I agree that in a critical emergency, the Provider has permission to transport my pet to the nearest emergency facility.</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* IMAGE FULL VIEW MODAL */}
        {selectedImage && (
          <div className="image-fullview-overlay" onClick={() => setSelectedImage(null)}>
            <div className="fullview-content" onClick={(e) => e.stopPropagation()}>
              <button className="close-fullview" onClick={() => setSelectedImage(null)}><X size={24}/></button>
              <img src={selectedImage} alt="Full view" className="fullview-img" />
            </div>
          </div>
        )}

        {showSummaryModal && (
        <div className="summary-modal-overlay">
          <div className="summary-modal-content detailed-summary">
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={24} /> Booking Confirmation
              </h2>
              <button className="close-modal" onClick={() => setShowSummaryModal(false)}><X size={24}/></button>
            </div>

            <div className="modal-body" style={{ paddingTop: '10px' }}>
              <div className="summary-scroll-area" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
                {petsData.map((p, i) => (
                  <div key={i} className="pet-summary-card" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '20px', background: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    
                    {/* Pet Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
                      <h3 style={{ color: '#0E2679', margin: 0, fontSize: '1.2rem' }}>Pet #{i + 1}: {p.pet_name || "Unnamed"}</h3>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Subtotal</span>
                        <strong style={{ color: '#2563eb', fontSize: '1.2rem', display: 'block' }}>₱{parseFloat(p.total_price || 0).toFixed(2)}</strong>
                      </div>
                    </div>

                    {/* Physical Profile Grid */}
                    <div className="summary-info-grid-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                      <div className="summary-item"><label>Type</label><strong>{p.pet_type}</strong></div>
                      <div className="summary-item"><label>Breed</label><strong>{p.breed}</strong></div>
                      <div className="summary-item"><label>Gender</label><strong>{p.gender}</strong></div>
                      <div className="summary-item"><label>Weight</label><strong>{p.weight_kg} kg</strong></div>
                      <div className="summary-item"><label>Size</label><strong>{p.calculated_size}</strong></div>
                      <div className="summary-item"><label>Birth Date</label><strong>{formatDOB(p.birth_date)}</strong></div>
                    </div>

                    {/* Services List */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0E2679', textTransform: 'uppercase' }}>Availed Services</label>
                      <div style={{ marginTop: '8px', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                        {p.services.map((srv, sIdx) => (
                          <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '10px', borderBottom: sIdx !== p.services.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <span style={{ fontWeight: '500' }}>{srv.service_name}</span>
                            <span style={{ color: '#475569', fontWeight: '700' }}>₱{parseFloat(srv.price).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ⭐ Conditional Grooming Section (ONLY shows if needs_haircut is true) */}
                    {p.needs_haircut && (
                      <div style={{ marginBottom: '20px', padding: '12px', borderLeft: '4px solid #0E2679', background: '#f0f4ff', borderRadius: '4px 8px 8px 4px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: '900', color: '#0E2679', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Haircut Instructions</label>
                        <div style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
                          <span style={{ color: '#64748b' }}>Style:</span> <strong>{p.selected_haircut}</strong>
                        </div>
                        <div style={{ fontSize: '0.85rem', fontStyle: 'italic', color: '#1e293b' }}>
                          "{p.grooming_specifications}"
                        </div>
                      </div>
                    )}

                    {/* Records & Previews */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      {p.vaccine_preview && (
                        <div className="summary-media-box">
                          <label>Vaccine Card</label>
                          <img src={p.vaccine_preview} onClick={() => setSelectedImage(p.vaccine_preview)} alt="vax" />
                        </div>
                      )}
                      {p.illness_preview && (
                        <div className="summary-media-box">
                          <label>Medical Record</label>
                          <img src={p.illness_preview} onClick={() => setSelectedImage(p.illness_preview)} alt="ill" />
                        </div>
                      )}
                      {p.ai_generated_preview && (
                        <div className="summary-media-box" style={{ border: '1px solid #0E2679' }}>
                          <label style={{ color: '#0E2679' }}>AI Preview</label>
                          <img src={p.ai_generated_preview} onClick={() => setSelectedImage(p.ai_generated_preview)} alt="ai" />
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: '15px', fontSize: '0.75rem', color: p.emergency_consent ? '#059669' : '#dc2626', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '600' }}>
                      {p.emergency_consent ? <ShieldCheck size={14} /> : <AlertCircle size={14} />}
                      {p.emergency_consent ? "Emergency Transport Permission: GRANTED" : "Emergency Transport Permission: DECLINED"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer Area */}
              <div className="summary-total-footer" style={{ borderTop: '2px solid #f1f5f9', paddingTop: '20px', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <h4 style={{ margin: 0, color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Grand Total</h4>
                    <strong style={{ color: '#0E2679', fontSize: '2rem', lineHeight: '1' }}>₱{calculateGrandTotal().toFixed(2)}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="vat-inclusive-badge" style={{ background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800', border: '1px solid #a7f3d0' }}>
                      VAT INCLUSIVE
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '12px', marginTop: '25px' }}>
              <button className="btn-cancel-modal" style={{ flex: 1, padding: '14px' }} onClick={() => setShowSummaryModal(false)}>Back to Edit</button>
              <button className="btn-confirm-booking" style={{ flex: 2, backgroundColor: '#0E2679', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }} onClick={handleFinalSubmit} disabled={loading}>
                {loading ? "Processing..." : "Confirm Booking"}
              </button>
            </div>
          </div>
        </div>
      )}
        
        {/* Success Modal (Matching Payment Page) */}
        {showSuccessModal && (
          <div className="modal-overlay">
            <div className="success-modal">
              <div className="success-icon"><CheckCircle size={64} /></div>
              <h3>Booking Requested!</h3>
              <p>Your appointment request has been submitted. Please wait for the provider to confirm your slot.</p>
              <button className="done-btn" onClick={handleFinish}>Return to Home</button>
            </div>
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
};

export default PetDetails;