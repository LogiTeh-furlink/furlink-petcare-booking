import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCalendarTimes, FaTimes, FaInfoCircle, FaPaw, FaClock, FaExclamationTriangle } from "react-icons/fa";
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
    { id: 'upcoming', label: 'Upcoming' }, // New Tab
    { id: 'today', label: 'Today' },       // Replaces Ongoing
    { id: 'to_rate', label: 'To Rate' },   // Replaces Completed
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'denied', label: 'Denied' }
  ];

  // --- Modal States ---
  const [selectedBooking, setSelectedBooking] = useState(null); // Detail Modal
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
    const date = new Date(dateStr).toLocaleDateString("en-US", { 
      month: "short", day: "numeric", year: "numeric" 
    });
    return `${date} @ ${timeStr}`;
  };

  const getServiceSummary = (pets) => {
    if (!pets || pets.length === 0) return "No services";
    const services = pets.flatMap(p => p.booking_services?.map(s => s.service_name) || []);
    return [...new Set(services)].join(", ");
  };

  const formatCurrency = (val) => `Php ${parseFloat(val || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

  // --- Filtering Logic (Crucial Update) ---
  const getFilteredBookings = () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    switch(activeTab) {
      case 'awaiting_approval': 
        return bookings.filter(b => b.status === 'pending');
      
      case 'for_payment': 
        return bookings.filter(b => b.status === 'approved');
      
      case 'upcoming': 
        // Paid/Confirmed AND Date is AFTER today
        return bookings.filter(b => (b.status === 'paid' || b.status === 'confirmed') && b.booking_date > today);
      
      case 'today': 
        // Paid/Confirmed AND Date is TODAY
        return bookings.filter(b => (b.status === 'paid' || b.status === 'confirmed') && b.booking_date === today);
      
      case 'to_rate': 
        // Completed bookings
        return bookings.filter(b => b.status === 'completed');
      
      case 'cancelled': 
        return bookings.filter(b => b.status === 'cancelled');
      
      case 'denied': 
        return bookings.filter(b => b.status === 'declined' || b.status === 'voided');
      
      default: return [];
    }
  };

  // --- Modal Actions ---
  const handleCloseAll = () => {
    setSelectedBooking(null);
    setShowRescheduleModal(false);
    setShowCancelModal(false);
    setReschedForm({ date: "", time: "" });
  };

  // 1. Reschedule Logic
  const openReschedule = () => {
    setReschedForm({ date: selectedBooking.booking_date, time: selectedBooking.time_slot });
    // Keep selectedBooking active (don't null it) but stack modal or swap view
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
      
      // Update UI
      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? {...b, booking_date: reschedForm.date, time_slot: reschedForm.time} : b));
      alert("Reschedule successful.");
      handleCloseAll();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Cancel Logic
  const initiateCancel = () => {
    setShowCancelModal(true);
  };

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

  // 3. Navigation Actions
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
                <div className="zzz">Z<span className="small-z">z</span></div>
            </div>
              <h3>No appointments yet</h3>
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

      {/* --- 1. DETAILS MODAL --- */}
      {selectedBooking && !showRescheduleModal && !showCancelModal && (
        <div className="modal-overlay" onClick={handleCloseAll}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
             <div className="modal-header">
               <h3>Booking Details</h3>
               <button className="close-btn" onClick={handleCloseAll}><FaTimes/></button>
             </div>
             
             <div className="modal-body">
                <div className="detail-row">
                   <label><FaInfoCircle/> Provider:</label>
                   <span>{selectedBooking.service_providers?.business_name}</span>
                </div>
                <div className="detail-row">
                   <label><FaClock/> Schedule:</label>
                   <span>{formatDateTime(selectedBooking.booking_date, selectedBooking.time_slot)}</span>
                </div>
                <div className="detail-row">
                   <label>Status:</label>
                   <span className={`status-badge ${selectedBooking.status}`}>{selectedBooking.status.toUpperCase()}</span>
                </div>
                <div className="detail-row">
                   <label>Total:</label>
                   <span className="price-tag">{formatCurrency(selectedBooking.total_estimated_price)}</span>
                </div>
                
                <hr className="divider"/>
                
                <h4>Pets & Services</h4>
                {selectedBooking.booking_pets?.map((pet, idx) => (
                  <div key={pet.id} className="pet-mini-card">
                     <strong>{idx+1}. {pet.pet_name}</strong>
                     <p>{pet.booking_services?.map(s => s.service_name).join(', ')}</p>
                  </div>
                ))}
             </div>

             <div className="modal-footer">
                {/* 1. Awaiting Approval -> Reschedule | Cancel */}
                {activeTab === 'awaiting_approval' && (
                  <>
                    <button className="resched-btn" onClick={openReschedule}>Reschedule</button>
                    <button className="cancel-btn" onClick={initiateCancel}>Cancel Appointment</button>
                  </>
                )}

                {/* 2. For Payment -> Pay Now | Cancel */}
                {activeTab === 'for_payment' && (
                  <>
                    <button className="pay-btn" onClick={handlePayNow}>Pay Now</button>
                    <button className="cancel-btn" onClick={initiateCancel}>Cancel Appointment</button>
                  </>
                )}

                {/* 3. Upcoming & Today -> Cancel (Warning) */}
                {(activeTab === 'upcoming' || activeTab === 'today') && (
                  <button className="cancel-btn" onClick={initiateCancel}>Cancel Appointment</button>
                )}

                {/* 4. To Rate -> Rate */}
                {activeTab === 'to_rate' && (
                   <button className="rate-btn" onClick={handleRate}>Rate</button>
                )}

                {/* 5. Cancelled / Denied -> Close Only */}
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

      {/* --- 3. CANCEL CONFIRMATION MODAL --- */}
      {showCancelModal && (
        <div className="modal-overlay">
           <div className="modal-content small-modal">
              <div className="modal-header warning-header">
                 <h3><FaExclamationTriangle/> Confirm Cancel</h3>
              </div>
              <div className="modal-body">
                 {(activeTab === 'upcoming' || activeTab === 'today') ? (
                    <p className="warning-text">
                      <strong>Warning:</strong> Your down payment is non-refundable if you cancel now. Are you sure you want to proceed?
                    </p>
                 ) : (
                    <p>Are you sure you want to cancel this appointment? This cannot be undone.</p>
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