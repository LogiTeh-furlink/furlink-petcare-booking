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
  FaCheckCircle, 
  FaExclamationCircle, 
  FaBell,
  FaChevronDown,
  FaChevronUp
} from "react-icons/fa";
import "./AdminViewBooking.css";

export default function AdminViewBooking() {
  const { id } = useParams(); // User Profile ID
  const navigate = useNavigate();
  
  // --- STATE ---
  const [userProfile, setUserProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [warningCount, setWarningCount] = useState(0); 
  const [warningHistory, setWarningHistory] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // Action States
  const [warningMessage, setWarningMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showEligibleModal, setShowEligibleModal] = useState(false); 
  const [successMessage, setSuccessMessage] = useState("");
  const [showWarningHistory, setShowWarningHistory] = useState(false); 

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

      // 2. Fetch Notification History (Warnings + Suspensions)
      const { data: notifData, error: notifError } = await supabase
        .from('notifications')
        .select('id, title, message, created_at, read') 
        .eq('user_id', id)
        .in('title', ['Admin Warning', 'Account Suspended']) 
        .order('created_at', { ascending: false }); 

      if (!notifError && notifData) {
          // Calculate Count: Count warnings only since the last suspension
          let activeCount = 0;
          for (const notif of notifData) {
              if (notif.title === 'Account Suspended') {
                  break; // Stop counting, this resets the cycle
              }
              if (notif.title === 'Admin Warning') {
                  activeCount++;
              }
          }
          setWarningCount(activeCount);

          // For the list view, we still show all historical warnings
          const warningsOnly = notifData.filter(n => n.title === 'Admin Warning');
          setWarningHistory(warningsOnly); 
      } else if (notifError) {
          console.error("Error fetching notification history:", notifError);
      }

      // 3. Fetch ALL Bookings
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
      // 1. Send the Notification
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: id,
          title: 'Admin Warning',
          message: warningMessage,
          read: false,
          link: '/profile' 
        });

      if (error) throw error;

      // 2. Refresh Data (This recalculates the count)
      await fetchUserData();

      setWarningMessage(""); 
      
      // 3. Trigger Modal Logic based on NEW count estimate
      const newCount = warningCount + 1; 

      if (newCount >= 3) {
        setShowEligibleModal(true);
      } else {
        setSuccessMessage("Warning notification sent successfully.");
        setShowSuccessModal(true);
      }

    } catch (err) {
      console.error("Error sending warning:", err);
      alert("Failed to send warning.");
    } finally {
      setActionLoading(false);
    }
  };

  const initiateSuspension = () => {
      setShowSuspendModal(true);
  };

  const confirmSuspension = async () => {
    setActionLoading(true);
    try {
        const suspensionEnd = new Date();
        suspensionEnd.setDate(suspensionEnd.getDate() + 7);

        // 1. Update profile using is_active
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ 
                is_active: false, 
                suspension_end_date: suspensionEnd.toISOString()
            })
            .eq('id', id);

        if (profileError) throw profileError;

        // 2. Insert 'Account Suspended' Notification 
        await supabase.from('notifications').insert({
            user_id: id,
            title: 'Account Suspended',
            message: `Your account has been suspended for 7 days until ${suspensionEnd.toLocaleDateString()}.`,
            read: false,
            link: '/profile'
        });

        setShowSuspendModal(false); 
        setShowEligibleModal(false); 

        setSuccessMessage(`User has been suspended until ${suspensionEnd.toLocaleDateString()}.`);
        setShowSuccessModal(true); 
        
        // Refreshing here will see the new "Account Suspended" row and reset warningCount to 0
        fetchUserData(); 

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
    setShowEligibleModal(false);
  };

  if (loading) return <div className="admin-view-booking-loading-screen">Loading User Details...</div>;

  return (
    <>
      <LoggedInAdmin />
      <div className="admin-view-booking-container">
        <button className="btn-back-nav" onClick={() => navigate(-1)}>
          <FaArrowLeft /> Back to Main Dashboard
        </button>

        {/* --- HEADER --- */}
        <div className="provider-header-main">
          <h1>
            {userProfile?.first_name} {userProfile?.last_name}
            {userProfile?.display_name && <span style={{fontSize: '1rem', color:'#64748b', marginLeft:'10px'}}>({userProfile.display_name})</span>}
          </h1>
          <span className={`badge-status ${!userProfile?.is_active ? 'suspended' : userProfile?.role}`}>
            {!userProfile?.is_active ? 'Suspended/Inactive' : userProfile?.role?.replace(/_/g, " ")}
          </span>
        </div>

        <div className="view-grid">
          {/* --- LEFT COLUMN: Personal Info + Actions (STICKY) --- */}
          <div className="view-column sticky-column">
            
            {/* 1. Personal Information Card */}
            <section className="provider-card">
              <h2><FaUser /> Personal Information</h2>
              <div className="info-item">
                <strong>Role:</strong> 
                <span style={{textTransform: 'capitalize'}}>
                    {userProfile?.role === 'both' 
                      ? "Pet Owner and Service Provider" 
                      : (userProfile?.role ? userProfile.role.replace(/_/g, " ") : "N/A")}
                </span>
              </div>
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
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <label className="action-label">Issue Warning</label>
                  {/* --- NOTIFICATION COUNTER --- */}
                  <span className={`warning-count-display ${warningCount >= 3 ? 'high-risk' : ''}`}>
                    <FaBell size={10} style={{marginRight: '4px'}}/>
                    Count: {warningCount}
                  </span>
                </div>
                
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

                {/* --- WARNING HISTORY TOGGLE (ALWAYS VISIBLE) --- */}
                <div className="warning-history-section">
                  <button 
                    className="btn-toggle-history" 
                    onClick={() => setShowWarningHistory(!showWarningHistory)}
                  >
                    {showWarningHistory ? <FaChevronUp/> : <FaChevronDown/>}
                    {showWarningHistory ? "Hide Warning History" : `View History (${warningHistory.length})`}
                  </button>
                  
                  {showWarningHistory && (
                    <div className="warning-history-list">
                      {warningHistory.length === 0 ? (
                          <div className="warning-history-empty">
                              No warnings sent yet.
                          </div>
                      ) : (
                          warningHistory.map((notif) => (
                            <div key={notif.id} className="warning-history-item">
                              <div className="warning-date">
                                {new Date(notif.created_at).toLocaleDateString()}
                              </div>
                              <div className="warning-msg-text">
                                "{notif.message}"
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>
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
                    disabled={actionLoading || !userProfile?.is_active}
                >
                    <FaUserSlash /> {!userProfile?.is_active ? 'User Suspended' : 'Suspend for 1 Week'}
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
        <div className="admin-view-booking-modal-overlay" onClick={handleCloseAll}>
          <div className="admin-view-booking-modal-content admin-view-booking-large-modal" onClick={e => e.stopPropagation()}>
             <div className="admin-view-booking-modal-header">
               <h3>Appointment Details</h3>
               <button className="admin-view-booking-close-btn" onClick={handleCloseAll}><FaTimes/></button>
             </div>
             <div className="admin-view-booking-modal-body-scroll">
               
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

               <div className="admin-view-booking-info-grid">
                  <div className="admin-view-booking-info-item">
                    <label><FaInfoCircle/> Provider</label>
                    <span>{selectedBooking.service_providers?.business_name}</span>
                  </div>
                  <div className="admin-view-booking-info-item">
                    <label><FaClock/> Schedule</label>
                    <span>{formatDateTime(selectedBooking.booking_date, selectedBooking.time_slot)}</span>
                  </div>
                  <div className="admin-view-booking-info-item">
                      <label><FaFileInvoiceDollar/> Total Amount</label>
                      <span className="admin-view-booking-price-tag">{formatCurrency(selectedBooking.total_estimated_price)}</span>
                      <span className="admin-view-booking-vat-note-small" style={{textAlign: 'left', marginTop: '0'}}>* VAT exclusive</span>
                  </div>
                  <div className="admin-view-booking-info-item">
                        <label><FaCreditCard/> Downpayment</label>
                        <span className="admin-view-booking-price-tag">{formatCurrency(selectedBooking.installation_payment)}</span>
                        <span className="admin-view-booking-vat-note-small" style={{textAlign: 'left', marginTop: '0'}}>* VAT exclusive</span>
                   </div>
                  <div className="admin-view-booking-info-item">
                    <label>Status</label>
                    <span className={`status-pill ${selectedBooking.status}`} style={{display: 'inline-block', width: 'fit-content'}}>
                       {selectedBooking.status}
                    </span>
                  </div>
                  
                  {selectedBooking.payment_proof_url && (
                    <div className="admin-view-booking-info-item">
                      <label>Payment Proof</label>
                      <div className="admin-view-booking-image-wrapper admin-view-booking-clickable-img" onClick={() => setPreviewImage(selectedBooking.payment_proof_url)}>
                          <div className="admin-view-booking-img-label">View Proof <FaSearchPlus size={12} /></div>
                          <img src={selectedBooking.payment_proof_url} className="admin-view-booking-proof-image" alt="Payment Proof"/>
                      </div>
                    </div>
                  )}
               </div>
               <hr className="admin-view-booking-divider"/>
               <h4>Pets & Grooming Details</h4>
               <div className="admin-view-booking-pets-list">
                 {selectedBooking.booking_pets?.map((pet, idx) => (
                   <div key={pet.id || idx} className="admin-view-booking-pet-full-card">
                      <h5 className="admin-view-booking-pet-name-header">Pet {idx+1}: {pet.pet_name} ({pet.pet_type})</h5>
                      <div className="admin-view-booking-pet-specs-grid">
                        <div><span className="admin-view-booking-label">Breed</span> {pet.breed || 'N/A'}</div>
                        <div><span className="admin-view-booking-label">Gender</span> {pet.gender || 'N/A'}</div>
                        <div><span className="admin-view-booking-label">Weight</span> {pet.weight_kg} kg</div>
                        <div><span className="admin-view-booking-label">Size</span> {pet.calculated_size || 'N/A'}</div>
                        <div><span className="admin-view-booking-label">Behavior</span> {pet.behavior || 'N/A'}</div>
                        <div><span className="admin-view-booking-label">Consent</span> {pet.emergency_consent ? 'Yes' : 'No'}</div>
                      </div>
                      <div className="admin-view-booking-pet-info-row-split" style={{display:'flex', gap:'15px', marginTop:'10px'}}>
                        <div className="admin-view-booking-pet-specs-full" style={{flex:1}}><span className="admin-view-booking-label">Grooming Specs:</span> {pet.grooming_specifications || 'None'}</div>
                        <div className="admin-view-booking-pet-specs-full" style={{flex:1}}><span className="admin-view-booking-label">Services:</span> {pet.booking_services?.map(s => s.service_name).join(', ')}</div>
                      </div>
                      <div className="admin-view-booking-pet-images-row">
                        {pet.vaccine_card_url && <div className="admin-view-booking-image-wrapper admin-view-booking-clickable-img" onClick={() => setPreviewImage(pet.vaccine_card_url)}><div className="admin-view-booking-img-label">Vaccine Card <FaSearchPlus size={12} /></div><img src={pet.vaccine_card_url} className="admin-view-booking-proof-image" alt="Vaccine Card"/></div>}
                        {pet.illness_proof_url && <div className="admin-view-booking-image-wrapper admin-view-booking-clickable-img" onClick={() => setPreviewImage(pet.illness_proof_url)}><div className="admin-view-booking-img-label">Proof of Illness <FaSearchPlus size={12} /></div><img src={pet.illness_proof_url} className="admin-view-booking-proof-image" alt="Illness Proof"/></div>}
                        {pet.ai_generated_url && <div className="admin-view-booking-image-wrapper admin-view-booking-clickable-img" onClick={() => setPreviewImage(pet.ai_generated_url)}><div className="admin-view-booking-img-label">AI Style Preview <FaSearchPlus size={12} /></div><img src={pet.ai_generated_url} className="admin-view-booking-proof-image" alt="AI Preview"/></div>}
                      </div>
                   </div>
                 ))}
               </div>
             </div>
             <div className="admin-view-booking-modal-footer">
               <button className="admin-view-booking-secondary-btn" onClick={handleCloseAll}>Close</button>
             </div>
          </div>
        </div>
      )}

      {/* --- SUSPENSION CONFIRMATION MODAL --- */}
      {showSuspendModal && (
        <div className="admin-view-booking-modal-overlay">
          <div className="admin-view-booking-modal-content admin-view-booking-small-modal">
            <div className="admin-view-booking-modal-header" style={{backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca'}}>
              <h3 style={{color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px'}}>
                 <FaExclamationTriangle /> Suspend User?
              </h3>
              <button className="admin-view-booking-close-btn" onClick={() => setShowSuspendModal(false)}><FaTimes/></button>
            </div>
            <div className="admin-view-booking-modal-body-scroll" style={{textAlign: 'center', overflow: 'hidden'}}>
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
            <div className="admin-view-booking-modal-footer" style={{justifyContent: 'center', gap: '12px'}}>
              <button className="admin-view-booking-secondary-btn" onClick={() => setShowSuspendModal(false)}>Cancel</button>
              <button 
                className="btn-action-suspend" 
                style={{
                  backgroundColor: '#ef4444', 
                  color: 'white', 
                  border: 'none', 
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                onClick={confirmSuspension}
                disabled={actionLoading}
              >
                {actionLoading ? "Suspending..." : "Confirm Suspension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUSPENSION ELIGIBILITY MODAL (NEW) --- */}
      {showEligibleModal && (
        <div className="admin-view-booking-modal-overlay">
          <div className="admin-view-booking-modal-content admin-view-booking-small-modal">
            <div className="admin-view-booking-modal-header warning-mode">
              <h3 style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                 <FaExclamationCircle /> Suspension Eligible
              </h3>
              <button className="admin-view-booking-close-btn" onClick={() => setShowEligibleModal(false)}><FaTimes/></button>
            </div>
            <div className="admin-view-booking-modal-body-scroll" style={{textAlign: 'center', overflow: 'hidden'}}>
               <div style={{
                   backgroundColor: '#ffedd5', 
                   width: '60px', 
                   height: '60px', 
                   borderRadius: '50%', 
                   display: 'flex', 
                   alignItems: 'center', 
                   justifyContent: 'center',
                   margin: '0 auto 15px auto'
               }}>
                  <FaExclamationTriangle size={24} color="#c2410c" />
               </div>
               <p style={{fontSize: '1rem', fontWeight: '600', color: '#1e293b', marginBottom: '8px'}}>
                 Attention: {warningCount}th Warning Sent
               </p>
               <p style={{fontSize: '0.9rem', color: '#64748b', marginBottom: '20px'}}>
                 This user has reached <strong>{warningCount} warnings</strong>. They are eligible for immediate account suspension.
               </p>
            </div>
            <div className="admin-view-booking-modal-footer" style={{justifyContent: 'center', gap: '12px'}}>
              <button className="admin-view-booking-secondary-btn" onClick={() => setShowEligibleModal(false)}>Cancel</button>
              <button 
                className="btn-action-suspend" 
                style={{
                  backgroundColor: '#ef4444', 
                  color: 'white', 
                  border: 'none', 
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                onClick={confirmSuspension}
                disabled={actionLoading}
              >
                {actionLoading ? "Suspending..." : "Suspend User Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUCCESS MODAL --- */}
      {showSuccessModal && (
        <div className="admin-view-booking-modal-overlay">
          <div className="admin-view-booking-modal-content admin-view-booking-small-modal" style={{maxWidth: '350px', textAlign: 'center'}}>
             <div style={{padding: '30px 20px'}}>
                <FaCheckCircle size={50} color="#16a34a" style={{marginBottom: '15px'}} />
                <h3 style={{color: '#16a34a', margin: '0 0 10px 0'}}>Success</h3>
                <p style={{color: '#475569'}}>{successMessage}</p>
                <button 
                  className="admin-view-booking-secondary-btn" 
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
        <div className="admin-view-booking-modal-overlay admin-view-booking-image-preview-overlay" onClick={() => setPreviewImage(null)}>
          <div className="admin-view-booking-image-preview-content" onClick={e => e.stopPropagation()}>
            <button className="admin-view-booking-close-preview-btn" onClick={() => setPreviewImage(null)}><FaTimes /></button>
            <img src={previewImage} className="admin-view-booking-large-proof-image" alt="Preview" />
          </div>
        </div>
      )}
    </>
  );
}