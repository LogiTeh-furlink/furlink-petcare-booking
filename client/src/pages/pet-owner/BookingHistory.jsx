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
  FaStar,
  FaCheckCircle,
  FaFileInvoiceDollar,
  FaSearchPlus,
  FaBan,
  FaTimesCircle,
  FaMoneyBillWave,
  FaCalendarCheck
} from "react-icons/fa";
import "./Appointments.css";

export default function BookingHistory() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("awaiting"); 
  const [selectedBooking, setSelectedBooking] = useState(null); 
  const [showCancelModal, setShowCancelModal] = useState(false); 
  const [showRescheduleModal, setShowRescheduleModal] = useState(false); 
  const [showSuccessModal, setShowSuccessModal] = useState(false); 
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const [successMessage, setSuccessMessage] = useState(""); 
  const [successTitle, setSuccessTitle] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  
  // Reschedule Logic States
  const [reschedForm, setReschedForm] = useState({ date: "", time: "" });
  const [availableSlots, setAvailableSlots] = useState([]); 
  const [providerHours, setProviderHours] = useState([]);   
  const [targetDateBookings, setTargetDateBookings] = useState([]);

  const [feedbackForm, setFeedbackForm] = useState({
    overallRating: 0,
    staffRating: 0,
    comment: ""
  });

  useEffect(() => {
    fetchBookings();
  }, [navigate]);

  // Fetch Provider Hours when Reschedule Modal Opens
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

  // Fetch Existing Bookings for Provider when Reschedule DATE changes
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
            ai_generated_url,
            booking_services (service_name, price)
          )
        `)
        .eq("user_id", user.id)
        .order('booking_date', { ascending: false });

      if (error) throw error;
      setBookings(data || []);

    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoading(false);
    }
  };

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

  const convertTo24Hour = (timeStr) => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
    return `${hours}:${minutes}`;
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

  const getMinDate = () => {
    if (!selectedBooking) return "";
    const original = new Date(selectedBooking.booking_date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return original > tomorrow ? original.toISOString().split("T")[0] : tomorrow.toISOString().split("T")[0];
  };

  const isFourHoursPast = (booking) => {
    if (!booking.booking_date || !booking.time_slot) return false;
    const bookingDateTime = new Date(`${booking.booking_date}T${booking.time_slot}`);
    const diffHours = (new Date() - bookingDateTime) / (1000 * 60 * 60);
    return diffHours >= 4;
  };

  const isCancellable = (booking) => {
    if (!booking.booking_date) return false;
    const bookingDate = new Date(booking.booking_date);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = bookingDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return (['pending', 'paid'].includes(booking.status)) && diffDays > 1;
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

  const isTodayBooking = (booking) => {
    if (!booking.booking_date) return false;
    const bookingDate = new Date(booking.booking_date);
    const today = new Date();
    
    return (
      bookingDate.getFullYear() === today.getFullYear() &&
      bookingDate.getMonth() === today.getMonth() &&
      bookingDate.getDate() === today.getDate()
    );
  };

  const isUpcomingBooking = (booking) => {
    if (!booking.booking_date) return false;
    const bookingDate = new Date(booking.booking_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return bookingDate > today;
  };

  const getFilteredBookings = () => {
    if (!bookings) return [];
    const sorted = [...bookings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    switch (activeTab) {
      case "awaiting": 
        return sorted.filter(b => b.status === "pending");
      
      case "payment": 
        return sorted.filter(b => b.status === "approved");
      
      case "upcoming": 
        return sorted.filter(b => b.status === "paid" && isUpcomingBooking(b) && !isTodayBooking(b));
      
      case "today": 
        return sorted.filter(b => b.status === "paid" && isTodayBooking(b));
      
      case "toRate":
        // Display "paid" bookings that are 4 hours past the scheduled time and not yet rated
        return sorted.filter(b => b.status === "paid" && isFourHoursPast(b));
      
      case "rated": 
        return sorted.filter(b => b.status === "rated");
      
      case "cancelled": 
        return sorted.filter(b => b.status === "cancelled");
      
      case "denied": 
        return sorted.filter(b => b.status === "declined");
      
      case "void": 
        return sorted.filter(b => b.status === "void" || b.status === "voided");
      
      default: 
        return [];
    }
  };

  const counts = {
    awaiting: bookings.filter(b => b.status === "pending").length,
    payment: bookings.filter(b => b.status === "approved").length,
    upcoming: bookings.filter(b => b.status === "paid" && isUpcomingBooking(b) && !isTodayBooking(b)).length,
    today: bookings.filter(b => b.status === "paid" && isTodayBooking(b)).length,
    toRate: bookings.filter(b => b.status === "paid" && isFourHoursPast(b)).length,
    rated: bookings.filter(b => b.status === "rated").length,
    cancelled: bookings.filter(b => b.status === "cancelled").length,
    denied: bookings.filter(b => b.status === "declined").length,
    void: bookings.filter(b => b.status === "void" || b.status === "voided").length,
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
    setPreviewImage(null);
    setAvailableSlots([]);
    setReschedForm({ date: "", time: "" });
    setFeedbackForm({ overallRating: 0, staffRating: 0, comment: "" });
    setTargetDateBookings([]);
  };

  const handlePayNow = () => navigate(`/payment/${selectedBooking.id}`);

  const confirmReschedule = async (e) => {
    e.preventDefault();
    if(!reschedForm.time || !selectedBooking) return;

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
          status: 'pending' 
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
    if (!selectedBooking) return;

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
    } catch (err) { 
      console.error(err);
    } finally { 
      setActionLoading(false); 
    }
  };

  if (loading) return <div className="app-loading">Loading...</div>;

  return (
    <div className="page-wrapper">
      <LoggedInNavbar />
      <div className="appointments-wrapper">
        <div className="appointments-container">
          <div className="app-header-row">
             <div className="header-text">
               <h1>Booking History</h1>
               <p>View your past and upcoming appointments</p>
             </div>
          </div>
          
          <div className="status-icons-card">
            <div className="icons-row">
              {[
                { key: 'awaiting', label: 'Awaiting Approval', icon: <FaClock /> },
                { key: 'payment', label: 'For Payment', icon: <FaCreditCard /> },
                { key: 'upcoming', label: 'Upcoming', icon: <FaCalendarCheck /> },
                { key: 'today', label: 'Today', icon: <FaCalendarAlt /> },
                { key: 'toRate', label: 'To Rate', icon: <FaStar style={{color: '#fbbf24'}} /> },
                { key: 'rated', label: 'Rated', icon: <FaStar /> },
                { key: 'cancelled', label: 'Cancelled', icon: <FaBan /> },
                { key: 'denied', label: 'Denied', icon: <FaTimesCircle /> },
                { key: 'void', label: 'Void Payments', icon: <FaMoneyBillWave /> }
              ].map((tab) => (
                <div key={tab.key} className={`icon-item ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
                  <div className="icon-circle">
                    {tab.icon}
                    {counts[tab.key] > 0 && <span className="badge-count">{counts[tab.key]}</span>}
                  </div>
                  <span>{tab.label}</span>
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
                  <h3>No bookings found.</h3>
                </div>
              ) : (
                getFilteredBookings().map((booking) => (
                  <div key={booking.id} className="app-row">
                    <div className="col-date"><strong>{formatDateTime(booking.booking_date, booking.time_slot)}</strong></div>
                    <div className="col-pets">{booking.booking_pets?.length || 0} Pet/s</div>
                    <div className="col-service">{getServiceSummary(booking.booking_pets)}</div>
                    <div className="col-price">
                        {formatCurrency(booking.total_estimated_price)}
                    </div>
                    <div className="col-action"><button className="view-app-btn" onClick={() => handleOpenDetails(booking)}>View Details</button></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedBooking && !showRescheduleModal && !showCancelModal && !showSuccessModal && !showFeedbackModal && (
        <div className="modal-overlay" onClick={handleCloseAll}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
             <div className="modal-header">
               <h3>Booking Details</h3>
               <button className="close-btn" onClick={handleCloseAll}><FaTimes/></button>
             </div>
             <div className="modal-body-scroll">
                <div className="info-grid">
                   <div className="info-item">
                     <label><FaInfoCircle/> Provider</label>
                     <span>{selectedBooking.service_providers?.business_name}</span>
                   </div>
                   <div className="info-item">
                     <label><FaClock/> Schedule</label>
                     <span>{formatDateTime(selectedBooking.booking_date, selectedBooking.time_slot)}</span>
                   </div>
                   <div className="info-item">
                       <label><FaFileInvoiceDollar/> Total Amount</label>
                       <span className="price-tag">{formatCurrency(selectedBooking.total_estimated_price)}</span>
                       <span className="vat-note-small" style={{textAlign: 'left', marginTop: '0'}}>* VAT exclusive</span>
                   </div>
                   <div className="info-item">
                        <label><FaCreditCard/> Downpayment</label>
                        <span className="price-tag">{formatCurrency(selectedBooking.installation_payment)}</span>
                        <span className="vat-note-small" style={{textAlign: 'left', marginTop: '0'}}>* VAT exclusive</span>
                    </div>

                    {/* ⭐ NEW: Balance Row for Paid Bookings (Upcoming/Today) */}
                    {(selectedBooking.status === 'paid' && (activeTab === 'upcoming' || activeTab === 'today')) && (
                        <div className="info-item">
                            <label>
                                <FaMoneyBillWave/> Balance to Pay
                            </label>
                            <span className="price-tag" style={{ color: 'var(--brand-blue)' }}>
                                {formatCurrency(
                                    (selectedBooking.total_estimated_price || 0) - (selectedBooking.installation_payment || 0)
                                )}
                            </span>
                            <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '2px 0 0 0' }}>
                                Payable at the shop on {new Date(selectedBooking.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                    )}
                   <div className="info-item">
                     <label>Status</label>
                     <span className="status-badge">{selectedBooking.status}</span>
                   </div>
                   {selectedBooking.rejection_reason && 
                      (selectedBooking.status === "declined" || 
                      selectedBooking.status === "void" || 
                      selectedBooking.status === "voided") && (
                      <div className="info-item" style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                        <label style={{ color: 'var(--brand-red)' }}><FaExclamationTriangle/> Rejection for Reason</label>
                        <div style={{ 
                          padding: '12px', 
                          backgroundColor: '#fff5f5', 
                          borderRadius: '8px', 
                          borderLeft: '4px solid var(--brand-red)' 
                        }}>
                          <span style={{ display: 'block', color: '#c53030', fontWeight: '600', marginBottom: '8px' }}>
                            {selectedBooking.rejection_reason}
                          </span>
                          <p style={{ fontSize: '0.85rem', color: '#4a5568', margin: 0, lineHeight: '1.4' }}>
                            We apologize for the inconvenience. If you believe this is a mistake or if you need help with your payment, please reach out to our support team at 
                            <a href={`mailto:logiteh045@gmail.com?subject=Payment Assistance - Booking #${selectedBooking.id}`} 
                              style={{ color: '#2b6cb0', fontWeight: '600', marginLeft: '4px', textDecoration: 'underline' }}>
                              logiteh045@gmail.com
                            </a>. We're here to help!
                          </p>
                        </div>
                      </div>
                    )}
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
                         {pet.vaccine_card_url && <div className="image-wrapper clickable-img" onClick={() => setPreviewImage(pet.vaccine_card_url)}><p className="img-label">Vaccine Card <FaSearchPlus size={12} /></p><img src={pet.vaccine_card_url} className="proof-image" alt="Vaccine Card"/></div>}
                         {pet.illness_proof_url && <div className="image-wrapper clickable-img" onClick={() => setPreviewImage(pet.illness_proof_url)}><p className="img-label">Proof of Illness <FaSearchPlus size={12} /></p><img src={pet.illness_proof_url} className="proof-image" alt="Illness Proof"/></div>}
                         {pet.ai_generated_url && <div className="image-wrapper clickable-img" onClick={() => setPreviewImage(pet.ai_generated_url)}><p className="img-label">AI Style Preview <FaSearchPlus size={12} /></p><img src={pet.ai_generated_url} className="proof-image" alt="AI Preview"/></div>}
                       </div>
                    </div>
                  ))}
                </div>
             </div>
             <div className="modal-footer">
               {/* Reschedule for pending bookings */}
               {selectedBooking.status === 'pending' && (
                 <button className="resched-btn" onClick={() => setShowRescheduleModal(true)}>Reschedule</button>
               )}

               {/* Pay Now for approved bookings */}
               {selectedBooking.status === 'approved' && (
                 <button className="pay-btn" onClick={handlePayNow}>Pay Now</button>
               )}

               {/* Rate for paid bookings 4 hours past */}
               {selectedBooking.status === 'paid' && isFourHoursPast(selectedBooking) && (
                 <button className="rate-btn" onClick={() => setShowFeedbackModal(true)}>Rate Service</button>
               )}

               {/* Cancel for pending/paid bookings not within 24h */}
               {isCancellable(selectedBooking) && (
                 <button className="cancel-btn" onClick={() => setShowCancelModal(true)}>Cancel Appointment</button>
               )}

               {/* Always show Close button */}
               <button className="secondary-btn" onClick={handleCloseAll}>Close</button>
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
              
              {selectedBooking?.status === 'paid' && (
                <div className="refund-warning-box" style={{ 
                  backgroundColor: '#fef2f2', 
                  border: '1px solid #fecaca', 
                  padding: '12px', 
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '0.85rem'
                }}>
                  <strong>Important:</strong> This booking is already <strong>PAID</strong>. 
                  By cancelling, you acknowledge that the 30% downpayment is 
                  <strong> non-refundable</strong>.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="secondary-btn" 
                onClick={() => setShowCancelModal(false)}
                disabled={actionLoading}
              >
                No, Keep Booking
              </button>
              <button 
                className="confirm-btn-no" 
                onClick={confirmCancel} 
                disabled={actionLoading}
                style={{ backgroundColor: '#ef4444' }}
              >
                {actionLoading ? "Processing..." : "Yes, Cancel Appointment"}
              </button>
            </div>
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
                      style={{ 
                        cursor: 'pointer', 
                        fontSize: '2rem', 
                        color: feedbackForm.overallRating >= star ? 'var(--brand-yellow)' : '#e2e8f0',
                        marginRight: '5px'
                      }}
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
                      style={{ 
                        cursor: 'pointer', 
                        fontSize: '2rem', 
                        color: feedbackForm.staffRating >= star ? 'var(--brand-yellow)' : '#e2e8f0',
                        marginRight: '5px'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="textarea-group" style={{ marginTop: '1.5rem' }}>
                <label style={{ color: 'var(--brand-blue)', fontWeight: '700', display: 'block', marginBottom: '8px' }}>
                  Comments
                </label>
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
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '700',
                  cursor: (feedbackForm.overallRating === 0 || feedbackForm.staffRating === 0) ? 'not-allowed' : 'pointer'
                }}
              >
                {actionLoading ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="modal-overlay">
          <div 
            className="modal-content small-modal" 
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center', 
              padding: '3rem 2rem',
              borderRadius: '16px'
            }}
          >
            <FaCheckCircle 
              style={{
                fontSize: '4.5rem', 
                color: 'var(--brand-green)', 
                marginBottom: '1.5rem',
                display: 'block'
              }}
            />
            
            <h3 style={{ color: 'var(--brand-blue)', fontWeight: '800', marginBottom: '0.5rem' }}>
              {successTitle}
            </h3>
            
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
              {successMessage}
            </p>
            
            <button 
              className="confirm-btn-yes" 
              onClick={() => setShowSuccessModal(false)} 
              style={{ width: '100%', maxWidth: '250px' }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="modal-overlay image-preview-overlay" onClick={() => setPreviewImage(null)}>
          <div className="image-preview-content" onClick={e => e.stopPropagation()}>
            <button className="close-preview-btn" onClick={() => setPreviewImage(null)}><FaTimes /></button>
            <img src={previewImage} className="large-proof-image" alt="Preview" />
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}