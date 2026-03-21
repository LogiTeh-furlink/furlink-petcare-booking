import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { CheckCircle, Clock, Calendar, Info, ArrowRight, Loader2 } from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";

const BookingSuccess = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const MAX_RETRIES = 10; // Poll every 2s for up to 20 seconds

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

            // Poll Supabase directly — the webhook will insert the booking within seconds of payment.
            // We simply wait for it to appear rather than verifying with PayMongo.
            const { data, error } = await supabase
                .from("bookings")
                .select(`
                    *,
                    service_providers:provider_id ( company_name, profile_image_url ),
                    booking_pets (
                        pet_name,
                        selected_haircut,
                        booking_services ( service_name, price )
                    )
                `)
                .eq("user_id", user.id)
                .eq("status", "for approval")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) console.error("Polling error:", error.message);

            if (data) {
                setBooking(data);
                setLoading(false);
            } else if (retryCount < MAX_RETRIES) {
                // Webhook hasn't finished inserting yet — try again in 2 seconds
                setTimeout(() => setRetryCount(prev => prev + 1), 2000);
            } else {
                // Webhook took too long — show fallback UI
                setLoading(false);
            }
        };

        fetchLatestBooking();
    }, [isPaid, retryCount, navigate]);

    const formatDate = (dateStr) => {
        if (!dateStr) return "N/A";
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric'
        });
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return "N/A";
        const [hours, minutes] = timeStr.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        return `${h % 12 || 12}:${minutes} ${ampm}`;
    };

    // Spinner shown while polling for the booking record
    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', gap: '16px' }}>
                <Loader2 style={{ width: 48, height: 48, color: '#2563eb', animation: 'spin 1s linear infinite' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Finalizing your booking...</h2>
                <p style={{ color: '#64748b', margin: 0, textAlign: 'center', maxWidth: 360 }}>
                    Your payment was received. We're saving your booking — this takes just a few seconds.
                </p>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // Fallback — webhook took too long (rare), direct to booking history
    if (!booking) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
                <CheckCircle style={{ width: 64, height: 64, color: '#16a34a', marginBottom: 16 }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Payment Received!</h2>
                <p style={{ color: '#475569', maxWidth: 420, marginBottom: 24 }}>
                    Your payment was processed successfully. Your booking record is being saved — please check your Booking History in a moment.
                </p>
                <button
                    onClick={() => navigate("/booking-history")}
                    style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}
                >
                    Go to Booking History
                </button>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
            <Header />
            <main style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 16px 48px' }}>
                <div style={{ background: 'white', maxWidth: 640, width: '100%', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden', border: '1px solid #f1f5f9' }}>

                    {/* Success Banner */}
                    <div style={{ background: '#f0fdf4', padding: '40px 32px', textAlign: 'center', borderBottom: '1px solid #dcfce7' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, background: '#dcfce7', borderRadius: '50%', marginBottom: 16 }}>
                            <CheckCircle style={{ width: 40, height: 40, color: '#16a34a' }} />
                        </div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Payment Successful!</h1>
                        <p style={{ color: '#15803d', fontWeight: 500, margin: 0 }}>Your booking request has been sent to the service provider.</p>
                    </div>

                    <div style={{ padding: '32px' }}>

                        {/* Provider Info + Status Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <img
                                    src={booking.service_providers?.profile_image_url || "/default-sp.png"}
                                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }}
                                    alt="Provider"
                                />
                                <div>
                                    <p style={{ fontWeight: 700, color: '#1e293b', margin: 0 }}>{booking.service_providers?.company_name}</p>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Service Provider</p>
                                </div>
                            </div>
                            <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '4px 12px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                For Approval
                            </span>
                        </div>

                        {/* Date, Time & Total Paid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32, background: '#f8fafc', padding: 24, borderRadius: 12, border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <Calendar style={{ width: 20, height: 20, color: '#2563eb', marginTop: 2 }} />
                                <div>
                                    <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 4px' }}>Date & Time</p>
                                    <p style={{ fontWeight: 600, color: '#1e293b', margin: '0 0 2px' }}>{formatDate(booking.booking_date)}</p>
                                    <p style={{ color: '#475569', margin: 0 }}>{formatTime(booking.time_slot)}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <Clock style={{ width: 20, height: 20, color: '#2563eb', marginTop: 2 }} />
                                <div>
                                    <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 4px' }}>Total Paid</p>
                                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#2563eb', margin: 0 }}>
                                        ₱{parseFloat(booking.total_estimated_price).toFixed(2)}
                                    </p>
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Full Payment (VAT Inclusive)</p>
                                </div>
                            </div>
                        </div>

                        {/* Pet & Service Summary */}
                        <div style={{ marginBottom: 32 }}>
                            <h4 style={{ fontWeight: 700, color: '#374151', borderBottom: '1px solid #f1f5f9', paddingBottom: 8, marginBottom: 12 }}>Booking Summary</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {booking.booking_pets?.map((pet, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                                        <div>
                                            <p style={{ fontWeight: 700, color: '#1e293b', margin: '0 0 2px' }}>{pet.pet_name}</p>
                                            {pet.selected_haircut && (
                                                <p style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', margin: 0 }}>{pet.selected_haircut}</p>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            {pet.booking_services?.map((s, sIdx) => (
                                                <p key={sIdx} style={{ fontSize: '0.8rem', color: '#475569', margin: 0 }}>{s.service_name}</p>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Refund policy notice */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px', background: '#eff6ff', borderRadius: 10, color: '#1d4ed8', fontSize: '0.85rem', marginBottom: 32 }}>
                            <Info style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1 }} />
                            <p style={{ margin: 0 }}>
                                The provider will review your booking shortly. If your booking is <strong>declined</strong>, your full payment will be refunded automatically. You'll be notified once the provider responds.
                            </p>
                        </div>

                        <button
                            onClick={() => navigate("/dashboard")}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#0f172a', color: 'white', fontWeight: 700, padding: '16px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                        >
                            Return to Dashboard <ArrowRight style={{ width: 18, height: 18 }} />
                        </button>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default BookingSuccess;