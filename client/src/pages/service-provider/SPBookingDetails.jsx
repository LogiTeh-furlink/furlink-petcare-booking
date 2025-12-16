import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { 
  FaArrowLeft, FaCheck, FaTimes, FaPaw, FaSyringe, 
  FaFileMedical, FaExclamationCircle, FaImage
} from "react-icons/fa";
import "./SPBookingDetails.css";

export default function SPBookingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // --- Modal States ---
  const [previewImage, setPreviewImage] = useState(null); 
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [feedback, setFeedback] = useState({ show: false, type: '', message: '' });

  // --- Form States ---
  const [declineReason, setDeclineReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Helper: Feedback Modal ---
  const showFeedback = (type, message) => {
    setFeedback({ show: true, type, message });
  };

  const closeFeedback = () => {
    setFeedback({ ...feedback, show: false });
  };

  // --- Data Fetching ---
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
        navigate("/service/dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchBookingDetails();
  }, [id, navigate]);

  // --- Formatters ---
  const formatTime12Hour = (timeStr) => {
    if (!timeStr) return "";
    const [hour, minute] = timeStr.split(":");
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? "P.M." : "A.M.";
    const h12 = h % 12 || 12; 
    return `${h12}:${minute} ${ampm}`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: 'long', day: 'numeric', year: 'numeric'
    });
  };

  // --- Handlers ---
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
      if (newStatus === 'declined') setShowDeclineModal(false);
      showFeedback('success', `Booking has been ${newStatus === 'approved' ? 'APPROVED' : 'DECLINED'}.`);

    } catch (err) {
      showFeedback('error', "Failed to update booking status.");
    } finally {
      setIsProcessing(false);
    }
  };

  const submitDecline = () => {
    if (!declineReason) {
      showFeedback('error', "Please select a reason.");
      return;
    }
    const finalReason = declineReason === "Other" ? customReason : declineReason;
    handleUpdateStatus("declined", finalReason);
  };

  if (loading) return <div className="sp-loading">Loading...</div>;
  if (!booking) return null;

  return (
    <>
      <LoggedInNavbar />

      {/* --- 1. Image Zoom Modal --- */}
      {previewImage && (
        <div className="modal-overlay z-max" onClick={() => setPreviewImage(null)}>
          <div className="image-modal-content">
            <img src={previewImage} alt="Preview" />
            <button className="close-preview-btn"><FaTimes /></button>
          </div>
        </div>
      )}

      {/* --- 2. Feedback Modal --- */}
      {feedback.show && (
        <div className="modal-overlay z-high">
          <div className={`feedback-card ${feedback.type}`}>
            <div className="feedback-icon">
              {feedback.type === 'success' ? <FaCheck /> : <FaExclamationCircle />}
            </div>
            <h3>{feedback.type === 'success' ? 'Success' : 'Error'}</h3>
            <p>{feedback.message}</p>
            <button className="feedback-btn" onClick={closeFeedback}>Close</button>
          </div>
        </div>
      )}

      {/* --- 3. Decline Modal --- */}
      {showDeclineModal && (
        <div className="modal-overlay z-high">
          <div className="decline-card">
            <div className="modal-header">
              <h3>Decline Request</h3>
              <button onClick={() => setShowDeclineModal(false)}><FaTimes /></button>
            </div>
            <p>Reason for rejection:</p>
            <select 
              value={declineReason} 
              onChange={(e) => setDeclineReason(e.target.value)}
              className="reason-select"
            >
              <option value="">-- Select Reason --</option>
              <option value="Fully Booked">Fully Booked</option>
              <option value="Staff Unavailable">Staff Unavailable</option>
              <option value="Incomplete Documents">Incomplete Documents</option>
              <option value="Other">Other</option>
            </select>
            {declineReason === "Other" && (
              <textarea 
                className="custom-reason-input"
                placeholder="Specify reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
            <button className="confirm-decline-btn" onClick={submitDecline} disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Confirm Decline"}
            </button>
          </div>
        </div>
      )}


      {/* --- Main Page Layout --- */}
      <div className="details-page-wrapper">
        <div className="details-container">
          
          <button className="back-link" onClick={() => navigate("/service/dashboard")}>
            <FaArrowLeft /> Back to Dashboard
          </button>

          <div className="wireframe-grid">
            
            {/* --- LEFT SIDE: CONTENT --- */}
            <div className="content-side">
              
              {/* Header: Amount and Date (Matches Wireframe) */}
              <div className="simple-header">
                <div className="amount-row">
                  <span className="amount-label">Total Amount</span>
                  <span className="amount-value">Php {booking.total_estimated_price}</span>
                </div>
                <div className="date-row">
                  {formatDate(booking.booking_date)} &nbsp; {formatTime12Hour(booking.time_slot)}
                </div>
              </div>

              {/* Loop through Pets */}
              {booking.booking_pets.map((pet, index) => (
                <div key={pet.id} className="wf-pet-card">
                  
                  <h3 className="wf-pet-name">Pet {index + 1} ({pet.pet_name})</h3>

                  <div className="wf-pet-columns">
                    {/* Left Column: Details */}
                    <div className="wf-col-left">
                      <div className="wf-row"><span className="wf-label">Name</span> <span className="wf-val">{pet.pet_name}</span></div>
                      <div className="wf-row"><span className="wf-label">Pet Type</span> <span className="wf-val">{pet.pet_type}</span></div>
                      <div className="wf-row"><span className="wf-label">Breed</span> <span className="wf-val">{pet.breed || "N/A"}</span></div>
                      <div className="wf-row"><span className="wf-label">Gender</span> <span className="wf-val">{pet.gender || "N/A"}</span></div>
                      <div className="wf-row"><span className="wf-label">Weight and Size</span> <span className="wf-val">{pet.weight_kg}kg / {pet.calculated_size}</span></div>
                      <div className="wf-row"><span className="wf-label">Behavior</span> <span className="wf-val">{pet.behavior || "Normal"}</span></div>
                      <div className="wf-row"><span className="wf-label">Emergency Consent</span> <span className="wf-val">{pet.emergency_consent ? "Granted" : "Denied"}</span></div>
                    </div>

                    {/* Right Column: Services */}
                    <div className="wf-col-right">
                      <div className="wf-service-group">
                        <span className="wf-label">Availed Service</span>
                        <div className="wf-service-list">
                          {pet.booking_services?.map((s, i) => (
                            <div key={i}>{s.service_name}</div>
                          ))}
                        </div>
                      </div>
                      <div className="wf-service-group">
                        <span className="wf-label">Grooming Specification</span>
                        <div className="wf-spec-text">{pet.grooming_specifications || "None"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Images (Gray Boxes style) */}
                  <div className="wf-images-row">
                    
                    {/* Vaccine Box */}
                    <div className="wf-img-box" onClick={() => pet.vaccine_card_url && setPreviewImage(pet.vaccine_card_url)}>
                      <div className="wf-img-placeholder">
                        {pet.vaccine_card_url ? (
                          <img src={pet.vaccine_card_url} alt="Vaccine" />
                        ) : (
                          <FaImage className="wf-icon" />
                        )}
                      </div>
                      <span className="wf-img-label">Vaccine</span>
                    </div>

                    {/* Proof Box */}
                    <div className="wf-img-box" onClick={() => pet.illness_proof_url && setPreviewImage(pet.illness_proof_url)}>
                      <div className="wf-img-placeholder">
                        {pet.illness_proof_url ? (
                          <img src={pet.illness_proof_url} alt="Illness" />
                        ) : (
                          <FaImage className="wf-icon" />
                        )}
                      </div>
                      <span className="wf-img-label">Proof of Illness</span>
                    </div>

                  </div>
                </div>
              ))}
            </div>

            {/* --- RIGHT SIDE: STATUS (Sticky) --- */}
            <div className="sidebar-side">
              <div className="wf-status-box">
                <div className="wf-status-header">STATUS</div>
                
                <div className="wf-status-body">
                  {booking.status === 'pending' ? (
                    <>
                      <button 
                        className="wf-btn approve" 
                        onClick={() => handleUpdateStatus('approved')}
                        disabled={isProcessing}
                      >
                        Approved
                      </button>
                      <button 
                        className="wf-btn decline" 
                        onClick={() => setShowDeclineModal(true)}
                        disabled={isProcessing}
                      >
                        Declined
                      </button>
                    </>
                  ) : (
                    <div className={`current-status-badge ${booking.status}`}>
                      {booking.status.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}