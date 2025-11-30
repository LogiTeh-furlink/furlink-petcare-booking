// src/pages/admin/AdminViewProvider.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import LoggedInAdmin from "../../components/Header/LoggedInAdmin";
import "./AdminViewProvider.css";

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

  console.log("Current state - Images:", images);
  console.log("Current state - Payments:", payments);
  console.log("Current state - Permits:", permits);
  const [action, setAction] = useState(null);
  const [rejectReasons, setRejectReasons] = useState({
    incomplete: false,
    unverifiable: false,
    inappropriate: false,
  });
  const [saving, setSaving] = useState(false);

  // Map frontend checkbox keys to enum values
  const reasonMapping = {
    incomplete: 'Incomplete Information',
    unverifiable: 'Information Cannot Be Verified',
    inappropriate: 'Uploaded Files Are Invalid or Inappropriate',
  };

  useEffect(() => {
    fetchAllData();
  }, [id]);

  const fetchAllData = async () => {
    try {
      console.log("Provider ID from URL:", id);
      
      // Fetch provider
      const { data: providerData, error: providerError } = await supabase
        .from("service_providers")
        .select("*")
        .eq("id", id)
        .single();

      console.log("Provider data:", providerData);
      console.log("Provider error:", providerError);

      if (providerError) {
        setProvider(null);
      } else {
        setProvider(providerData);
      }

      // Fetch services with service_options
      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select(`
          *,
          service_options (
            id,
            pet_type,
            size,
            weight_range,
            price
          )
        `)
        .eq("provider_id", id);

      if (!servicesError) setServices(servicesData || []);

      // Fetch hours
      const { data: hoursData, error: hoursError } = await supabase
        .from("service_provider_hours")
        .select("*")
        .eq("provider_id", id);

      if (!hoursError) setHours(hoursData || []);

      // Fetch images
      const { data: imagesData, error: imagesError } = await supabase
        .from("service_provider_images")
        .select("id, image_url")
        .eq("provider_id", id);

      console.log("Images query - provider_id:", id);
      console.log("Images data:", imagesData);
      console.log("Images error:", imagesError);
      if (!imagesError && imagesData) {
        console.log("Setting images:", imagesData);
        setImages(imagesData);
      }

      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("service_provider_payments")
        .select("id, method_type, file_url")
        .eq("provider_id", id);

      console.log("Payments query - provider_id:", id);
      console.log("Payments data:", paymentsData);
      console.log("Payments error:", paymentsError);
      if (!paymentsError && paymentsData) {
        console.log("Setting payments:", paymentsData);
        setPayments(paymentsData);
      }

      // Fetch permits
      const { data: permitsData, error: permitsError } = await supabase
        .from("service_provider_permits")
        .select("*")
        .eq("provider_id", id);

      console.log("Permits query - provider_id:", id);
      console.log("Permits data:", permitsData);
      console.log("Permits error:", permitsError);
      if (!permitsError && permitsData) {
        console.log("Setting permits:", permitsData);
        setPermits(permitsData);
      }

      // Fetch staff
      const { data: staffData, error: staffError } = await supabase
        .from("service_provider_staff")
        .select("*")
        .eq("provider_id", id);

      if (!staffError) setStaff(staffData || []);

    } finally {
      setLoading(false);
    }
  };

  const toggleReason = (reason) => {
    setRejectReasons((prev) => ({
      ...prev,
      [reason]: !prev[reason],
    }));
  };

  const saveStatus = async () => {
    if (!action) {
      alert("Select Approve or Reject first.");
      return;
    }

    if (action === "reject") {
      const selected = Object.keys(rejectReasons).filter((r) => rejectReasons[r]);
      if (selected.length === 0) {
        alert("Select at least one rejection reason.");
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Get current logged in admin user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert("You must be logged in to perform this action.");
        return;
      }

      // 2. Prepare the update object
      const updates = {
        status: action === "approve" ? "approved" : "rejected",
        updated_at: new Date().toISOString(),
      };

      // 3. If approving, stamp with admin ID and time
      if (action === "approve") {
        updates.approved_by = user.id;
        updates.approved_at = new Date().toISOString();
      }

      // 4. If rejecting, save rejection reasons
      if (action === "reject") {
        // Convert selected checkboxes to enum values
        const selectedReasons = Object.keys(rejectReasons)
          .filter((key) => rejectReasons[key])
          .map((key) => reasonMapping[key]);

        updates.rejection_reasons = selectedReasons;
      }

      // 5. Send Update to Supabase
      const { error } = await supabase
        .from("service_providers")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      // Navigate back to dashboard without alert
      navigate("/admin-dashboard");
      
    } catch (error) {
      console.error("Error updating status:", error.message);
      alert(`Failed to update status: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (time) => {
    if (!time) return "";
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  if (loading) return <p>Loading...</p>;
  if (!provider) return <p>Provider not found.</p>;

  return (
    <>
      <LoggedInAdmin />
      <div className="admin-view-provider-container">
        <h1 className="provider-title">Service Provider Details</h1>

        <div className="provider-info-box">
          <h2>Business Information</h2>
          <p>
            <strong>Business Name:</strong> {provider.business_name}
          </p>
          <p>
            <strong>Email:</strong> {provider.business_email}
          </p>
          <p>
            <strong>Mobile:</strong> {provider.business_mobile}
          </p>
          <p>
            <strong>Address:</strong> {provider.house_street}, {provider.barangay},{" "}
            {provider.city}, {provider.province}, {provider.postal_code}
          </p>
          <p>
            <strong>Country:</strong> {provider.country}
          </p>
          <p>
            <strong>Type of Service:</strong> {provider.type_of_service}
          </p>
          <p>
             <strong>Current Status:</strong> <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{provider.status}</span>
          </p>
          {provider.status === 'rejected' && provider.rejection_reasons && provider.rejection_reasons.length > 0 && (
            <p>
              <strong>Rejection Reasons:</strong>
              <ul style={{ marginTop: '0.5rem' }}>
                {provider.rejection_reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </p>
          )}
        </div>

        {/* Submitted Files */}
        <div className="provider-info-box">
          <h2>Submitted Files</h2>
          
          <h3 className="section-header">Required Documents</h3>
          <p>
            <strong>Waiver (Optional):</strong>{" "}
            {provider.waiver_url ? (
              <a href={provider.waiver_url} target="_blank" rel="noopener noreferrer">
                View File
              </a>
            ) : (
              "No file uploaded"
            )}
          </p>

          <p>
            <strong>Social Media:</strong>{" "}
            {provider.social_media_url ? (
              <a href={provider.social_media_url} target="_blank" rel="noopener noreferrer">
                View Link
              </a>
            ) : (
              "No link provided"
            )}
          </p>
          
          <p>
            <strong>Images of Facilities:</strong>{" "}
            {images.length > 0 ? (
              images.map((img, idx) => (
                <span key={img.id}>
                  <a href={img.image_url} target="_blank" rel="noopener noreferrer">
                    View File {idx + 1}
                  </a>
                  {idx < images.length - 1 ? ", " : ""}
                </span>
              ))
            ) : (
              "No files uploaded"
            )}
          </p>

          <p>
            <strong>Payment Channel:</strong>{" "}
            {payments.length > 0 ? (
              payments.map((payment, idx) => (
                <span key={payment.id}>
                  <a href={payment.file_url} target="_blank" rel="noopener noreferrer">
                    View File ({payment.method_type})
                  </a>
                  {idx < payments.length - 1 ? ", " : ""}
                </span>
              ))
            ) : (
              "No files uploaded"
            )}
          </p>

          <p>
            <strong>Business Permit:</strong>{" "}
            {permits.length > 0 ? (
              permits.map((permit, idx) => (
                <span key={permit.id}>
                  <a href={permit.file_url} target="_blank" rel="noopener noreferrer">
                    View File ({permit.permit_type})
                  </a>
                  {idx < permits.length - 1 ? ", " : ""}
                </span>
              ))
            ) : (
              "No files uploaded"
            )}
          </p>
        </div>

        {/* Operating Hours */}
        {hours.length > 0 && (
          <div className="provider-info-box">
            <h2>Operating Hours</h2>
            {daysOrder.map((day) => {
              const dayHours = hours.filter(h => h.day_of_week === day);
              return dayHours.length > 0 ? (
                <p key={day}>
                  <strong>{day}:</strong>{" "}
                  {dayHours.map((h, idx) => (
                    <span key={h.id}>
                      {formatTime(h.start_time)} - {formatTime(h.end_time)}
                      {idx < dayHours.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              ) : null;
            })}
          </div>
        )}

        {/* Types of Services */}
        {services.length > 0 && (
          <div className="provider-info-box">
            <h2>Types of Services</h2>
            {services.map((service) => (
              <div key={service.id} className="service-item">
                <h3 className="section-header">{service.name}</h3>
                <p><strong>Type:</strong> {service.type}</p>
                <p><strong>Description:</strong> {service.description}</p>
                {service.notes && <p><strong>Notes:</strong> {service.notes}</p>}
                
                {/* Service Options */}
                {service.service_options && service.service_options.length > 0 && (
                  <div className="service-options">
                    <h4>Service Options:</h4>
                    <table className="options-table">
                      <thead>
                        <tr>
                          <th>Pet Type</th>
                          <th>Size</th>
                          <th>Weight Range</th>
                          <th>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {service.service_options.map((option) => (
                          <tr key={option.id}>
                            <td>{option.pet_type}</td>
                            <td>{option.size}</td>
                            <td>{option.weight_range}</td>
                            <td>₱{parseFloat(option.price).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Staff */}
        {staff.length > 0 && (
          <div className="provider-info-box">
            <h2>Staff Members</h2>
            {staff.map((member) => (
              <p key={member.id}>
                <strong>{member.full_name}</strong> - {member.job_title}
              </p>
            ))}
          </div>
        )}

        <div className="approval-actions">
          <h2>Approval Action</h2>
          <div className="action-buttons">
            <button
              className={`approve-btn ${action === "approve" ? "active" : ""}`}
              onClick={() => setAction("approve")}
            >
              Approve
            </button>
            <button
              className={`reject-btn ${action === "reject" ? "active" : ""}`}
              onClick={() => setAction("reject")}
            >
              Reject
            </button>
          </div>

          {action === "reject" && (
            <div className="reject-options">
              <h3>Select reason(s) for rejection:</h3>
              <label>
                <input
                  type="checkbox"
                  checked={rejectReasons.incomplete}
                  onChange={() => toggleReason("incomplete")}
                />
                Incomplete Information
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={rejectReasons.unverifiable}
                  onChange={() => toggleReason("unverifiable")}
                />
                Information Cannot Be Verified
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={rejectReasons.inappropriate}
                  onChange={() => toggleReason("inappropriate")}
                />
                Uploaded Files Are Invalid or Inappropriate
              </label>
            </div>
          )}

          {action && (
            <button className="save-status-btn" onClick={saveStatus} disabled={saving}>
              {saving ? "Saving..." : "Save Status"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}