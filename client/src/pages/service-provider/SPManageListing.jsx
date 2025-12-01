import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { ArrowLeft, Edit3 } from "lucide-react";
import "./SPManageListing.css";

export default function SPManageListing() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Get Provider ID first
        const { data: providerData } = await supabase
          .from("service_providers")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (providerData) {
          // 2. Get Services & Options
          const { data: serviceData } = await supabase
            .from("services")
            .select(`*, service_options (*)`)
            .eq("provider_id", providerData.id);
          
          setServices(serviceData || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="sp-loading">Loading Listing...</div>;

  return (
    <>
      <LoggedInNavbar />
      <div className="sp-manage-container">
        
        <div className="manage-header">
          <h1>My Service Listings</h1>
          <p>Review your current service catalog below.</p>
        </div>

        {/* Services List */}
        <section className="manage-card">
          <div className="services-list-view">
            {services.length === 0 ? (
                <div className="empty-state">No services found. Click edit to add some!</div>
            ) : (
                services.map(service => (
                <div key={service.id} className="service-view-item">
                    <div className="service-view-header">
                    <h3>{service.name}</h3>
                    <span className={`service-type-tag ${service.type}`}>
                        {service.type === 'package' ? 'Package' : 'Individual'}
                    </span>
                    </div>
                    
                    <p className="service-desc">
                        <strong>Description:</strong> {service.description || "N/A"}
                    </p>
                    {service.notes && (
                        <p className="service-note">
                            <strong>Note:</strong> {service.notes}
                        </p>
                    )}
                    
                    <div className="pricing-wrapper">
                        <table className="mini-pricing-table">
                        <thead>
                            <tr>
                                <th>Pet Type</th>
                                <th>Size</th>
                                <th>Weight</th>
                                <th>Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            {service.service_options?.map(opt => (
                            <tr key={opt.id}>
                                <td style={{textTransform: 'capitalize'}}>
                                    {opt.pet_type === 'dog-cat' ? 'Dog & Cat' : opt.pet_type}
                                </td>
                                <td>{opt.size.replace('_', ' ')}</td>
                                <td>{opt.weight_range || 'N/A'}</td>
                                <td className="price-col">₱{opt.price}</td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                </div>
                ))
            )}
          </div>
        </section>

        {/* Edit Button - Bottom Right */}
        <div className="edit-action-container">
            <button 
                className="btn-edit-listing" 
                onClick={() => navigate("/service/edit-listing")}
            >
                <Edit3 size={18} /> Edit Listings
            </button>
        </div>

      </div>
      <Footer />
    </>
  );
}