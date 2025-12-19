import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { 
  FaTimes, 
  FaInfoCircle, 
  FaPaw, 
  FaClock, 
  FaExclamationTriangle,
  FaFileInvoiceDollar 
} from "react-icons/fa"; 
import "./BookingHistory.css";

export default function BookingHistory() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- Tabs Configuration ---
  const [activeTab, setActiveTab] = useState("awaiting_approval"); 
  const tabs = [
    { id: 'awaiting_approval', label: 'Awaiting Approval' },
    { id: 'for_payment', label: 'For Payment' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'today', label: 'Today' },
    { id: 'to_rate', label: 'To Rate' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'denied', label: 'Denied' } // Includes 'declined' and 'voided'
  ];

  // --- Modal States ---
  const [selectedBooking, setSelectedBooking] = useState(null); 
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  // --- Form/Action States ---
  const [reschedForm, setReschedForm] = useState({ date: "", time: "" });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          service_providers (business_name),
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
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Helpers ---
  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr) return "TBD";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Invalid Date";
    const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${formattedDate} @ ${timeStr || "?"}`;
  };

  const getServiceSummary = (pets) => {
    if (!pets || pets.length === 0) return "No services";
    const services = pets.flatMap(p => p.booking_services?.map(s => s.service_name) || []);
    return [...new Set(services)].join(", ");
  };

  const formatCurrency = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

  // --- Filtering Logic ---
  const getFilteredBookings = () => {
    const today = new Date().toISOString().split('T')[0]; 

    return bookings.filter(b => {
        const status = b.status || ""; 
        const date = b.booking_date || "";

        switch(activeTab) {
            case 'awaiting_approval': 
                return status === 'pending';
            case 'for_payment': 
                return status === 'approved' || status === 'for review'; // 'for review' means user uploaded proof
            case 'upcoming': 
                return (status === 'paid' || status === 'confirmed') && date > today;
            case 'today': 
                return (status === 'paid' || status === 'confirmed') && date === today;
            case 'to_rate': 
                return status === 'completed';
            case 'cancelled': 
                return status === 'cancelled';
            case 'denied': 
                // Groups 'declined' (provider said no) and 'voided' (payment rejected)
                return status === 'declined' || status === 'voided';
            default: return false;
        }
    });
  };

  // --- Modal Actions ---
  const handleCloseAll = () => {
    setSelectedBooking(null);
    setShowRescheduleModal(false);
    setShowCancelModal(false);
    setReschedForm({ date: "", time: "" });
  };

  // 1. Reschedule
  const openReschedule = () => {
    setReschedForm({ date: selectedBooking.booking_date, time: selectedBooking.time_slot });
    setShowRescheduleModal(true); 
  };

  const confirmReschedule = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const { error } = await supabase.from('bookings')
        .update({ booking_date: reschedForm.date, time_slot: reschedForm.time })
        .eq('id', selectedBooking.id);
      
      if(error) throw error;
      
      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? {...b, booking_date: reschedForm.date, time_slot: reschedForm.time} : b));
      alert("Reschedule successful.");
      handleCloseAll();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Cancel
  const initiateCancel = () => setShowCancelModal(true);

  const confirmCancel = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', selectedBooking.id);
      if(error) throw error;

      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? {...b, status: 'cancelled'} : b));
      alert("Appointment cancelled.");
      handleCloseAll();
    } catch(err) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayNow = () => navigate(`/payment/${selectedBooking.id}`);
  const handleRate = () => navigate(`/rate-provider/${selectedBooking.id}`);

  if (loading) return <div className="history-loading">Loading History...</div>;
  const filteredList = getFilteredBookings();

  return (
    <div className="page-wrapper">
      <LoggedInNavbar />
      
      <div className="history-container">
        
        {/* TABS */}
        <div className="history-tabs-header">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`history-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="history-content-area">
          {filteredList.length === 0 ? (
            <div className="history-empty-state">
              <div className="empty-icon-circle">
                <FaPaw className="sleeping-icon" /> 
              </div>
              <h3>No appointments found</h3>
              <p>Book an appointment now!</p>
            </div>
          ) : (
            <div className="history-list">
               <div className="history-list-header">
                 <div>Date & Time</div>
                 <div>Provider</div>
                 <div>Services</div>
                 <div>Total</div>
                 <div>Action</div>
               </div>

               {filteredList.map(booking => (
                 <div key={booking.id} className="history-row">
                    <div className="h-col date-col">
                      <span className="mobile-label">Date:</span>
                      <strong>{formatDateTime(booking.booking_date, booking.time_slot)}</strong>
                    </div>
                    <div className="h-col provider-col">
                      <span className="mobile-label">Provider:</span>
                      {booking.service_providers?.business_name || "Unknown"}
                    </div>
                    <div className="h-col service-col">
                      <span className="mobile-label">Services:</span>
                      {getServiceSummary(booking.booking_pets)}
                    </div>
                    <div className="h-col price-col">
                      <span className="mobile-label">Total:</span>
                      {formatCurrency(booking.total_estimated_price)}
                    </div>
                    <div className="h-col action-col">
                       <button className="view-history-btn" onClick={() => setSelectedBooking(booking)}>
                         View Details
                       </button>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>

      </div>

      {/* --- 1. DETAILS MODAL (WIDE) --- */}
      {selectedBooking && !showRescheduleModal && !showCancelModal && (
        <div className="modal-overlay" onClick={handleCloseAll}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
             <div className="modal-header">
               <h3>Booking Details</h3>
               <button className="close-btn" onClick={handleCloseAll}><FaTimes/></button>
             </div>
             
             <div className="modal-body-scroll">
                
                {/* General Info */}
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
                      <label><FaFileInvoiceDollar/> Total</label>
                      <span className="price-tag">{formatCurrency(selectedBooking.total_estimated_price)}</span>
                   </div>
                   <div className="info-item">
                      <label>Status</label>
                      <span className={`status-badge ${selectedBooking.status || 'unknown'}`}>
                        {(selectedBooking.status || 'UNKNOWN').toUpperCase()}
                      </span>
                   </div>
                </div>

                {/* VOID/REJECTION REASON ALERT */}
                {(selectedBooking.status === 'declined' || selectedBooking.status === 'voided') && selectedBooking.rejection_reason && (
                  <div className="void-reason-box">
                    <FaExclamationTriangle className="alert-icon"/>
                    <div>
                      <strong>Reason for {selectedBooking.status === 'voided' ? 'Voiding' : 'Decline'}:</strong>
                      <p>{selectedBooking.rejection_reason}</p>
                    </div>
                  </div>
                )}

                <hr className="divider"/>
                
                <h4>Pets & Services</h4>
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
                          <span className="label">Services:</span> {pet.booking_services?.map(s => s.service_name).join(', ')}
                       </div>

                       {/* Documents */}
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
                {activeTab === 'awaiting_approval' && (
                  <>
                    <button className="resched-btn" onClick={openReschedule}>Reschedule</button>
                    <button className="cancel-btn" onClick={initiateCancel}>Cancel</button>
                  </>
                )}
                {activeTab === 'for_payment' && (
                  <>
                    <button className="pay-btn" onClick={handlePayNow}>Pay Now</button>
                    <button className="cancel-btn" onClick={initiateCancel}>Cancel</button>
                  </>
                )}
                {(activeTab === 'upcoming' || activeTab === 'today') && (
                  <button className="cancel-btn" onClick={initiateCancel}>Cancel</button>
                )}
                {activeTab === 'to_rate' && (
                   <button className="rate-btn" onClick={handleRate}>Rate</button>
                )}
                {(activeTab === 'cancelled' || activeTab === 'denied') && (
                   <button className="secondary-btn" onClick={handleCloseAll}>Close</button>
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
                 <h3>Reschedule</h3>
                 <button className="close-btn" onClick={() => setShowRescheduleModal(false)}><FaTimes/></button>
              </div>
              <form onSubmit={confirmReschedule}>
                <div className="modal-body">
                   <p>Please select a new date and time.</p>
                   <label>New Date</label>
                   <input type="date" className="input-field" required 
                     value={reschedForm.date} onChange={e => setReschedForm({...reschedForm, date: e.target.value})} />
                   <label>New Time</label>
                   <input type="time" className="input-field" required 
                     value={reschedForm.time} onChange={e => setReschedForm({...reschedForm, time: e.target.value})} />
                </div>
                <div className="modal-footer">
                   <button type="button" className="secondary-btn" onClick={() => setShowRescheduleModal(false)}>Back</button>
                   <button type="submit" className="confirm-btn-yes" disabled={actionLoading}>{actionLoading ? "Saving..." : "Confirm"}</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* --- 3. CANCEL MODAL --- */}
      {showCancelModal && (
        <div className="modal-overlay">
           <div className="modal-content small-modal">
              <div className="modal-header warning-header">
                 <h3><FaExclamationTriangle/> Confirm Cancellation</h3>
              </div>
              <div className="modal-body">
                 {(activeTab === 'upcoming' || activeTab === 'today') ? (
                    <p className="warning-text">
                      <strong>Warning:</strong> Your down payment is non-refundable. Are you sure you want to proceed?
                    </p>
                 ) : (
                    <p>Are you sure you want to cancel? This cannot be undone.</p>
                 )}
              </div>
              <div className="modal-footer">
                 <button className="secondary-btn" onClick={() => setShowCancelModal(false)}>No, Keep it</button>
                 <button className="confirm-btn-no" onClick={confirmCancel} disabled={actionLoading}>
                   {actionLoading ? "Processing..." : "Yes, Cancel"}
                 </button>
              </div>
           </div>
        </div>
      )}

      <Footer />
    </div>
  );
}