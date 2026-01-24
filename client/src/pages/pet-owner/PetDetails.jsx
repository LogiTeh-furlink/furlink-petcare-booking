import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { 
  Calendar, Weight, Activity, Cat, AlertCircle,
  UploadCloud, FileText, Trash2, Plus, ArrowRight,
  CreditCard, ArrowLeft, ChevronDown, ChevronUp, X, Maximize2
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
    illness_file: null, illness_preview: null, total_price: 0
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

    updatePetInfo(index, `${field}_file`, file);
    updatePetInfo(index, `${field}_preview`, URL.createObjectURL(file));
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