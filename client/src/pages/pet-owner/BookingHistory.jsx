import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { 
  FaTimes, FaPaw, FaInfoCircle, FaClock, FaExclamationTriangle,
  FaFileInvoiceDollar, FaCheckCircle, FaStar, FaCalendarAlt,
  FaCreditCard, FaSearchPlus
} from "react-icons/fa"; 
import "./BookingHistory.css";

export default function BookingHistory() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- Tabs Configuration ---
  const [activeTab, setActiveTab] = useState("awaiting_approval"); 
  const tabs = [
    { id: 'awaiting_approval', label: 'Awaiting Approval', icon: <FaClock /> },
    { id: 'for_payment', label: 'For Payment', icon: <FaCreditCard /> },
    { id: 'upcoming', label: 'Upcoming', icon: <FaCalendarAlt /> },
    { id: 'today', label: 'Today', icon: <FaCheckCircle /> },
    { id: 'to_rate', label: 'To Rate', icon: <FaStar /> },
    { id: 'rated', label: 'Rated', icon: <FaStar /> },
    { id: 'cancelled', label: 'Cancelled', icon: <FaTimes /> },
    { id: 'denied', label: 'Denied', icon: <FaExclamationTriangle /> },
    { id: 'voided', label: 'Void Payment', icon: <FaFileInvoiceDollar /> }
  ];

  // --- Modal States ---
  const [selectedBooking, setSelectedBooking] = useState(null); 
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  
  // --- Form & Action States ---
  const [reschedForm, setReschedForm] = useState({ date: "", time: "" });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [providerHours, setProviderHours] = useState([]);
  const [feedbackForm, setFeedbackForm] = useState({ overallRating: 0, staffRating: 0, comment: "" });
  const [actionLoading, setActionLoading] = useState(false);
  const [successTitle, setSuccessTitle] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => { fetchHistory(); }, []);

  useEffect(() => {
    if (selectedBooking && showRescheduleModal) {
      const fetchHours = async () => {
        const { data } = await supabase
          .from("service_provider_hours")
          .select("*")
          .eq("provider_id", selectedBooking.service_providers.id);
        if (data) setProviderHours(data);
      };
      fetchHours();
    }
  }, [selectedBooking, showRescheduleModal]);

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          service_providers (id, business_name),
          booking_pets (
            *,
            booking_services (service_name, price)
          ),
          reviews (*)
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
  const formatCurrency = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
  
  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr) return "TBD";
    const date = new Date(dateStr);
    return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${timeStr}`;
  };

  const convertTo24Hour = (timeStr) => {
    if (!timeStr) return "00:00";
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  const isFourHoursPast = (booking) => {
    if (!booking.booking_date || !booking.time_slot) return false;
    const bookingDateTime = new Date(`${booking.booking_date}T${convertTo24Hour(booking.time_slot)}`);
    return (new Date() - bookingDateTime) / (1000 * 60 * 60) >= 4;
  };

  const generateTimeSlots = (dateString) => {
    if (!dateString || providerHours.length === 0) return [];
    const dayName = new Date(dateString).toLocaleDateString('en-US', { weekday: 'long' });
    const sched = providerHours.find(h => h.day_of_week === dayName);
    if (!sched) return [];
    const slots = [];
    let current = new Date(`2000-01-01T${sched.start_time}`);
    const end = new Date(`2000-01-01T${sched.end_time}`);
    while (current < end) {
      slots.push(current.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
      current.setHours(current.getHours() + 1);
    }
    return slots;
  };

  // --- Filtering Logic ---
  const getFilteredBookings = () => {
    const today = new Date().toISOString().split('T')[0]; 
    return bookings.filter(b => {
        const status = (b.status || "").toLowerCase();
        const bDate = b.booking_date;

        switch(activeTab) {
            case 'awaiting_approval': return status === 'pending';
            case 'for_payment': return status === 'approved' || status === 'for review';
            case 'upcoming': return (status === 'paid' || status === 'confirmed') && bDate > today;
            case 'today': return (status === 'paid' || status === 'confirmed') && bDate === today;
            case 'to_rate': 
                return status !== 'rated' && (status === 'completed' || ((status === 'paid' || status === 'confirmed') && (isFourHoursPast(b) || bDate === today)));
            case 'rated': return status === 'rated';
            case 'cancelled': return status === 'cancelled';
            case 'denied': return status === 'declined';
            case 'voided': return status === 'void' || status === 'voided';
            default: return false;
        }
    });
  };

  // --- Action Handlers ---
  const handleCloseAll = () => {
    setSelectedBooking(null);
    setShowRescheduleModal(false);
    setShowCancelModal(false);
    setShowFeedbackModal(false);
    setShowSuccessModal(false);
    setPreviewImage(null);
    setReschedForm({ date: "", time: "" });
  };

  const handleRescheduleDateChange = (e) => {
    const newDate = e.target.value;
    setReschedForm({ ...reschedForm, date: newDate, time: "" });
    setAvailableSlots(generateTimeSlots(newDate));
  };

  const confirmReschedule = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await supabase.from('bookings').update({ 
        booking_date: reschedForm.date, 
        time_slot: reschedForm.time 
      }).eq('id', selectedBooking.id);
      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? {...b, booking_date: reschedForm.date, time_slot: reschedForm.time} : b));
      handleCloseAll();
      setSuccessTitle("Success!");
      setSuccessMessage("Appointment rescheduled successfully.");
      setShowSuccessModal(true);
    } catch(err) { console.error(err); } finally { setActionLoading(false); }
  };

  const confirmCancel = async () => {
    setActionLoading(true);
    try {
      await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', selectedBooking.id);
      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? {...b, status: 'cancelled'} : b));
      handleCloseAll();
      setSuccessTitle("Cancelled");
      setSuccessMessage("Appointment cancelled successfully.");
      setShowSuccessModal(true);
    } catch(err) { console.error(err); } finally { setActionLoading(false); }
  };

  const submitFeedback = async () => {
    if (!feedbackForm.overallRating || !feedbackForm.staffRating) return;
    setActionLoading(true);
    try {
      await supabase.from('reviews').insert({
        booking_id: selectedBooking.id,
        provider_id: selectedBooking.service_providers.id,
        user_id: selectedBooking.user_id,
        rating_overall: feedbackForm.overallRating,
        rating_staff: feedbackForm.staffRating,
        comment: feedbackForm.comment
      });
      await supabase.from('bookings').update({ status: 'rated' }).eq('id', selectedBooking.id);
      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? {...b, status: 'rated'} : b));
      handleCloseAll();
      setSuccessTitle("Thank You!");
      setSuccessMessage("Feedback submitted successfully.");
      setShowSuccessModal(true);
    } catch(err) { console.error(err); } finally { setActionLoading(false); }
  };

  return (
    <div className="page-wrapper">
      <LoggedInNavbar />
      
      <div className="history-container">
        <header className="history-header">
            <h1>Booking History</h1>
            <p>Track and manage your past and current pet grooming sessions</p>
        </header>

        <div className="history-status-card">
          <div className="history-icons-row">
            {tabs.map(tab => (
              <div 
                key={tab.id} 
                className={`history-icon-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <div className="icon-circle">{tab.icon}</div>
                <span>{tab.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="history-list-section">
          <div className="bookings-grid">
            <div className="list-table-header">
              <div className="col-date">Date & Time</div>
              <div className="col-provider">Provider</div>
              <div className="col-service">Service Summary</div>
              <div className="col-price">Total</div>
              <div className="col-action">Action</div>
            </div>

            {getFilteredBookings().length === 0 ? (
              <div className="no-app-state">
                <FaPaw className="empty-icon" />
                <h3>No appointments found in this category.</h3>
              </div>
            ) : (
              getFilteredBookings().map(booking => (
                <div key={booking.id} className="app-row">
                  <div className="col-date"><strong>{formatDateTime(booking.booking_date, booking.time_slot)}</strong></div>
                  <div className="col-provider">{booking.service_providers?.business_name}</div>
                  <div className="col-service">
                    {booking.booking_pets?.flatMap(p => p.booking_services?.map(s => s.service_name)).join(", ")}
                  </div>
                  <div className="col-price">{formatCurrency(booking.total_estimated_price)}</div>
                  <div className="col-action">
                    <button className="view-app-btn" onClick={() => setSelectedBooking(booking)}>View Details</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* --- DETAILS MODAL --- */}
      {selectedBooking && !showRescheduleModal && !showCancelModal && !showFeedbackModal && (
        <div className="modal-overlay" onClick={handleCloseAll}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
                <h3>Appointment Details</h3>
                <button className="close-btn" onClick={handleCloseAll}><FaTimes/></button>
            </div>
            
            <div className="modal-body-scroll">
                {/* VOID ALERT */}
                {activeTab === 'voided' && selectedBooking.rejection_reason && (
                    <div className="void-reason-alert">
                        <FaExclamationTriangle />
                        <div>
                            <strong>Payment Voided:</strong>
                            <p>{selectedBooking.rejection_reason}</p>
                        </div>
                    </div>
                )}

                <div className="info-grid">
                    <div className="info-item"><label><FaInfoCircle/> Provider</label><span>{selectedBooking.service_providers?.business_name}</span></div>
                    <div className="info-item"><label><FaClock/> Schedule</label><span>{formatDateTime(selectedBooking.booking_date, selectedBooking.time_slot)}</span></div>
                    <div className="info-item"><label><FaFileInvoiceDollar/> Total Amount</label><span className="price-tag">{formatCurrency(selectedBooking.total_estimated_price)}</span></div>
                    <div className="info-item">
                        <label><FaCreditCard/> Downpayment</label>
                        <span className="price-tag">{formatCurrency(selectedBooking.total_estimated_price * 0.30)}</span>
                    </div>
                    <div className="info-item"><label>Status</label><span className={`status-badge ${selectedBooking.status}`}>{selectedBooking.status?.toUpperCase()}</span></div>
                </div>

                {/* --- PAYMENT PROOF SECTION --- */}
                {['upcoming', 'today', 'to_rate', 'rated', 'cancelled', 'voided'].includes(activeTab) && selectedBooking.payment_proof_url && (
                    <div className="full-image-block" style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--brand-blue)' }}>Payment Proof</h4>
                            <small style={{ color: 'var(--brand-blue)', fontWeight: 'bold'}}>
                                Payment Reference Code: {selectedBooking?.rejection_reason || "N/A"}
                            </small>
                        </div>
                        
                        {/* Clickable wrapper for expansion */}
                        <div className="image-wrapper clickable-img" 
                            style={{ maxWidth: '400px', cursor: 'pointer' }} 
                            onClick={() => setPreviewImage(selectedBooking.payment_proof_url)}>
                            <p className="img-label" style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                Proof of Payment <FaSearchPlus size={12} />
                            </p>
                            <img src={selectedBooking.payment_proof_url} 
                                alt="Payment Proof" 
                                className="facebook-style-img" 
                                style={{ width: '100%', borderRadius: '8px', border: '1px solid #ddd' }} /> 
                        </div>
                    </div>
                )}

                {/* Rating Info if Rated */}
                {selectedBooking.status === 'rated' && selectedBooking.reviews && selectedBooking.reviews.length > 0 && (
                  <div className="review-display-box" style={{ marginTop: '20px', background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ color: 'var(--brand-blue)', marginBottom: '10px' }}>Your Feedback</h4>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
                      <div><strong>Overall Rating:</strong> {selectedBooking.reviews[0].rating_overall} / 5</div>
                      <div><strong>Staff Rating:</strong> {selectedBooking.reviews[0].rating_staff} / 5</div>
                    </div>
                    <p style={{ fontStyle: 'italic', color: '#64748b' }}>"{selectedBooking.reviews[0].comment}"</p>
                  </div>
                )}

                <hr className="divider"/>
                <h4>Pets & Grooming Details</h4>
                <div className="pets-list">
                  {selectedBooking.booking_pets?.map((pet, idx) => (
                    <div key={pet.id || idx} className="pet-full-card">
                       <h5 className="pet-name-header">Pet {idx+1}: {pet.pet_name} ({pet.pet_type})</h5>
                       <div className="pet-specs-grid">
                         <div><span className="label">Breed</span> {pet.breed || 'N/A'}</div>
                         <div><span className="label">Gender</span> {pet.gender || 'N/A'}</div>
                         <div><span className="label">Weight</span> {pet.weight_kg} kg</div>
                         <div><span className="label">Size</span> {pet.calculated_size || 'N/A'}</div>
                         <div><span className="label">Behavior</span> {pet.behavior || 'N/A'}</div>
                         <div><span className="label">Consent</span> {pet.emergency_consent ? 'Yes' : 'No'}</div>
                       </div>
                       <div className="pet-info-row-split">
                         <div className="pet-specs-full"><span className="label">Grooming Specs:</span> {pet.grooming_specifications || 'None'}</div>
                         <div className="pet-specs-full"><span className="label">Services:</span> {pet.booking_services?.map(s => s.service_name).join(', ')}</div>
                       </div>
                       <div className="pet-images-row">
                         {pet.vaccine_card_url && <div className="image-wrapper clickable-img" onClick={() => setPreviewImage(pet.vaccine_card_url)}><p className="img-label">Vaccine Card <FaSearchPlus size={12} /></p><img src={pet.vaccine_card_url} className="proof-image" alt="Vaccine"/></div>}
                         {pet.illness_proof_url && <div className="image-wrapper clickable-img" onClick={() => setPreviewImage(pet.illness_proof_url)}><p className="img-label">Proof of Illness <FaSearchPlus size={12} /></p><img src={pet.illness_proof_url} className="proof-image" alt="Illness"/></div>}
                       </div>
                    </div>
                  ))}
                </div>
            </div>

            <div className="modal-footer">
                {activeTab === 'awaiting_approval' && (
                    <>
                        <button className="resched-btn" onClick={() => setShowRescheduleModal(true)}>Reschedule</button>
                        <button className="cancel-btn" onClick={() => setShowCancelModal(true)}>Cancel Appointment</button>
                    </>
                )}
                {activeTab === 'for_payment' && (
                    <>
                        <button className="pay-btn" onClick={() => navigate(`/payment/${selectedBooking.id}`)}>Pay Now</button>
                        <button className="cancel-btn" onClick={() => setShowCancelModal(true)}>Cancel Appointment</button>
                    </>
                )}
                {activeTab === 'upcoming' && (
                    <button className="cancel-btn" onClick={() => setShowCancelModal(true)}>Cancel Appointment</button>
                )}
                {activeTab === 'today' && (
                    <>
                        <button className="rate-btn" onClick={() => setShowFeedbackModal(true)}>Rate Service</button>
                        <button className="cancel-btn" onClick={() => setShowCancelModal(true)}>Cancel Appointment</button>
                    </>
                )}
                {activeTab === 'to_rate' && (
                    <>
                        <button className="rate-btn" onClick={() => setShowFeedbackModal(true)}>Rate Service</button>
                        <button className="cancel-btn" onClick={() => setShowCancelModal(true)}>Cancel Appointment</button>
                    </>
                )}
                {['rated', 'cancelled', 'denied', 'voided'].includes(activeTab) && (
                    <button className="secondary-btn" onClick={handleCloseAll}>Close</button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* --- RESCHEDULE MODAL --- */}
      {showRescheduleModal && (
        <div className="modal-overlay">
          <div className="modal-content small-modal">
            <div className="modal-header"><h3>Reschedule</h3><button className="close-btn" onClick={() => setShowRescheduleModal(false)}><FaTimes/></button></div>
            <form onSubmit={confirmReschedule}>
              <div className="modal-body">
                <p>Select a new date and time.</p>
                <label className="input-label">New Date</label>
                <input type="date" className="input-field" required min={new Date().toISOString().split("T")[0]} value={reschedForm.date} onChange={handleRescheduleDateChange} />
                <label className="input-label">New Time</label>
                <select className="input-field" required value={reschedForm.time} disabled={!reschedForm.date || availableSlots.length === 0} onChange={(e) => setReschedForm({ ...reschedForm, time: e.target.value })}>
                  <option value="">{!reschedForm.date ? "Select a date" : availableSlots.length === 0 ? "Closed" : "Select Time"}</option>
                  {availableSlots.map((slot, idx) => <option key={idx} value={slot}>{slot}</option>)}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="secondary-btn" onClick={() => setShowRescheduleModal(false)}>Back</button>
                <button type="submit" className="confirm-btn-yes" disabled={actionLoading || !reschedForm.time}>{actionLoading ? "Saving..." : "Confirm"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CANCEL MODAL --- */}
      {showCancelModal && (
        <div className="modal-overlay">
           <div className="modal-content small-modal">
              <div className="modal-header warning-header"><h3>Confirm Cancellation</h3></div>
              <div className="modal-body"><p>Are you sure? Downpayments are non-refundable.</p></div>
              <div className="modal-footer">
                <button className="secondary-btn" onClick={() => setShowCancelModal(false)}>No</button>
                <button className="confirm-btn-no" onClick={confirmCancel} disabled={actionLoading}>Yes, Cancel</button>
              </div>
           </div>
        </div>
      )}

      {/* --- FEEDBACK MODAL --- */}
      {showFeedbackModal && (
        <div className="modal-overlay">
           <div className="modal-content small-modal">
              <div className="modal-header"><h3>Rate Service</h3></div>
              <div className="modal-body">
                  <div className="rating-group">
                    <label>Overall Rating</label>
                    <div className="stars-container">
                        {[1,2,3,4,5].map(s => <FaStar key={s} className={`star-icon ${feedbackForm.overallRating >= s ? 'filled' : ''}`} onClick={() => setFeedbackForm({...feedbackForm, overallRating: s})}/>)}
                    </div>
                  </div>
                  <div className="rating-group" style={{marginTop: '15px'}}>
                    <label>Staff Rating</label>
                    <div className="stars-container">
                        {[1,2,3,4,5].map(s => <FaStar key={s} className={`star-icon ${feedbackForm.staffRating >= s ? 'filled' : ''}`} onClick={() => setFeedbackForm({...feedbackForm, staffRating: s})}/>)}
                    </div>
                  </div>
                  <textarea className="feedback-textarea" placeholder="Share your experience..." value={feedbackForm.comment} onChange={e => setFeedbackForm({...feedbackForm, comment: e.target.value})} style={{marginTop: '15px', width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0'}}></textarea>
              </div>
              <div className="modal-footer">
                <button className="secondary-btn" onClick={handleCloseAll}>Cancel</button>
                <button className="confirm-btn-yes" onClick={submitFeedback} disabled={actionLoading || !feedbackForm.overallRating}>Submit Review</button>
              </div>
           </div>
        </div>
      )}

      {/* --- SUCCESS MODAL --- */}
      {showSuccessModal && (
        <div className="modal-overlay">
           <div className="modal-content small-modal success-center" style={{ textAlign: 'center', padding: '3rem' }}>
              <FaCheckCircle className="success-icon" style={{ fontSize: '4rem', color: 'var(--brand-green)', marginBottom: '1rem' }} />
              <h3>{successTitle}</h3>
              <p>{successMessage}</p>
              <button className="confirm-btn-yes" onClick={handleCloseAll} style={{ marginTop: '20px' }}>OK</button>
           </div>
        </div>
      )}

      {/* --- IMAGE PREVIEW OVERLAY --- */}
      {previewImage && (
          <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={() => setPreviewImage(null)}>
              <div className="image-preview-modal" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                  <button className="close-preview-btn" 
                          style={{ position: 'fixed', top: '20px', right: '20px', background: 'white', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }} 
                          onClick={() => setPreviewImage(null)}>
                      <FaTimes />
                  </button>
                  <img src={previewImage} 
                      alt="Document Preview" 
                      style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', display: 'block', margin: '0 auto' }} />
              </div>
          </div>
      )}

      <Footer />
    </div>
  );
}