import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { 
  FaCalendarAlt, 
  FaTimes, 
  FaPaw, 
  FaInfoCircle, 
  FaExclamationTriangle, 
  FaClock, 
  FaCreditCard, 
  FaCut, 
  FaStar,
  FaCheckCircle,
  FaFileInvoiceDollar,
  FaChevronLeft,
  FaChevronRight,
  FaSearchPlus 
} from "react-icons/fa";
import "./Appointments.css";

// --- CALENDAR COMPONENT ---
const CalendarModal = ({ bookings, onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const getBookingsForDate = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return bookings.filter(b => b.booking_date === dateStr && b.status !== 'cancelled' && b.status !== 'declined' && b.status !== 'void' && b.status !== 'voided');
  };

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const renderDays = () => {
    const days = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayBookings = getBookingsForDate(d);
      const isToday = dateStr === todayStr;
      const isSelected = selectedDate === dateStr;
      
      let statusClass = "";
      if (dayBookings.length > 0) {
        const isPastDate = dateStr < todayStr;
        if (isPastDate) {
           statusClass = "has-history"; 
        } else {
           const hasPending = dayBookings.some(b => ['pending', 'payment_review', 'for review'].includes(b.status));
           if (hasPending) {
             statusClass = "has-pending"; 
           } else {
             statusClass = "has-upcoming"; 
           }
        }
      }

      days.push(
        <div 
          key={d} 
          className={`cal-day ${statusClass} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => setSelectedDate(dateStr)}
        >
          <span className="day-num">{d}</span>
          {dayBookings.length > 0 && <div className="dot"></div>}
        </div>
      );
    }
    return days;
  };

  const selectedDayBookings = selectedDate ? bookings.filter(b => b.booking_date === selectedDate && !['cancelled','declined','void','voided'].includes(b.status)) : [];

  return (
    <div className="modal-overlay">
      <div className="modal-content calendar-modal-content">
        <div className="modal-header">
          <h3>My Appointment Calendar</h3>
          <button className="close-btn" onClick={onClose}><FaTimes/></button>
        </div>
        <div className="calendar-body">
          <div className="cal-nav">
            <button onClick={handlePrevMonth}><FaChevronLeft/></button>
            <span className="cal-month-title">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <button onClick={handleNextMonth}><FaChevronRight/></button>
          </div>
          <div className="cal-legend">
            <span className="legend-item"><span className="dot blue"></span> Upcoming</span>
            <span className="legend-item"><span className="dot yellow"></span> Pending</span>
            <span className="legend-item"><span className="dot gray"></span> Past/Done</span>
            <span className="legend-item"><span className="dot green"></span> Today</span>
          </div>
          <div className="cal-grid-header">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>
          <div className="cal-grid">
            {renderDays()}
          </div>
          <div className="cal-details-section">
            <h4>{selectedDate ? `Appointments on ${new Date(selectedDate).toDateString()}` : "Select a date to view details"}</h4>
            {selectedDate && selectedDayBookings.length === 0 && <p className="text-muted">No appointments on this day.</p>}
            <div className="cal-list">
              {selectedDayBookings.map(b => (
                <div key={b.id} className="cal-list-item">
                  <div className="cal-time">{b.time_slot}</div>
                  <div className="cal-info">
                    <strong>{b.service_providers?.business_name}</strong>
                    <span>{b.booking_pets?.map(p => p.pet_name).join(', ')}</span>
                    <span className={`status-text ${b.status || 'unknown'}`}>
                      {(b.status || 'unknown').toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Appointments() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("awaiting"); 
  const [selectedBooking, setSelectedBooking] = useState(null); 
  const [showCancelModal, setShowCancelModal] = useState(false); 
  const [showRescheduleModal, setShowRescheduleModal] = useState(false); 
  const [showSuccessModal, setShowSuccessModal] = useState(false); 
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const [successMessage, setSuccessMessage] = useState(""); 
  const [successTitle, setSuccessTitle] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [reschedForm, setReschedForm] = useState({ date: "", time: "" });
  const [availableSlots, setAvailableSlots] = useState([]); 
  const [providerHours, setProviderHours] = useState([]);   

  const [feedbackForm, setFeedbackForm] = useState({
    overallRating: 0,
    staffRating: 0,
    comment: ""
  });

  useEffect(() => {
    if (selectedBooking && showRescheduleModal) {
      const fetchProviderHours = async () => {
        const { data, error } = await supabase
          .from("service_provider_hours")
          .select("*")
          .eq("provider_id", selectedBooking.service_providers.id);
        
        if (!error) setProviderHours(data || []);
      };
      fetchProviderHours();
    }
  }, [selectedBooking, showRescheduleModal]);

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
          service_providers (id, business_name, business_mobile),
          booking_pets (
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
            booking_services (service_name, price)
          )
        `)
        .eq("user_id", user.id)
        .order('booking_date', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (err) {
      // Errors handled silently as requested
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = (dateString) => {
    if (!dateString || providerHours.length === 0) return [];
    const selectedDate = new Date(dateString);
    const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
    const daySchedule = providerHours.find(h => h.day_of_week === dayName);

    if (!daySchedule) return [];

    const slots = [];
    let current = new Date(`2000-01-01T${daySchedule.start_time}`);
    const end = new Date(`2000-01-01T${daySchedule.end_time}`);

    while (current < end) {
      slots.push(current.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      }));
      current.setHours(current.getHours() + 1);
    }
    return slots;
  };

  const handleRescheduleDateChange = (e) => {
    const newDate = e.target.value;
    const slots = generateTimeSlots(newDate);
    setReschedForm({ ...reschedForm, date: newDate, time: "" });
    setAvailableSlots(slots);
  };

  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return "TBD";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Invalid Date"; 
    const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const tempTime = new Date(`2000-01-01T${timeStr}`);
    const formattedTime = isNaN(tempTime.getTime()) ? timeStr : tempTime.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${formattedDate} at ${formattedTime}`;
  };

  const convertTo24Hour = (timeStr) => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
    return `${hours}:${minutes}`;
  };

  const isFourHoursPast = (booking) => {
    if (!booking.booking_date || !booking.time_slot) return false;
    const bookingDateTime = new Date(`${booking.booking_date}T${convertTo24Hour(booking.time_slot)}`);
    const diffHours = (new Date() - bookingDateTime) / (1000 * 60 * 60);
    return diffHours >= 4;
  };

  const isCancellable = (booking) => {
    if (!booking.booking_date || !booking.time_slot) return false;
    const bookingDateTime = new Date(`${booking.booking_date}T${convertTo24Hour(booking.time_slot)}`);
    return bookingDateTime > new Date(); 
  };

  const getFilteredBookings = () => {
    if (!bookings) return [];
    switch (activeTab) {
      case "awaiting": return bookings.filter(b => b.status === "pending");
      case "payment": return bookings.filter(b => b.status === "approved");
      case "upcoming": return bookings.filter(b => (b.status === "paid" || b.status === "confirmed") && !isFourHoursPast(b));
      case "rate": return bookings.filter(b => b.status !== 'rated' && (b.status === "completed" || b.status === "to_rate" || ((b.status === "paid" || b.status === "confirmed") && isFourHoursPast(b))));
      default: return [];
    }
  };

  const counts = {
    awaiting: bookings.filter(b => b.status === "pending").length,
    payment: bookings.filter(b => b.status === "approved").length,
    upcoming: bookings.filter(b => (b.status === "paid" || b.status === "confirmed") && !isFourHoursPast(b)).length,
    rate: bookings.filter(b => b.status !== 'rated' && (b.status === "completed" || b.status === "to_rate" || ((b.status === "paid" || b.status === "confirmed") && isFourHoursPast(b)))).length,
  };

  const getServiceSummary = (pets) => {
    if (!pets || pets.length === 0) return "No services";
    const services = pets.flatMap(p => p.booking_services?.map(s => s.service_name) || []);
    return [...new Set(services)].join(", ");
  };

  const formatCurrency = (amount) => `₱ ${parseFloat(amount || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

  const handleOpenDetails = (booking) => setSelectedBooking(booking);

  const handleCloseAll = () => {
    setSelectedBooking(null);
    setShowCancelModal(false);
    setShowRescheduleModal(false);
    setShowFeedbackModal(false);
    setShowCalendarModal(false);
    setPreviewImage(null);
    setAvailableSlots([]);
    setReschedForm({ date: "", time: "" });
    setFeedbackForm({ overallRating: 0, staffRating: 0, comment: "" });
  };

  const handleOpenRateModal = () => setShowFeedbackModal(true); 

  const handleSubmitFeedback = async () => {
    if (feedbackForm.overallRating === 0 || feedbackForm.staffRating === 0) return;
    setActionLoading(true);
    try {
      await supabase.from('reviews').insert({
        booking_id: selectedBooking.id,
        provider_id: selectedBooking.service_providers.id,
        user_id: selectedBooking.user_id,
        rating_overall: feedbackForm.overallRating,
        rating_staff: feedbackForm.staffRating,
        comment: feedbackForm.comment
      });
      await supabase.from('bookings').update({ status: 'rated' }).eq('id', selectedBooking.id);
      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, status: 'rated' } : b));
      handleCloseAll();
      setSuccessTitle("Thank You!");
      setSuccessMessage("Feedback submitted.");
      setShowSuccessModal(true);
    } catch (err) { } finally { setActionLoading(false); }
  };

  const confirmReschedule = async (e) => {
    e.preventDefault();
    if(!reschedForm.time) return;
    setActionLoading(true);
    try {
       await supabase.from('bookings').update({
         booking_date: reschedForm.date, time_slot: reschedForm.time
       }).eq('id', selectedBooking.id);
       setBookings(prev => prev.map(b => b.id === selectedBooking.id ? {...b, booking_date: reschedForm.date, time_slot: reschedForm.time} : b));
       handleCloseAll();
       setSuccessTitle("Reschedule Successful!");
       setSuccessMessage("Your appointment has been updated.");
       setShowSuccessModal(true);
    } catch (err) { } finally { setActionLoading(false); }
  };

  const confirmCancel = async () => {
    if(!selectedBooking) return;
    setActionLoading(true);
    try {
      await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', selectedBooking.id);
      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? {...b, status: 'cancelled'} : b));
      handleCloseAll();
      setSuccessTitle("Cancelled");
      setSuccessMessage("Your appointment has been cancelled.");
      setShowSuccessModal(true);
    } catch(err) { } finally { setActionLoading(false); }
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  const handlePayNow = () => navigate(`/payment/${selectedBooking.id}`);
  
  if (loading) return <div className="app-loading">Loading...</div>;

  return (
    <div className="page-wrapper">
      <LoggedInNavbar />
      <div className="appointments-wrapper">
        <div className="appointments-container">
          <div className="app-header-row">
             <div className="header-text">
               <h1>My Appointments</h1>
               <p>Manage your pet's grooming sessions</p>
             </div>
             <div className="header-actions">
               <button className="calendar-view-btn" onClick={() => setShowCalendarModal(true)}>
                  <FaCalendarAlt /> View Calendar
               </button>
               <button className="history-btn" onClick={() => navigate('/booking-history')}>
                  View History
               </button>
             </div>
          </div>
          <div className="status-icons-card">
            <div className="icons-row">
              {['awaiting', 'payment', 'upcoming', 'rate'].map((tab) => (
                <div key={tab} className={`icon-item ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                  <div className="icon-circle">
                    {tab === 'awaiting' && <FaClock />}
                    {tab === 'payment' && <FaCreditCard />}
                    {tab === 'upcoming' && <FaCut />}
                    {tab === 'rate' && <FaStar />}
                    {counts[tab] > 0 && <span className="badge-count">{counts[tab]}</span>}
                  </div>
                  <span>{tab === 'awaiting' ? 'Awaiting Approval' : tab === 'payment' ? 'For Payment' : tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="app-list-section">
            <div className="bookings-grid">
              <div className="list-table-header">
                <div className="col-date">Date & Time</div>
                <div className="col-pets">No. of Pets</div>
                <div className="col-service">Service</div>
                <div className="col-price">Total</div>
                <div className="col-action">Action</div>
              </div>
              {getFilteredBookings().length === 0 ? (
                <div className="no-app-state">
                  <FaCalendarAlt className="empty-icon" />
                  <h3>No appointments found.</h3>
                </div>
              ) : (
                getFilteredBookings().map((booking) => (
                  <div key={booking.id} className="app-row">
                    <div className="col-date"><strong>{formatDateTime(booking.booking_date, booking.time_slot)}</strong></div>
                    <div className="col-pets">{booking.booking_pets?.length || 0} Pet/s</div>
                    <div className="col-service">{getServiceSummary(booking.booking_pets)}</div>
                    <div className="col-price">{formatCurrency(booking.total_estimated_price)}</div>
                    <div className="col-action"><button className="view-app-btn" onClick={() => handleOpenDetails(booking)}>View Details</button></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showCalendarModal && <CalendarModal bookings={bookings} onClose={handleCloseAll} />}

      {selectedBooking && !showRescheduleModal && !showCancelModal && !showSuccessModal && !showFeedbackModal && !showCalendarModal && (
        <div className="modal-overlay" onClick={handleCloseAll}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
             <div className="modal-header"><h3>Appointment Details</h3><button className="close-btn" onClick={handleCloseAll}><FaTimes/></button></div>
             <div className="modal-body-scroll">
                <div className="info-grid">
                   <div className="info-item"><label><FaInfoCircle/> Provider</label><span>{selectedBooking.service_providers?.business_name}</span></div>
                   <div className="info-item"><label><FaClock/> Schedule</label><span>{formatDateTime(selectedBooking.booking_date, selectedBooking.time_slot)}</span></div>
                   <div className="info-item"><label><FaFileInvoiceDollar/> Total Amount</label><span className="price-tag">{formatCurrency(selectedBooking.total_estimated_price)}</span></div>
                   <div className="info-item"><label>Status</label><span className="status-badge">{selectedBooking.status}</span></div>
                </div>
                <hr className="divider"/>
                <h4>Pets & Grooming Details</h4>
                <div className="pets-list">
                  {selectedBooking.booking_pets?.map((pet, idx) => (
                    <div key={pet.id || idx} className="pet-full-card">
                       <h5 className="pet-name-header">Pet {idx+1}: {pet.pet_name} ({pet.pet_type})</h5>
                       <div className="pet-specs-grid">
                         <div><span className="label">Breed</span> {pet.breed || 'N/A'}</div>
                         <div><span className="label">Gender</span> {pet.gender || 'N/A'}</div>
                         <div><span className="label">Weight</span> {pet.weight_kg} kg</div>
                         <div><span className="label">Size</span> {pet.calculated_size || 'N/A'}</div>
                         <div><span className="label">Behavior</span> {pet.behavior || 'N/A'}</div>
                         <div><span className="label">Consent</span> {pet.emergency_consent ? 'Yes' : 'No'}</div>
                       </div>
                       <div className="pet-info-row-split">
                         <div className="pet-specs-full"><span className="label">Grooming Specs:</span> {pet.grooming_specifications || 'None'}</div>
                         <div className="pet-specs-full"><span className="label">Services:</span> {pet.booking_services?.map(s => s.service_name).join(', ')}</div>
                       </div>
                       <div className="pet-images-row">
                         {pet.vaccine_card_url && <div className="image-wrapper clickable-img" onClick={() => setPreviewImage(pet.vaccine_card_url)}><p className="img-label">Vaccine Card <FaSearchPlus size={12} /></p><img src={pet.vaccine_card_url} className="proof-image"/></div>}
                         {pet.illness_proof_url && <div className="image-wrapper clickable-img" onClick={() => setPreviewImage(pet.illness_proof_url)}><p className="img-label">Proof of Illness <FaSearchPlus size={12} /></p><img src={pet.illness_proof_url} className="proof-image"/></div>}
                       </div>
                    </div>
                  ))}
                </div>
             </div>
             <div className="modal-footer">
              {selectedBooking.status === 'pending' && <button className="resched-btn" onClick={() => setShowRescheduleModal(true)}>Reschedule Appointment</button>}
              {activeTab === 'upcoming' && <><button className="rate-btn" onClick={handleOpenRateModal}>Rate</button>{isCancellable(selectedBooking) && <button className="cancel-btn" onClick={() => setShowCancelModal(true)}>Cancel Appointment</button>}</>}
              {activeTab === 'rate' && <button className="rate-btn" onClick={handleOpenRateModal}>Rate Service</button>}
              {activeTab === 'awaiting' && <button className="cancel-btn" onClick={() => setShowCancelModal(true)}>Cancel Appointment</button>}
              {activeTab === 'payment' && <><button className="pay-btn" onClick={handlePayNow}>Pay Now</button><button className="cancel-btn" onClick={() => setShowCancelModal(true)}>Cancel Appointment</button></>}
             </div>
          </div>
        </div>
      )}

      {showRescheduleModal && (
        <div className="modal-overlay">
          <div className="modal-content small-modal">
            <div className="modal-header"><h3>Reschedule</h3><button className="close-btn" onClick={() => setShowRescheduleModal(false)}><FaTimes/></button></div>
            <form onSubmit={confirmReschedule}>
              <div className="modal-body">
                <p className="modal-instruction">Please select a new date and time.</p>
                <label className="input-label">New Date</label>
                <input type="date" className="input-field" required min={getMinDate()} value={reschedForm.date} onChange={handleRescheduleDateChange} />
                <label className="input-label">New Time</label>
                <select className="input-field" required value={reschedForm.time} disabled={!reschedForm.date || availableSlots.length === 0} onChange={(e) => setReschedForm({ ...reschedForm, time: e.target.value })}>
                  <option value="">{!reschedForm.date ? "Select a date first" : availableSlots.length === 0 ? "Closed" : "Select Time"}</option>
                  {availableSlots.map((slot, index) => <option key={index} value={slot}>{slot}</option>)}
                </select>
                {reschedForm.date && availableSlots.length === 0 && <div className="warning-text-simple" style={{ color: 'var(--brand-red)', fontSize: '0.85rem', marginTop: '5px' }}><FaExclamationTriangle /> Provider is closed on selected day.</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="secondary-btn" onClick={() => setShowRescheduleModal(false)}>Back</button>
                <button type="submit" className="confirm-btn-yes" disabled={actionLoading || !reschedForm.time || availableSlots.length === 0}>{actionLoading ? "Saving..." : "Confirm"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="modal-overlay image-preview-overlay" onClick={() => setPreviewImage(null)}>
          <div className="image-preview-content" onClick={e => e.stopPropagation()}>
            <button className="close-preview-btn" onClick={() => setPreviewImage(null)}><FaTimes /></button>
            <img src={previewImage} className="large-proof-image" />
          </div>
        </div>
      )}

      {showFeedbackModal && (
        <div className="modal-overlay">
           <div className="modal-content small-modal">
              <div className="modal-header"><h3>Rate Experience</h3><button className="close-btn" onClick={handleCloseAll}><FaTimes/></button></div>
              <div className="modal-body">
                 <div className="rating-group">
                    <label>Overall Experience</label>
                    <div className="stars-container">
                      {[1,2,3,4,5].map(star => <FaStar key={`overall-${star}`} className={`star-icon ${feedbackForm.overallRating >= star ? 'filled' : ''}`} onClick={() => setFeedbackForm({...feedbackForm, overallRating: star})} />)}
                    </div>
                 </div>
                 <div className="rating-group">
                    <label>Staff Rating</label>
                    <div className="stars-container">
                      {[1,2,3,4,5].map(star => <FaStar key={`staff-${star}`} className={`star-icon ${feedbackForm.staffRating >= star ? 'filled' : ''}`} onClick={() => setFeedbackForm({...feedbackForm, staffRating: star})} />)}
                    </div>
                 </div>
                 <textarea className="feedback-textarea" placeholder="Your feedback..." value={feedbackForm.comment} onChange={(e) => setFeedbackForm({...feedbackForm, comment: e.target.value})} />
              </div>
              <div className="modal-footer">
                 <button className="secondary-btn" onClick={handleCloseAll}>Cancel</button>
                 <button className="confirm-btn-yes" onClick={handleSubmitFeedback} disabled={actionLoading}>Submit Review</button>
              </div>
           </div>
        </div>
      )}

      {showCancelModal && (
        <div className="modal-overlay">
           <div className="modal-content small-modal">
              <div className="modal-header warning-header"><h3>Confirm Cancel</h3></div>
              <div className="modal-body"><p>Are you sure you want to cancel?</p></div>
              <div className="modal-footer"><button className="secondary-btn" onClick={() => setShowCancelModal(false)}>No</button><button className="confirm-btn-no" onClick={confirmCancel} disabled={actionLoading}>Yes, Cancel</button></div>
           </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="modal-overlay">
           <div className="modal-content small-modal" style={{textAlign:'center', padding:'2rem'}}><FaCheckCircle style={{fontSize:'4rem', color:'var(--brand-green)', marginBottom:'1rem'}}/><h3>{successTitle}</h3><p>{successMessage}</p><button className="confirm-btn-yes" onClick={() => setShowSuccessModal(false)} style={{width:'100%'}}>OK</button></div>
        </div>
      )}
      <Footer />
    </div>
  );
}