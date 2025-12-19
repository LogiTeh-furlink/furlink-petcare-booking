import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { 
  FaArrowLeft, 
  FaQrcode, 
  FaMoneyBillWave, 
  FaFileUpload, 
  FaCheckCircle, 
  FaPaw, 
  FaFileInvoiceDollar,
  FaTimes,
  FaSearchPlus
} from "react-icons/fa";
import "./Payment.css";

export default function Payment() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Data State
  const [booking, setBooking] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [referenceNum, setReferenceNum] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Modal States
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null); // For QR Zoom

  useEffect(() => {
    fetchBookingData();
  }, [id]);

  const fetchBookingData = async () => {
    try {
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(`
          *,
          service_providers (
            id, 
            business_name, 
            business_mobile
          ),
          booking_pets (
            pet_name, pet_type, breed, gender, weight_kg, calculated_size, 
            behavior, emergency_consent, grooming_specifications, 
            vaccine_card_url, illness_proof_url,
            booking_services (service_name, price)
          )
        `)
        .eq("id", id)
        .single();

      if (bookingError) throw bookingError;
      setBooking(bookingData);

      if (bookingData.service_providers?.id) {
        const { data: methods } = await supabase
          .from("service_provider_payments")
          .select("*")
          .eq("provider_id", bookingData.service_providers.id);
        
        setPaymentMethods(methods || []);
      }

    } catch (err) {
      setErrorMsg("Unable to load booking details.");
    } finally {
      setLoading(false);
    }
  };

  // --- File Handling ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setErrorMsg("");

    if (!file) return;

    // Type Validation
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setErrorMsg("Invalid file type. Only PNG and JPEG are allowed.");
      return;
    }

    // Size Validation (1MB)
    if (file.size > 1024 * 1024) {
      setErrorMsg("File is too large. Max size is 1 MB.");
      return;
    }

    setProofFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // --- Submit Logic ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!proofFile || !referenceNum) {
      setErrorMsg("Both Reference Number and Proof Image are required.");
      return;
    }

    setUploading(true);
    setErrorMsg("");

    try {
      // 1. Upload to 'Payments' Bucket
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${booking.id}_ref_${Date.now()}.${fileExt}`;
      const filePath = `proofs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('Payments') 
        .upload(filePath, proofFile);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('Payments')
        .getPublicUrl(filePath);

      // 3. Update Database
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          payment_proof_url: publicUrl,
          rejection_reason: referenceNum, // Storing Ref No. here or add a new column 'reference_no'
          status: 'for review' 
        })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      setShowSuccessModal(true);

    } catch (err) {
      setErrorMsg("Submission failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFinish = () => {
    navigate("/booking-history");
  };

  const formatCurrency = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
  const formatDateTime = (date, time) => {
    const d = new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    return `${d} @ ${time}`;
  };

  if (loading) return <div className="payment-loading">Loading...</div>;

  return (
    <div className="page-wrapper">
      <LoggedInNavbar />
      
      <div className="payment-container">
        
        <div className="payment-header">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft /> Cancel Payment
          </button>
          <h1>Complete Your Payment</h1>
        </div>

        <div className="payment-grid-layout">
          
          {/* --- TOP LEFT: DETAILS --- */}
          <div className="info-card details-section">
            <h3 className="card-title"><FaFileInvoiceDollar/> Booking Summary</h3>
            <div className="summary-grid">
               <div className="summary-item">
                 <span className="label">Total Amount</span>
                 <span className="amount-highlight">{formatCurrency(booking.total_estimated_price)}</span>
               </div>
               <div className="summary-item">
                 <span className="label">Provider</span>
                 <span>{booking.service_providers?.business_name}</span>
               </div>
               <div className="summary-item">
                 <span className="label">Schedule</span>
                 <span>{formatDateTime(booking.booking_date, booking.time_slot)}</span>
               </div>
            </div>

            <h4 className="sub-header"><FaPaw/> Pet Details</h4>
            <div className="pets-scroll">
              {booking.booking_pets?.map((pet, idx) => (
                <div key={idx} className="mini-pet-card">
                  <strong>{idx + 1}. {pet.pet_name} ({pet.pet_type})</strong>
                  <p className="mini-specs">{pet.breed} • {pet.weight_kg}kg • {pet.gender}</p>
                  <p className="mini-services">
                    Svcs: {pet.booking_services?.map(s => s.service_name).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* --- TOP RIGHT: QR CODES --- */}
          <div className="info-card qr-section">
            <h3 className="card-title"><FaQrcode/> Scan to Pay</h3>
            <p className="card-hint">Click image to zoom</p>
            
            <div className="qr-grid">
              {paymentMethods.length > 0 ? (
                paymentMethods.map(method => (
                  <div key={method.id} className="qr-item" onClick={() => setZoomedImage(method.file_url)}>
                    <div className="qr-wrapper">
                      <img src={method.file_url} alt={method.method_type} className="qr-thumb" />
                      <div className="zoom-overlay"><FaSearchPlus/></div>
                    </div>
                    <span className="method-label">{method.method_type}</span>
                  </div>
                ))
              ) : (
                <div className="no-qr">
                  No QR codes available. 
                  <br/>Mobile: {booking.service_providers?.business_mobile}
                </div>
              )}
            </div>
          </div>

          {/* --- FULL WIDTH BOTTOM: SUBMIT PROOF --- */}
          <div className="info-card upload-card full-width">
            <h3 className="card-title"><FaMoneyBillWave/> Submit Proof of Payment</h3>
            
            <form onSubmit={handleSubmit} className="proof-form">
              
              <div className="form-row">
                <div className="form-group ref-group">
                  <label>Reference Number <span className="req">*</span></label>
                  <input 
                    type="text" 
                    className="payment-input"
                    placeholder="Transaction / Reference No."
                    maxLength={50} // LIMIT 50 CHARS
                    value={referenceNum}
                    onChange={(e) => setReferenceNum(e.target.value)}
                    required
                  />
                  <small>{referenceNum.length}/50</small>
                </div>

                <div className="form-group file-group">
                  <label>Upload Screenshot <span className="req">*</span></label>
                  <div className="file-input-container">
                    <input 
                      type="file" 
                      id="proof-upload"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleFileChange}
                      hidden
                    />
                    <label htmlFor="proof-upload" className="custom-file-btn">
                      <FaFileUpload/> {proofFile ? "Change File" : "Select Image"}
                    </label>
                    <span className="file-name">
                      {proofFile ? proofFile.name : "No file selected (Max 1MB)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Preview Area */}
              {previewUrl && (
                <div className="proof-preview-area">
                  <p>Preview:</p>
                  <img src={previewUrl} alt="Proof Preview" className="proof-preview-img"/>
                </div>
              )}

              {errorMsg && <div className="error-msg"><FaExclamationTriangle/> {errorMsg}</div>}

              <div className="form-actions">
                <button 
                  type="submit" 
                  className="submit-btn" 
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Submit Payment"}
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>

      {/* --- QR ZOOM MODAL --- */}
      {zoomedImage && (
        <div className="modal-overlay" onClick={() => setZoomedImage(null)}>
          <div className="modal-content zoom-modal">
            <button className="close-icon-btn" onClick={() => setZoomedImage(null)}>
              <FaTimes/>
            </button>
            <img src={zoomedImage} alt="QR Full" className="zoomed-img"/>
          </div>
        </div>
      )}

      {/* --- SUCCESS MODAL --- */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="modal-content success-modal">
            <div className="success-icon"><FaCheckCircle /></div>
            <h3>Payment Submitted!</h3>
            <p>Your booking is now under review. Please wait for the provider to verify your payment.</p>
            <button className="done-btn" onClick={handleFinish}>Return to History</button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}