// src/pages/pet-owner/PetDetails.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { 
  PawPrint, Calendar, Weight, 
  Dna, Activity, ChevronLeft, Tag, Cat 
} from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./PetDetails.css";

const PetDetails = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Booking data passed from ListingInfo.jsx
  const { providerId, providerName, bookingDate, bookingTime, numberOfPets } = state || {};

  // Data State
  const [providerServices, setProviderServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  
  // Form State
  const [petsData, setPetsData] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize petsData array based on numberOfPets
  useEffect(() => {
    if (numberOfPets) {
      setPetsData(Array.from({ length: numberOfPets }, () => ({
        // Service Data
        service_id: "",
        service_name: "",
        service_type: "",
        price: "",
        
        // Pet Data
        pet_type: "Dog", // Default value
        pet_name: "",
        birth_date: "",
        weight_kg: "",
        calculated_size: "",
        breed: "",
        gender: "Male",
        behavior: ""
      })));
    }
  }, [numberOfPets]);

  // Fetch Provider Services
  useEffect(() => {
    const fetchServices = async () => {
      if (!providerId) return;
      try {
        const { data, error } = await supabase
          .from('services')
          .select(`
            id, 
            name, 
            type, 
            description, 
            service_options (id, price, size, pet_type)
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

  // --- HANDLERS ---

  const handleInputChange = (index, e) => {
    const { name, value } = e.target;
    setPetsData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [name]: value };
      return updated;
    });
  };

  const handleServiceChange = (index, e) => {
    const selectedServiceId = e.target.value;
    const serviceObj = providerServices.find(s => s.id === selectedServiceId);
    
    setPetsData(prev => {
      const updated = [...prev];
      if (serviceObj) {
        const basePrice = serviceObj.service_options?.[0]?.price || 0;
        updated[index] = {
          ...updated[index],
          service_id: serviceObj.id,
          service_name: serviceObj.name,
          service_type: serviceObj.type,
          price: basePrice 
        };
      } else {
        updated[index] = {
          ...updated[index],
          service_id: "",
          service_name: "",
          service_type: "",
          price: ""
        };
      }
      return updated;
    });
  };

  const handleWeightChange = (index, e) => {
    const weight = e.target.value;
    let size = "";
    const w = parseFloat(weight);
    if (!isNaN(w)) {
        if (w < 5) size = "Small";
        else if (w < 15) size = "Medium";
        else if (w < 30) size = "Large";
        else size = "Extra Large";
    }
    
    setPetsData(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        weight_kg: weight,
        calculated_size: size
      };
      return updated;
    });
  };

  const calculateTotal = () => {
    return petsData.reduce((acc, pet) => acc + parseFloat(pet.price || 0), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation: Ensure ALL pets have a service
    const incompletePets = petsData.some(pet => !pet.service_id || !pet.pet_name || !pet.weight_kg);
    if (incompletePets) {
        alert("Please fill in all required fields (Service, Name, Weight) for all pets.");
        return;
    }

    setIsSubmitting(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not logged in");

        // 1. Insert into 'bookings'
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .insert({
                provider_id: providerId,
                pet_owner_id: user.id,
                booking_date: bookingDate,
                time_slot: bookingTime,
                status: 'pending',
                total_price: calculateTotal()
            })
            .select()
            .single();

        if (bookingError) throw bookingError;

        // 2. Process each pet
        for (const petData of petsData) {
            // Insert into 'booking_pets'
            const { data: petRecord, error: petError } = await supabase
                .from('booking_pets')
                .insert({
                    booking_id: booking.id,
                    pet_type: petData.pet_type, // Added Pet Type
                    pet_name: petData.pet_name,
                    birth_date: petData.birth_date,
                    weight_kg: petData.weight_kg,
                    calculated_size: petData.calculated_size,
                    breed: petData.breed,
                    gender: petData.gender,
                    behavior: petData.behavior,
                    vaccine_card_url: "pending_upload", 
                    emergency_consent: false
                })
                .select()
                .single();

            if (petError) throw petError;

            // Insert into 'booking_services'
            const { error: serviceError } = await supabase
                .from('booking_services')
                .insert({
                    booking_pet_id: petRecord.id,
                    service_id: petData.service_id,
                    service_name: petData.service_name,
                    service_type: petData.service_type,
                    price: petData.price
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
            <button className="back-link" onClick={() => navigate(-1)}>
                <ChevronLeft size={20} /> Back to Listing
            </button>
            <div className="booking-summary-badge">
                {bookingDate} @ {bookingTime}
            </div>
        </div>

        <form onSubmit={handleSubmit} className="all-pets-form">
            
            {petsData.map((pet, index) => (
                <div key={index} className="pet-details-card">
                    <div className="card-header-block">
                        <h2 className="card-title">Pet {index + 1}</h2>
                        <span className="card-price-tag">
                            {pet.price ? `₱${parseFloat(pet.price).toFixed(2)}` : '₱0.00'}
                        </span>
                    </div>
                    
                    <div className="pet-form-content">
                        {/* --- SECTION 1: SERVICE SELECTION --- */}
                        <div className="form-section-label">Service Selection</div>
                        
                        <div className="form-group">
                            <label className="form-label">
                                <Tag size={14} className="label-icon" /> Choose Service
                            </label>
                            <div className="select-wrapper">
                                <select 
                                    name="service_id"
                                    className="form-input"
                                    value={pet.service_id}
                                    onChange={(e) => handleServiceChange(index, e)}
                                    disabled={loadingServices}
                                    required
                                >
                                    <option value="">Select a service...</option>
                                    {providerServices.map(service => (
                                        <option key={service.id} value={service.id}>
                                            {service.name} ({service.type})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* --- SECTION 2: PET INFORMATION --- */}
                        <div className="form-section-label" style={{marginTop: '1rem'}}>Pet Information</div>

                        {/* Pet Type & Name Row */}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">
                                    <Cat size={14} className="label-icon" /> Pet Type
                                </label>
                                <div className="select-wrapper">
                                    <select 
                                        name="pet_type" 
                                        className="form-input"
                                        value={pet.pet_type}
                                        onChange={(e) => handleInputChange(index, e)}
                                    >
                                        <option value="Dog">Dog</option>
                                        <option value="Cat">Cat</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">
                                    <PawPrint size={14} className="label-icon" /> Pet Name
                                </label>
                                <input 
                                    type="text" 
                                    name="pet_name"
                                    className="form-input" 
                                    placeholder="Pet's Name"
                                    value={pet.pet_name}
                                    onChange={(e) => handleInputChange(index, e)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">
                                    <Dna size={14} className="label-icon" /> Breed
                                </label>
                                <input 
                                    type="text" 
                                    name="breed"
                                    className="form-input" 
                                    placeholder="Breed"
                                    value={pet.breed}
                                    onChange={(e) => handleInputChange(index, e)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Gender</label>
                                <div className="select-wrapper">
                                    <select 
                                        name="gender" 
                                        className="form-input"
                                        value={pet.gender}
                                        onChange={(e) => handleInputChange(index, e)}
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                <Calendar size={14} className="label-icon" /> Birth Date
                            </label>
                            <input 
                                type="date" 
                                name="birth_date"
                                className="form-input"
                                value={pet.birth_date}
                                onChange={(e) => handleInputChange(index, e)}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">
                                    <Weight size={14} className="label-icon" /> Weight (kg)
                                </label>
                                <input 
                                    type="number" 
                                    name="weight_kg"
                                    className="form-input" 
                                    placeholder="0.0"
                                    step="0.1"
                                    value={pet.weight_kg}
                                    onChange={(e) => handleWeightChange(index, e)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Size</label>
                                <input 
                                    type="text" 
                                    className="form-input read-only" 
                                    value={pet.calculated_size}
                                    readOnly
                                    placeholder="Auto-calc"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                <Activity size={14} className="label-icon" /> Behavior / Notes
                            </label>
                            <textarea 
                                name="behavior"
                                className="form-input textarea" 
                                placeholder="Aggression, allergies, etc."
                                value={pet.behavior}
                                onChange={(e) => handleInputChange(index, e)}
                                rows={2}
                            />
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