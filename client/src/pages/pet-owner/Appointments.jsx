import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCalendarAlt, FaTimes, FaPaw, FaInfoCircle, FaExclamationTriangle, FaClock } from "react-icons/fa";
import "./Appointments.css";

export default function Appointments() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  
  // State for Details Modal
  const [selectedBooking, setSelectedBooking] = useState(null);
  
  // State for Cancel Confirmation Modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // --- NEW: State for Reschedule Modal ---
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [reschedLoading, setReschedLoading] = useState(false);
  const [reschedForm, setReschedForm] = useState({ date: "", time: "" });

  useEffect(() => {
    fetchBookings();
  }, [navigate]);

  const fetchBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          service_providers (business_name),
          booking_pets (
            *,
            booking_services (
              *
            )
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
    const date = new Date(dateStr).toLocaleDateString("en-US", { 
      month: "short", day: "numeric", year: "numeric" 
    });
    // Handle time formatting carefully
    const [hour, minute] = timeStr.split(":");
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${date} • ${h12}:${minute} ${ampm}`;
  };

  const getServiceSummary = (pets) => {
    if (!pets || pets.length === 0) return "No services";
    const services = pets.flatMap(p => p.booking_services?.map(s => s.service_name) || []);
    return [...new Set(services)].join(", ");
  };

  const getCount = (tabId) => {
    return bookings.filter(b => {
      if(tabId === 'payment') return b.status === 'approved';
      if(tabId === 'verification') return b.status === 'verification_pending';
      if(tabId === 'denied') return b.status === 'declined';
      return b.status === tabId;
    }).length;
  };

  // --- Modal Logic ---
  const handleOpenModal = (booking) => {
    setSelectedBooking(booking);
    document.body.style.overflow = 'hidden';
  };

  const handleCloseModal = () => {
    setSelectedBooking(null);
    setShowCancelModal(false);
    setShowRescheduleModal(false); // Ensure reschedule modal is closed
    document.body.style.overflow = 'auto';
  };

  // --- NEW: Reschedule Logic ---
  const handleOpenReschedule = () => {
    // Pre-fill form with current booking details
    setReschedForm({
      date: selectedBooking.booking_date,
      time: selectedBooking.time_slot
    });
    setShowRescheduleModal(true);
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBooking) return;
    
    setReschedLoading(true);
    try {
      // 1. Update Supabase
      const { error } = await supabase
        .from('bookings')
        .update({ 
          booking_date: reschedForm.date,
          time_slot: reschedForm.time
        })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      // 2. Update Local State (Bookings List)
      const updatedBookings = bookings.map(b => 
        b.id === selectedBooking.id 
          ? { ...b, booking_date: reschedForm.date, time_slot: reschedForm.time } 
          : b
      );
      setBookings(updatedBookings);

      // 3. Update Selected Booking (so the details modal updates instantly)
      setSelectedBooking(prev => ({
        ...prev,
        booking_date: reschedForm.date,
        time_slot: reschedForm.time
      }));

      // 4. Close Reschedule Modal
      setShowRescheduleModal(false);
      alert("Appointment rescheduled successfully!");

    } catch (err) {
      console.error("Error rescheduling:", err);
      alert("Failed to reschedule. Please try again.");
    } finally {
      setReschedLoading(false);
    }
  };

  // --- Cancel Logic ---
  const initiateCancel = () => {
    setShowCancelModal(true);
  };

  const confirmCancellation = async () => {
    if (!selectedBooking) return;
    setCancelLoading(true);

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      const updatedBookings = bookings.map(b => 
        b.id === selectedBooking.id ? { ...b, status: 'cancelled' } : b
      );
      setBookings(updatedBookings);

      setShowCancelModal(false);
      setSelectedBooking(prev => ({ ...prev, status: 'cancelled' }));
      handleCloseModal(); 
      alert("Appointment has been cancelled.");

    } catch (err) {
      console.error("Error cancelling booking:", err);
      alert("Failed to cancel booking. Please try again.");
    } finally {
      setCancelLoading(false);
    }
  };

  // --- Filtering ---
  const getFilteredBookings = () => {
    switch (activeTab) {
      case "pending": return bookings.filter(b => b.status === 'pending');
      case "payment": return bookings.filter(b => b.status === 'approved'); 
      case "verification": return bookings.filter(b => b.status === 'verification_pending');
      case "verified": return bookings.filter(b => b.status === 'verified');
      case "completed": return bookings.filter(b => b.status === 'completed');
      case "denied": return bookings.filter(b => b.status === 'declined');
      case "cancelled": return bookings.filter(b => b.status === 'cancelled');
      default: return [];
    }
  };

  const displayedBookings = getFilteredBookings();

  const getCancelMessage = () => {
    if (!selectedBooking) return "";
    const s = selectedBooking.status;
    if (s === 'pending' || s === 'approved') {
      return "If the booking is cancelled, it cannot be undone.";
    }
    if (s === 'verification_pending' || s === 'verified') {
      return "If the booking is cancelled, it cannot be undone and the payment cannot be refunded.";
    }
    return "Are you sure you want to cancel?";
  };

  if (loading) return <div className="app-loading">Loading Appointments...</div>;

  return (
    <>
      <LoggedInNavbar />
      <div className="appointments-wrapper">
        <div className="appointments-container">
          
          <div className="app-header">
            <h1>My Appointments</h1>
            <p>Track your pet's grooming schedule and status.</p>
          </div>

          <div className="status-tabs-container">
            <div className="status-tabs-row">
              {['pending', 'payment', 'verification', 'verified', 'completed', 'denied', 'cancelled'].map(status => (
                 <button 
                 key={status}
                 className={`status-tab ${activeTab === status ? 'active' : ''}`}
                 onClick={() => setActiveTab(status)}
               >
                 <h3>{status === 'verification' ? 'VERIFYING' : status === 'payment' ? 'FOR PAYMENT' : status.toUpperCase()}</h3>
                 <span className="count-badge">{getCount(status)}</span>
               </button>
              ))}
            </div>
          </div>

          <div className="app-list-section">
            <div className="section-header">
               <h2>{activeTab.replace('_', ' ').toUpperCase()} LIST</h2>
            </div>
            
            <div className="list-header-row">
              <div>Date & Time</div>
              <div>Provider</div>
              <div>Pets & Services</div>
              <div>Total</div>
              <div>Action</div>
            </div>

            <div className="bookings-grid">
              {displayedBookings.length === 0 ? (
                <div className="no-app-state">
                  <FaCalendarAlt className="empty-icon"/>
                  <h3>No appointments found.</h3>
                </div>
              ) : (
                displayedBookings.map(booking => (
                  <div key={booking.id} className="app-card">
                    <div className="app-col date-col">
                      <span className="mobile-label">Schedule</span>
                      <div className="content-wrap">{formatDateTime(booking.booking_date, booking.time_slot)}</div>
                    </div>
                    <div className="app-col provider-col">
                      <span className="mobile-label">Provider</span>
                      <strong>{booking.service_providers?.business_name || "Unknown Provider"}</strong>
                    </div>
                    <div className="app-col service-col">
                      <span className="mobile-label">Details</span>
                      <div className="content-wrap">
                        <span>{booking.booking_pets?.length || 0} Pets • {getServiceSummary(booking.booking_pets)}</span>
                      </div>
                    </div>
                    <div className="app-col price-col">
                      <span className="mobile-label">Total</span>
                      <div className="content-wrap price">Php {booking.total_estimated_price}</div>
                    </div>
                    <div className="app-col action-col">
                      <button className="view-app-btn" onClick={() => handleOpenModal(booking)}>View Details</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* --- DETAILS MODAL --- */}
      {selectedBooking && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            
            <div className="modal-header">
              <h2>Appointment Details</h2>
              <button className="close-btn" onClick={handleCloseModal}><FaTimes /></button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3><FaInfoCircle /> General Info</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Status:</label>
                    <span className={`status-tag ${selectedBooking.status}`}>{selectedBooking.status.toUpperCase()}</span>
                  </div>
                  <div className="detail-item">
                    <label>Date & Time:</label>
                    <span>{formatDateTime(selectedBooking.booking_date, selectedBooking.time_slot)}</span>
                  </div>
                  {/* ... other detail items ... */}
                  <div className="detail-item">
                    <label>Total Price:</label>
                    <span className="price-text">Php {selectedBooking.total_estimated_price}</span>
                  </div>
                </div>
              </div>

              {/* ... Pets & Services Section ... */}
              <div className="detail-section">
                <h3><FaPaw /> Pets & Services</h3>
                {selectedBooking.booking_pets && selectedBooking.booking_pets.map((pet, index) => (
                  <div key={pet.id} className="pet-detail-card">
                    <div className="pet-header">
                      <h4>{index + 1}. {pet.pet_name} ({pet.pet_type})</h4>
                    </div>
                     {/* ... Rest of pet details ... */}
                     <div className="services-list">
                         <ul>
                            {pet.booking_services?.map(s => <li key={s.id}>{s.service_name} - Php {s.price}</li>)}
                         </ul>
                     </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              {['pending', 'approved', 'verification_pending', 'verified'].includes(selectedBooking.status) ? (
                 <div className="footer-actions">
                   {/* --- MODIFIED: OnClick calls handleOpenReschedule --- */}
                   <button className="resched-btn" onClick={handleOpenReschedule}>
                    Reschedule
                   </button>
                   <button className="cancel-btn" onClick={initiateCancel}>
                    Cancel Appointment
                   </button>
                 </div>
              ) : (
                <button className="secondary-btn" onClick={handleCloseModal}>Close</button>
              )}
            </div>

            {/* --- CONFIRMATION MODAL (Existing) --- */}
            {showCancelModal && (
               <div className="confirm-modal-overlay">
                 {/* ... Cancel modal content ... */}
                 <div className="confirm-modal-content">
                    <h3>Are you sure?</h3>
                    <p>{getCancelMessage()}</p>
                    <div className="confirm-actions">
                        <button className="confirm-btn-yes" onClick={confirmCancellation} disabled={cancelLoading}>Yes</button>
                        <button className="confirm-btn-no" onClick={()=>setShowCancelModal(false)}>No</button>
                    </div>
                 </div>
               </div>
            )}

            {/* --- NEW: RESCHEDULE MODAL --- */}
            {showRescheduleModal && (
              <div className="confirm-modal-overlay">
                <div className="confirm-modal-content" style={{ maxWidth: '400px' }}>
                  <div className="confirm-icon">
                    <FaClock />
                  </div>
                  <h3>Reschedule Appointment</h3>
                  <p className="confirm-message">Select a new date and time for your appointment.</p>
                  
                  <form onSubmit={handleRescheduleSubmit} className="reschedule-form">
                    <div className="form-group" style={{ marginBottom: '15px', textAlign: 'left' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>New Date</label>
                      <input 
                        type="date" 
                        required
                        value={reschedForm.date}
                        onChange={(e) => setReschedForm({...reschedForm, date: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
                      />
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: '20px', textAlign: 'left' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>New Time</label>
                      <input 
                        type="time" 
                        required
                        value={reschedForm.time}
                        onChange={(e) => setReschedForm({...reschedForm, time: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
                      />
                    </div>

                    <div className="confirm-actions">
                      <button 
                        type="submit"
                        className="confirm-btn-yes" 
                        style={{ backgroundColor: '#2563eb' }} // Blue for save
                        disabled={reschedLoading}
                      >
                        {reschedLoading ? "Saving..." : "Save Changes"}
                      </button>
                      <button 
                        type="button"
                        className="confirm-btn-no" 
                        onClick={() => setShowRescheduleModal(false)}
                        disabled={reschedLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      <Footer />
    </>
  );
}