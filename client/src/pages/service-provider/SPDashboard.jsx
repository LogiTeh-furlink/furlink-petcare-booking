import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCalendarAlt, FaTimes, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import "./SPDashboard.css";

// --- Helper: Simple Calendar Component ---
const BookingCalendar = ({ bookings, onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filter only Verified/Approved bookings for the calendar counts
  const verifiedBookings = bookings.filter(b => 
    b.status === 'verified' || b.status === 'approved'
  );

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
      const count = verifiedBookings.filter(b => b.booking_date === dateStr).length;
      
      days.push(
        <div key={d} className={`calendar-day ${count > 0 ? 'has-bookings' : ''}`}>
          <span className="day-number">{d}</span>
          {count > 0 && <span className="day-badge">{count} Req</span>}
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
          <h3>Verified Requests Calendar</h3>
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
  const [provider, setProvider] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [activeTab, setActiveTab] = useState("request"); 
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/login");

        const { data: providerData, error: providerError } = await supabase
          .from("service_providers")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (providerError) throw providerError;
        setProvider(providerData);

        const { data: bookingsData, error: bookingsError } = await supabase
          .from("bookings")
          .select(`
            *,
            booking_pets (
              id,
              pet_name,
              booking_services (service_name, price)
            )
          `)
          .eq("provider_id", providerData.id)
          .order('booking_date', { ascending: false });

        if (bookingsError) throw bookingsError;
        setBookings(bookingsData || []);

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const formatDateTime = (dateStr, timeStr) => {
    const date = new Date(dateStr).toLocaleDateString("en-US", { 
      month: "short", day: "numeric", year: "numeric" 
    });
    return `${date} ${timeStr}`;
  };

  const getServiceSummary = (pets) => {
    if (!pets || pets.length === 0) return "No services selected";
    const allServices = pets.flatMap(pet => 
      pet.booking_services?.map(s => s.service_name) || []
    );
    return [...new Set(allServices)].join(", ") || "No services";
  };

  // --- Logic: Filtering ---
  const getFilteredBookings = () => {
    const todayStr = new Date().toISOString().split('T')[0];

    switch (activeTab) {
      case "request":
        return bookings.filter(b => b.status === 'pending');
      case "approved":
        return bookings.filter(b => b.status === 'approved');
      case "verification":
        return bookings.filter(b => b.status === 'verification_pending');
      case "verified":
        return bookings.filter(b => b.status === 'verified');
      case "completed":
        return bookings.filter(b => b.status === 'completed');
      case "rejected":
        return bookings.filter(b => b.status === 'declined');
      case "today":
        return bookings.filter(b => b.booking_date === todayStr && b.status !== 'cancelled' && b.status !== 'declined');
      default:
        return bookings;
    }
  };

  // --- Logic: Counts ---
  const getCounts = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      request: bookings.filter(b => b.status === 'pending').length,
      approved: bookings.filter(b => b.status === 'approved').length,
      verification: bookings.filter(b => b.status === 'verification_pending').length,
      verified: bookings.filter(b => b.status === 'verified').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      rejected: bookings.filter(b => b.status === 'declined').length,
      today: bookings.filter(b => b.booking_date === todayStr && b.status !== 'cancelled' && b.status !== 'declined').length,
    };
  };

  const counts = getCounts();
  const displayedBookings = getFilteredBookings();

  if (loading) return <div className="sp-loading">Loading Dashboard...</div>;

  return (
    <>
      <LoggedInNavbar />
      
      {showCalendar && <BookingCalendar bookings={bookings} onClose={() => setShowCalendar(false)} />}

      <div className="sp-dashboard-container">
        
        {/* Header */}
        <div className="sp-header">
          <div className="sp-welcome">
            <h1>{provider?.business_name || "My Business"}</h1>
            <p>Provider Dashboard</p>
          </div>
          <button className="calendar-toggle-btn" onClick={() => setShowCalendar(true)}>
             <FaCalendarAlt /> Access Calendar
          </button>
        </div>

        {/* Quick Actions / Status Tabs */}
        <div className="status-tabs-container">
          <div className="status-tabs-row">
            <button 
              className={`status-tab ${activeTab === 'request' ? 'active' : ''}`}
              onClick={() => setActiveTab('request')}
            >
              <h3>REQUEST</h3>
              <span className="count-badge">{counts.request}</span>
            </button>

            <button 
              className={`status-tab ${activeTab === 'approved' ? 'active' : ''}`}
              onClick={() => setActiveTab('approved')}
            >
              <h3>APPROVED</h3>
              <span className="count-badge">{counts.approved}</span>
            </button>

            <button 
              className={`status-tab ${activeTab === 'today' ? 'active' : ''}`}
              onClick={() => setActiveTab('today')}
            >
              <h3>TODAY</h3>
              <span className="count-badge">{counts.today}</span>
            </button>

            <button 
              className={`status-tab ${activeTab === 'verification' ? 'active' : ''}`}
              onClick={() => setActiveTab('verification')}
            >
              <h3>VERIFICATION</h3>
              <span className="count-badge">{counts.verification}</span>
            </button>

            <button 
              className={`status-tab ${activeTab === 'verified' ? 'active' : ''}`}
              onClick={() => setActiveTab('verified')}
            >
              <h3>VERIFIED</h3>
              <span className="count-badge">{counts.verified}</span>
            </button>

            <button 
              className={`status-tab ${activeTab === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveTab('completed')}
            >
              <h3>COMPLETED</h3>
              <span className="count-badge">{counts.completed}</span>
            </button>

            <button 
              className={`status-tab ${activeTab === 'rejected' ? 'active' : ''}`}
              onClick={() => setActiveTab('rejected')}
            >
              <h3>REJECTED</h3>
              <span className="count-badge">{counts.rejected}</span>
            </button>
          </div>
        </div>

        {/* Bookings List Section */}
        <div className="bookings-list-section">
          <div className="section-header">
            <h2>{activeTab.toUpperCase()} LIST</h2>
          </div>

          {/* ⭐ NEW: Table Header Row (Hidden on Mobile) */}
          <div className="booking-list-header">
             <div>Date & Time</div>
             <div>No. of Pets</div>
             <div>Service to Avail</div>
             <div>Total Amt</div>
             <div>Action</div>
          </div>

          <div className="bookings-grid">
            {displayedBookings.length === 0 ? (
              <div className="no-bookings">No bookings found in this category.</div>
            ) : (
              displayedBookings.map((booking) => (
                <div key={booking.id} className="booking-card">
                  
                  <div className="booking-col date-col">
                    <span className="label-mobile">Date & Time</span>
                    <p className="main-text">{formatDateTime(booking.booking_date, booking.time_slot)}</p>
                  </div>

                  <div className="booking-col pets-col">
                    <span className="label-mobile">No. of Pets</span>
                    <p>{booking.booking_pets?.length || 0} Pets</p>
                  </div>

                  <div className="booking-col service-col">
                    <span className="label-mobile">Service to Avail</span>
                    <div className="service-list">
                      <p>{getServiceSummary(booking.booking_pets)}</p>
                    </div>
                  </div>

                  <div className="booking-col price-col">
                    <span className="label-mobile">Total Amt</span>
                    <p>Php {booking.total_estimated_price || "0.00"}</p>
                  </div>

                  <div className="booking-col action-col">
                    <button 
                      className="view-details-btn"
                      onClick={() => navigate(`/service/booking-details/${booking.id}`)}
                    >
                      View Details
                    </button>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}