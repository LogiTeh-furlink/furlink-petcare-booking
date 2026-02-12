// src/pages/admin/AdminViewBooking.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInAdmin from "../../components/Header/LoggedInAdmin";
import { 
  FaArrowLeft, 
  FaUser, 
  FaHistory, 
  FaTimes, 
  FaSearchPlus,
  FaCalendarAlt, 
  FaClock, 
  FaCreditCard, 
  FaFileInvoiceDollar,
  FaInfoCircle,
  FaStar,
  FaCommentDots,
  FaExclamationTriangle,
  FaUserSlash,
  FaPaperPlane,
  FaCheckCircle
} from "react-icons/fa";
import "./AdminViewBooking.css";

export default function AdminViewBooking() {
  const { id } = useParams(); // User Profile ID
  const navigate = useNavigate();
  
  // --- STATE ---
  const [userProfile, setUserProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Action States
  const [warningMessage, setWarningMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Modal States
  const [selectedBooking, setSelectedBooking] = useState(null); 
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    fetchUserData();
  }, [id]);

  const fetchUserData = async () => {
    try {
      setLoading(true);

      // 1. Fetch User Profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();
      
      if (profileError) throw profileError;
      setUserProfile(profileData);

      // 2. Fetch ALL Bookings
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(`
          *,
          service_providers (id, business_name, business_mobile),
          booking_pets (
            id,
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
            ai_generated_url,
            booking_services (service_name, price)
          ),
          reviews (
            rating_overall,
            rating_staff,
            comment,
            created_at
          )
        `)
        .eq("user_id", id)
        .order("booking_date", { ascending: false });
        
      if (bookingError) console.error("Error fetching bookings:", bookingError);
      setBookings(bookingData || []);

    } catch (err) {
      console.error("Error fetching user data:", err);
    } finally {
      setLoading(false);
    }
  };

  /* --- ACTIONS --- */
  const handleSendWarning = async () => {
    if (!warningMessage.trim()) return alert("Please enter a warning message.");
    
    setActionLoading(true);
    try {
      // Create notification entry
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: id,
          title: 'Admin Warning',
          message: warningMessage,
          type: 'warning',
          is_read: false
        });

      if (error) throw error;

      setSuccessMessage("Warning notification sent successfully.");
      setShowSuccessModal(true);
      setWarningMessage(""); // Clear input
    } catch (err) {
      console.error("Error sending warning:", err);
      alert("Failed to send warning.");
    } finally {
      setActionLoading(false);
    }
  };

  // 1. Trigger Modal Logic
  const initiateSuspension = () => {
      setShowSuspendModal(true);
  };

  // 2. Execute Suspension (Called from Modal)
  const confirmSuspension = async () => {
    setActionLoading(true);
    try {
        // Calculate suspension end date (7 days from now)
        const suspensionEnd = new Date();
        suspensionEnd.setDate(suspensionEnd.getDate() + 7);

        // Update profile status
        const { error } = await supabase
            .from('profiles')
            .update({ 
                status: 'suspended',
                suspension_end_date: suspensionEnd.toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        setShowSuspendModal(false); // Close Confirmation
        setSuccessMessage(`User has been suspended until ${suspensionEnd.toLocaleDateString()}.`);
        setShowSuccessModal(true); // Show Success
        
        fetchUserData(); // Refresh UI

    } catch (err) {
        console.error("Error suspending user:", err);
        alert("Failed to suspend user.");
    } finally {
        setActionLoading(false);
    }
  };

  /* --- HELPERS --- */
  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return "TBD";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Invalid Date"; 
    const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    
    const tempTime = new Date(`2000-01-01T${timeStr}`);
    const formattedTime = isNaN(tempTime.getTime()) ? timeStr : tempTime.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true });
    
    return `${formattedDate} at ${formattedTime}`;
  };

  const formatCurrency = (amount) => `₱ ${parseFloat(amount || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

  const getServiceSummary = (pets) => {
    if (!pets || pets.length === 0) return "No services";
    const services = pets.flatMap(p => p.booking_services?.map(s => s.service_name) || []);
    return [...new Set(services)].join(", ");
  };

  const renderStars = (count) => {
    return [...Array(5)].map((_, i) => (
      <FaStar key={i} color={i < count ? "#fbbf24" : "#e2e8f0"} size={14} style={{marginRight: '2px'}}/>
    ));
  };

  const handleOpenDetails = (booking) => setSelectedBooking(booking);
  
  const handleCloseAll = () => {
    setSelectedBooking(null);
    setPreviewImage(null);
    setShowSuspendModal(false);
    setShowSuccessModal(false);
  };

  if (loading) return <div className="loading-screen">Loading User Details...</div>;

  return (
    <>
      <LoggedInAdmin />
      <div className="admin-view-booking-container">
        <button className="btn-back-nav" onClick={() => navigate(-1)}>
          <FaArrowLeft /> Back to Dashboard
        </button>

        {/* --- HEADER --- */}
        <div className="provider-header-main">
          <h1>
            {userProfile?.first_name} {userProfile?.last_name}
            {userProfile?.display_name && <span style={{fontSize: '1rem', color:'#64748b', marginLeft:'10px'}}>({userProfile.display_name})</span>}
          </h1>
          <span className={`badge-status ${userProfile?.status === 'suspended' ? 'suspended' : userProfile?.role}`}>
            {userProfile?.status === 'suspended' ? 'Suspended' : userProfile?.role?.replace(/_/g, " ")}
          </span>
        </div>

        <div className="view-grid">
          {/* --- LEFT COLUMN: Personal Info + Actions (STICKY) --- */}
          <div className="view-column sticky-column">
            
            {/* 1. Personal Information Card */}
            <section className="provider-card">
              <h2><FaUser /> Personal Information</h2>
              <div className="info-item">
                <strong>Email:</strong> {userProfile?.email || "N/A"}
              </div>
              <div className="info-item">
                <strong>Mobile:</strong> {userProfile?.mobile_number || "N/A"}
              </div>
              <div className="info-item">
                <strong>Date of Birth:</strong> {userProfile?.date_of_birth ? new Date(userProfile.date_of_birth).toLocaleDateString() : "-"}
              </div>
              <div className="info-item">
                <strong>Member Since:</strong> {userProfile?.created_at ? new Date(userProfile.created_at).toLocaleDateString() : "-"}
              </div>
            </section>

            {/* 2. User Action Card */}
            <section className="provider-card action-card">
              <h2 style={{color: '#b91c1c', borderBottomColor: '#fecaca'}}>
                 <FaExclamationTriangle /> Admin Actions
              </h2>
              
              <div className="action-group">
                <label className="action-label">Issue Warning</label>
                <textarea 
                    className="warning-input" 
                    placeholder="Type warning message here..."
                    value={warningMessage}
                    onChange={(e) => setWarningMessage(e.target.value)}
                />
                <button 
                    className="btn-action-send" 
                    onClick={handleSendWarning}
                    disabled={actionLoading || !warningMessage}
                >
                    <FaPaperPlane /> Send Notification
                </button>
              </div>

              <hr className="divider" style={{margin: '20px 0'}} />

              <div className="action-group">
                <label className="action-label">Account Suspension</label>
                <p style={{fontSize: '0.8rem', color: '#64748b', marginBottom: '10px'}}>
                    Temporarily disable this user's access for 7 days.
                </p>
                <button 
                    className="btn-action-suspend" 
                    onClick={initiateSuspension}
                    disabled={actionLoading || userProfile?.status === 'suspended'}
                >
                    <FaUserSlash /> {userProfile?.status === 'suspended' ? 'User Suspended' : 'Suspend for 1 Week'}
                </button>
              </div>
            </section>

          </div>

          {/* --- RIGHT COLUMN: ALL BOOKING HISTORY --- */}
          <div className="view-column">
            <section className="provider-card" style={{padding: '0', overflow: 'hidden'}}>
              <div style={{padding: '20px 20px 0'}}>
                <h2><FaHistory /> Full Booking History</h2>
                <p style={{fontSize: '0.85rem', color: '#64748b', marginBottom: '15px'}}>
                   Showing all appointments (Pending, Paid, Cancelled, Rated, etc.)
                </p>
              </div>
              
              <div className="app-list-section">
                <div className="bookings-grid">
                  <div className="list-table-header">
                    <div className="col-date">Date</div>
                    <div className="col-pets">Pets</div>
                    <div className="col-service">Service</div>
                    <div className="col-price">Total</div>
                    <div className="col-action">Action</div>
                  </div>
                  
                  {bookings.length === 0 ? (
                    <div className="no-app-state">
                      <FaCalendarAlt className="empty-icon" />
                      <h3>No booking history found.</h3>
                      <p style={{fontSize: '0.8rem', marginTop: '5px'}}>This user has not made any appointments yet.</p>
                    </div>
                  ) : (
                    bookings.map((booking) => (
                      <div key={booking.id} className="app-row">
                        <div className="col-date">
                            <strong>{formatDateTime(booking.booking_date, booking.time_slot)}</strong>
                            <div style={{fontSize:'0.7rem', color: '#64748b', marginTop: '4px'}}>
                                Status: <span className={`status-pill ${booking.status}`} style={{
                                    fontWeight: 700, 
                                    color: booking.status === 'cancelled' || booking.status === 'declined' ? '#b91c1c' : '#0E2679', 
                                    textTransform: 'capitalize'
                                }}>{booking.status}</span>
                            </div>
                        </div>
                        <div className="col-pets">{booking.booking_pets?.length || 0} Pet/s</div>
                        <div className="col-service">{getServiceSummary(booking.booking_pets)}</div>
                        <div className="col-price">
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
            </section>
          </div>
        </div>
      </div>

      {/* --- BOOKING DETAILS MODAL --- */}
      {selectedBooking && (
        <div className="modal-overlay" onClick={handleCloseAll}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
             <div className="modal-header">
               <h3>Appointment Details</h3>
               <button className="close-btn" onClick={handleCloseAll}><FaTimes/></button>
             </div>
             <div className="modal-body-scroll">
                
                {/* --- CLIENT FEEDBACK SECTION --- */}
                {selectedBooking.reviews && selectedBooking.reviews.length > 0 && (
                  <div className="review-highlight-box" style={{
                      backgroundColor: '#f0f9ff', 
                      border: '1px solid #bae6fd', 
                      borderRadius: '12px', 
                      padding: '15px',
                      marginBottom: '20px'
                  }}>
                    <h4 style={{marginTop: 0, color: '#0369a1', display:'flex', alignItems:'center', gap:'8px'}}>
                       <FaCommentDots /> Client Feedback
                    </h4>
                    
                    {selectedBooking.reviews.map((review, idx) => (
                      <div key={idx}>
                         <div style={{display:'flex', gap:'20px', marginBottom:'10px'}}>
                           <div>
                             <span style={{fontSize:'0.75rem', fontWeight:'600', color:'#64748b', display:'block'}}>Overall</span>
                             {renderStars(review.rating_overall)}
                           </div>
                           <div>
                             <span style={{fontSize:'0.75rem', fontWeight:'600', color:'#64748b', display:'block'}}>Staff</span>
                             {renderStars(review.rating_staff)}
                           </div>
                         </div>
                         <div style={{fontSize: '0.9rem', color: '#334155', fontStyle: 'italic'}}>
                           "{review.comment || "No comment provided."}"
                         </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="info-grid">
                   <div className="info-item">
                     <label><FaInfoCircle/> Provider</label>
                     <span>{selectedBooking.service_providers?.business_name}</span>
                   </div>
                   <div className="info-item">
                     <label><FaClock/> Schedule</label>
                     <span>{formatDateTime(selectedBooking.booking_date, selectedBooking.time_slot)}</span>
                   </div>
                   <div className="info-item">
                       <label><FaFileInvoiceDollar/> Total Amount</label>
                       <span className="price-tag">{formatCurrency(selectedBooking.total_estimated_price)}</span>
                       <span className="vat-note-small" style={{textAlign: 'left', marginTop: '0'}}>* VAT exclusive</span>
                   </div>
                   <div className="info-item">
                        <label><FaCreditCard/> Downpayment</label>
                        <span className="price-tag">{formatCurrency(selectedBooking.installation_payment)}</span>
                        <span className="vat-note-small" style={{textAlign: 'left', marginTop: '0'}}>* VAT exclusive</span>
                    </div>
                   <div className="info-item">
                     <label>Status</label>
                     <span className={`status-pill ${selectedBooking.status}`} style={{display: 'inline-block', width: 'fit-content'}}>
                        {selectedBooking.status}
                     </span>
                   </div>
                   
                   {selectedBooking.payment_proof_url && (
                     <div className="info-item">
                       <label>Payment Proof</label>
                       <div className="image-wrapper clickable-img" onClick={() => setPreviewImage(selectedBooking.payment_proof_url)}>
                          <div className="img-label">View Proof <FaSearchPlus size={12} /></div>
                          <img src={selectedBooking.payment_proof_url} className="proof-image" alt="Payment Proof"/>
                       </div>
                     </div>
                   )}
                </div>
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
                         {pet.vaccine_card_url && <div className="image-wrapper clickable-img" onClick={() => setPreviewImage(pet.vaccine_card_url)}><div className="img-label">Vaccine Card <FaSearchPlus size={12} /></div><img src={pet.vaccine_card_url} className="proof-image" alt="Vaccine Card"/></div>}
                         {pet.illness_proof_url && <div className="image-wrapper clickable-img" onClick={() => setPreviewImage(pet.illness_proof_url)}><div className="img-label">Proof of Illness <FaSearchPlus size={12} /></div><img src={pet.illness_proof_url} className="proof-image" alt="Illness Proof"/></div>}
                         {pet.ai_generated_url && <div className="image-wrapper clickable-img" onClick={() => setPreviewImage(pet.ai_generated_url)}><div className="img-label">AI Style Preview <FaSearchPlus size={12} /></div><img src={pet.ai_generated_url} className="proof-image" alt="AI Preview"/></div>}
                       </div>
                    </div>
                  ))}
                </div>
             </div>
             <div className="modal-footer">
               <button className="secondary-btn" onClick={handleCloseAll}>Close</button>
             </div>
          </div>
        </div>
      )}

      {/* --- SUSPENSION CONFIRMATION MODAL (NEW) --- */}
      {showSuspendModal && (
        <div className="modal-overlay">
          <div className="modal-content small-modal" style={{maxWidth: '400px'}}>
            <div className="modal-header" style={{backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca'}}>
              <h3 style={{color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px'}}>
                 <FaExclamationTriangle /> Suspend User?
              </h3>
              <button className="close-btn" onClick={() => setShowSuspendModal(false)}><FaTimes/></button>
            </div>
            <div className="modal-body" style={{padding: '20px', textAlign: 'center'}}>
               <div style={{
                   backgroundColor: '#fee2e2', 
                   width: '60px', 
                   height: '60px', 
                   borderRadius: '50%', 
                   display: 'flex', 
                   alignItems: 'center', 
                   justifyContent: 'center',
                   margin: '0 auto 15px auto'
               }}>
                  <FaUserSlash size={24} color="#b91c1c" />
               </div>
               <p style={{fontSize: '1rem', fontWeight: '600', color: '#1e293b', marginBottom: '8px'}}>
                 Are you sure you want to suspend {userProfile?.first_name}?
               </p>
               <p style={{fontSize: '0.9rem', color: '#64748b', marginBottom: '10px'}}>
                 This action will block their access to the platform for <strong>7 days</strong>.
               </p>
            </div>
            <div className="modal-footer" style={{justifyContent: 'center', gap: '12px'}}>
              <button className="secondary-btn" onClick={() => setShowSuspendModal(false)}>Cancel</button>
              <button 
                className="btn-action-suspend" 
                style={{backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '10px 20px'}}
                onClick={confirmSuspension}
                disabled={actionLoading}
              >
                {actionLoading ? "Suspending..." : "Confirm Suspension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUCCESS MODAL --- */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="modal-content small-modal" style={{maxWidth: '350px', textAlign: 'center'}}>
             <div style={{padding: '30px 20px'}}>
                <FaCheckCircle size={50} color="#16a34a" style={{marginBottom: '15px'}} />
                <h3 style={{color: '#16a34a', margin: '0 0 10px 0'}}>Success</h3>
                <p style={{color: '#475569'}}>{successMessage}</p>
                <button 
                  className="secondary-btn" 
                  style={{marginTop: '20px', backgroundColor: '#16a34a', color: 'white', border: 'none', width: '100%'}} 
                  onClick={() => setShowSuccessModal(false)}
                >
                  OK
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="modal-overlay image-preview-overlay" onClick={() => setPreviewImage(null)}>
          <div className="image-preview-content" onClick={e => e.stopPropagation()}>
            <button className="close-preview-btn" onClick={() => setPreviewImage(null)}><FaTimes /></button>
            <img src={previewImage} className="large-proof-image" alt="Preview" />
          </div>
        </div>
      )}
    </>
  );
}