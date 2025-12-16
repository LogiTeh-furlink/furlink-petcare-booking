import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { 
  FaArrowLeft, FaCheck, FaTimes, FaPaw, FaSyringe, 
  FaFileMedical, FaClock, FaCalendarDay, FaInfoCircle, FaExclamationCircle
} from "react-icons/fa";
import "./SPBookingDetails.css";

export default function SPBookingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [previewImage, setPreviewImage] = useState(null); 
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  
  // ⭐ NEW: Feedback Modal State (Replaces Alerts)
  const [feedback, setFeedback] = useState({ show: false, type: '', message: '' });

  const [declineReason, setDeclineReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper to show modal
  const showFeedback = (type, message) => {
    setFeedback({ show: true, type, message });
  };

  const closeFeedback = () => {
    setFeedback({ ...feedback, show: false });
    // If it was a success, verify if we need to redirect or just stay
    if (feedback.type === 'success') {
       // Optional: Redirect after success if you prefer
       // navigate("/service/dashboard");
    }
  };

  useEffect(() => {
    const fetchBookingDetails = async () => {
      try {
        const { data, error } = await supabase
          .from("bookings")
          .select(`
            *,
            booking_pets (
              *,
              booking_services (service_name, price)
            )
          `)
          .eq("id", id)
          .single();

        if (error) throw error;
        setBooking(data);
      } catch (err) {
        // Silent error or redirect
        navigate("/service/dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchBookingDetails();
  }, [id, navigate]);

  const formatTime12Hour = (timeStr) => {
    if (!timeStr) return "";
    const [hour, minute] = timeStr.split(":");
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12; 
    return `${h12}:${minute} ${ampm}`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const handleUpdateStatus = async (newStatus, reason = null) => {
    setIsProcessing(true);
    try {
      const updates = { 
        status: newStatus,
        rejection_reason: newStatus === 'declined' ? reason : null 
      };

      const { error } = await supabase
        .from("bookings")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      setBooking(prev => ({ ...prev, ...updates }));
      
      // Close decline modal if open
      if (newStatus === 'declined') setShowDeclineModal(false);

      // Show Success Modal
      showFeedback('success', `Booking has been successfully ${newStatus === 'approved' ? 'ACCEPTED' : 'DECLINED'}.`);

    } catch (err) {
      // Show Error Modal
      showFeedback('error', "Failed to update booking status. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const submitDecline = () => {
    if (!declineReason) {
      showFeedback('error', "Please select a reason for rejection.");
      return;
    }
    const finalReason = declineReason === "Other" ? customReason : declineReason;
    handleUpdateStatus("declined", finalReason);
  };

  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!booking) return null;

  return (
    <>
      <LoggedInNavbar />

      {/* --- 1. Image Zoom Modal --- */}
      {previewImage && (
        <div className="image-modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="image-modal-content">
            <img src={previewImage} alt="Preview" />
            <button className="close-preview-btn" onClick={() => setPreviewImage(null)}><FaTimes /></button>
          </div>
        </div>
      )}

      {/* --- 2. Feedback Modal (Success/Error) --- */}
      {feedback.show && (
        <div className="modal-overlay">
          <div className={`feedback-card ${feedback.type}`}>
            <div className="feedback-icon">
              {feedback.type === 'success' ? <FaCheck /> : <FaExclamationCircle />}
            </div>
            <h3>{feedback.type === 'success' ? 'Success!' : 'Error'}</h3>
            <p>{feedback.message}</p>
            <button className="feedback-btn" onClick={closeFeedback}>Okay, Got it</button>
          </div>
        </div>
      )}

      {/* --- 3. Decline Input Modal --- */}
      {showDeclineModal && (
        <div className="modal-overlay">
          <div className="decline-card">
            <div className="modal-header">
              <h3>Decline Request</h3>
              <button className="close-icon-btn" onClick={() => setShowDeclineModal(false)}><FaTimes /></button>
            </div>
            <p>Please select a reason for declining this request:</p>
            
            <select 
              value={declineReason} 
              onChange={(e) => setDeclineReason(e.target.value)}
              className="reason-select"
            >
              <option value="">-- Select Reason --</option>
              <option value="Fully Booked">Fully Booked for this Time Slot</option>
              <option value="Staff Unavailable">Staff Unavailable</option>
              <option value="Incomplete Documents">Incomplete Documents</option>
              <option value="Service Mismatch">Service Not Suitable for Pet</option>
              <option value="Other">Other</option>
            </select>

            {declineReason === "Other" && (
              <textarea 
                className="custom-reason-input"
                placeholder="Please specify the reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowDeclineModal(false)}>Cancel</button>
              <button 
                className="confirm-decline-btn" 
                onClick={submitDecline}
                disabled={isProcessing}
              >
                {isProcessing ? "Processing..." : "Confirm Decline"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Main Content --- */}
      <div className="details-page-wrapper">
        <div className="details-container">
          
          <button className="back-link" onClick={() => navigate("/service/dashboard")}>
            <FaArrowLeft /> Back to Dashboard
          </button>

          <div className="details-grid-layout">
            
            {/* LEFT COLUMN */}
            <div className="details-left">
              
              <div className="detail-card highlight-card">
                <div className="status-header">
                  <div>
                    <span className="label-sub">Status</span>
                    <div className={`status-pill ${booking.status}`}>
                      {booking.status.toUpperCase()}
                    </div>
                  </div>
                  <div className="price-box">
                    <span className="label-sub">Total Price</span>
                    <span className="price-display">Php {booking.total_estimated_price}</span>
                  </div>
                </div>
              </div>

              <div className="detail-card">
                <h2 className="card-title">Schedule Details</h2>
                <div className="schedule-row">
                  <div className="schedule-item">
                    <div className="icon-circle"><FaCalendarDay /></div>
                    <div>
                      <span className="label-sub">Date</span>
                      <p>{formatDate(booking.booking_date)}</p>
                    </div>
                  </div>
                  <div className="schedule-item">
                     <div className="icon-circle"><FaClock /></div>
                    <div>
                      <span className="label-sub">Time</span>
                      <p>{formatTime12Hour(booking.time_slot)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <h2 className="section-title">Pet Information ({booking.booking_pets.length})</h2>
              
              {booking.booking_pets.map((pet) => (
                <div key={pet.id} className="pet-detail-card">
                  <div className="pet-card-header">
                    <h3><FaPaw /> {pet.pet_name}</h3>
                    <span className="pet-type-badge">{pet.pet_type}</span>
                  </div>

                  <div className="service-highlight">
                    <h4>Service Selected</h4>
                    <ul>
                      {pet.booking_services?.map((svc, i) => (
                        <li key={i}>
                          <span>{svc.service_name}</span>
                          <span className="svc-price">Php {svc.price}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pet-info-grid">
                    <div className="info-box"><label>Breed</label><p>{pet.breed || "N/A"}</p></div>
                    <div className="info-box"><label>Gender</label><p>{pet.gender || "N/A"}</p></div>
                    <div className="info-box"><label>Weight</label><p>{pet.weight_kg} kg</p></div>
                    <div className="info-box"><label>Size</label><p>{pet.calculated_size || "Standard"}</p></div>
                    <div className="info-box"><label>Behavior</label><p>{pet.behavior || "Normal"}</p></div>
                  </div>

                  <div className="consent-box">
                    <FaInfoCircle /> 
                    <span>Emergency Consent: <strong>{pet.emergency_consent ? "GRANTED" : "DENIED"}</strong></span>
                  </div>

                  <div className="medical-docs-section">
                    <h4>Medical Records</h4>
                    <div className="docs-flex">
                      <div className="doc-preview-container">
                         <span className="doc-tag"><FaSyringe /> Vaccine Record</span>
                         {pet.vaccine_card_url ? (
                           <img src={pet.vaccine_card_url} alt="Vaccine" onClick={() => setPreviewImage(pet.vaccine_card_url)}/>
                         ) : <div className="no-img">No Image</div>}
                      </div>
                      {pet.illness_proof_url && (
                        <div className="doc-preview-container">
                           <span className="doc-tag alert"><FaFileMedical /> Illness Proof</span>
                           <img src={pet.illness_proof_url} alt="Illness" onClick={() => setPreviewImage(pet.illness_proof_url)}/>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* RIGHT COLUMN (Sticky) */}
            <div className="details-right">
              <div className="action-sticky-card">
                <h3>Action Required</h3>
                
                {booking.status === 'pending' ? (
                  <>
                    <p className="action-desc">Please review the details. You can accept or decline this request.</p>
                    <div className="action-btn-group">
                      <button className="btn-action accept" onClick={() => handleUpdateStatus('approved')} disabled={isProcessing}>
                        <FaCheck /> {isProcessing ? "Saving..." : "Accept Request"}
                      </button>
                      <button className="btn-action decline" onClick={() => setShowDeclineModal(true)} disabled={isProcessing}>
                        <FaTimes /> Decline Request
                      </button>
                    </div>
                  </>
                ) : (
                  <div className={`status-message ${booking.status}`}>
                    {booking.status === 'approved' && (
                      <>
                        <div className="status-icon-circle success"><FaCheck /></div>
                        <h4>Booking Accepted</h4>
                        <p>You have approved this schedule.</p>
                      </>
                    )}
                    {booking.status === 'declined' && (
                      <>
                        <div className="status-icon-circle error"><FaTimes /></div>
                        <h4>Booking Declined</h4>
                        <p>Reason: {booking.rejection_reason || "No reason provided"}</p>
                      </>
                    )}
                    {(booking.status === 'verified' || booking.status === 'completed') && (
                      <>
                         <div className="status-icon-circle success"><FaCheck /></div>
                         <h4>{booking.status.toUpperCase()}</h4>
                         <p>This booking is processed.</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}