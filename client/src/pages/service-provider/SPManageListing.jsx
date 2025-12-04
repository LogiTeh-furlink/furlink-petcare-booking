import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { Edit3, FileText, ExternalLink, X, Clock, User, CheckCircle } from "lucide-react";
import "./SPManageListing.css";

// --- FILE PREVIEW MODAL ---
const FilePreviewModal = ({ isOpen, onClose, fileUrl, fileType }) => {
  if (!isOpen || !fileUrl) return null;

  const isImage = fileType === 'image' || fileUrl.match(/\.(jpeg|jpg|gif|png)$/) != null;
  const isPdf = fileType === 'pdf' || fileUrl.match(/\.pdf$/) != null;
  const isDoc = !isImage && !isPdf; 

  return (
    <div className="file-modal-overlay" onClick={onClose}>
      <div className="file-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="file-modal-close" onClick={onClose}><X size={24} /></button>
        
        <div className="file-viewer-body">
          {isImage && <img src={fileUrl} alt="Preview" className="modal-img-preview" />}
          
          {isPdf && (
            <object data={fileUrl} type="application/pdf" width="100%" height="100%">
              <iframe src={fileUrl} title="PDF Preview" width="100%" height="100%">
                <p>This browser does not support PDFs. <a href={fileUrl}>Download the PDF</a>.</p>
              </iframe>
            </object>
          )}

          {isDoc && (
            <iframe 
              src={`https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`} 
              width="100%" 
              height="100%" 
              frameBorder="0"
              title="Doc Preview"
            />
          )}
        </div>
        
        <div className="file-modal-footer">
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn-download-link">
                Open Original / Download
            </a>
        </div>
      </div>
    </div>
  );
};

