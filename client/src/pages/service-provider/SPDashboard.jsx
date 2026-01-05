import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCalendarAlt, FaTimes, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import "./SPDashboard.css";

// --- Time Helpers ---
const convertTo24Hour = (timeStr) => {
  // Handles "1:00 PM" -> "13:00" or "13:00:00" -> "13:00"
  if (!timeStr) return "00:00";
  if (timeStr.includes('M')) { // AM/PM format
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') { hours = '00'; }
    if (modifier === 'PM') { hours = parseInt(hours, 10) + 12; }
    return `${hours}:${minutes}`;
  }
  return timeStr; // Already 24h
};

const isFourHoursPast = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return false;
  const bookingDateTime = new Date(`${dateStr}T${convertTo24Hour(timeStr)}`);
  const now = new Date();
  const diffMs = now - bookingDateTime;
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours >= 4;
};

// --- Helper: Enhanced Calendar ---
const BookingCalendar = ({ bookings = [], onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  // Ensure we have a default selected date to prevent mapping errors
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // 1. Internal Time Helper to prevent "isFourHoursPast is not defined" error
  const checkIsPast = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return false;
    try {
      // Handles "1:00 PM" or "13:00" formats
      const cleanTime = timeStr.includes('M') 
        ? new Date(`2000-01-01 ${timeStr}`).toLocaleTimeString('en-GB', { hour12: false }).slice(0, 5)
        : timeStr;
      
      const bookingDateTime = new Date(`${dateStr}T${cleanTime}`);
      const now = new Date();
      return (now - bookingDateTime) / (1000 * 60 * 60) >= 4;
    } catch (e) { return false; }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  // 2. Filter bookings for the right-side list
  const selectedDayBookings = Array.isArray(bookings) 
    ? bookings.filter(b => b.booking_date === selectedDate) 
    : [];

  const getDayStats = (dateStr) => {
    const dayBookings = bookings.filter(b => b.booking_date === dateStr);
    const todayStr = new Date().toISOString().split('T')[0];
    
    let completed = 0;
    let upcoming = 0;
    let todayCount = 0;

    dayBookings.forEach(b => {
      const isPast = checkIsPast(b.booking_date, b.time_slot);
      if (['completed', 'rated'].includes(b.status) || isPast) {
        completed++;
      } else {
        if (dateStr === todayStr) todayCount++;
        else upcoming++;
      }
    });

    return { total: dayBookings.length, badge: todayCount > 0 ? "today" : upcoming > 0 ? "upcoming" : completed > 0 ? "past" : "" };
  };

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const stats = getDayStats(dateStr);
      const isSelected = selectedDate === dateStr;

      days.push(
        <div 
          key={d} 
          className={`calendar-day has-${stats.badge} ${isSelected ? 'selected' : ''}`}
          onClick={() => setSelectedDate(dateStr)}
        >
          <span className="day-number">{d}</span>
          {stats.total > 0 && <span className="day-total-count">{stats.total}</span>}
        </div>
      );
    }
    return days;
  };

  return (
    <div className="calendar-modal-overlay" onClick={onClose}>
      <div className="calendar-modal-content large-split-modal" onClick={e => e.stopPropagation()}>
        <div className="calendar-header">
          <div className="header-title-group">
            <FaCalendarAlt size={18} />
            <h3>Booking Schedule</h3>
          </div>
          <button className="close-btn" onClick={onClose}><FaTimes /></button>
        </div>

        <div className="calendar-body-split">
          {/* LEFT SIDE: CALENDAR */}
          <div className="calendar-main-column">
            <div className="calendar-nav">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))}><FaChevronLeft /></button>
              <span className="cal-month-title">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))}><FaChevronRight /></button>
            </div>

            <div className="calendar-grid-header">
              <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>
            <div className="calendar-grid">{renderDays()}</div>

          </div>

          {/* RIGHT SIDE: DETAILS */}
          <div className="cal-details-section">
            <div className="details-header">
              <FaCalendarAlt size={14} />
              <h4>{new Date(selectedDate).toDateString()}</h4>
            </div>

            <div className="cal-list">
              {selectedDayBookings.length === 0 ? (
                <div className="empty-details">
                   <p>No bookings for this date.</p>
                </div>
              ) : (
                selectedDayBookings.map(b => (
                  <div key={b.id} className="cal-list-item-detailed">
                    <div className="item-main-row">
                      <div className="cal-time-badge">{b.time_slot}</div>
                      <div className={`status-pill ${b.status}`}>{b.status?.toUpperCase()}</div>
                    </div>
                    <div className="item-content-row">
                      <div>
                        <label>Customer</label>
                        <strong>{b.users?.full_name || 'Pet Owner'}</strong>
                      </div>
                      <div className="pet-count-info">
                        <label>Pets</label>
                        <span className="count-badge">🐾 {b.booking_pets?.length || 0}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
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

      const { data: providerData, error: providerError } = await supabase
        .from("service_providers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (providerError) throw providerError;

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

  // --- Logic: Filtering & Stats ---
  
  const isBookingComplete = (b) => {
    // Explicitly completed/rated OR Paid/Confirmed + 4 hours past
    if (['completed', 'to_rate', 'rated'].includes(b.status)) return true;
    if (['paid', 'confirmed'].includes(b.status) && isFourHoursPast(b.booking_date, b.time_slot)) return true;
    return false;
  };

  const getFilteredBookings = () => {
  const now = new Date();

  switch(activeTab) {
    case 'new_request':
      return bookings.filter(b => {
        const hoursSinceCreated = (now - new Date(b.created_at)) / (1000 * 60 * 60);
        // Show ONLY if status is pending AND under 24 hours
        return b.status === 'pending' && hoursSinceCreated < 24;
      });
    
    case 'for_verification':
      return bookings.filter(b => {
        const hoursSinceUpdate = (now - new Date(b.created_at)) / (1000 * 60 * 60);
        // Show ONLY if status is for review AND under 24 hours
        return b.status === 'for review' && hoursSinceUpdate < 24;
      });

    case 'upcoming':
      return bookings.filter(b => b.status === 'paid' && !isBookingComplete(b));

    case 'completed':
      return bookings.filter(b => isBookingComplete(b));

    default:
      return [];
  }
};

  const now = new Date();

const stats = {
  revenue: bookings
    .filter(b => isBookingComplete(b))
    .reduce((sum, b) => sum + (parseFloat(b.total_estimated_price) || 0), 0),
  
  // Counts only pending bookings sent in the last 24 hours
  new_request: bookings.filter(b => {
    const hoursSinceCreated = (now - new Date(b.created_at)) / (1000 * 60 * 60);
    return b.status === 'pending' && hoursSinceCreated < 24;
  }).length,

  // Counts only payment verifications sent in the last 24 hours
  for_verification: bookings.filter(b => {
    const hoursSinceUpdate = (now - new Date(b.created_at)) / (1000 * 60 * 60);
    return b.status === 'for review' && hoursSinceUpdate < 24;
  }).length,
  
  upcoming: bookings.filter(b => b.status === 'paid' && !isBookingComplete(b)).length,
  completed: bookings.filter(b => isBookingComplete(b)).length,
};

  const formatCurrency = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  
  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return "TBD";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Invalid Date"; 
    const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const tempTime = new Date(`2000-01-01T${timeStr}`);
    const formattedTime = isNaN(tempTime.getTime()) ? timeStr : tempTime.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${formattedDate} at ${formattedTime}`;
  };

  // --- Handlers ---
  const handleAction = async (actionType) => {
    if (!selectedBooking) return;

    let newStatus = '';
    let updateData = {};

    switch(actionType) {
      case 'approve':
        newStatus = 'approved'; 
        break;
      
      case 'decline':
        newStatus = 'decline';
        updateData = { rejection_reason: declineReason };
        break;
      
      case 'accept_payment':
        newStatus = 'paid';
        break;
      
      case 'void_payment':
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

      setBookings(prev => prev.map(b => 
        b.id === selectedBooking.id ? { ...b, status: newStatus, ...updateData } : b
      ));
      
      closeModal();
    } catch (err) {
      alert("Action failed: " + err.message);
    }
  };

  const [previewImage, setPreviewImage] = useState(null); // State for expanded view

  const closeModal = () => {
    setSelectedBooking(null);
    setDeclineReason("");
    setVoidReason("");
    setPreviewImage(null); 
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
              <p>For the month of {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
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

        {/* Status Tabs */}
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
                <th>Total Amt</th>
                <th>Status</th>
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
            
            {/* Summary Section */}
            <div className="modal-summary-section">
              <div className="info-row">
                <span>Status:</span>
                <strong className="uppercase-status">{selectedBooking.status}</strong>
              </div>

              {/* ADDED: Reference Number for Payment Verification */}
              {(selectedBooking.status === 'for review' || selectedBooking.status === 'paid') && (
                <div className="info-row">
                  <span>Reference No:</span>
                  <strong style={{ color: 'var(--brand-blue)' }}>
                    {selectedBooking?.rejection_reason || "Not Provided"}
                  </strong>
                </div>
              )}

              <div className="info-row">
                <span>Date & Time:</span>
                <strong>{formatDateTime(selectedBooking.booking_date, selectedBooking.time_slot)}</strong>
              </div>
              <div className="info-row">
                <span>Total Amount:</span>
                <strong className="text-highlight">{formatCurrency(selectedBooking.total_estimated_price)}</strong>
              </div>
            </div>

            {/* Payment Proof Section - Updated with Click to Zoom */}
            {selectedBooking.payment_proof_url && (
              <div className="full-image-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4>Payment Proof</h4>
                    {/* Optional: Second location for the Ref No right above the image */}
                    <small style={{ color: 'var(--brand-blue)', fontWeight: 'bold'}}>
                        Payment Reference Code: {selectedBooking?.rejection_reason}
                    </small>
                </div>
                {/* Clickable wrapper for expansion */}
                <div className="image-wrapper clickable-img" onClick={() => setPreviewImage(selectedBooking.payment_proof_url)}>
                    <img src={selectedBooking.payment_proof_url} alt="Payment Proof" className="facebook-style-img" /> 
                </div>
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
                    <div className="pet-info-row-split">
                         <div className="pet-specs-full"><span className="label">Grooming Specs:</span> {pet.grooming_specifications || 'None'}</div>
                         <div className="pet-specs-full"><span className="label">Services:</span> {pet.booking_services?.map(s => s.service_name).join(', ')}</div>
                    </div>
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
              {(isBookingComplete(selectedBooking) || ['approved', 'paid', 'decline', 'void', 'cancelled'].includes(selectedBooking.status)) && (
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