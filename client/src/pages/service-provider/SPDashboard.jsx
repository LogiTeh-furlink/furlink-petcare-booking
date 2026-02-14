import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { 
  FaCalendarAlt, 
  FaTimes, 
  FaChevronLeft, 
  FaChevronRight, 
  FaChartLine, 
  FaPaw, 
  FaClock, 
  FaCheckCircle, 
  FaSearchPlus,
  FaExclamationTriangle,
  FaStar,
  FaRegStar
} from "react-icons/fa";
import "./SPDashboard.css";

// --- Time Helpers ---
const convertTo24Hour = (timeStr) => {
  if (!timeStr) return "00:00";
  if (timeStr.includes('M')) {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') { hours = '00'; }
    if (modifier === 'PM') { hours = parseInt(hours, 10) + 12; }
    return `${hours}:${minutes}`;
  }
  return timeStr;
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const checkIsPast = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return false;
    try {
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
                        <strong>
                          {b.profiles?.first_name 
                            ? `${b.profiles.first_name} ${b.profiles.last_name}` 
                            : 'Pet Owner'}
                        </strong>
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
  const [providerId, setProviderId] = useState(null);
  
  // Tabs: 'new_request', 'for_verification', 'upcoming', 'completed'
  const [activeTab, setActiveTab] = useState("new_request"); 
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingReview, setBookingReview] = useState(null);
  
  // Actions
  const [declineReason, setDeclineReason] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [previewImage, setPreviewImage] = useState(null);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTitle, setSuccessTitle] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
      setProviderId(providerData.id);

      // STEP 1: Fetch Bookings without the direct 'profiles' join to prevent errors
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

      // STEP 2: Extract User IDs and Fetch Profiles Separately
      const userIds = [...new Set(bookingsData.map(b => b.user_id).filter(Boolean))];
      let profilesMap = {};

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, mobile_number, email")
          .in("id", userIds);

        if (!profilesError && profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = p;
          });
        }
      }

      // STEP 3: Merge Profile Data into Bookings
      const mergedBookings = bookingsData.map(b => ({
        ...b,
        profiles: profilesMap[b.user_id] || null
      }));

      setBookings(mergedBookings || []);

    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewForBooking = async (bookingId) => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("booking_id", bookingId)
        .single();

      if (error) {
        // No review found
        setBookingReview(null);
        return;
      }

      // Fetch user profile separately using the user_id from the review
      if (data && data.user_id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", data.user_id)
          .single();

        setBookingReview({
          ...data,
          reviewer_name: profileData 
            ? `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() 
            : 'Pet Owner'
        });
      } else {
        setBookingReview(data);
      }
    } catch (err) {
      console.error("Error fetching review:", err);
      setBookingReview(null);
    }
  };

  const isBookingComplete = (b) => {
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
          return b.status === 'pending' && hoursSinceCreated < 24;
        });
      case 'for_verification':
        return bookings.filter(b => {
          const hoursSinceUpdate = (now - new Date(b.created_at)) / (1000 * 60 * 60);
          return b.status === 'for review' && hoursSinceUpdate < 24;
        });
      case 'upcoming':
        return bookings.filter(b => b.status === 'paid' && !isBookingComplete(b));
      case 'completed':
        return bookings.filter(b => isBookingComplete(b));
      case 'cancelled':
        return bookings.filter(b => b.status === 'cancelled');
      default:
        return [];
    }
  };

  const stats = {
    revenue: bookings
      .filter(b => isBookingComplete(b))
      .reduce((sum, b) => sum + (parseFloat(b.total_estimated_price) || 0), 0),
    new_request: bookings.filter(b => {
      const now = new Date();
      const hoursSinceCreated = (now - new Date(b.created_at)) / (1000 * 60 * 60);
      return b.status === 'pending' && hoursSinceCreated < 24;
    }).length,
    for_verification: bookings.filter(b => {
      const now = new Date();
      const hoursSinceUpdate = (now - new Date(b.created_at)) / (1000 * 60 * 60);
      return b.status === 'for review' && hoursSinceUpdate < 24;
    }).length,
    upcoming: bookings.filter(b => b.status === 'paid' && !isBookingComplete(b)).length,
    completed: bookings.filter(b => isBookingComplete(b)).length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
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

  const handleAction = async (actionType) => {
    if (!selectedBooking) return;
    let newStatus = '';
    let updateData = {};
    let title = "";
    let msg = "";

    switch(actionType) {
      case 'approve': 
        newStatus = 'approved'; 
        title = "Booking Approved";
        msg = "The customer has been notified to proceed with payment.";
        break;
      case 'decline': 
        newStatus = 'declined'; 
        updateData = { rejection_reason: declineReason }; 
        title = "Booking Declined";
        msg = "The request has been removed and the customer notified.";
        break;
      case 'accept_payment': 
        newStatus = 'paid'; 
        title = "Payment Accepted";
        msg = "Payment verified. The booking is now moved to Upcoming appointments.";
        break;
      case 'void_payment': 
        newStatus = 'void'; 
        updateData = { rejection_reason: voidReason }; 
        title = "Payment Voided";
        msg = "The payment proof was rejected. The customer will be notified to re-upload.";
        break;
      case 'cancel': 
        newStatus = 'cancelled'; 
        title = "Booking Cancelled";
        msg = `The booking has been moved to Cancelled. Please ensure you have refunded the 30% Downpayment (${formatCurrency(selectedBooking.installation_payment)}) to the pet owner.`;
        break;  
      default: return;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus, ...updateData })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      // Update local state immediately
      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, status: newStatus, ...updateData } : b));
      
      closeModal(); // Close details modal first

      // Trigger Success Modal
      setSuccessTitle(title);
      setSuccessMessage(msg);
      setShowSuccessModal(true);

    } catch (err) {
      alert("Action failed: " + err.message);
    }
  };

  const closeModal = () => {
    setSelectedBooking(null);
    setBookingReview(null);
    setDeclineReason("");
    setVoidReason("");
    setPreviewImage(null); 
  };

  const handleViewDetails = async (booking) => {
    setSelectedBooking(booking);
    
    // If this is a completed booking, fetch the review
    if (isBookingComplete(booking)) {
      await fetchReviewForBooking(booking.id);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        i <= rating ? 
          <FaStar key={i} className="star-icon filled" /> : 
          <FaRegStar key={i} className="star-icon empty" />
      );
    }
    return stars;
  };

  if (loading) return <div className="sp-loading">Loading Dashboard...</div>;

  return (
    <div className="page-wrapper">
      <LoggedInNavbar />

      {/* --- SUCCESS MODAL --- */}
      {showSuccessModal && (
        <div className="modal-overlay" style={{ zIndex: 5000 }}>
          <div className="modal-content small-modal success-center" 
              style={{ 
                textAlign: 'center', 
                padding: '2rem', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center' // Ensures all children are centered horizontally
              }}>
            
            <FaCheckCircle 
              size={60} 
              color="#22c55e" 
              style={{ 
                display: 'block',    // Makes it a block to respect auto margins
                margin: '0 auto 1rem', // 0 top, auto sides (centers it), 1rem bottom
              }} 
            />
            
            <h3 style={{ color: 'var(--brand-blue)', fontWeight: '800', width: '100%' }}>
              {successTitle}
            </h3>
            
            <p style={{ color: '#64748b', margin: '10px 0 20px', width: '100%' }}>
              {successMessage}
            </p>
            
            <button 
              className="btn-approve" 
              style={{ width: '100%' }} 
              onClick={() => setShowSuccessModal(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
      
      {showCalendar && <BookingCalendar bookings={bookings} onClose={() => setShowCalendar(false)} />}

      <div className="sp-dashboard-container">
        
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
          
          <button className="top-action-btn" onClick={() => navigate('/service/sales')}>
             <FaChartLine size={24} />
             <span>Dashboard</span>
          </button>

          <button className="top-action-btn" onClick={() => setShowCalendar(true)}>
             <FaCalendarAlt size={24} />
             <span>Calendar</span>
          </button>
        </div>

        <div className="status-cards-grid">
           <div className={`status-card ${activeTab === 'new_request' ? 'active' : ''}`} onClick={() => setActiveTab('new_request')}>
             <h3>New Requests</h3>
             <p className="status-count">{stats.new_request}</p>
           </div>
           <div className={`status-card ${activeTab === 'for_verification' ? 'active' : ''}`} onClick={() => setActiveTab('for_verification')}>
             <h3>Verify Payment</h3>
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
           <div className={`status-card ${activeTab === 'cancelled' ? 'active' : ''}`} onClick={() => setActiveTab('cancelled')}>
            <h3>Cancelled</h3>
            <p className="status-count" style={{ color: '#ef4444' }}>{stats.cancelled}</p>
          </div>
        </div>

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
                        {/* Check if the booking is time-completed but still just says 'paid' */}
                        {activeTab === 'completed' && booking.status === 'paid' && isFourHoursPast(booking.booking_date, booking.time_slot) ? (
                          <span className="badge badge-to_rate">
                            To Rate
                          </span>
                        ) : (
                          <span className={`badge badge-${booking.status ? booking.status.replace(/\s+/g, '_').toLowerCase() : 'unknown'}`}>
                            {booking.status}
                          </span>
                        )}
                      </td>
                    <td>
                      <button className="view-details-btn" onClick={() => handleViewDetails(booking)}>
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

      {selectedBooking && (
      <div className="modal-overlay">
        <div className="modal-content wide-modal">
          <div className="modal-header">
            <h3>Booking Details</h3>
            <button onClick={closeModal}><FaTimes /></button>
          </div>
          <div className="modal-body-scroll">
            <div className="modal-summary-section">
              <div className="info-row">
                <span>Status:</span>
                <strong className="uppercase-status">{selectedBooking.status}</strong>
              </div>
              
              {/* --- CUSTOMER DETAILS (Safe Access) --- */}
              <div className="info-row">
                <span>Customer:</span>
                <strong>
                  {selectedBooking.profiles 
                    ? `${selectedBooking.profiles.first_name} ${selectedBooking.profiles.last_name}` 
                    : 'Pet Owner'}
                </strong>
              </div>
              <div className="info-row">
                <span>Contact:</span>
                <strong>{selectedBooking.profiles?.mobile_number || 'N/A'}</strong>
              </div>
              <div className="info-row">
                <span>Email:</span>
                <strong style={{textTransform: 'lowercase'}}>{selectedBooking.profiles?.email || 'N/A'}</strong>
              </div>
              {/* ----------------------------- */}

              <div className="info-row">
                <span>Date & Time:</span>
                <strong>{formatDateTime(selectedBooking.booking_date, selectedBooking.time_slot)}</strong>
              </div>
              <div className="info-row">
                <span>Balance:</span>
                <div className="amount-container">
                  <strong className="text-highlight">
                    <b>
                      {formatCurrency(
                        (selectedBooking.total_estimated_price || 0) - (selectedBooking.installation_payment || 0)
                      )}
                    </b>
                  </strong>
                  <p className="down-payment-note">30% Down Payment: <b>{formatCurrency(selectedBooking.installation_payment)}</b></p>
                  <p className="down-payment-note">Total Amount: <b>{formatCurrency(selectedBooking.total_estimated_price)}</b></p>
                </div>
              </div>
            </div>

            {selectedBooking.payment_proof_url && (
              <div className="full-image-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <small style={{ color: 'var(--brand-blue)', fontWeight: 'bold'}}>
                    Payment Reference Code: {selectedBooking?.rejection_reason || "N/A"}
                  </small>
                </div>
                
                <div 
                  className="image-wrapper clickable-img" 
                  onClick={() => setPreviewImage(selectedBooking.payment_proof_url)}
                >
                  <p className="img-label" style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    Click image to maximize <FaSearchPlus size={12} />
                  </p>
                  <img src={selectedBooking.payment_proof_url} alt="Payment Proof" className="facebook-style-img" /> 
                </div>
              </div>
            )}

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
                        <div 
                          className="image-wrapper clickable-img" 
                          onClick={() => setPreviewImage(pet.vaccine_card_url)}
                        >
                          <p className="img-label">Vaccine Card <FaSearchPlus size={10} /></p>
                          <img src={pet.vaccine_card_url} alt="Vaccine Card" className="facebook-style-img" />
                        </div>
                      )}

                      {pet.illness_proof_url && (
                        <div 
                          className="image-wrapper clickable-img" 
                          onClick={() => setPreviewImage(pet.illness_proof_url)}
                        >
                          <p className="img-label">Proof of Illness <FaSearchPlus size={10} /></p>
                          <img src={pet.illness_proof_url} alt="Illness Proof" className="facebook-style-img" />
                        </div>
                      )}

                      {pet.ai_generated_url && (
                        <div 
                          className="image-wrapper clickable-img ai-preview-border" 
                          onClick={() => setPreviewImage(pet.ai_generated_url)}
                        >
                          <p className="img-label">AI Style Preview <FaSearchPlus size={10} /></p>
                          <img src={pet.ai_generated_url} alt="AI Generated Preview" className="facebook-style-img" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* REVIEW SECTION - Only shows for completed bookings */}
              {isBookingComplete(selectedBooking) && (
                <div className="review-section">
                  <h4>Customer Review</h4>
                  {bookingReview ? (
                    <div className="review-card">
                      <div className="review-header">
                        <div className="reviewer-info">
                          <strong className="reviewer-name">
                            {bookingReview.reviewer_name || 'Pet Owner'}
                          </strong>
                          <span className="review-date">
                            {new Date(bookingReview.created_at).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="review-ratings">
                        <div className="rating-item">
                          <span className="rating-label">Overall Experience:</span>
                          <div className="stars-display">
                            {renderStars(bookingReview.rating_overall)}
                            <span className="rating-number">{bookingReview.rating_overall}/5</span>
                          </div>
                        </div>
                        <div className="rating-item">
                          <span className="rating-label">Staff Service:</span>
                          <div className="stars-display">
                            {renderStars(bookingReview.rating_staff)}
                            <span className="rating-number">{bookingReview.rating_staff}/5</span>
                          </div>
                        </div>
                      </div>

                      {bookingReview.comment && (
                        <div className="review-comment">
                          <p className="comment-label">Comment:</p>
                          <p className="comment-text">{bookingReview.comment}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="no-review-card">
                      <p>No review submitted yet for this booking.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              {selectedBooking.status === 'paid' && !isBookingComplete(selectedBooking) && (
  <div className="cancel-verification-wrapper" style={{ 
      marginTop: '15px', 
      borderTop: '1px solid #f1f5f9', 
      paddingTop: '15px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: '12px'
  }}>
    
    <div className="compact-refund-alert" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        padding: '6px 10px',
        borderRadius: '6px', 
        background: '#fff1f2', 
        borderLeft: '4px solid #e11d48',
        marginRight: 'auto',
        textAlign: 'left'
    }}>
      <FaExclamationTriangle style={{ color: '#e11d48', flexShrink: 0 }} size={12} />
      <p style={{ margin: 0, fontSize: '0.75rem', color: '#be123c', fontWeight: '500', lineHeight: '1.2' }}>
          Cancellation requires a manual refund of the <strong>{formatCurrency(selectedBooking.installation_payment)}</strong> (30% Down Payment) to the pet owner.
      </p>
    </div>
    
    <button 
      className="btn-cancel-action" 
      style={{ 
        padding: '8px 16px', 
        background: '#475569', 
        color: 'white', 
        border: 'none', 
        borderRadius: '6px', 
        fontWeight: '600', 
        fontSize: '0.8rem',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'background 0.2s'
      }} 
      onClick={() => {
        if(window.confirm(`Cancel booking? You must manually refund ${formatCurrency(selectedBooking.installation_payment)}.`)) {
          handleAction('cancel');
        }
      }}
    >
      Cancel Booking
    </button>
  </div>
)}

              {selectedBooking.status === 'pending' && (
                <div className="action-row">
                   <div className="decline-area">
                      <select value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} className="action-select">
                        <option value="">Select Reason for Declining...</option>
                        <option value="Schedule Conflict">Schedule Conflict</option>
                        <option value="Staff Unavailable">Staff Unavailable</option>
                        <option value="Service Not Available">Service Not Available</option>
                      </select>
                      <button className="btn-decline" disabled={!declineReason} onClick={() => handleAction('decline')}>Decline</button>
                   </div>
                   <button className="btn-approve" onClick={() => handleAction('approve')}>Approve</button>
                </div>
              )}
              {selectedBooking.status === 'for review' && (
                <div className="action-row">
                   <div className="decline-area">
                      <select value={voidReason} onChange={(e) => setVoidReason(e.target.value)} className="action-select">
                        <option value="">Select Reason for Voiding...</option>
                        <option value="Invalid Receipt">Invalid Receipt</option>
                        <option value="Amount Mismatch">Amount Mismatch</option>
                        <option value="Unclear Image">Unclear Image</option>
                      </select>
                      <button className="btn-decline" disabled={!voidReason} onClick={() => handleAction('void_payment')}>Void</button>
                   </div>
                   <button className="btn-approve" onClick={() => handleAction('accept_payment')}>Accept Payment</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <Footer />

      {previewImage && (
        <div className="modal-overlay image-preview-overlay" onClick={() => setPreviewImage(null)}>
          <div className="image-preview-content" onClick={e => e.stopPropagation()}>
            <button className="close-preview-btn" onClick={() => setPreviewImage(null)}>
              <FaTimes />
            </button>
            <img src={previewImage} alt="Maximized Preview" className="large-proof-image" />
          </div>
        </div>
      )}
    </div>
  );
}