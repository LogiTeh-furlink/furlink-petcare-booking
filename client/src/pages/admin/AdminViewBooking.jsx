// src/pages/admin/AdminViewBooking.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInAdmin from "../../components/Header/LoggedInAdmin";
import { 
  FaArrowLeft, FaUser, FaHistory, FaTimes, FaImage, FaSearchPlus 
} from "react-icons/fa";
import "./AdminViewBooking.css";

/* --- MODAL FOR PROOFS --- */
const FileModal = ({ content, onClose }) => {
  if (!content) return null;
  return (
    <div className="admin-file-modal-overlay" onClick={onClose}>
      <div className="admin-file-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-view-header">
          <div className="header-left">
            <FaImage className="type-icon img" style={{marginRight: '10px'}}/>
            <span>{content.title}</span>
          </div>
          <button className="close-modal-btn" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="modal-view-body">
          <img 
            src={content.url} 
            alt={content.title} 
            className="modal-main-img" 
          />
        </div>
      </div>
    </div>
  );
};

export default function AdminViewBooking() {
  const { id } = useParams(); // This is the User (Profile) ID
  const navigate = useNavigate();
  
  // --- STATE ---
  const [userProfile, setUserProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalContent, setModalContent] = useState(null);

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

      // 2. Fetch Deeply Nested Booking Data based on new Schema
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(`
          *,
          service_providers (business_name),
          booking_pets (
            id,
            pet_name,
            pet_type,
            weight_kg,
            booking_services (
              service_name,
              price
            )
          )
        `)
        .eq("user_id", id)
        .order("created_at", { ascending: false });
        
      if (bookingError) console.error("Error fetching bookings:", bookingError);
      setBookings(bookingData || []);

    } catch (err) {
      console.error("Error fetching user data:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric"
    });
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
          <span className={`badge-status ${userProfile?.role}`}>
            {userProfile?.role?.replace(/_/g, " ")}
          </span>
        </div>

        <div className="view-grid">
          {/* --- LEFT COLUMN --- */}
          <div className="view-column">
            
            {/* USER INFORMATION */}
            <section className="provider-card">
              <h2><FaUser /> Personal Information</h2>
              <div className="info-item">
                <strong>Email:</strong> {userProfile?.email || "N/A"}
              </div>
              <div className="info-item">
                <strong>Mobile:</strong> {userProfile?.mobile_number || "N/A"}
              </div>
              <div className="info-item">
                <strong>Date of Birth:</strong> {formatDate(userProfile?.date_of_birth)}
              </div>
              <div className="info-item">
                <strong>Member Since:</strong> {formatDate(userProfile?.created_at)}
              </div>
            </section>
          </div>

          {/* --- RIGHT COLUMN --- */}
          <div className="view-column">
            
            {/* BOOKING HISTORY (Updated for Multi-Pet/Multi-Service) */}
            <section className="provider-card">
              <h2><FaHistory /> Booking History</h2>
              
              {bookings.length > 0 ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                  {bookings.map((booking) => (
                    <div key={booking.id} className="service-details-box">
                       {/* Booking Header */}
                       <div className="service-header-row" style={{borderBottom: '1px solid #f1f5f9', paddingBottom:'10px', marginBottom:'10px'}}>
                          <div>
                            <div style={{fontWeight:'700', fontSize:'1rem', color:'#0E2679'}}>
                              {formatDate(booking.booking_date)}
                            </div>
                            <div style={{fontSize:'0.85rem', color:'#64748b'}}>
                              {booking.time_slot} • {booking.service_providers?.business_name || "Unknown Provider"}
                            </div>
                          </div>
                          <div style={{textAlign:'right'}}>
                             <span className={`status-pill ${booking.status}`} style={{marginBottom:'5px', display:'inline-block'}}>
                               {booking.status}
                             </span>
                             <div style={{fontSize:'0.9rem', fontWeight:'600'}}>Total: ₱{booking.total_estimated_price}</div>
                          </div>
                       </div>

                       {/* Inner Table for Pets & Services */}
                       <table className="admin-service-table" style={{marginTop:'0'}}>
                          <thead>
                             <tr>
                               <th>Pet</th>
                               <th>Service</th>
                               <th>Price</th>
                             </tr>
                          </thead>
                          <tbody>
                             {booking.booking_pets?.map((pet) => (
                               <React.Fragment key={pet.id}>
                                  {/* If a pet has multiple services, map them. If no services, show row with dash */}
                                  {pet.booking_services && pet.booking_services.length > 0 ? (
                                    pet.booking_services.map((svc, idx) => (
                                      <tr key={`${pet.id}-${idx}`}>
                                        {/* Only show Pet Name on the first row for that pet */}
                                        <td style={{borderBottom: idx === pet.booking_services.length - 1 ? '1px solid #f1f5f9' : 'none'}}>
                                          {idx === 0 && (
                                            <>
                                              <strong>{pet.pet_name}</strong>
                                              <div style={{fontSize:'0.75rem', color:'#94a3b8'}}>{pet.pet_type} ({pet.weight_kg}kg)</div>
                                            </>
                                          )}
                                        </td>
                                        <td>{svc.service_name}</td>
                                        <td>₱{svc.price}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td>
                                        <strong>{pet.pet_name}</strong>
                                        <div style={{fontSize:'0.75rem', color:'#94a3b8'}}>{pet.pet_type} ({pet.weight_kg}kg)</div>
                                      </td>
                                      <td colSpan="2" style={{fontStyle:'italic', color:'#cbd5e1'}}>No services recorded</td>
                                    </tr>
                                  )}
                               </React.Fragment>
                             ))}
                          </tbody>
                       </table>

                       {/* Payment / Installation Info */}
                       <div style={{marginTop:'15px', paddingTop:'10px', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                          <div style={{fontSize:'0.85rem'}}>
                             <strong>30% Downpayment:</strong> ₱{booking.installation_payment}
                             {booking.rejection_reason && (
                               <div style={{color:'#ef4444', marginTop:'4px'}}>
                                 <strong>Reason for Rejection:</strong> {booking.rejection_reason}
                               </div>
                             )}
                          </div>
                          
                          {booking.payment_proof_url && (
                             <button 
                               className="btn-back-nav" 
                               style={{fontSize:'0.75rem', padding:'6px 12px', margin:'0', background:'#fff', color:'#0E2679', border:'1px solid #0E2679'}}
                               onClick={() => setModalContent({ url: booking.payment_proof_url, title: `Payment Proof - ${formatDate(booking.booking_date)}` })}
                             >
                               <FaSearchPlus /> View Payment
                             </button>
                          )}
                       </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-data">No bookings found for this user.</p>
              )}
            </section>

          </div>
        </div>

      </div>

      {/* Modal for Proof Images */}
      <FileModal content={modalContent} onClose={() => setModalContent(null)} />
    </>
  );
}