import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { FaCalendarAlt, FaPaw, FaMoneyBillWave, FaClock } from "react-icons/fa";
import "./Appointments.css";

export default function Appointments() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
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
              pet_name,
              booking_services (service_name)
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

    fetchBookings();
  }, [navigate]);

  // --- Helpers ---
  const formatDateTime = (dateStr, timeStr) => {
    const date = new Date(dateStr).toLocaleDateString("en-US", { 
      month: "short", day: "numeric", year: "numeric" 
    });
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

  // --- Filtering ---
  const getFilteredBookings = () => {
    switch (activeTab) {
      case "pending": return bookings.filter(b => b.status === 'pending');
      case "payment": return bookings.filter(b => b.status === 'approved'); 
      case "verification": return bookings.filter(b => b.status === 'verification_pending');
      case "verified": return bookings.filter(b => b.status === 'verified');
      case "completed": return bookings.filter(b => b.status === 'completed');
      case "denied": return bookings.filter(b => b.status === 'declined');
      default: return [];
    }
  };

  const displayedBookings = getFilteredBookings();

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

          {/* Matches SPDashboard Tabs Style */}
          <div className="status-tabs-container">
            <div className="status-tabs-row">
              
              <button 
                className={`status-tab ${activeTab === 'pending' ? 'active' : ''}`}
                onClick={() => setActiveTab('pending')}
              >
                <h3>PENDING</h3>
                <span className="count-badge">{getCount('pending')}</span>
              </button>

              <button 
                className={`status-tab ${activeTab === 'payment' ? 'active' : ''}`}
                onClick={() => setActiveTab('payment')}
              >
                <h3>FOR PAYMENT</h3>
                <span className="count-badge">{getCount('payment')}</span>
              </button>

              <button 
                className={`status-tab ${activeTab === 'verification' ? 'active' : ''}`}
                onClick={() => setActiveTab('verification')}
              >
                <h3>VERIFYING</h3>
                <span className="count-badge">{getCount('verification')}</span>
              </button>

              <button 
                className={`status-tab ${activeTab === 'verified' ? 'active' : ''}`}
                onClick={() => setActiveTab('verified')}
              >
                <h3>VERIFIED</h3>
                <span className="count-badge">{getCount('verified')}</span>
              </button>

              <button 
                className={`status-tab ${activeTab === 'completed' ? 'active' : ''}`}
                onClick={() => setActiveTab('completed')}
              >
                <h3>COMPLETED</h3>
                <span className="count-badge">{getCount('completed')}</span>
              </button>

              <button 
                className={`status-tab ${activeTab === 'denied' ? 'active' : ''}`}
                onClick={() => setActiveTab('denied')}
              >
                <h3>DENIED</h3>
                <span className="count-badge">{getCount('denied')}</span>
              </button>

            </div>
          </div>

          {/* List Section */}
          <div className="app-list-section">
            <div className="section-header">
               <h2>{activeTab.replace('_', ' ').toUpperCase()} LIST</h2>
            </div>
            
            {/* Table Header Row */}
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
                      <div className="content-wrap">
                        {formatDateTime(booking.booking_date, booking.time_slot)}
                      </div>
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
                      <div className="content-wrap price">
                        Php {booking.total_estimated_price}
                      </div>
                    </div>

                    <div className="app-col action-col">
                      <button 
                        className="view-app-btn"
                        onClick={() => navigate(`/appointments/${booking.id}`)}
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
      </div>
      <Footer />
    </>
  );
}