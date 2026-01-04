// src/pages/admin/AdminViewProvider.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInAdmin from "../../components/Header/LoggedInAdmin";
import { 
  FaArrowLeft, FaCheckCircle, FaTimesCircle, FaStore, FaClock, 
  FaUsers, FaFilePdf, FaImage, FaDownload, FaTimes, FaMoneyCheckAlt, 
  FaSearchPlus, FaGlobe, FaMapMarkedAlt, FaListUl 
} from "react-icons/fa";
import "./AdminViewProvider.css";

/* --- MODAL FOR PREVIEWABLE CONTENT (QR & GALLERY ONLY) --- */
const FileModal = ({ content, onClose }) => {
  if (!content) return null;
  return (
    <div className="admin-file-modal-overlay" onClick={onClose}>
      <div className="admin-file-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-view-header">
          <div className="header-left">
            <FaImage className="type-icon img" />
            <span>{content.title}</span>
          </div>
          <button className="close-modal-btn" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="modal-view-body">
          <img 
            src={content.url} 
            alt={content.title} 
            className="modal-main-img" 
          />
        </div>
      </div>
    </div>
  );
};

export default function AdminViewProvider() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [hours, setHours] = useState([]);
  const [images, setImages] = useState([]);
  const [payments, setPayments] = useState([]);
  const [permits, setPermits] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalContent, setModalContent] = useState(null);
  const [action, setAction] = useState(null);
  const [rejectReasons, setRejectReasons] = useState({ incomplete: false, unverifiable: false, inappropriate: false });
  const [saving, setSaving] = useState(false);

  const reasonMapping = {
    incomplete: 'Incomplete Information',
    unverifiable: 'Information Cannot Be Verified',
    inappropriate: 'Uploaded Files Are Invalid or Inappropriate',
  };

  useEffect(() => { fetchAllData(); }, [id]);

  const fetchAllData = async () => {
    try {
      const { data: providerData } = await supabase.from("service_providers").select("*").eq("id", id).single();
      setProvider(providerData);

      const { data: servicesData } = await supabase.from("services").select(`*, service_options (*)`).eq("provider_id", id);
      setServices(servicesData || []);

      const { data: hoursData } = await supabase.from("service_provider_hours").select("*").eq("provider_id", id);
      setHours(hoursData || []);

      const { data: imagesData } = await supabase.from("service_provider_images").select("id, image_url").eq("provider_id", id);
      setImages(imagesData || []);

      const { data: paymentsData } = await supabase.from("service_provider_payments").select("id, method_type, file_url").eq("provider_id", id);
      setPayments(paymentsData || []);

      const { data: permitsData } = await supabase.from("service_provider_permits").select("id, permit_type, file_url").eq("provider_id", id);
      setPermits(permitsData || []);

      const { data: staffData } = await supabase.from("service_provider_staff").select("*").eq("provider_id", id);
      setStaff(staffData || []);
    } finally { setLoading(false); }
  };

  const handleDownload = (url, title) => {
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", title);
    link.setAttribute("target", "_blank");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveStatus = async () => {
    if (!action) return alert("Select Action first.");
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const updates = {
        status: action === "approve" ? "approved" : "rejected",
        updated_at: new Date().toISOString(),
      };
      if (action === "approve") {
        updates.approved_by = user.id;
        updates.approved_at = new Date().toISOString();
      } else {
        updates.rejection_reasons = Object.keys(rejectReasons).filter(k => rejectReasons[k]).map(k => reasonMapping[k]);
      }
      const { error } = await supabase.from("service_providers").update(updates).eq("id", id);
      if (error) throw error;
      navigate("/admin-dashboard");
    } catch (error) { alert(error.message); } finally { setSaving(false); }
  };

  const formatTime = (time) => {
    if (!time) return "Closed";
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="loading-screen">Loading Provider Details...</div>;

  return (
    <>
      <LoggedInAdmin />
      <div className="admin-view-provider-container">
        <button className="btn-back-nav" onClick={() => navigate(-1)}><FaArrowLeft /> Dashboard</button>

        <div className="provider-header-main">
            <h1>{provider?.business_name}</h1>
            <span className={`badge-status ${provider?.status}`}>{provider?.status}</span>
        </div>

        <div className="view-grid">
          <div className="view-column">
            {/* BUSINESS INFORMATION */}
            <section className="provider-card">
              <h2><FaStore /> Business Information</h2>
              <div className="info-item"><strong>Business Name:</strong> {provider?.business_name}</div>
              <div className="info-item"><strong>Email:</strong> {provider?.business_email}</div>
              <div className="info-item"><strong>Mobile:</strong> {provider?.business_mobile}</div>
              <div className="info-item"><strong>Address:</strong> {`${provider?.house_street}, ${provider?.barangay}, ${provider?.city}, ${provider?.province}, ${provider?.postal_code}`}</div>
              
              {provider?.social_media_url && (
                <div className="info-item">
                  <strong>Social Media:</strong> 
                  <a href={provider.social_media_url} target="_blank" rel="noopener noreferrer" className="link-text">
                    <FaGlobe /> View Social Page
                  </a>
                </div>
              )}

              {provider?.google_map_url && (
                <div className="info-item">
                  <strong>Google Maps:</strong> 
                  <a href={provider.google_map_url} target="_blank" rel="noopener noreferrer" className="link-text">
                    <FaMapMarkedAlt /> View Location
                  </a>
                </div>
              )}
            </section>

            {/* OPERATING HOURS */}
            <section className="provider-card">
              <h2><FaClock /> Operating Hours</h2>
              <div className="hours-grid-display">
                {hours.length > 0 ? (
                  hours.map((h) => (
                    <div key={h.id} className="hour-row">
                      <span className="day-label">{h.day_of_week}:</span>
                      <span className="time-label">{formatTime(h.start_time)} - {formatTime(h.end_time)}</span>
                    </div>
                  ))
                ) : <p className="no-data">No operating hours set.</p>}
              </div>
            </section>

            {/* STAFF MEMBERS */}
            <section className="provider-card">
                <h2><FaUsers /> Staff Members</h2>
                <div className="staff-list">
                    {staff.length > 0 ? staff.map((s, i) => (
                        <p key={i}>• {s.full_name} <em>({s.job_title})</em></p>
                    )) : <p className="no-data">No staff listed.</p>}
                </div>
            </section>

            {/* DOCUMENTS */}
            <section className="provider-card">
              <h2><FaDownload /> Documents</h2>
              {provider?.waiver_url && (
                <div className="file-review-card download-mode" onClick={() => handleDownload(provider.waiver_url, "Business_Waiver")}>
                  <div className="file-card-icon"><FaFilePdf /></div>
                  <div className="file-card-info">
                    <span className="file-card-title">Business Waiver</span>
                    <span className="file-card-action">Click to download waiver</span>
                  </div>
                  <FaDownload className="action-icon" />
                </div>
              )}

              {permits.map(p => (
                <div key={p.id} className="file-review-card download-mode" onClick={() => handleDownload(p.file_url, p.permit_type)}>
                   <div className="file-card-icon"><FaFilePdf /></div>
                   <div className="file-card-info">
                     <span className="file-card-title">{p.permit_type}</span>
                     <span className="file-card-action">Click to download permit</span>
                   </div>
                   <FaDownload className="action-icon" />
                </div>
              ))}
            </section>
          </div>

          <div className="view-column">
             {/* PAYMENT QR */}
             <section className="provider-card">
                <h2><FaMoneyCheckAlt /> Payment QR</h2>
                {payments.map(pay => (
                  <div key={pay.id} className="file-review-card preview-mode" onClick={() => setModalContent({ url: pay.file_url, title: pay.method_type })}>
                    <div className="file-card-icon"><FaImage /></div>
                    <div className="file-card-info">
                      <span className="file-card-title">{pay.method_type}</span>
                      <span className="file-card-action">Click to preview QR</span>
                    </div>
                    <FaSearchPlus className="action-icon" />
                  </div>
                ))}
             </section>

             {/* FACILITY GALLERY */}
             <section className="provider-card">
                <h2><FaImage /> Facility Gallery</h2>
                <div className="facility-grid">
                    {images.map(img => (
                        <div key={img.id} className="gallery-item" onClick={() => setModalContent({ url: img.image_url, title: "Facility Image" })}>
                            <img src={img.image_url} alt="Facility" />
                            <div className="overlay"><FaSearchPlus /></div>
                        </div>
                    ))}
                </div>
             </section>

             {/* SERVICES LISTING */}
             <section className="provider-card">
                <h2><FaListUl /> Services Listing</h2>
                <div className="services-container">
                    {services.length > 0 ? services.map((service) => (
                        <div key={service.id} className="service-details-box">
                            <div className="service-header-row">
                                <h3>{service.name}</h3>
                                <span className="service-type-badge">{service.type}</span>
                            </div>
                            <p className="service-desc">{service.description}</p>
                            {service.notes && <p className="service-notes"><strong>Notes:</strong> {service.notes}</p>}
                            
                            <table className="admin-service-table">
                                <thead>
                                    <tr>
                                        <th>Pet Type</th>
                                        <th>Size</th>
                                        <th>Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {service.service_options?.map((opt) => (
                                        <tr key={opt.id}>
                                            <td>{opt.pet_type}</td>
                                            <td>{opt.size} {opt.weight_range && `(${opt.weight_range})`}</td>
                                            <td>₱{opt.price}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )) : <p className="no-data">No services listed.</p>}
                </div>
             </section>
          </div>
        </div>

        {/* ACTION SECTION */}
        {provider?.status === 'pending' && (
          <div className="approval-action-box">
            <h2>Take Action</h2>
            <div className="decision-buttons">
              <button className={`btn-choice approve ${action === 'approve' ? 'active' : ''}`} onClick={() => setAction('approve')}><FaCheckCircle /> Approve</button>
              <button className={`btn-choice reject ${action === 'reject' ? 'active' : ''}`} onClick={() => setAction('reject')}><FaTimesCircle /> Reject</button>
            </div>
            {action === 'reject' && (
              <div className="reject-reason-list">
                {Object.keys(reasonMapping).map(key => (
                  <label key={key}><input type="checkbox" checked={rejectReasons[key]} onChange={() => setRejectReasons(p => ({...p, [key]: !p[key]}))} /> {reasonMapping[key]}</label>
                ))}
              </div>
            )}
            {action && <button className="btn-save-final" onClick={saveStatus} disabled={saving}>{saving ? "Saving..." : "Confirm"}</button>}
          </div>
        )}
      </div>
      <FileModal content={modalContent} onClose={() => setModalContent(null)} />
    </>
  );
}