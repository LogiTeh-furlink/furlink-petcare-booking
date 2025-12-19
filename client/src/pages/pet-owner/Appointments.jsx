import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { 
  FaCalendarAlt, 
  FaTimes, 
  FaPaw, 
  FaInfoCircle, 
  FaExclamationTriangle, 
  FaClock, 
  FaCreditCard, 
  FaCut, 
  FaStar,
  FaCheckCircle 
} from "react-icons/fa";
import "./Appointments.css";

export default function Appointments() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Tab State
  const [activeTab, setActiveTab] = useState("awaiting"); 
  
  // Modal States
  const [selectedBooking, setSelectedBooking] = useState(null); 
  const [showCancelModal, setShowCancelModal] = useState(false); 
  const [showRescheduleModal, setShowRescheduleModal] = useState(false); 
  const [showSuccessModal, setShowSuccessModal] = useState(false); 
  
  // Dynamic Message State
  const [successMessage, setSuccessMessage] = useState(""); 
  const [successTitle, setSuccessTitle] = useState("");
  
  // Action Loading
  const [actionLoading, setActionLoading] = useState(false);
  
  // Reschedule State
  const [reschedForm, setReschedForm] = useState({ date: "", time: "" });
  const [availableSlots, setAvailableSlots] = useState([]); 
  const [providerHours, setProviderHours] = useState([]);   

  useEffect(() => {
    fetchBookings();
  }, [navigate]);

  const fetchBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      // Updated Query to fetch ALL pet details
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          service_providers (id, business_name, business_mobile),
          booking_pets (
            pet_name,
            pet_type,
            breed,
            gender,
            weight_kg,
            calculated_size,
            behavior,
            emergency_consent,
            grooming_specifications,
            vaccine_card_url,
            illness_proof_url,
            booking_services (service_name, price)
          )
        `)
        .eq("user_id", user.id)
        .order('booking_date', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (err) {
      console.error("Error fetching appointments:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Helpers ---
  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return "TBD";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Invalid Date"; 
    
    const formattedDate = date.toLocaleDateString("en-US", { 
      month: "short", day: "numeric", year: "numeric" 
    });
    return `${formattedDate} @ ${timeStr}`;
  };

  const getFilteredBookings = () => {
    if (!bookings) return [];
    
    switch (activeTab) {
      case "awaiting": return bookings.filter(b => (b.status || "") === "pending");
      case "payment": return bookings.filter(b => (b.status || "") === "approved");
      case "upcoming": return bookings.filter(b => (b.status || "") === "paid" || (b.status || "") === "confirmed");
      case "rate": return bookings.filter(b => (b.status || "") === "completed");
      default: return [];
    }
  };

  const counts = {
    awaiting: bookings.filter(b => (b.status || "") === "pending").length,
    payment: bookings.filter(b => (b.status || "") === "approved").length,
    upcoming: bookings.filter(b => (b.status || "") === "paid" || (b.status || "") === "confirmed").length,
    rate: bookings.filter(b => (b.status || "") === "completed").length,
  };

  const getServiceSummary = (pets) => {
    if (!pets || pets.length === 0) return "No services";
    const services = pets.flatMap(p => p.booking_services?.map(s => s.service_name) || []);
    return [...new Set(services)].join(", ");
  };

  const formatCurrency = (amount) => `Php ${parseFloat(amount || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

  const handleOpenDetails = (booking) => setSelectedBooking(booking);

  const handleCloseAll = () => {
    setSelectedBooking(null);
    setShowCancelModal(false);
    setShowRescheduleModal(false);
    setAvailableSlots([]);
    setReschedForm({ date: "", time: "" });
  };

  // --- RESCHEDULE LOGIC ---
  const openRescheduleModal = async () => {
    if (!selectedBooking) return;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    setReschedForm({ date: dateStr, time: "" });
    setShowRescheduleModal(true);

    const providerId = selectedBooking.service_providers?.id;
    if (providerId) {
      const { data: hours } = await supabase
        .from('service_provider_hours')
        .select('*')
        .eq('provider_id', providerId);
      
      const hoursData = hours || [];
      setProviderHours(hoursData);
      generateSlots(dateStr, hoursData);
    }
  };

  const generateSlots = (dateString, hoursData) => {
    if (!dateString || !hoursData || hoursData.length === 0) {
      setAvailableSlots([]);
      return;
    }

    const [year, month, day] = dateString.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day); 
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    const daySchedule = hoursData.find(h => (h.day_of_week || "").toLowerCase() === dayName.toLowerCase());

    if (!daySchedule) {
      setAvailableSlots([]);
      return;
    }

    const slots = [];
    let current = new Date(`2000-01-01T${daySchedule.start_time}`);
    const end = new Date(`2000-01-01T${daySchedule.end_time}`);

    while (current < end) {
      const timeStr = current.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      slots.push(timeStr);
      current.setHours(current.getHours() + 1);
    }
    setAvailableSlots(slots);
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setReschedForm(prev => ({ ...prev, date: newDate, time: "" }));
    generateSlots(newDate, providerHours);
  };

  const confirmReschedule = async (e) => {
    e.preventDefault();
    if(!selectedBooking) return;
    if(!reschedForm.time) {
      alert("Please select a time slot.");
      return;
    }

    setActionLoading(true);
    try {
       const { error } = await supabase.from('bookings').update({
         booking_date: reschedForm.date,
         time_slot: reschedForm.time
       }).eq('id', selectedBooking.id);

       if(error) throw error;

       setBookings(prev => prev.map(b => b.id === selectedBooking.id ? {...b, booking_date: reschedForm.date, time_slot: reschedForm.time} : b));
       
       handleCloseAll();
       setSuccessTitle("Reschedule Successful!");
       setSuccessMessage("Your appointment has been successfully rescheduled.");
       setShowSuccessModal(true);

    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- CANCEL LOGIC ---
  const initiateCancel = () => setShowCancelModal(true);

  const confirmCancel = async () => {
    if(!selectedBooking) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', selectedBooking.id);
      if(error) throw error;

      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? {...b, status: 'cancelled'} : b));
      
      handleCloseAll();
      setSuccessTitle("Cancellation Successful");
      setSuccessMessage("Your appointment has been successfully cancelled.");
      setShowSuccessModal(true);

    } catch(err) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayNow = () => navigate(`/payment/${selectedBooking.id}`);
  const handleRate = () => navigate(`/rate-provider/${selectedBooking.id}`);
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  if (loading) return <div className="app-loading">Loading Appointments...</div>;

  return (
    <div className="page-wrapper">
      <LoggedInNavbar />
      
      <div className="appointments-wrapper">
        <div className="appointments-container">
          
          <div className="app-header-row">
             <div className="header-text">
               <h1>My Appointments</h1>
               <p>Manage your pet's grooming sessions</p>
             </div>
             <button className="history-btn" onClick={() => navigate('/booking-history')}>
                View Booking History
             </button>
          </div>

          <div className="status-icons-card">
            <div className="icons-row">
              <div className={`icon-item ${activeTab === 'awaiting' ? 'active' : ''}`} onClick={() => setActiveTab('awaiting')}>
                <div className="icon-circle">
                  <FaClock />
                  {counts.awaiting > 0 && <span className="badge-count">{counts.awaiting}</span>}
                </div>
                <span>Awaiting Approval</span>
              </div>
              <div className={`icon-item ${activeTab === 'payment' ? 'active' : ''}`} onClick={() => setActiveTab('payment')}>
                <div className="icon-circle">
                  <FaCreditCard />
                  {counts.payment > 0 && <span className="badge-count">{counts.payment}</span>}
                </div>
                <span>For Payment</span>
              </div>
              <div className={`icon-item ${activeTab === 'upcoming' ? 'active' : ''}`} onClick={() => setActiveTab('upcoming')}>
                <div className="icon-circle">
                  <FaCut />
                  {counts.upcoming > 0 && <span className="badge-count">{counts.upcoming}</span>}
                </div>
                <span>Upcoming</span>
              </div>
              <div className={`icon-item ${activeTab === 'rate' ? 'active' : ''}`} onClick={() => setActiveTab('rate')}>
                <div className="icon-circle">
                  <FaStar />
                  {counts.rate > 0 && <span className="badge-count">{counts.rate}</span>}
                </div>
                <span>To Rate</span>
              </div>
            </div>
          </div>

          <div className="app-list-section">
            <div className="section-header">
               <h2>
                 {activeTab === 'awaiting' ? 'NEW REQUEST' : 
                  activeTab === 'payment' ? 'PENDING PAYMENT' : 
                  activeTab === 'upcoming' ? 'UPCOMING APPOINTMENTS' : 'TO RATE'}
               </h2>
            </div>
            
            <div className="bookings-grid">
               <div className="list-table-header">
                 <div>Date & Time</div>
                 <div>No. of Pets</div>
                 <div>Service to Avail</div>
                 <div>Service Total Amt</div>
                 <div>Action</div>
               </div>

               {getFilteredBookings().length === 0 ? (
                 <div className="no-app-state">
                   <FaCalendarAlt className="empty-icon"/>
                   <h3>No appointments found.</h3>
                 </div>
               ) : (
                 getFilteredBookings().map(booking => (
                   <div key={booking.id} className="app-row">
                      <div className="col-date">
                        <span className="mobile-label">Date:</span>
                        <strong>{formatDateTime(booking.booking_date, booking.time_slot)}</strong>
                      </div>
                      <div className="col-pets">
                        <span className="mobile-label">Pets:</span>
                        {booking.booking_pets?.length || 0} Pets
                      </div>
                      <div className="col-service">
                        <span className="mobile-label">Service:</span>
                        {getServiceSummary(booking.booking_pets)}
                      </div>
                      <div className="col-price">
                        <span className="mobile-label">Total:</span>
                        {formatCurrency(booking.total_estimated_price)}
                      </div>
                      <div className="col-action">
                         <button className="view-app-btn" onClick={() => handleOpenDetails(booking)}>View Details</button>
                      </div>
                   </div>
                 ))
               )}
            </div>
          </div>
        </div>
      </div>

      {/* --- 1. DETAILS MODAL (EXPANDED) --- */}
      {selectedBooking && !showRescheduleModal && !showCancelModal && !showSuccessModal && (
        <div className="modal-overlay" onClick={handleCloseAll}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
             <div className="modal-header">
               <h3>Appointment Details</h3>
               <button className="close-btn" onClick={handleCloseAll}><FaTimes/></button>
             </div>
             
             <div className="modal-body-scroll">
                
                {/* General Info Grid */}
                <div className="info-grid">
                   <div className="info-item">
                      <label><FaInfoCircle/> Provider</label>
                      <span>{selectedBooking.service_providers?.business_name || "Unknown"}</span>
                   </div>
                   <div className="info-item">
                      <label><FaClock/> Schedule</label>
                      <span>{formatDateTime(selectedBooking.booking_date, selectedBooking.time_slot)}</span>
                   </div>
                   <div className="info-item">
                      <label><FaPaw/> Total Amount</label>
                      <span className="price-tag">{formatCurrency(selectedBooking.total_estimated_price)}</span>
                   </div>
                   <div className="info-item">
                      <label>Status</label>
                      <span className={`status-badge ${selectedBooking.status || 'unknown'}`}>
                        {(selectedBooking.status || 'UNKNOWN').toUpperCase()}
                      </span>
                   </div>
                </div>

                <hr className="divider"/>
                
                {/* Pet Information Cards */}
                <h4 className="section-title">Pet Information & Documents</h4>
                <div className="pets-list">
                  {selectedBooking.booking_pets?.map((pet, idx) => (
                    <div key={pet.id} className="pet-full-card">
                       <h5 className="pet-name-header">Pet {idx+1}: {pet.pet_name} ({pet.pet_type})</h5>
                       
                       <div className="pet-specs-grid">
                          <div><span className="label">Breed:</span> {pet.breed || 'N/A'}</div>
                          <div><span className="label">Gender:</span> {pet.gender || 'N/A'}</div>
                          <div><span className="label">Weight:</span> {pet.weight_kg} kg</div>
                          <div><span className="label">Size:</span> {pet.calculated_size || 'N/A'}</div>
                          <div><span className="label">Behavior:</span> {pet.behavior || 'N/A'}</div>
                          <div><span className="label">Consent:</span> {pet.emergency_consent ? 'Yes' : 'No'}</div>
                       </div>
                       
                       <div className="pet-specs-full">
                          <span className="label">Grooming Specs:</span> {pet.grooming_specifications || 'None'}
                       </div>
                       <div className="pet-specs-full">
                          <span className="label">Services:</span> {pet.booking_services?.map(s => s.service_name).join(', ')}
                       </div>

                       {/* Documents / Images */}
                       <div className="pet-images-row">
                          {pet.vaccine_card_url && (
                            <div className="image-wrapper">
                               <p className="img-label">Vaccine Card</p>
                               <img src={pet.vaccine_card_url} alt="Vaccine Card" className="proof-image"/>
                            </div>
                          )}
                          {pet.illness_proof_url && (
                            <div className="image-wrapper">
                               <p className="img-label">Proof of Illness</p>
                               <img src={pet.illness_proof_url} alt="Illness Proof" className="proof-image"/>
                            </div>
                          )}
                       </div>
                    </div>
                  ))}
                </div>
             </div>

             <div className="modal-footer">
                {activeTab === 'awaiting' && (
                  <>
                    <button className="resched-btn" onClick={openRescheduleModal}>Reschedule</button>
                    <button className="cancel-btn" onClick={initiateCancel}>Cancel Appointment</button>
                  </>
                )}
                {activeTab === 'payment' && (
                  <>
                    <button className="pay-btn" onClick={handlePayNow}>Pay Now</button>
                    <button className="cancel-btn" onClick={initiateCancel}>Cancel Appointment</button>
                  </>
                )}
                {activeTab === 'upcoming' && (
                  <button className="cancel-btn" onClick={initiateCancel}>Cancel Appointment</button>
                )}
                {activeTab === 'rate' && (
                   <button className="rate-btn" onClick={handleRate}>Rate Service</button>
                )}
             </div>
          </div>
        </div>
      )}

      {/* --- 2. RESCHEDULE MODAL --- */}
      {showRescheduleModal && (
        <div className="modal-overlay">
           <div className="modal-content small-modal">
              <div className="modal-header">
                 <h3>Reschedule Appointment</h3>
                 <button className="close-btn" onClick={handleCloseAll}><FaTimes/></button>
              </div>
              <form onSubmit={confirmReschedule}>
                <div className="modal-body">
                   <p style={{marginBottom: '1rem', color: '#64748b', fontSize:'0.9rem'}}>
                     Select a new date. Only future dates and available provider hours are shown.
                   </p>
                   
                   <label className="input-label"><FaCalendarAlt/> Select Date</label>
                   <input 
                     type="date" 
                     className="input-field" 
                     required 
                     min={getMinDate()}
                     value={reschedForm.date} 
                     onChange={handleDateChange}
                   />
                   
                   <label className="input-label"><FaClock/> Select Time Slot</label>
                   <select 
                     className="input-field" 
                     required 
                     value={reschedForm.time}
                     onChange={e => setReschedForm({...reschedForm, time: e.target.value})}
                     disabled={!reschedForm.date}
                     style={{ cursor: !reschedForm.date ? 'not-allowed' : 'pointer' }}
                   >
                     {availableSlots.length > 0 ? (
                       <>
                         <option value="">-- Choose a time --</option>
                         {availableSlots.map(slot => (
                           <option key={slot} value={slot}>{slot}</option>
                         ))}
                       </>
                     ) : (
                       <option value="">
                         {reschedForm.date ? "No slots available on this day" : "Please select a date first"}
                       </option>
                     )}
                   </select>

                </div>
                <div className="modal-footer">
                   <button type="button" className="secondary-btn" onClick={() => setShowRescheduleModal(false)}>Back</button>
                   <button 
                     type="submit" 
                     className="confirm-btn-yes" 
                     disabled={actionLoading || !reschedForm.time || availableSlots.length === 0}
                   >
                     {actionLoading ? 'Saving...' : 'Confirm'}
                   </button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* --- 3. CANCEL CONFIRMATION MODAL --- */}
      {showCancelModal && (
        <div className="modal-overlay">
           <div className="modal-content small-modal">
              <div className="modal-header warning-header">
                 <h3><FaExclamationTriangle/> Confirm Cancellation</h3>
              </div>
              <div className="modal-body">
                 {activeTab === 'upcoming' ? (
                   <p className="warning-text">
                     <strong>Warning:</strong> Cancelling an upcoming appointment is non-refundable. 
                     Your down payment will be forfeited. Are you sure?
                   </p>
                 ) : (
                   <p>Are you sure you want to cancel this appointment? This action cannot be undone.</p>
                 )}
              </div>
              <div className="modal-footer">
                 <button className="secondary-btn" onClick={() => setShowCancelModal(false)}>No, Keep it</button>
                 <button className="confirm-btn-no" onClick={confirmCancel} disabled={actionLoading}>
                   {actionLoading ? 'Processing...' : 'Yes, Cancel Appointment'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- 4. SUCCESS MODAL --- */}
      {showSuccessModal && (
        <div className="modal-overlay">
           <div className="modal-content small-modal" style={{textAlign: 'center', padding: '2rem'}}>
              <div style={{color: 'var(--brand-green)', fontSize: '4rem', marginBottom: '1rem'}}>
                 <FaCheckCircle />
              </div>
              <h3 style={{fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--brand-blue)'}}>
                {successTitle}
              </h3>
              <p style={{color: 'var(--text-muted)', marginBottom: '1.5rem'}}>
                {successMessage}
              </p>
              <button 
                className="confirm-btn-yes" 
                onClick={() => setShowSuccessModal(false)}
                style={{width: '100%', justifyContent: 'center'}}
              >
                 OK
              </button>
           </div>
        </div>
      )}

      <Footer />
    </div>
  );
}