import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCalendarAlt, FaTimes, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import "./SPDashboard.css";

// --- Helper: Calendar ---
const BookingCalendar = ({ bookings, onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Count only "paid" (Upcoming) bookings
  const activeBookings = bookings.filter(b => b.status === 'paid');

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const count = activeBookings.filter(b => b.booking_date === dateStr).length;
      
      days.push(
        <div key={d} className={`calendar-day ${count > 0 ? 'has-bookings' : ''}`}>
          <span className="day-number">{d}</span>
          {count > 0 && <span className="day-badge">{count} Paid</span>}
        </div>
      );
    }
    return days;
  };

  const changeMonth = (offset) => {
    setCurrentDate(new Date(year, month + offset, 1));
  };

  return (
    <div className="calendar-modal-overlay">
      <div className="calendar-modal">
        <div className="calendar-header">
          <h3>Paid Bookings Calendar</h3>
          <button onClick={onClose}><FaTimes /></button>
        </div>
        <div className="calendar-nav">
          <button onClick={() => changeMonth(-1)}><FaChevronLeft /></button>
          <span>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => changeMonth(1)}><FaChevronRight /></button>
        </div>
        <div className="calendar-grid-header">
          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
        </div>
        <div className="calendar-grid">
          {renderDays()}
        </div>
      </div>
    </div>
  );
};

