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
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaStar 
} from "react-icons/fa"; 
import "./BookingHistory.css";

export default function BookingHistory() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- Tabs Configuration (Reordered) ---
  const [activeTab, setActiveTab] = useState("awaiting_approval"); 
  const tabs = [
    { id: 'awaiting_approval', label: 'Awaiting Approval' },
    { id: 'for_payment', label: 'For Payment' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'today', label: 'Today' },
    { id: 'to_rate', label: 'To Rate' },
    { id: 'rated', label: 'Rated' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'denied', label: 'Denied' },
    { id: 'voided', label: 'Void Payment' }
  ];

  // --- Modal States ---
  const [selectedBooking, setSelectedBooking] = useState(null); 
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  
  // --- Form/Action States ---
  const [reschedForm, setReschedForm] = useState({ date: "", time: "" });
  const [feedbackForm, setFeedbackForm] = useState({ overallRating: 0, staffRating: 0, comment: "" });
  const [actionLoading, setActionLoading] = useState(false);
  
  // Success Message State
  const [successTitle, setSuccessTitle] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
          service_providers (id, business_name),
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
          ),
          reviews (
            rating_overall,
            rating_staff,
            comment
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

  const convertTo24Hour = (timeStr) => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') { hours = '00'; }
    if (modifier === 'PM') { hours = parseInt(hours, 10) + 12; }
    return `${hours}:${minutes}`;
  };

  const isFourHoursPast = (booking) => {
    if (!booking.booking_date || !booking.time_slot) return false;
    const bookingDateTime = new Date(`${booking.booking_date}T${convertTo24Hour(booking.time_slot)}`);
    const now = new Date();
    const diffMs = now - bookingDateTime;
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= 4;
  };

  const getServiceSummary = (pets) => {
    if (!pets || pets.length === 0) return "No services";
    const services = pets.flatMap(p => p.booking_services?.map(s => s.service_name) || []);
    return [...new Set(services)].join(", ");
  };

  const formatCurrency = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

  const renderStaticStars = (count) => {
    return (
      <div className="static-stars">
        {[1, 2, 3, 4, 5].map(star => (
          <FaStar key={star} className={star <= count ? "star-filled" : "star-empty"} />
        ))}
      </div>
    );
  };

  

  // --- Filtering Logic ---
  const getFilteredBookings = () => {
    const today = new Date().toISOString().split('T')[0]; 

    return bookings.filter(b => {
        const status = (b.status || "").toLowerCase(); 
        const date = b.booking_date || "";

        switch(activeTab) {
            case 'awaiting_approval': 
                return status === 'pending';
            
            case 'for_payment': 
                return status === 'approved' || status === 'for review'; 
            
            case 'upcoming': 
                return (status === 'paid' || status === 'confirmed') && date > today;
            
            case 'today': 
                return (status === 'paid' || status === 'confirmed') && date === today;
            
            case 'to_rate': 
                if (status === 'rated') return false;
                return status === 'completed' || status === 'to_rate' || 
                       ((status === 'paid' || status === 'confirmed') && isFourHoursPast(b));
            
            case 'rated':
                return status === 'rated';

            case 'cancelled': 
                return status === 'cancelled';
            
            case 'denied': 
                return status === 'declined'; 

            case 'voided': 
                return status === 'void' || status === 'voided';
            
            default: return false;
        }
    });
  };

  // --- Modal Actions ---
  const handleCloseAll = () => {
    setSelectedBooking(null);
    setShowRescheduleModal(false);
    setShowCancelModal(false);
    setShowFeedbackModal(false);
    setReschedForm({ date: "", time: "" });
    setFeedbackForm({ overallRating: 0, staffRating: 0, comment: "" });
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

  // 2. Cancel
  const initiateCancel = () => setShowCancelModal(true);

  const confirmCancel = async () => {
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
      setSuccessTitle("Error");
      setSuccessMessage("Failed to cancel appointment.");
      setShowSuccessModal(true);
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Rate / Feedback
  const submitFeedback = async () => {
    if (feedbackForm.overallRating === 0 || feedbackForm.staffRating === 0) {
      setSuccessTitle("Missing Rating");
      setSuccessMessage("Please select star ratings before submitting.");
      setShowSuccessModal(true);
      return;
    }
    setActionLoading(true);
    try {
      const { error: reviewError } = await supabase.from('reviews').insert({
        booking_id: selectedBooking.id,
        provider_id: selectedBooking.service_providers.id,
        user_id: selectedBooking.user_id,
        rating_overall: feedbackForm.overallRating,
        rating_staff: feedbackForm.staffRating,
        comment: feedbackForm.comment
      });
      if (reviewError) throw reviewError;

      const { error: updateError } = await supabase.from('bookings').update({ status: 'rated' }).eq('id', selectedBooking.id);
      if(updateError) throw updateError;

      setBookings(prev => prev.map(b => {
        if (b.id === selectedBooking.id) {
          return { 
            ...b, 
            status: 'rated',
            reviews: [{ 
              rating_overall: feedbackForm.overallRating,
              rating_staff: feedbackForm.staffRating,
              comment: feedbackForm.comment
            }]
          };
        }
        return b;
      }));

      handleCloseAll();
      setSuccessTitle("Thank You!");
      setSuccessMessage("Your feedback has been submitted.");
      setShowSuccessModal(true);
    } catch (err) {
      setSuccessTitle("Error");
      setSuccessMessage("Failed to submit feedback.");
      setShowSuccessModal(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayNow = () => navigate(`/payment/${selectedBooking.id}`);
  const handleRate = () => setShowFeedbackModal(true);

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

      {/* --- 1. DETAILS MODAL (EXPANDED) --- */}
      {selectedBooking && !showRescheduleModal && !showCancelModal && !showSuccessModal && !showFeedbackModal && (
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
                      <label><FaFileInvoiceDollar/> Total Amount</label>
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
                {(selectedBooking.status === 'declined' || selectedBooking.status === 'void' || selectedBooking.status === 'voided') && selectedBooking.rejection_reason && (
                  <div className="void-reason-box">
                    <FaExclamationTriangle className="alert-icon"/>
                    <div>
                      <strong>Reason for {selectedBooking.status.includes('void') ? 'Voiding' : 'Decline'}:</strong>
                      <p>{selectedBooking.rejection_reason}</p>
                    </div>
                  </div>
                )}

                {/* REVIEW DISPLAY (Only if Rated) */}
                {selectedBooking.status === 'rated' && selectedBooking.reviews && selectedBooking.reviews.length > 0 && (
                  <div className="review-display-box">
                    <h4 className="section-title">Your Review</h4>
                    <div className="review-content">
                      <div className="stars-display-row">
                        <div className="star-group">
                          <span>Overall:</span>
                          {renderStaticStars(selectedBooking.reviews[0].rating_overall)}
                        </div>
                        <div className="star-group">
                          <span>Staff:</span>
                          {renderStaticStars(selectedBooking.reviews[0].rating_staff)}
                        </div>
                      </div>
                      <div className="review-comment-box">
                        <span className="comment-label">Feedback:</span>
                        <p>"{selectedBooking.reviews[0].comment}"</p>
                      </div>
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
                          <span className="label">Grooming Specs:</span> {pet.grooming_specifications || 'None'}
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
                   <button className="rate-btn" onClick={() => setShowFeedbackModal(true)}>Rate Service</button>
                )}
                
                {/* READ ONLY STATES: Cancelled, Denied, Voided, Rated */}
                {(activeTab === 'cancelled' || activeTab === 'denied' || activeTab === 'voided' || activeTab === 'rated') && (
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

      {/* --- 4. FEEDBACK MODAL --- */}
      {showFeedbackModal && (
        <div className="modal-overlay">
           <div className="modal-content small-modal">
              <div className="modal-header">
                 <h3>Rate Experience</h3>
                 <button className="close-btn" onClick={handleCloseAll}><FaTimes/></button>
              </div>
              <div className="modal-body">
                 <p className="modal-instruction">How was your service with {selectedBooking?.service_providers?.business_name}?</p>
                 
                 <div className="rating-group">
                    <label>Overall Experience</label>
                    <div className="stars-container">
                      {[1,2,3,4,5].map(star => (
                        <FaStar 
                          key={`overall-${star}`}
                          className={`star-icon ${feedbackForm.overallRating >= star ? 'filled' : ''}`}
                          onClick={() => setFeedbackForm({...feedbackForm, overallRating: star})}
                        />
                      ))}
                    </div>
                 </div>

                 <div className="rating-group">
                    <label>Staff Rating</label>
                    <div className="stars-container">
                      {[1,2,3,4,5].map(star => (
                        <FaStar 
                          key={`staff-${star}`}
                          className={`star-icon ${feedbackForm.staffRating >= star ? 'filled' : ''}`}
                          onClick={() => setFeedbackForm({...feedbackForm, staffRating: star})}
                        />
                      ))}
                    </div>
                 </div>

                 <div className="form-group">
                    <label>Feedback</label>
                    <textarea 
                      className="feedback-textarea" rows="4" maxLength={500}
                      value={feedbackForm.comment}
                      onChange={(e) => setFeedbackForm({...feedbackForm, comment: e.target.value})}
                    />
                 </div>
              </div>
              <div className="modal-footer">
                 <button className="secondary-btn" onClick={handleCloseAll}>Cancel</button>
                 <button className="confirm-btn-yes" onClick={submitFeedback} disabled={actionLoading}>
                   {actionLoading ? "Submitting..." : "Submit Review"}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- 5. SUCCESS MODAL --- */}
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