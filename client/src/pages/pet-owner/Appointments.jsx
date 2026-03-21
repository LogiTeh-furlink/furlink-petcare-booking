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
  FaSearchPlus,
  FaBan
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

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayBookings = getBookingsForDate(d);
      const isToday = dateStr === todayStr;
      
      let statusClass = "";
      if (dayBookings.length > 0) {
        if (dateStr < todayStr) {
          statusClass = "has-past"; 
        } else if (isToday) {
          statusClass = "has-today"; 
        } else {
          const hasPending = dayBookings.some(b => b.status === 'for approval');
          statusClass = hasPending ? "has-pending" : "has-upcoming"; 
        }
      }

      days.push(
        <div 
          key={d} 
          className={`cal-day ${statusClass} ${isToday ? 'today-border' : ''} ${selectedDate === dateStr ? 'selected' : ''}`}
          onClick={() => setSelectedDate(dateStr)}
        >
          <span className="day-num">{d}</span>
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
          <div className="calendar-main-column">
            <div className="cal-nav">
              <button onClick={handlePrevMonth}><FaChevronLeft/></button>
              <span className="cal-month-title">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
              <button onClick={handleNextMonth}><FaChevronRight/></button>
            </div>
            
            <div className="cal-grid-header">
              <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>
            <div className="cal-grid">
              {renderDays()}
            </div>
          </div>

          <div className="cal-details-section">
            <div className="details-header">
              <FaCalendarAlt size={16} />
              <h4>{selectedDate ? new Date(selectedDate).toDateString() : "Daily Schedule"}</h4>
            </div>
            
            <div className="cal-list">
              {selectedDayBookings.map(b => (
                <div key={b.id} className="cal-list-item-detailed">
                  <div className="item-main-row">
                    <div className="cal-time-badge">{b.time_slot}</div>
                    <div className={`status-pill ${b.status}`}>{b.status?.toUpperCase()}</div>
                  </div>
                  
                  <div className="item-content-row">
                    <div className="provider-info">
                      <label>Service Provider</label>
                      <strong>{b.service_providers?.business_name}</strong>
                    </div>
                    <div className="pet-count-info">
                      <span className="count-badge">
                        <FaPaw size={12} /> {b.booking_pets?.length || 0}
                      </span>
                    </div>
                  </div>

                  <div className="pet-names-list">
                    {b.booking_pets?.map(p => p.pet_name).join(', ')}
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
  
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionDate, setSuspensionDate] = useState(null);

  const [reschedForm, setReschedForm] = useState({ date: "", time: "" });
  const [availableSlots, setAvailableSlots] = useState([]); 
  const [providerHours, setProviderHours] = useState([]);    
  const [targetDateBookings, setTargetDateBookings] = useState([]); 
  
  const calculateIntervalSlots = (workingDay) => {
    if (!workingDay) return [];
    const slots = [];
    let current = new Date(`2000-01-01T${workingDay.start_time}`);
    const end = new Date(`2000-01-01T${workingDay.end_time}`);
    const intervalMinutes = parseInt(workingDay.slot_interval_minutes) || 90;

    while (current < end) {
      slots.push(current.toTimeString().split(' ')[0]);
      current.setMinutes(current.getMinutes() + intervalMinutes);
    }
    return slots;
  };

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
    const fetchTargetDateBookings = async () => {
      if (!reschedForm.date || !selectedBooking) return;
      
      const { data, error } = await supabase
        .from("bookings")
        .select("id, time_slot, status")
        .eq("provider_id", selectedBooking.service_providers.id)
        .eq("booking_date", reschedForm.date)
        .not("status", "in", '("cancelled", "declined", "rejected", "void", "voided")')
        .neq("id", selectedBooking.id); 

      if (!error) setTargetDateBookings(data || []);
    };

    if (showRescheduleModal) {
      fetchTargetDateBookings();
    }
  }, [reschedForm.date, selectedBooking, showRescheduleModal]);

  useEffect(() => {
    fetchBookings();
  }, [navigate]);

  const fetchBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      const { data: profile } = await supabase
        .from("profiles")
        .select("suspension_end_date")
        .eq("id", user.id)
        .single();

      if (profile?.suspension_end_date) {
        const endDate = new Date(profile.suspension_end_date);
        if (endDate > new Date()) {
          setIsSuspended(true);
          setSuspensionDate(endDate);
        }
      }

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
            ai_generated_url,
            booking_services (service_name, price)
          )
        `)
        .eq("user_id", user.id)
        .order('booking_date', { ascending: false });

      if (error) throw error;
      setBookings(data || []);

    } catch (err) {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = (dateString) => {
    if (!dateString || providerHours.length === 0) return [];
    const dayName = new Date(dateString).toLocaleDateString('en-US', { weekday: 'long' });
    const daySchedule = providerHours.find(h => h.day_of_week === dayName);
    return calculateIntervalSlots(daySchedule).map(time => {
      const tempDate = new Date(`2000-01-01T${time}`);
      return tempDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', minute: '2-digit', hour12: true 
      });
    });
  };

  const handleRescheduleDateChange = async (e) => {
    const newDate = e.target.value;
    if (!newDate || !selectedBooking) return;

    const dayName = new Date(newDate).toLocaleDateString('en-US', { weekday: 'long' });
    const workingDay = providerHours.find(h => h.day_of_week === dayName);

    if (!workingDay) {
      alert(`The service provider is closed on ${dayName}s. Please select a different date.`);
      setReschedForm({ ...reschedForm, date: "", time: "" });
      setAvailableSlots([]);
      return;
    }

    const petCount = selectedBooking.booking_pets?.length || 1;
    const { data: dateBookings } = await supabase
      .from("bookings")
      .select("time_slot, status")
      .eq("provider_id", selectedBooking.service_providers.id)
      .eq("booking_date", newDate)
      .not("status", "in", '("cancelled", "declined", "rejected", "void", "voided")');

    const potentialSlots = calculateIntervalSlots(workingDay);
    
    const hasRoom = potentialSlots.some(time => {
      const occupied = dateBookings.filter(b => b.time_slot === time).length;
      const capacity = parseInt(workingDay.slot_capacity) || 1;
      return (capacity - occupied) >= petCount;
    });

    if (!hasRoom) {
      alert(`This date is fully booked for ${petCount} pet(s).`);
      setReschedForm({ ...reschedForm, date: "", time: "" });
      setAvailableSlots([]);
    } else {
      setReschedForm({ ...reschedForm, date: newDate, time: "" });
      setTargetDateBookings(dateBookings || []);
      
      const displaySlots = potentialSlots.map(t => {
        const [h, m] = t.split(':');
        const hr = parseInt(h);
        return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
      });
      setAvailableSlots(displaySlots);
    }
  };

  const getSlotDetails = (timeSlot) => {
    if (!reschedForm.date || !selectedBooking || providerHours.length === 0) return { remaining: 0, isEnough: false };

    const dayName = new Date(reschedForm.date).toLocaleDateString('en-US', { weekday: 'long' });
    const workingDay = providerHours.find(h => h.day_of_week === dayName);
    const maxCapacity = workingDay ? parseInt(workingDay.slot_capacity) : 1;
    
    const time24 = convertTo24Hour(timeSlot) + ":00";
    const occupiedByOthers = targetDateBookings.filter(b => b.time_slot === time24).length;
    const remaining = maxCapacity - occupiedByOthers;
    const petCount = selectedBooking.booking_pets?.length || 0;
    
    return {
      remaining: Math.max(0, remaining),
      isEnough: remaining >= petCount
    };
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

  const isCancellable = (booking) => {
    if (!booking.booking_date) return false;
    const bookingDate = new Date(booking.booking_date);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffTime = bookingDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // ✅ Only 'for approval' bookings can be cancelled (removed 'paid' since payment is full upfront now)
    return booking.status === 'for approval' && diffDays > 1;
  };

  const getFilteredBookings = () => {
    if (!bookings) return [];
    const sorted = [...bookings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    switch (activeTab) {
      // ✅ "Awaiting Approval" now shows 'for approval' status
      case "awaiting": return sorted.filter(b => b.status === "for approval");
      // ✅ "Upcoming" remains 'paid' — provider approved and full payment already collected
      case "upcoming": return sorted.filter(b => b.status === "paid");
      case "rate":     return sorted.filter(b => b.status === "for review");
      default:         return [];
    }   
  };

  // ✅ Removed 'payment' count — only 3 tabs now
  const counts = {
    awaiting: bookings.filter(b => b.status === "for approval").length,
    upcoming:  bookings.filter(b => b.status === "paid").length,
    rate:      bookings.filter(b => b.status === "for review").length,
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
    setTargetDateBookings([]);
  };

  const handleOpenRateModal = () => setShowFeedbackModal(true); 

  const handleSubmitFeedback = async () => {
    if (isSuspended) return;
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
    if (isSuspended) return;
    if (!reschedForm.time || !selectedBooking) return;

    const { isEnough } = getSlotDetails(reschedForm.time);
    if (!isEnough) {
      alert("Sorry, this slot was just taken by another user. Please choose another time.");
      return;
    }

    setActionLoading(true);
    try {
      const time24 = convertTo24Hour(reschedForm.time);
      const { error } = await supabase
        .from('bookings')
        .update({
          booking_date: reschedForm.date,
          time_slot: time24,
          status: 'for approval' 
        })
        .eq('id', selectedBooking.id);

      if (error) throw error;
      
      await fetchBookings(); 
      handleCloseAll();

      setSuccessTitle("Reschedule Successful!");
      setSuccessMessage("Your previous slot has been released and your new appointment is now awaiting approval.");
      setShowSuccessModal(true);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmCancel = async () => {
    if (isSuspended || !selectedBooking) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      setBookings(prev => prev.map(b => 
        b.id === selectedBooking.id ? { ...b, status: 'cancelled' } : b
      ));

      handleCloseAll();
      setSuccessTitle("Cancelled Successfully");
      setSuccessMessage("The appointment has been removed from your active list.");
      setShowSuccessModal(true);

    } catch (err) {
      console.error("Cancellation Error:", err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getMinDate = () => {
    if (!selectedBooking) return "";
    const original = new Date(selectedBooking.booking_date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return original > tomorrow ? original.toISOString().split("T")[0] : tomorrow.toISOString().split("T")[0];
  };

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

          {/* ✅ 3 tabs only: Awaiting Approval, Upcoming, To Rate */}
          <div className="status-icons-card">
            <div className="icons-row">
              {['awaiting', 'upcoming', 'rate'].map((tab) => (
                <div key={tab} className={`icon-item ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                  <div className="icon-circle">
                    {tab === 'awaiting' && <FaClock />}
                    {tab === 'upcoming' && <FaCut />}
                    {tab === 'rate' && <FaStar />}
                    {counts[tab] > 0 && <span className="badge-count">{counts[tab]}</span>}
                  </div>
                  <span>
                    {tab === 'awaiting' ? 'Awaiting Approval' : tab === 'rate' ? 'To Rate' : 'Upcoming'}
                  </span>
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
            <div className="modal-header">
              <h3>Appointment Details</h3>
              <button className="close-btn" onClick={handleCloseAll}><FaTimes/></button>
            </div>
            <div className="modal-body-scroll">
              {isSuspended && (
                <div className="refund-warning-box" style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', padding: '15px', borderRadius: '12px', color: '#be123c', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <FaBan size={20}/>
                  <span><strong>Action Restricted:</strong> Your account is currently suspended until {suspensionDate.toLocaleDateString()}. You can view your details but cannot modify this appointment.</span>
                </div>
              )}

              <div className="info-grid">
                <div className="info-item"><label><FaInfoCircle/> Provider</label><span>{selectedBooking.service_providers?.business_name}</span></div>
                <div className="info-item"><label><FaClock/> Schedule</label><span>{formatDateTime(selectedBooking.booking_date, selectedBooking.time_slot)}</span></div>
                <div className="info-item">
                  <label><FaFileInvoiceDollar/> Total Paid</label>
                  <span className="price-tag">{formatCurrency(selectedBooking.total_estimated_price)}</span>
                  <span className="vat-note-small" style={{textAlign: 'left', marginTop: '0'}}>Full Payment (VAT Inclusive)</span>
                </div>
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
                      {pet.ai_generated_url && <div className="image-wrapper clickable-img" onClick={() => setPreviewImage(pet.ai_generated_url)}><p className="img-label">AI Style Preview <FaSearchPlus size={12} /></p><img src={pet.ai_generated_url} className="proof-image"/></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="modal-footer">
              {/* ✅ Reschedule only available for 'for approval' bookings */}
              {selectedBooking.status === 'for approval' && (
                <button 
                  className="resched-btn" 
                  onClick={() => !isSuspended && setShowRescheduleModal(true)}
                  disabled={isSuspended}
                  style={isSuspended ? { backgroundColor: '#cbd5e1', cursor: 'not-allowed', color: '#64748b' } : {}}
                >
                  {isSuspended ? "Reschedule Locked" : "Reschedule"}
                </button>
              )}

              {selectedBooking.status === 'for review' && (
                <button 
                  className="rate-btn" 
                  onClick={handleOpenRateModal}
                  disabled={isSuspended}
                  style={isSuspended ? { backgroundColor: '#cbd5e1', cursor: 'not-allowed', color: '#64748b' } : {}}
                >
                  {isSuspended ? "Rating Locked" : "Rate Service"}
                </button>
              )}

              {isCancellable(selectedBooking) && (
                <button 
                  className="cancel-btn" 
                  onClick={() => !isSuspended && setShowCancelModal(true)}
                  disabled={isSuspended}
                  style={isSuspended ? { backgroundColor: '#cbd5e1', cursor: 'not-allowed', color: '#64748b' } : {}}
                >
                  {isSuspended ? "Cancellation Locked" : "Cancel Appointment"}
                </button>
              )}
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
                <input 
                  type="date" 
                  className="input-field" 
                  required 
                  min={getMinDate()} 
                  value={reschedForm.date} 
                  onChange={handleRescheduleDateChange} 
                />
                
                {!reschedForm.date && (
                  <div style={{fontSize: '0.75rem', color: '#64748b', marginTop: '-8px', marginBottom: '10px'}}>
                    Available days: {providerHours.map(h => h.day_of_week.slice(0,3)).join(', ')}
                  </div>
                )}

                <label className="input-label">New Time</label>
                <select 
                  className="input-field" 
                  required 
                  value={reschedForm.time} 
                  disabled={!reschedForm.date || availableSlots.length === 0} 
                  onChange={(e) => setReschedForm({ ...reschedForm, time: e.target.value })}
                >
                  <option value="">Select Time Slot</option>
                  {availableSlots.map((slot, index) => {
                    const { remaining, isEnough } = getSlotDetails(slot);
                    const petCount = selectedBooking.booking_pets?.length || 1;
                    const isOriginalTime = 
                      reschedForm.date === selectedBooking.booking_date && 
                      convertTo24Hour(slot) === selectedBooking.time_slot.slice(0, 5); 

                    return (
                      <option 
                        key={index} 
                        value={slot} 
                        disabled={!isEnough || isOriginalTime}
                        style={(!isEnough || isOriginalTime) ? { color: '#999', backgroundColor: '#f3f4f6' } : {}}
                      >
                        {slot} 
                        {isOriginalTime 
                          ? " (Current Schedule)" 
                          : isEnough 
                            ? `(${remaining} left)` 
                            : `(Full - needs ${petCount} slots)`
                        }
                      </option>
                    );
                  })}
                </select>
                
                {reschedForm.time && (
                  <div className="slot-availability-text">
                    Available slots for this time: <strong>{getSlotDetails(reschedForm.time).remaining}</strong>
                  </div>
                )}

                {reschedForm.date && availableSlots.length === 0 && (
                  <div className="warning-text-simple" style={{ color: 'var(--brand-red)', fontSize: '0.85rem', marginTop: '5px' }}>
                    <FaExclamationTriangle /> Provider is closed on selected day.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="secondary-btn" onClick={() => setShowRescheduleModal(false)}>Back</button>
                <button type="submit" className="confirm-btn-yes" disabled={actionLoading || !reschedForm.time || availableSlots.length === 0}>
                  {actionLoading ? "Saving..." : "Confirm"}
                </button>
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
            <div className="modal-header">
              <h3>Rate Experience</h3>
              <button className="close-btn" onClick={handleCloseAll}><FaTimes/></button>
            </div>
            <div className="modal-body">
              <div className="rating-group">
                <label style={{ color: 'var(--brand-blue)', fontWeight: '700' }}>
                  Overall Experience <span className="req" style={{ color: 'var(--brand-red)' }}>*</span>
                </label>
                <div className="stars-container">
                  {[1, 2, 3, 4, 5].map(star => (
                    <FaStar 
                      key={`overall-${star}`} 
                      className={`star-icon ${feedbackForm.overallRating >= star ? 'filled' : ''}`} 
                      onClick={() => setFeedbackForm({...feedbackForm, overallRating: star})} 
                      style={{ cursor: 'pointer', fontSize: '2rem', color: feedbackForm.overallRating >= star ? 'var(--brand-yellow)' : '#e2e8f0', marginRight: '5px' }}
                    />
                  ))}
                </div>
              </div>

              <div className="rating-group" style={{ marginTop: '1.5rem' }}>
                <label style={{ color: 'var(--brand-blue)', fontWeight: '700' }}>
                  Staff Rating <span className="req" style={{ color: 'var(--brand-red)' }}>*</span>
                </label>
                <div className="stars-container">
                  {[1, 2, 3, 4, 5].map(star => (
                    <FaStar 
                      key={`staff-${star}`} 
                      className={`star-icon ${feedbackForm.staffRating >= star ? 'filled' : ''}`} 
                      onClick={() => setFeedbackForm({...feedbackForm, staffRating: star})} 
                      style={{ cursor: 'pointer', fontSize: '2rem', color: feedbackForm.staffRating >= star ? 'var(--brand-yellow)' : '#e2e8f0', marginRight: '5px' }}
                    />
                  ))}
                </div>
              </div>

              <div className="textarea-group" style={{ marginTop: '1.5rem' }}>
                <label style={{ color: 'var(--brand-blue)', fontWeight: '700', display: 'block', marginBottom: '8px' }}>Comments</label>
                <textarea 
                  className="feedback-textarea" 
                  placeholder="Tell us about your experience..." 
                  value={feedbackForm.comment} 
                  maxLength={500}
                  onChange={(e) => setFeedbackForm({...feedbackForm, comment: e.target.value})} 
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border-light)', minHeight: '100px', fontFamily: 'inherit' }}
                />
                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: feedbackForm.comment.length >= 500 ? 'var(--brand-red)' : 'var(--text-muted)', marginTop: '5px', fontWeight: '600' }}>
                  {feedbackForm.comment.length} / 500
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '2rem' }}>
              <button className="secondary-btn" onClick={handleCloseAll}>Cancel</button>
              <button 
                className="confirm-btn-yes" 
                onClick={handleSubmitFeedback} 
                disabled={actionLoading || feedbackForm.overallRating === 0 || feedbackForm.staffRating === 0}
                style={{ 
                  backgroundColor: (feedbackForm.overallRating === 0 || feedbackForm.staffRating === 0) ? '#cbd5e1' : 'var(--brand-blue)',
                  color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: '700',
                  cursor: (feedbackForm.overallRating === 0 || feedbackForm.staffRating === 0) ? 'not-allowed' : 'pointer'
                }}
              >
                {actionLoading ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="modal-overlay">
          <div className="modal-content small-modal">
            <div className="modal-header warning-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaExclamationTriangle color="#ef4444" /> Confirm Cancellation
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ fontWeight: '600', marginBottom: '10px' }}>
                Are you sure you want to cancel this appointment?
              </p>
              {/* ✅ Updated warning: full payment refund policy since we charge full amount upfront */}
              <div className="refund-warning-box" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px', color: '#991b1b', fontSize: '0.85rem' }}>
                <strong>Important:</strong> You have already paid the <strong>full amount</strong> for this booking. If you cancel, a refund will be processed subject to the provider's refund policy.
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setShowCancelModal(false)} disabled={actionLoading}>
                No, Keep Booking
              </button>
              <button className="confirm-btn-no" onClick={confirmCancel} disabled={actionLoading} style={{ backgroundColor: '#ef4444' }}>
                {actionLoading ? "Processing..." : "Yes, Cancel Appointment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="modal-content small-modal" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '3rem 2rem', borderRadius: '16px' }}>
            <FaCheckCircle style={{ fontSize: '4.5rem', color: 'var(--brand-green)', marginBottom: '1.5rem', display: 'block' }} />
            <h3 style={{ color: 'var(--brand-blue)', fontWeight: '800', marginBottom: '0.5rem' }}>{successTitle}</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{successMessage}</p>
            <button className="confirm-btn-yes" onClick={() => setShowSuccessModal(false)} style={{ width: '100%', maxWidth: '250px' }}>OK</button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}