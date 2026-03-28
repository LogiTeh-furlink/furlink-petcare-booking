import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { XCircle, ArrowLeft, RefreshCw, AlertTriangle } from "lucide-react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";

const BookingFailed = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isCancelled = searchParams.get("status") === "cancelled";

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Header />
            <main className="flex-grow flex items-center justify-center p-4 pt-24 pb-12">
                <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-8 text-center border border-red-50">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                        {isCancelled ? (
                            <AlertTriangle className="w-12 h-12 text-red-600" />
                        ) : (
                            <XCircle className="w-12 h-12 text-red-600" />
                        )}
                    </div>

                    <h1 className="text-2xl font-black text-gray-900 mb-2">
                        {isCancelled ? "Booking Cancelled" : "Payment Failed"}
                    </h1>
                    
                    <p className="text-gray-600 mb-8">
                        {isCancelled 
                            ? "You've cancelled the payment process. No charges were made to your account." 
                            : "We couldn't process your payment. Please check your balance or try a different payment method."}
                    </p>

                    <div className="space-y-3">
                        <button 
                            onClick={() => navigate(-1)}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors"
                        >
                            <RefreshCw size={18} /> Try Booking Again
                        </button>
                        
                        <button 
                            onClick={() => navigate("/dashboard")}
                            className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            <ArrowLeft size={18} /> Back to Home
                        </button>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default BookingFailed;