export default function SPManageListing() {
  const navigate = useNavigate();
  
  // Data States
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [hours, setHours] = useState([]);
  const [files, setFiles] = useState({ images: [], payments: [], permits: [] });
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // Preview Modal State
  const [previewFile, setPreviewFile] = useState(null); // { url, type }

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/login");

        // 1. Get Provider Info
        const { data: providerData } = await supabase
          .from("service_providers")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (providerData) {
          setProvider(providerData);
          const providerId = providerData.id;

          // 2. Fetch Services
          const { data: serviceData } = await supabase
            .from("services")
            .select(`*, service_options (*)`)
            .eq("provider_id", providerId);
          setServices(serviceData || []);

          // 3. Fetch Hours
          const { data: hoursData } = await supabase.from("service_provider_hours").select("*").eq("provider_id", providerId);
          setHours(hoursData || []);

          // 4. Fetch Files
          const { data: imgData } = await supabase.from("service_provider_images").select("*").eq("provider_id", providerId);
          const { data: payData } = await supabase.from("service_provider_payments").select("*").eq("provider_id", providerId);
          const { data: permData } = await supabase.from("service_provider_permits").select("*").eq("provider_id", providerId);
          
          setFiles({ images: imgData || [], payments: payData || [], permits: permData || [] });

          // 5. Fetch Staff
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

  const handlePreview = (url, type = 'doc') => {
    setPreviewFile({ url, type });
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
        
        {/* Header */}
        <div className="manage-header">
          <h1>{provider.business_name}</h1>
          <p>Review your current business information below.</p>
        </div>

        {/* ===================================================
            SECTION 1: BUSINESS INFORMATION
           =================================================== */}
        <section className="manage-card business-info-section">
          <div className="card-header">
            <h2>Business Information</h2>
            <button 
                className="btn-edit-header" 
                onClick={() => navigate("/service/edit-profile")}
                title="Edit Information"
            >
                <Edit3 size={18} /> Edit Information
            </button>
          </div>

          <div className="info-grid">
            {/* Basic Info */}
            <div className="info-group">
                <label>Contact Details</label>
                <p><strong>Email:</strong> {provider.business_email}</p>
                <p><strong>Mobile:</strong> {provider.business_mobile}</p>
                <p><strong>Service Type:</strong> {provider.type_of_service}</p>
                {provider.social_media_url && (
                    <p><strong>Social:</strong> <a href={provider.social_media_url} target="_blank" rel="noreferrer" className="link-text">{provider.social_media_url}</a></p>
                )}
                <p><strong>Description:</strong> {provider.description}</p>
            </div>

            {/* Address */}
            <div className="info-group">
                <label>Business Address</label>
                <p>{provider.house_street}</p>
                <p>{provider.barangay}, {provider.city}</p>
                <p>{provider.province}, {provider.postal_code}</p>
                <p>{provider.country}</p>
            </div>

            {/* Operating Hours */}
            <div className="info-group wide-group">
                <label>Operating Hours</label>
                {hours.length > 0 ? (
                    <div className="hours-grid-display">
                        {daysOrder.map(day => {
                            const dayHours = hours.filter(h => h.day_of_week === day);
                            const isOpen = dayHours.length > 0;
                            return (
                                <div key={day} className={`day-card ${isOpen ? 'open' : 'closed'}`}>
                                    <div className="day-card-header">
                                        <Clock size={14} />
                                        <span>{day}</span>
                                    </div>
                                    <div className="day-card-body">
                                        {isOpen ? (
                                            dayHours.map((h, i) => (
                                                <div key={i} className="time-pill">
                                                    {formatTime(h.start_time)} - {formatTime(h.end_time)}
                                                </div>
                                            ))
                                        ) : <span className="closed-text">Closed</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : <p className="text-muted">No hours set.</p>}
            </div>

            {/* Staff */}
            <div className="info-group wide-group">
                <label>Employees</label>
                {staff.length > 0 ? (
                    <div className="staff-grid-display">
                        {staff.map(s => (
                            <div key={s.id} className="staff-card">
                                <div className="staff-avatar">
                                    <User size={20} />
                                </div>
                                <div className="staff-details">
                                    <strong>{s.full_name}</strong>
                                    <span>{s.job_title}</span>
                                </div>
                                <CheckCircle size={16} className="verified-badge" title="Registered" />
                            </div>
                        ))}
                    </div>
                ) : <p className="text-muted">No staff listed.</p>}
            </div>
          </div>

          {/* Files & Images Gallery */}
          <div className="files-section">
            <label className="section-label">Documents & Uploads</label>
            
            <div className="files-grid">
                {/* Permits */}
                {files.permits.map(f => (
                    <div key={f.id} className="file-chip permit" onClick={() => handlePreview(f.file_url, 'doc')}>
                        <FileText size={16} /> Business Permit
                    </div>
                ))}
                {/* Waivers */}
                {provider.waiver_url && (
                    <div className="file-chip waiver" onClick={() => handlePreview(provider.waiver_url, 'doc')}>
                        <FileText size={16} /> Waiver Form
                    </div>
                )}
                {/* Removed Payment from here to move it to image gallery below */}
            </div>

            {/* Payment QR Gallery - Moved here to show as images */}
            {files.payments.length > 0 && (
                <div className="image-gallery" style={{ marginTop: '20px' }}>
                    <label className="sub-label">Payment QR Codes</label>
                    <div className="gallery-row">
                        {files.payments.map(img => (
                            <div key={img.id} className="gallery-item" onClick={() => handlePreview(img.file_url, 'image')}>
                                <img src={img.file_url} alt="Payment QR" />
                                <div className="gallery-overlay"><ExternalLink size={16}/></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Facility Images Gallery */}
            {files.images.length > 0 && (
                <div className="image-gallery">
                    <label className="sub-label">Facility Images</label>
                    <div className="gallery-row">
                        {files.images.map(img => (
                            <div key={img.id} className="gallery-item" onClick={() => handlePreview(img.image_url, 'image')}>
                                <img src={img.image_url} alt="Facility" />
                                <div className="gallery-overlay"><ExternalLink size={16}/></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>
        </section>

        {/* ===================================================
            SECTION 2: SERVICE LISTINGS
           =================================================== */}
        <section className="manage-card service-list-section">
          <div className="card-header">
            <h2>Service Listings</h2>
            <button 
                className="btn-edit-header" 
                onClick={() => navigate("/service/edit-listing")}
                title="Edit Listings"
            >
                <Edit3 size={18} /> Edit Listings
            </button>
          </div>

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

      </div>
      
      {/* File Preview Modal */}
      <FilePreviewModal 
        isOpen={!!previewFile} 
        onClose={() => setPreviewFile(null)} 
        fileUrl={previewFile?.url}
        fileType={previewFile?.type}
      />

      <Footer />
    </>
  );
}