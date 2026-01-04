// src/pages/service-provider/SPManageListing.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { 
  Edit3, FileText, X, Clock, User, CheckCircle, 
  Download, Search, Globe, MapPin // Changed Facebook to Globe
} from "lucide-react";
import "./SPManageListing.css";

// --- FILE PREVIEW MODAL ---
const FilePreviewModal = ({ isOpen, onClose, fileUrl }) => {
  if (!isOpen || !fileUrl) return null;

  return (
    <div className="file-modal-overlay" onClick={onClose}>
      <div className="file-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="file-viewer-body">
          <img src={fileUrl} alt="Preview" className="modal-img-preview" />
        </div>
        <div className="file-modal-footer">
        </div>
      </div>
    </div>
  );
};

export default function SPManageListing() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [hours, setHours] = useState([]);
  const [files, setFiles] = useState({ images: [], payments: [], permits: [] });
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/login");

        const { data: providerData } = await supabase
          .from("service_providers")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (providerData) {
          setProvider(providerData);
          const providerId = providerData.id;

          const { data: serviceData } = await supabase
            .from("services")
            .select(`*, service_options (*)`)
            .eq("provider_id", providerId);
          setServices(serviceData || []);

          const { data: hoursData } = await supabase.from("service_provider_hours").select("*").eq("provider_id", providerId);
          setHours(hoursData || []);

          const { data: imgData } = await supabase.from("service_provider_images").select("*").eq("provider_id", providerId);
          const { data: payData } = await supabase.from("service_provider_payments").select("*").eq("provider_id", providerId);
          const { data: permData } = await supabase.from("service_provider_permits").select("*").eq("provider_id", providerId);
          
          setFiles({ images: imgData || [], payments: payData || [], permits: permData || [] });

          const { data: staffData } = await supabase.from("service_provider_staff").select("*").eq("provider_id", providerId);
          setStaff(staffData || []);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  const handleFileAction = (url, type = 'doc', fileName = 'document') => {
    if (type === 'doc') {
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      setPreviewFile({ url });
    }
  };

  const formatTime = (time) => {
    if (!time) return "";
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { 
      hour: 'numeric', minute: '2-digit', hour12: true 
    });
  };

  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  if (loading) return <div className="sp-loading">Loading Listing...</div>;
  if (!provider) return <div className="sp-loading">No provider record found.</div>;

  return (
    <>
      <LoggedInNavbar />
      <div className="sp-manage-container">
        <div className="manage-header">
          <h1>{provider.business_name}</h1>
          <p>Review your current business information below.</p>
        </div>

        <section className="manage-card business-info-section">
          <div className="card-header">
            <h2>Business Information</h2>
            <button className="btn-edit-header" onClick={() => navigate("/service/edit-profile")}>
                <Edit3 size={18} /> Edit Information
            </button>
          </div>

          <div className="info-grid">
            <div className="info-group">
                <label>Contact Details</label>
                <p><strong>Business Name:</strong> {provider.business_name}</p>
                <p><strong>Email:</strong> {provider.business_email}</p>
                <p><strong>Mobile:</strong> {provider.business_mobile}</p>
                <p><strong>Service:</strong> {provider.type_of_service}</p>
                <div className="icon-links-row">
                  {provider.social_media_url && (
                    <a href={provider.social_media_url} target="_blank" rel="noreferrer" className="branded-icon-link" title="Website/Socials">
                      <Globe size={20} /> <span>Social Media</span>
                    </a>
                  )}
                  {provider.google_map_url && (
                    <a href={provider.google_map_url} target="_blank" rel="noreferrer" className="branded-icon-link" title="Google Maps">
                      <MapPin size={20} /> <span>Location</span>
                    </a>
                  )}
                </div>
            </div>

            <div className="info-group">
                <label>Business Address</label>
                <p><strong>Street:</strong> {provider.house_street}</p>
                <p><strong>Barangay/City:</strong> {provider.barangay}, {provider.city}</p>
                <p><strong>Province:</strong> {provider.province}</p>
                <p><strong>Postal Code:</strong> {provider.postal_code}</p>
            </div>

            <div className="info-group wide-group">
                <label>Operating Hours</label>
                <div className="hours-grid-display">
                    {daysOrder.map(day => {
                        const dayHours = hours.filter(h => h.day_of_week === day);
                        const isOpen = dayHours.length > 0;
                        return (
                            <div key={day} className={`day-card ${isOpen ? 'open' : 'closed'}`}>
                                <div className="day-card-header"><Clock size={14} /> <span>{day}</span></div>
                                <div className="day-card-body">
                                    {isOpen ? dayHours.map((h, i) => (
                                        <div key={i} className="time-pill">{formatTime(h.start_time)} - {formatTime(h.end_time)}</div>
                                    )) : <span className="closed-text">Closed</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
          </div>

          <div className="files-section">
            <label className="sub-label"><strong>Business Documents</strong></label>
            <div className="files-grid">
                {files.permits.map(f => (
                    <div key={f.id} className="file-chip permit" onClick={() => handleFileAction(f.file_url, 'doc', 'Permit')}>
                        <Download size={16} /> Business Permit
                    </div>
                ))}
                {provider.waiver_url && (
                    <div className="file-chip waiver" onClick={() => handleFileAction(provider.waiver_url, 'doc', 'Waiver')}>
                        <Download size={16} /> Waiver Form
                    </div>
                )}
            </div>

            <div className="image-gallery-section">
                <label className="sub-label"><strong>Payment QRs</strong></label>
                <div className="gallery-row">
                    {files.payments.map(img => (
                        <div key={img.id} className="gallery-item" onClick={() => handleFileAction(img.file_url, 'image')}>
                            <img src={img.file_url} alt="QR" />
                            <div className="gallery-overlay"><Search size={16}/></div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="image-gallery-section">
                <label className="sub-label"><strong>Facility Gallery</strong></label>
                <div className="gallery-row">
                    {files.images.map(img => (
                        <div key={img.id} className="gallery-item" onClick={() => handleFileAction(img.image_url, 'image')}>
                            <img src={img.image_url} alt="Facility" />
                            <div className="gallery-overlay"><Search size={16}/></div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </section>

        <section className="manage-card service-list-section">
          <div className="card-header">
            <h2>Service Listings</h2>
            <button className="btn-edit-header" onClick={() => navigate("/service/edit-listing")}>
                <Edit3 size={18} /> Edit Listings
            </button>
          </div>
          <div className="services-list-view">
            {services.map(service => (
                <div key={service.id} className="service-view-item">
                    <div className="service-view-header">
                      <h3>{service.name}</h3>
                      <span className={`service-type-tag ${service.type}`}>
                        {service.type === 'package' ? 'Package' : 'Individual'}
                      </span>
                    </div>
                    <p className="service-desc">{service.description}</p>
                    {service.notes && (
                        <p className="service-note"><strong>Notes:</strong> {service.notes}</p>
                    )}
                    
                    <div className="pricing-wrapper full-width">
                        <table className="mini-pricing-table full-space">
                            <thead>
                              <tr>
                                <th>Pet Type</th>
                                <th>Size</th>
                                <th>Weight Range</th>
                                <th>Price</th>
                              </tr>
                            </thead>
                            <tbody>
                                {service.service_options?.map(opt => (
                                    <tr key={opt.id}>
                                        <td className="pet-type-col">
                                          {opt.pet_type === 'dog-cat' ? 'Dog and Cat' : 
                                           opt.pet_type === 'dog' ? 'Dog' : 
                                           opt.pet_type === 'cat' ? 'Cat' : opt.pet_type}
                                        </td>
                                        <td className="size-col">
                                          {opt.size.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                        </td>
                                        <td>{opt.weight_range || 'N/A'} kg</td>
                                        <td className="price-col">₱{parseFloat(opt.price).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
          </div>
        </section>
      </div>
      
      <FilePreviewModal isOpen={!!previewFile} onClose={() => setPreviewFile(null)} fileUrl={previewFile?.url} />
      <Footer />
    </>
  );
}