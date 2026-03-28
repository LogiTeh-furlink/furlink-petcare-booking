import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { CheckCircle, Clock, Calendar, Info, ArrowRight, Loader2, CalendarCheck } from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";

const BookingSuccess = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const MAX_RETRIES = 15; // Increased to 30 seconds total

    const isPaid = searchParams.get("status") === "paid";

    useEffect(() => {
        if (!isPaid) {
            navigate("/dashboard");
            return;
        }

        const fetchLatestBooking = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate("/login");
                return;
            }

            const { data, error } = await supabase
                .from("bookings")
                .select(`
                    *,
                    service_providers:provider_id ( 
                        business_name 
                    ),
                    booking_pets (
                        pet_name,
                        selected_haircut,
                        grooming_specifications,
                        booking_services ( service_name, price )
                    )
                `)
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            // Handle the polling logic
            if (data) {
                setBooking(data);
                setLoading(false);
            } else if (retryCount < MAX_RETRIES) {
                // Wait 2 seconds before retrying
                const timer = setTimeout(() => setRetryCount(prev => prev + 1), 2000);
                return () => clearTimeout(timer);
            } else {
                setLoading(false); // Stop loading even if no booking found after max retries
            }
        };

        fetchLatestBooking();
    }, [isPaid, retryCount, navigate]);

    const formatFullDate = (dateStr) => {
        if (!dateStr) return { day: "N/A", date: "N/A" };
        const dateObj = new Date(dateStr);
        return {
            day: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
            date: dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        };
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return "N/A";
        const [hours, minutes] = timeStr.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        return `${h % 12 || 12}:${minutes} ${ampm}`;
    };

    // 1. Loading State
    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', gap: '16px' }}>
                <Loader2 style={{ width: 48, height: 48, color: '#0E2679', animation: 'spin 1s linear infinite' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Confirming your booking...</h2>
                <p style={{ color: '#64748b' }}>This usually takes a few seconds.</p>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // 2. Error/Timeout State (Safety check to prevent "Cannot read properties of null")
    if (!booking) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
                <Header />
                <main style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 20px' }}>
                    <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', maxWidth: '500px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <Info style={{ width: 48, height: 48, color: '#f59e0b', marginBottom: '16px' }} />
                        <h2 style={{ fontWeight: 800 }}>Booking Synced</h2>
                        <p style={{ color: '#64748b', marginBottom: '24px' }}>Your payment was successful, but the record is still being updated. You can view your status in the Appointments page.</p>
                        <button onClick={() => navigate("/appointments")} style={{ background: '#0E2679', color: 'white', padding: '12px 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>View Appointments</button>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    const { day, date } = formatFullDate(booking.booking_date);

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
            <Header />
            <main style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 16px 60px' }}>
                <div style={{ background: 'white', maxWidth: 700, width: '100%', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>

                    {/* Success Header */}
                    <div style={{ background: '#f0fdf4', padding: '40px', textAlign: 'center', borderBottom: '1px solid #dcfce7' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, background: '#dcfce7', borderRadius: '50%', marginBottom: 20 }}>
                            <CheckCircle style={{ width: 44, height: 44, color: '#16a34a' }} />
                        </div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#111827', margin: '0 0 10px' }}>Booking Request Sent!</h1>
                        <p style={{ color: '#15803d', fontWeight: 600, fontSize: '1.1rem', margin: 0 }}>We've received your payment and notified the provider.</p>
                    </div>

                    <div style={{ padding: '40px' }}>
                        <div style={{ background: '#f8fafc', borderRadius: '20px', padding: '30px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
                                <div>
                                    <h3 style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Service Provider</h3>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0E2679' }}>{booking.service_providers?.business_name}</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <h3 style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Total Amount Paid</h3>
                                    <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0E2679' }}>₱{parseFloat(booking.total_estimated_price).toFixed(2)}</span>
                                    <p style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 800, margin: 0 }}>VAT INCLUSIVE</p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px' }}>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <Calendar style={{ color: '#0E2679', width: 20 }} />
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800 }}>DATE & DAY</span>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>{date} ({day})</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <Clock style={{ color: '#0E2679', width: 20 }} />
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800 }}>TIMESLOT</span>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>{formatTime(booking.time_slot)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pet Details */}
                        <div style={{ marginBottom: '30px' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#475569', marginBottom: '15px' }}>PET & SERVICE DETAILS</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {booking.booking_pets?.map((pet, idx) => (
                                    <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 800, color: '#0E2679' }}>{pet.pet_name}</span>
                                            <div style={{ textAlign: 'right' }}>
                                                {pet.booking_services?.map((s, sIdx) => (
                                                    <span key={sIdx} style={{ fontSize: '0.85rem', color: '#64748b', display: 'block' }}>{s.service_name}</span>
                                                ))}
                                            </div>
                                        </div>
                                        {pet.selected_haircut && (
                                            <div style={{ marginTop: '10px', padding: '10px', background: '#f0f4ff', borderRadius: '8px', borderLeft: '4px solid #0E2679' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0E2679', display: 'block' }}>HAIRCUT: {pet.selected_haircut}</span>
                                                <p style={{ fontSize: '0.8rem', color: '#475569', margin: '4px 0 0', fontStyle: 'italic' }}>"{pet.grooming_specifications}"</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <button onClick={() => navigate("/dashboard")} style={{ background: '#f1f5f9', color: '#475569', fontWeight: 700, padding: '16px', borderRadius: '14px', border: 'none', cursor: 'pointer' }}>Back to Home</button>
                            <button onClick={() => navigate("/appointments")} style={{ background: '#0E2679', color: 'white', fontWeight: 700, padding: '16px', borderRadius: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                <CalendarCheck size={20} /> View Appointments
                            </button>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default BookingSuccess;