export default function SPDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs: 'new_request', 'for_verification', 'upcoming', 'completed'
  const [activeTab, setActiveTab] = useState("new_request"); 
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  
  // Actions
  const [declineReason, setDeclineReason] = useState("");
  const [voidReason, setVoidReason] = useState("");

  useEffect(() => {
    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      // 1. Get Provider ID
      const { data: providerData, error: providerError } = await supabase
        .from("service_providers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (providerError) throw providerError;

      // 2. Get Bookings
      // Note: We use nested selects for related data
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select(`
          *,
          booking_pets (
            *,
            booking_services (service_name, price)
          )
        `)
        .eq("provider_id", providerData.id)
        .order('booking_date', { ascending: false });

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData || []);

    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Logic: Filtering based on the 4 Cards ---
  const getFilteredBookings = () => {
    switch(activeTab) {
      case 'new_request':
        // Show 'pending'
        return bookings.filter(b => b.status === 'pending');
      
      case 'for_verification':
        // Show 'for review' (User uploaded payment) and maybe 'approved' (Waiting for payment)
        // Adjusting strictly to "For Payment Verification" usually implies 'for review'
        return bookings.filter(b => b.status === 'for review');

      case 'upcoming':
        // Show 'paid' (Ready for service)
        return bookings.filter(b => b.status === 'paid');

      case 'completed':
        // Show 'completed'
        return bookings.filter(b => b.status === 'completed');

      default:
        return [];
    }
  };

  // --- Logic: Stats Counts ---
  const stats = {
    revenue: bookings
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + (parseFloat(b.total_estimated_price) || 0), 0),
    new_request: bookings.filter(b => b.status === 'pending').length,
    for_verification: bookings.filter(b => b.status === 'for review').length,
    upcoming: bookings.filter(b => b.status === 'paid').length,
    completed: bookings.filter(b => b.status === 'completed').length,
  };

  const formatCurrency = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  
  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${date} @ ${timeStr}`;
  };

  // --- Handlers ---
  const handleAction = async (actionType) => {
    if (!selectedBooking) return;

    let newStatus = '';
    let updateData = {};

    // STATUS FLOW MAPPING
    switch(actionType) {
      case 'approve':
        // pending -> approved (Provider accepts, waits for user payment)
        newStatus = 'approved'; 
        break;
      
      case 'decline':
        // pending -> decline
        newStatus = 'decline';
        updateData = { rejection_reason: declineReason };
        break;
      
      case 'accept_payment':
        // for review -> paid (Provider confirms receipt)
        newStatus = 'paid';
        break;
      
      case 'void_payment':
        // for review -> void (Provider rejects receipt)
        newStatus = 'void';
        updateData = { rejection_reason: voidReason };
        break;

      default: return;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus, ...updateData })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      // Update Local State Optimistically
      setBookings(prev => prev.map(b => 
        b.id === selectedBooking.id ? { ...b, status: newStatus, ...updateData } : b
      ));
      
      closeModal();
    } catch (err) {
      alert("Action failed: " + err.message);
    }
  };

  const closeModal = () => {
    setSelectedBooking(null);
    setDeclineReason("");
    setVoidReason("");
  };

  if (loading) return <div className="sp-loading">Loading Dashboard...</div>;

  return (
    <div className="page-wrapper">
      <LoggedInNavbar />
      
      {showCalendar && <BookingCalendar bookings={bookings} onClose={() => setShowCalendar(false)} />}

      <div className="sp-dashboard-container">
        
        {/* Header Row */}
        <div className="dashboard-top-row">
          <div className="revenue-card">
            <div className="revenue-info">
              <h1>Total Revenue</h1>
              <p>For the month of {new Date().toLocaleString('default', { month: 'long' })}</p>
            </div>
            <div className="revenue-value">
              <span>{formatCurrency(stats.revenue)}</span>
            </div>
          </div>
          <button className="calendar-btn" onClick={() => setShowCalendar(true)}>
             <FaCalendarAlt size={24} />
             <span>Access Calendar</span>
          </button>
        </div>

        {/* Status Tabs (Interactive Cards) */}
        <div className="status-cards-grid">
           <div className={`status-card ${activeTab === 'new_request' ? 'active' : ''}`} onClick={() => setActiveTab('new_request')}>
             <h3>New Requests</h3>
             <p className="status-count">{stats.new_request}</p>
           </div>
           <div className={`status-card ${activeTab === 'for_verification' ? 'active' : ''}`} onClick={() => setActiveTab('for_verification')}>
             <h3>Pending Payment</h3>
             <p className="status-count">{stats.for_verification}</p>
           </div>
           <div className={`status-card ${activeTab === 'upcoming' ? 'active' : ''}`} onClick={() => setActiveTab('upcoming')}>
             <h3>Upcoming</h3>
             <p className="status-count">{stats.upcoming}</p>
           </div>
           <div className={`status-card ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>
             <h3>Completed</h3>
             <p className="status-count">{stats.completed}</p>
           </div>
        </div>

        {/* Bookings Table */}
        <div className="bookings-table-container">
          <div className="table-header-title">
             <h2>{activeTab.replace('_', ' ').toUpperCase()}</h2>
          </div>

          <table className="sp-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>No. of Pets</th>
                <th>Service to Avail</th>
                <th>Service Total Amt</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredBookings().length === 0 ? (
                <tr><td colSpan="6" className="empty-state">No bookings found in this category.</td></tr>
              ) : (
                getFilteredBookings().map(booking => (
                  <tr key={booking.id}>
                    <td><div className="fw-bold">{formatDateTime(booking.booking_date, booking.time_slot)}</div></td>
                    <td>{booking.booking_pets?.length || 0} Pets</td>
                    <td className="service-cell">
                       {booking.booking_pets?.map(p => 
                         p.booking_services?.map(s => s.service_name).join(', ')
                       ).join(', ')}
                    </td>
                    <td>{formatCurrency(booking.total_estimated_price)}</td>
                    <td>
                      <span className={`badge badge-${booking.status ? booking.status.replace(' ', '_') : 'unknown'}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td>
                      <button className="view-details-btn" onClick={() => setSelectedBooking(booking)}>
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- WIDER DETAILS MODAL --- */}
      {selectedBooking && (
        <div className="modal-overlay">
          <div className="modal-content wide-modal">
            <div className="modal-header">
              <h3>Booking Details</h3>
              <button onClick={closeModal}><FaTimes /></button>
            </div>
            
            <div className="modal-body-scroll">
              
              {/* Top Summary */}
              <div className="modal-summary-section">
                <div className="info-row">
                   <span>Status:</span>
                   <strong className="uppercase-status">{selectedBooking.status}</strong>
                </div>
                <div className="info-row">
                   <span>Date & Time:</span>
                   <strong>{formatDateTime(selectedBooking.booking_date, selectedBooking.time_slot)}</strong>
                </div>
                <div className="info-row">
                   <span>Total Amount:</span>
                   <strong className="text-highlight">{formatCurrency(selectedBooking.total_estimated_price)}</strong>
                </div>
              </div>

              {/* Payment Proof (If in verification) */}
              {selectedBooking.payment_proof_url && (
                <div className="full-image-block">
                  <h4>Payment Proof</h4>
                  <img src={selectedBooking.payment_proof_url} alt="Payment Proof" className="facebook-style-img" />
                </div>
              )}

              {/* Pets & Images */}
              <div className="modal-pets-list">
                <h4>Pet Information & Documents</h4>
                {selectedBooking.booking_pets?.map((pet, i) => (
                  <div key={pet.id} className="pet-detail-block">
                    <div className="pet-header">
                      <h5>{i+1}. {pet.pet_name} ({pet.pet_type})</h5>
                    </div>
                    
                    <div className="pet-grid">
                      <p><strong>Breed:</strong> {pet.breed}</p>
                      <p><strong>Gender:</strong> {pet.gender}</p>
                      <p><strong>Weight:</strong> {pet.weight_kg} kg</p>
                      <p><strong>Size:</strong> {pet.calculated_size}</p>
                      <p><strong>Behavior:</strong> {pet.behavior || 'N/A'}</p>
                      <p><strong>Services:</strong> {pet.booking_services?.map(s => s.service_name).join(', ')}</p>
                    </div>

                    {/* LARGE IMAGES */}
                    <div className="pet-images-container">
                      {pet.vaccine_card_url && (
                        <div className="image-wrapper">
                          <p className="img-label">Vaccine Card</p>
                          <img src={pet.vaccine_card_url} alt="Vaccine Card" className="facebook-style-img" />
                        </div>
                      )}
                      {pet.illness_proof_url && (
                        <div className="image-wrapper">
                          <p className="img-label">Proof of Illness</p>
                          <img src={pet.illness_proof_url} alt="Illness Proof" className="facebook-style-img" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              {/* ACTION: New Request (pending) */}
              {selectedBooking.status === 'pending' && (
                <div className="action-row">
                   <div className="decline-area">
                      <select value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} className="action-select">
                        <option value="">Select Reason for Declining...</option>
                        <option value="Schedule Conflict">Schedule Conflict</option>
                        <option value="Staff Unavailable">Staff Unavailable</option>
                        <option value="Service Not Available">Service Not Available</option>
                      </select>
                      <button className="btn-decline" disabled={!declineReason} onClick={() => handleAction('decline')}>
                        Decline
                      </button>
                   </div>
                   <button className="btn-approve" onClick={() => handleAction('approve')}>
                     Approve
                   </button>
                </div>
              )}

              {/* ACTION: Payment Verification (for review) */}
              {selectedBooking.status === 'for review' && (
                <div className="action-row">
                   <div className="decline-area">
                      <select value={voidReason} onChange={(e) => setVoidReason(e.target.value)} className="action-select">
                        <option value="">Select Reason for Voiding...</option>
                        <option value="Invalid Receipt">Invalid Receipt</option>
                        <option value="Amount Mismatch">Amount Mismatch</option>
                        <option value="Unclear Image">Unclear Image</option>
                      </select>
                      <button className="btn-decline" disabled={!voidReason} onClick={() => handleAction('void_payment')}>
                        Void
                      </button>
                   </div>
                   <button className="btn-approve" onClick={() => handleAction('accept_payment')}>
                     Accept Payment
                   </button>
                </div>
              )}

              {/* READ ONLY CLOSE BUTTON */}
              {['approved', 'paid', 'completed', 'decline', 'void', 'cancelled'].includes(selectedBooking.status) && (
                 <button className="btn-close-footer" onClick={closeModal}>Close Details</button>
              )}
            </div>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}