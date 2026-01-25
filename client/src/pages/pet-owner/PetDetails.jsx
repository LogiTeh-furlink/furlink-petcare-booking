import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { 
  Calendar, Weight, Activity, Cat, AlertCircle,
  UploadCloud, FileText, Trash2, Plus, ArrowRight,
  CreditCard, ArrowLeft, ChevronDown, ChevronUp, X, Maximize2,
  Scissors, ShieldCheck // <--- ADD THESE TWO
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
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
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GOOGLE_AI_KEY });
  
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
    pet_name: "", pet_type: type, breed: "", gender: "Male", birth_date: "", weight_kg: "",
    calculated_size: "Auto-calc", behavior: [], vaccine_file: null, vaccine_preview: null,
    illness_file: null, illness_preview: null, total_price: 0,
    // AI SPECIFIC FIELDS
    ai_reference_file: null,
    ai_reference_preview: null,
    ai_generated_url: null,
    ai_style: "teddy bear cut",
    is_generating_ai: false,
    ai_confirmed: false
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

  const updatePetInfo = (index, field, value) => {
    setPetsData(prev => {
      const newPets = [...prev];
      newPets[index][field] = value;
      if (field === "weight_kg" || field === "pet_type") {
        const weight = parseFloat(newPets[index].weight_kg);
        newPets[index].calculated_size = weight > 20 ? "Large" : weight > 10 ? "Medium" : "Small";
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

    if (field === 'ai_reference') {
      updatePetInfo(index, 'ai_reference_file', file);
      updatePetInfo(index, 'ai_reference_preview', URL.createObjectURL(file));
    } else {
      updatePetInfo(index, `${field}_file`, file);
      updatePetInfo(index, `${field}_preview`, URL.createObjectURL(file));
    }
  };

  const handleRemoveFile = (index, field) => {
    const previewUrl = petsData[index][`${field}_preview` || `${field}_preview` || `${field}_generated_url` ];
    if (previewUrl) URL.revokeObjectURL(previewUrl); 
    
    if (field === 'ai_reference') {
        updatePetInfo(index, 'ai_reference_file', null);
        updatePetInfo(index, 'ai_reference_preview', null);
        updatePetInfo(index, 'ai_generated_url', null); // Reset generated state
        updatePetInfo(index, 'ai_confirmed', false);
    } else {
        updatePetInfo(index, `${field}_file`, null);
        updatePetInfo(index, `${field}_preview`, null);
    }
  };

  const handleAIAction = (index, action) => {
    if (action === 'cancel' || action === 'retry') {
      updatePetInfo(index, 'ai_generated_url', null);
      updatePetInfo(index, 'ai_confirmed', false);
    } else if (action === 'confirm') {
      updatePetInfo(index, 'ai_confirmed', true);
    }
  };

  const handleGenerateAI = async (index) => {
  const pet = petsData[index];
  if (!pet.ai_reference_file) {
    triggerError("Please upload a pet photo first.");
    return;
  }

  updatePetInfo(index, "is_generating_ai", true);

  // 1. Mock Fallback (For Demo Safety)
  let isMocked = false;
  const mockTimeout = setTimeout(() => {
    isMocked = true;
    // Updated to a guaranteed working placeholder
    const validMockImage = "https://placehold.co/400x400?text=Teddy+Bear+Cut+Sample"; 
    
    setPetsData((prev) => {
      const newPets = [...prev];
      if (!newPets[index].ai_generated_url) {
        newPets[index].ai_generated_url = validMockImage;
        newPets[index].is_generating_ai = false;
      }
      return newPets;
    });
  }, 30000); 

  try {
    const reader = new FileReader();
    reader.readAsDataURL(pet.ai_reference_file);
    reader.onload = async () => {
      const base64Data = reader.result.split(",")[1];
      
      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        config: { responseModalities: ["IMAGE"], temperature: 1.0 },
        contents: [
          { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          { text: `GENERATE_IMAGE: Edit fur to ${pet.ai_style}. Return only the modified image.` }
        ],
      });

      clearTimeout(mockTimeout);

      if (!isMocked) {
        const generatedPart = result.response?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        
        if (generatedPart && generatedPart.inlineData?.data) {
          // 2. THE FIX: Remove all whitespace and newlines that break the <img> tag
          const cleanBase64 = generatedPart.inlineData.data.replace(/\s/g, ''); // Removes ALL spaces/newlines
          
          // 3. THE FIX: Explicitly set the data URI prefix
          const imageUrl = `data:image/jpeg;base64,${cleanBase64}`;
          
          setPetsData((prev) => {
            const newPets = [...prev];
            newPets[index].ai_generated_url = imageUrl;
            newPets[index].is_generating_ai = false;
            return newPets;
          });
        } else {
          // 4. Handle Text-only responses (Finish Reason check)
          updatePetInfo(index, "is_generating_ai", false);
          const feedback = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
          triggerError(feedback || "AI Refused to return an image. Try a clearer photo.");
        }
      }
    };
  } catch (err) {
    if (!isMocked) {
      updatePetInfo(index, "is_generating_ai", false);
      triggerError("AI Error: " + err.message);
    }
  }
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
                <button className="btn-proceed-large">Proceed to Summary <ArrowRight size={18}/></button>
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
                                <button className="circle-btn delete" onClick={() => setPetsData(petsData.filter((_, i) => i !== index))}><Trash2 size={16}/></button>
                            )}
                            <button className="circle-btn add" onClick={() => setPetsData([...petsData, getEmptyPet(availablePetTypes[0])])}><Plus size={16}/></button>
                        </div>
                    </div>

                    <div className="card-form-body">
                        <div className="form-row-2">
                            <div className="input-group">
                                <label>Pet Type <span className="required-star">*</span></label>
                                <select value={pet.pet_type} onChange={(e) => updatePetInfo(index, 'pet_type', e.target.value)}>
                                    {availablePetTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Pet's Name <span className="required-star">*</span></label>
                                <input type="text" placeholder="Pet Name" value={pet.pet_name} onChange={(e) => updatePetInfo(index, 'pet_name', e.target.value)} />
                            </div>
                        </div>

                        <div className="form-row-2">
                            <div className="input-group">
                                <label>Breed <span className="required-star">*</span></label>
                                <input type="text" placeholder="Breed" value={pet.breed} onChange={(e) => updatePetInfo(index, 'breed', e.target.value)} />
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
                            <div className="input-group">
                                <label>Date of Birth <span className="required-star">*</span></label>
                                <input type="date" max={new Date().toISOString().split("T")[0]} onChange={(e) => updatePetInfo(index, 'birth_date', e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label>Weight (kg) <span className="required-star">*</span></label>
                                <input type="number" placeholder="0.0" onChange={(e) => updatePetInfo(index, 'weight_kg', e.target.value)} />
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
                                        <input type="checkbox" /> {opt}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="medical-uploads-container">
                            <label className="sub-label">Medical Records</label>
                            <div className="upload-buttons-flex">
                                {/* VACCINE SLOT */}
                                <div className="upload-btn-wrap">
                                    {!pet.vaccine_preview ? (
                                      <label className="upload-btn vaccine">
                                          <input type="file" accept=".png, .jpg, .jpeg" onChange={(e) => handleFileUpload(index, 'vaccine', e)} hidden />
                                          <UploadCloud size={18} /> Vaccine Record <span className="required-star">*</span>
                                      </label>
                                    ) : (
                                      <div className="preview-container">
                                          <img src={pet.vaccine_preview} className="mini-preview" onClick={() => setSelectedImage(pet.vaccine_preview)} alt="prev"/>
                                          <button className="remove-img-btn" onClick={() => handleRemoveFile(index, 'vaccine')}><X size={14}/></button>
                                          <div className="zoom-hint"><Maximize2 size={10}/> Click to view</div>
                                      </div>
                                    )}
                                </div>

                                {/* ILLNESS SLOT */}
                                <div className="upload-btn-wrap">
                                    {!pet.illness_preview ? (
                                      <label className="upload-btn illness">
                                          <input type="file" accept=".png, .jpg, .jpeg" onChange={(e) => handleFileUpload(index, 'illness', e)} hidden />
                                          <FileText size={18} /> Illness Record
                                      </label>
                                    ) : (
                                      <div className="preview-container">
                                          <img src={pet.illness_preview} className="mini-preview" onClick={() => setSelectedImage(pet.illness_preview)} alt="prev"/>
                                          <button className="remove-img-btn" onClick={() => handleRemoveFile(index, 'illness')}><X size={14}/></button>
                                          <div className="zoom-hint"><Maximize2 size={10}/> Click to view</div>
                                      </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {/* --- AI GENERATION SECTION (OPTIONAL) --- */}
<div className="ai-section-divider">
  <label className="sub-label">
    <Scissors size={16} className="icon-gap"/> AI Haircut Preview (Optional)
  </label>
</div>

<div className={`ai-card-box ${pet.ai_confirmed ? 'confirmed' : ''}`}>
  <p style={{fontSize: '10px', color: 'red'}}>
    Debug: {pet.is_generating_ai ? "Processing..." : "Idle"} | 
    Generated: {pet.ai_generated_url ? "YES" : "NO"}
  </p>
  {!pet.ai_generated_url ? (
    /* STEP 1: UPLOAD AND GENERATE VIEW */
    <div className="ai-upload-controls">
      <p className="ai-hint">Upload a photo to see a new cut! Use a clear, front-facing photo.</p>
      
      {/* REFERENCE PREVIEW: Visible after user selects a file */}
      {pet.ai_reference_preview && (
        <div className="ai-reference-preview-container">
          <img src={pet.ai_reference_preview} className="ai-mini-ref" alt="Reference" />
          <button 
            type="button"
            className="remove-img-btn" 
            onClick={() => handleRemoveFile(index, 'ai_reference')}
          >
            <X size={14}/>
          </button>
        </div>
      )}

      <div className="ai-flex-row">
        <label className="ai-upload-trigger">
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => handleFileUpload(index, 'ai_reference', e)} 
            hidden 
          />
          <UploadCloud size={20} />
          <span>{pet.ai_reference_file ? "Change Photo" : "Upload Pet"}</span>
        </label>
        
        <div className="ai-style-group">
          <select 
            className="ai-select" 
            value={pet.ai_style} 
            onChange={(e) => updatePetInfo(index, 'ai_style', e.target.value)}
          >
            <option value="teddy bear cut">Teddy Bear Cut</option>
            <option value="lion cut style">Lion Cut</option>
            <option value="mohawk style fur">Mohawk Cut</option>
            <option value="summer shave">Summer Shave</option>
          </select>
          
          <button 
            type="button" 
            className="btn-ai-gen" 
            onClick={() => handleGenerateAI(index)} 
            disabled={pet.is_generating_ai || !pet.ai_reference_file}
          >
            {pet.is_generating_ai ? "Grooming Pet..." : "Generate Preview"}
          </button>
        </div>
      </div>
    </div>
  ) : (
    /* STEP 2: GENERATED RESULT PREVIEW (Redo, Cancel, Confirm) */
    <div className="ai-preview-container">
      <div className="ai-img-frame">
        <img 
          key={pet.ai_generated_url} // Forces a fresh render when the URL changes
          src={pet.ai_generated_url} 
          alt="AI Result" 
          className="ai-result-img"
          style={{ 
            display: 'block', 
            minHeight: '200px', 
            width: '100%', 
            objectFit: 'contain', // Prevents stretching
            backgroundColor: '#f0f0f0' // Shows a grey box while loading
          }} 
          onError={(e) => {
            console.error("Image failed to load:", pet.ai_generated_url?.substring(0, 50));
          }}
        />
        {/* Visual Confirmation Overlay */}
        {pet.ai_confirmed && (
          <div className="confirmed-overlay">
            <ShieldCheck size={40} /> 
            <span>Style Confirmed</span>
          </div>
        )}
      </div>
      
      {!pet.ai_confirmed ? (
        <div className="ai-button-group">
          <button type="button" className="ai-btn retry" onClick={() => handleAIAction(index, 'retry')}>Redo</button>
          <button type="button" className="ai-btn cancel" onClick={() => handleAIAction(index, 'cancel')}>Cancel</button>
          <button type="button" className="ai-btn confirm" onClick={() => handleAIAction(index, 'confirm')}>Confirm Style</button>
        </div>
      ) : (
        <button type="button" className="ai-btn change" onClick={() => handleAIAction(index, 'cancel')}>Change Selection</button>
      )}
    </div>
  )}
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
      </main>
      <Footer />
    </div>
  );
};

export default PetDetails;