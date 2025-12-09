// src/pages/pet-owner/PetDetails.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { 
  PawPrint, Calendar, Weight, 
  Dna, Activity, ChevronLeft, Tag, Cat, AlertCircle,
  UploadCloud, X, FileText
} from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./PetDetails.css";

const PetDetails = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const { providerId, providerName, bookingDate, bookingTime, numberOfPets } = state || {};

  const [providerServices, setProviderServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [petsData, setPetsData] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- HELPER: CHECK IF WEIGHT IS IN RANGE ---
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
            const min = parseFloat(parts[0]);
            const max = parseFloat(parts[1]);
            return w >= min && w <= max;
        }
      }
      if (cleanRange.includes('+')) {
        const min = parseFloat(cleanRange.replace('+', ''));
        return w >= min;
      }
      if (!isNaN(parseFloat(cleanRange)) && cleanRange.indexOf('-') === -1) {
          return w === parseFloat(cleanRange);
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  // --- LOGIC: FIND MATCHING SERVICE OPTION ---
  const findServiceOption = (pet, services) => {
    if (!pet.service_id) return null; 

    const service = services.find(s => s.id === pet.service_id);
    if (!service || !service.service_options) return null;

    const userType = (pet.pet_type || "Dog").toLowerCase();

    return service.service_options.find(opt => {
      const dbType = (opt.pet_type || "").toLowerCase();
      const typeMatch = dbType === userType || dbType === 'dog-cat';
      const weightMatch = isWeightInRange(pet.weight_kg, opt.weight_range);
      return typeMatch && weightMatch;
    });
  };

  // --- UPDATE HELPER ---
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

  useEffect(() => {
    if (numberOfPets) {
      setPetsData(Array.from({ length: numberOfPets }, () => ({
        service_id: "",
        service_name: "",
        service_type: "",
        price: "0.00",
        pet_type: "Dog", 
        pet_name: "",
        birth_date: "",
        weight_kg: "",
        calculated_size: "",
        breed: "",
        gender: "Male",
        behavior: "",
        error: null,
        vaccine_file: null,
        vaccine_preview: null,
        illness_file: null,
        illness_preview: null
      })));
    }
  }, [numberOfPets]);

  useEffect(() => {
    const fetchServices = async () => {
      if (!providerId) return;
      try {
        const { data, error } = await supabase
          .from('services')
          .select(`
            id, name, type, description, 
            service_options (id, price, size, pet_type, weight_range)
          `)
          .eq('provider_id', providerId);

        if (error) throw error;
        setProviderServices(data || []);
      } catch (err) {
        console.error("Error fetching services:", err);
      } finally {
        setLoadingServices(false);
      }
    };
    fetchServices();
  }, [providerId]);

  const handleInputChange = (index, e) => {
    const { name, value } = e.target;
    updatePetDataAndPrice(index, { [name]: value });
  };

  const handleServiceChange = (index, e) => {
    const selectedServiceId = e.target.value;
    const serviceObj = providerServices.find(s => s.id === selectedServiceId);
    let serviceUpdate = serviceObj ? {
        service_id: serviceObj.id,
        service_name: serviceObj.name,
        service_type: serviceObj.type,
    } : { service_id: "", service_name: "", service_type: "" };
    updatePetDataAndPrice(index, serviceUpdate);
  };

  const handleWeightChange = (index, e) => {
    updatePetDataAndPrice(index, { weight_kg: e.target.value });
  };

  const handleFileUpload = (index, type, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    if (file.size > 1024 * 1024) { alert('File size exceeds 1MB limit.'); return; }

    const previewUrl = URL.createObjectURL(file);
    setPetsData(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [`${type}_file`]: file, [`${type}_preview`]: previewUrl };
        return updated;
    });
  };

  const removeFile = (index, type) => {
    setPetsData(prev => {
        const updated = [...prev];
        if (updated[index][`${type}_preview`]) URL.revokeObjectURL(updated[index][`${type}_preview`]);
        updated[index] = { ...updated[index], [`${type}_file`]: null, [`${type}_preview`]: null };
        return updated;
    });
  };

  const calculateTotal = () => petsData.reduce((acc, pet) => acc + parseFloat(pet.price || 0), 0);

  const uploadFileToSupabase = async (file, path) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${path}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('pet_documents').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('pet_documents').getPublicUrl(filePath);
      return publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const incompletePets = petsData.some(pet => !pet.service_id || !pet.pet_name || !pet.weight_kg || pet.error || !pet.vaccine_file);
    if (incompletePets) { alert("Please complete all forms. Ensure valid pricing and Vaccine Records are uploaded."); return; }

    setIsSubmitting(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not logged in");

        const { data: booking, error: bookingError } = await supabase.from('bookings').insert({
            provider_id: providerId, pet_owner_id: user.id, booking_date: bookingDate, time_slot: bookingTime, status: 'pending', total_price: calculateTotal()
        }).select().single();

        if (bookingError) throw bookingError;

        for (const [i, petData] of petsData.entries()) {
            const petStoragePath = `${user.id}/${booking.id}/pet_${i}`;
            let vaccineUrl = await uploadFileToSupabase(petData.vaccine_file, `${petStoragePath}/vaccine`);
            let illnessUrl = petData.illness_file ? await uploadFileToSupabase(petData.illness_file, `${petStoragePath}/illness`) : null;

            const { data: petRecord, error: petError } = await supabase.from('booking_pets').insert({
                booking_id: booking.id, pet_type: petData.pet_type, pet_name: petData.pet_name, birth_date: petData.birth_date,
                weight_kg: petData.weight_kg, calculated_size: petData.calculated_size, breed: petData.breed, gender: petData.gender,
                behavior: petData.behavior, vaccine_card_url: vaccineUrl, illness_record_url: illnessUrl, emergency_consent: false
            }).select().single();

            if (petError) throw petError;

            const { error: serviceError } = await supabase.from('booking_services').insert({
                booking_pet_id: petRecord.id, service_id: petData.service_id, service_name: petData.service_name,
                service_type: petData.service_type, price: petData.price
            });

            if (serviceError) throw serviceError;
        }
        alert("Booking Confirmed!");
        navigate("/dashboard");
    } catch (error) {
        console.error("Booking Error:", error);
        alert(`Failed to complete booking: ${error.message}`);
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!state) return <div className="pet-details-page"><Header /><main className="pet-details-container error-state"><h2>No booking in progress</h2><button onClick={() => navigate("/dashboard")}>Go Home</button></main><Footer /></div>;

  return (
    <div className="pet-details-page">
      <Header />
      <main className="pet-details-container">
        <div className="page-header-row">
            <button className="back-link" onClick={() => navigate(-1)}><ChevronLeft size={20} /> Back to Listing</button>
            <div className="booking-summary-badge">{bookingDate} @ {bookingTime}</div>
        </div>

        <form onSubmit={handleSubmit} className="all-pets-form">
            {petsData.map((pet, index) => (
                <div key={index} className={`pet-details-card ${pet.error ? 'card-has-error' : ''}`}>
                    <div className="card-header-block">
                        <h2 className="card-title">Pet {index + 1}</h2>
                        <span className={`card-price-tag ${pet.error ? 'text-red' : ''}`}>
                            {pet.error ? '---' : (pet.price ? `₱${parseFloat(pet.price).toFixed(2)}` : '₱0.00')}
                        </span>
                    </div>
                    <div className="pet-form-content">
                        <div className="form-section-label">Service Selection</div>
                        <div className="form-group">
                            <label className="form-label"><Tag size={14} className="label-icon" /> Choose Service</label>
                            <div className="select-wrapper">
                                <select name="service_id" className="form-input" value={pet.service_id} onChange={(e) => handleServiceChange(index, e)} disabled={loadingServices} required>
                                    <option value="">Select a service...</option>
                                    {providerServices.map(service => (
                                        <option key={service.id} value={service.id}>{service.name} ({service.type})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-section-label" style={{marginTop: '1rem'}}>Pet Information</div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label"><Cat size={14} className="label-icon" /> Pet Type</label>
                                <div className="select-wrapper">
                                    <select name="pet_type" className="form-input" value={pet.pet_type} onChange={(e) => handleInputChange(index, e)}>
                                        <option value="Dog">Dog</option>
                                        <option value="Cat">Cat</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label"><PawPrint size={14} className="label-icon" /> Pet Name</label>
                                <input type="text" name="pet_name" className="form-input" placeholder="Pet's Name" value={pet.pet_name} onChange={(e) => handleInputChange(index, e)} required />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label"><Dna size={14} className="label-icon" /> Breed</label>
                                <input type="text" name="breed" className="form-input" placeholder="Breed" value={pet.breed} onChange={(e) => handleInputChange(index, e)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Gender</label>
                                <div className="select-wrapper">
                                    <select name="gender" className="form-input" value={pet.gender} onChange={(e) => handleInputChange(index, e)}>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label"><Calendar size={14} className="label-icon" /> Birth Date</label>
                            <input type="date" name="birth_date" className="form-input" value={pet.birth_date} onChange={(e) => handleInputChange(index, e)} />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label"><Weight size={14} className="label-icon" /> Weight (kg)</label>
                                <input type="number" name="weight_kg" className={`form-input ${pet.error ? 'input-error' : ''}`} placeholder="0.0" step="0.1" value={pet.weight_kg} onChange={(e) => handleWeightChange(index, e)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Size (Matched)</label>
                                <input type="text" className="form-input read-only" value={pet.calculated_size} readOnly placeholder="Auto-calc" style={{textTransform: 'capitalize'}} />
                            </div>
                        </div>

                        {pet.error && <div className="error-banner"><AlertCircle size={16} /><span>{pet.error}</span></div>}

                        <div className="form-section-label" style={{marginTop: '1rem'}}>Medical Records</div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Vaccine Record <span className="text-red">*</span></label>
                                <span className="upload-helper-text">Max 1MB. Image only.</span>
                                {pet.vaccine_preview ? (
                                    <div className="image-preview-container">
                                        <img src={pet.vaccine_preview} alt="Vaccine Preview" className="image-preview" />
                                        <button type="button" className="remove-file-btn" onClick={() => removeFile(index, 'vaccine')}><X size={16} /></button>
                                    </div>
                                ) : (
                                    <label className={`upload-box ${!pet.vaccine_file && isSubmitting ? 'upload-error' : ''}`}>
                                        <input type="file" accept="image/*" onChange={(e) => handleFileUpload(index, 'vaccine', e)} hidden required />
                                        <div className="upload-content"><UploadCloud size={24} className="upload-icon" /><span>Click to Upload</span></div>
                                    </label>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Illness Record</label>
                                <span className="upload-helper-text">Optional. Max 1MB.</span>
                                {pet.illness_preview ? (
                                    <div className="image-preview-container">
                                        <img src={pet.illness_preview} alt="Illness Preview" className="image-preview" />
                                        <button type="button" className="remove-file-btn" onClick={() => removeFile(index, 'illness')}><X size={16} /></button>
                                    </div>
                                ) : (
                                    <label className="upload-box">
                                        <input type="file" accept="image/*" onChange={(e) => handleFileUpload(index, 'illness', e)} hidden />
                                        <div className="upload-content"><FileText size={24} className="upload-icon" /><span>Click to Upload</span></div>
                                    </label>
                                )}
                            </div>
                        </div>

                        <div className="form-group" style={{marginTop:'1rem'}}>
                            <label className="form-label"><Activity size={14} className="label-icon" /> Behavior / Notes</label>
                            <textarea name="behavior" className="form-input textarea" placeholder="Aggression, allergies, etc." value={pet.behavior} onChange={(e) => handleInputChange(index, e)} rows={2} />
                        </div>
                    </div>
                </div>
            ))}

            <div className="booking-footer-sticky">
                <div className="total-display">
                    <span>Total Est. Price:</span>
                    <span className="total-amount">₱{calculateTotal().toFixed(2)}</span>
                </div>
                <button type="submit" className="submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? "Processing..." : `Confirm Booking (${numberOfPets} Pets)`}
                </button>
            </div>
        </form>
      </main>
      <Footer />
    </div>
  );
};

export default PetDetails;