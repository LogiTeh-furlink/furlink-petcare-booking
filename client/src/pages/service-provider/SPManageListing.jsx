import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { ArrowLeft, Edit3 } from "lucide-react";
import "./SPManageListing.css";

export default function SPManageListing() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Get Provider Info
        const { data: providerData } = await supabase
          .from("service_providers")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (providerData) {
          setProvider(providerData);

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
        
        <button className="back-link" onClick={() => navigate("/service/dashboard")}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div className="manage-header">
          <h1>Manage Listing</h1>
          <p>View and update your public business details.</p>
        </div>

        {/* 1. Business Details Card */}
        <section className="manage-card">
          <div className="card-header">
            <h2>Business Information</h2>
            {/* In future: onClick={() => setShowEditModal(true)} */}
            <button className="edit-icon-btn" title="Edit Info"><Edit3 size={18} /></button>
          </div>
          <div className="details-grid">
            <div className="detail-item">
              <label>Business Name</label>
              <span>{provider.business_name}</span>
            </div>
            <div className="detail-item">
              <label>Service Type</label>
              <span>{provider.type_of_service}</span>
            </div>
            <div className="detail-item">
              <label>Contact Email</label>
              <span>{provider.business_email}</span>
            </div>
            <div className="detail-item">
              <label>Contact Mobile</label>
              <span>{provider.business_mobile}</span>
            </div>
            <div className="detail-item full-width">
              <label>Address</label>
              <span>
                {provider.house_street}, {provider.barangay}, {provider.city}, {provider.province} {provider.postal_code}
              </span>
            </div>
          </div>
        </section>

        {/* 2. Services List */}
        <section className="manage-card">
          <div className="card-header">
            <h2>My Services</h2>
            <button className="edit-icon-btn" title="Edit Services"><Edit3 size={18} /></button>
          </div>
          
          <div className="services-list-view">
            {services.map(service => (
              <div key={service.id} className="service-view-item">
                <div className="service-view-header">
                  <h3>{service.name}</h3>
                  <span className="service-type-tag">{service.type}</span>
                </div>
                <p className="service-desc">{service.description || "No description provided."}</p>
                
                <table className="mini-pricing-table">
                  <thead>
                    <tr><th>Variant</th><th>Size</th><th>Price</th></tr>
                  </thead>
                  <tbody>
                    {service.service_options?.map(opt => (
                      <tr key={opt.id}>
                        <td>{opt.pet_type}</td>
                        <td>{opt.size}</td>
                        <td>₱{opt.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>

      </div>
      <Footer />
    </>
  );
}