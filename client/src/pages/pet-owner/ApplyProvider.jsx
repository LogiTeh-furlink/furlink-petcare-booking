import React, { useState, useEffect } from "react";
import { X, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoggedInNavbar from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import "./ApplyProvider.css";

export default function ApplyProvider() {
  const [businessInfo, setBusinessInfo] = useState({
    businessName: "",
    businessEmail: "",
    businessMobile: "",
    socialMediaUrl: "",
    typeOfService: "Pet Grooming",
    operatingHours: [{ days: [], startTime: "09:00", endTime: "17:00" }],
    houseStreet: "",
    barangay: "",
    city: "",
    province: "",
    postalCode: "",
    country: "Philippines",
  });

  const [waiverFile, setWaiverFile] = useState(null);
  const [facilityImages, setFacilityImages] = useState([]);
  const [paymentChannelFiles, setPaymentChannelFiles] = useState([]);
  const [businessPermitFile, setBusinessPermitFile] = useState(null);

  const [employees, setEmployees] = useState([{ fullName: "", position: "" }]);
  const [validationErrors, setValidationErrors] = useState({});

  const navigate = useNavigate(); // <<--- REQUIRED ADDITION ✔✔✔

  const daysOfWeekShort = ["S", "M", "T", "W", "T", "F", "S"];
  const daysOfWeekFull = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  useEffect(() => {
    const savedData = JSON.parse(localStorage.getItem("businessInfo"));
    if (savedData) {
      setBusinessInfo(savedData);
    }

    const savedFiles = JSON.parse(localStorage.getItem("files"));
    if (savedFiles) {
      setWaiverFile(savedFiles.waiverFile);
      setFacilityImages(savedFiles.facilityImages);
      setPaymentChannelFiles(savedFiles.paymentChannelFiles);
      setBusinessPermitFile(savedFiles.businessPermitFile);
    }

    const savedEmployees = JSON.parse(localStorage.getItem("employees"));
    if (savedEmployees) {
      setEmployees(savedEmployees);
    }
  }, []);

  const saveToLocalStorage = () => {
    localStorage.setItem("businessInfo", JSON.stringify(businessInfo));
    localStorage.setItem("files", JSON.stringify({
      waiverFile,
      facilityImages,
      paymentChannelFiles,
      businessPermitFile,
    }));
    localStorage.setItem("employees", JSON.stringify(employees));
  };

  // ----------------------- Handlers -----------------------
  const handleBusinessChange = (e) => {
    const { name, value } = e.target;
    setBusinessInfo((prev) => {
      const updated = { ...prev, [name]: value };
      saveToLocalStorage(); // Save to localStorage
      return updated;
    });
  };

  const toggleDay = (slotIndex, day) => {
    setBusinessInfo((prev) => ({
      ...prev,
      operatingHours: prev.operatingHours.map((slot, i) =>
        i === slotIndex
          ? {
              ...slot,
              days: slot.days.includes(day)
                ? slot.days.filter((d) => d !== day)
                : [...slot.days, day],
            }
          : slot
      ),
    }));
  };

  const isDayDisabled = (slotIndex, day) => {
    return businessInfo.operatingHours.some(
      (slot, i) => i !== slotIndex && slot.days.includes(day)
    );
  };

  const canAddMoreSlots = () => {
    const assignedDays = new Set();
    businessInfo.operatingHours.forEach((slot) =>
      slot.days.forEach((d) => assignedDays.add(d))
    );
    return assignedDays.size < 7;
  };

  const handleTimeChange = (slotIndex, type, value) => {
    setBusinessInfo((prev) => ({
      ...prev,
      operatingHours: prev.operatingHours.map((slot, i) =>
        i === slotIndex ? { ...slot, [type]: value } : slot
      ),
    }));
  };

  const addTimeSlot = () => {
    setBusinessInfo((prev) => ({
      ...prev,
      operatingHours: [
        ...prev.operatingHours,
        { days: [], startTime: "09:00", endTime: "17:00" },
      ],
    }));
  };

  const removeTimeSlot = (index) => {
    if (businessInfo.operatingHours.length > 1) {
      setBusinessInfo((prev) => ({
        ...prev,
        operatingHours: prev.operatingHours.filter((_, i) => i !== index),
      }));
    }
  };

  const handleFileSelect = (setter, e, maxSizeMB = 1, fieldName) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > maxSizeMB * 1024 * 1024) {
        setValidationErrors((prev) => ({
          ...prev,
          [fieldName]: `File size must not exceed ${maxSizeMB}MB.`,
        }));
        e.target.value = "";
        return;
      }
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[fieldName];
        return updated;
      });
      setter(file);
    }
  };

  const handleMultiFileSelect = (
    setter,
    currentFiles,
    e,
    maxFiles,
    fieldName
  ) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (currentFiles.length + files.length > maxFiles) {
        setValidationErrors((prev) => ({
          ...prev,
          [fieldName]: `You can upload up to ${maxFiles} files.`,
        }));
        e.target.value = "";
        return;
      }
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[fieldName];
        return updated;
      });
      setter((prev) => [...prev, ...files]);
      e.target.value = "";
    }
  };

  const removeFile = (setter, index) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEmployeeChange = (index, field, value) => {
    setEmployees((prev) => {
      const updatedEmployees = prev.map((emp, i) =>
        i === index ? { ...emp, [field]: value } : emp
      );
      saveToLocalStorage(); // Save to localStorage
      return updatedEmployees;
    });
  };

  const addEmployee = () => {
    setEmployees((prev) => [...prev, { fullName: "", position: "" }]);
  };

  const removeEmployee = (index) => {
    if (employees.length > 1) {
      setEmployees((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!businessInfo.businessName.trim())
      errors.businessName = "Required";
    if (!businessInfo.businessEmail.trim())
      errors.businessEmail = "Required";
    if (!businessInfo.businessMobile.trim())
      errors.businessMobile = "Required";
    if (
      businessInfo.operatingHours.length === 0 ||
      businessInfo.operatingHours.some((s) => s.days.length === 0)
    )
      errors.operatingHours = "Select at least one day for each slot";

    ["houseStreet", "barangay", "city", "province", "postalCode"].forEach(
      (field) => {
        if (!businessInfo[field].trim()) errors[field] = "Required";
      }
    );

    if (!waiverFile) errors.waiverFile = "Required";
    if (facilityImages.length === 0)
      errors.facilityImages = "At least one image required";
    if (paymentChannelFiles.length === 0)
      errors.paymentChannelFiles = "At least one QR code required";
    if (!businessPermitFile) errors.businessPermitFile = "Required";

    employees.forEach((emp, i) => {
      if (!emp.fullName.trim() || !emp.position.trim()) {
        errors[`employee_${i}`] =
          "Full name and position required";
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    saveToLocalStorage(); // Save data before proceeding

    // Redirect to service type selection
    navigate("/service-setup"); 
  };

  // ----------------------- Render -----------------------
  return (
    <>
      <LoggedInNavbar hideBecomeProvider={true} />
      <div className="apply-provider-wrapper">
        <h1 className="page-title">Service Provider Application</h1>

        <form className="apply-provider-form" onSubmit={handleSubmit}>
          {/* --- Business Info --- */}
          <section className="form-section">
            <h2>Business Information</h2>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Business Name *</label>
                <input
                  type="text"
                  name="businessName"
                  value={businessInfo.businessName}
                  onChange={handleBusinessChange}
                />
                {validationErrors.businessName && (
                  <small className="error">
                    {validationErrors.businessName}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  name="businessEmail"
                  value={businessInfo.businessEmail}
                  onChange={handleBusinessChange}
                />
                {validationErrors.businessEmail && (
                  <small className="error">
                    {validationErrors.businessEmail}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Mobile Number *</label>
                <input
                  type="tel"
                  name="businessMobile"
                  value={businessInfo.businessMobile}
                  onChange={handleBusinessChange}
                />
                {validationErrors.businessMobile && (
                  <small className="error">
                    {validationErrors.businessMobile}
                  </small>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Service Type *</label>
              <input
                type="text"
                name="typeOfService"
                value={businessInfo.typeOfService}
                disabled
              />
            </div>

            <div className="form-group">
              <label>Social Media URL</label>
              <input
                type="url"
                name="socialMediaUrl"
                value={businessInfo.socialMediaUrl}
                onChange={handleBusinessChange}
              />
            </div>

            <div className="form-group">
              <label>Operating Hours *</label>
              {businessInfo.operatingHours.map((slot, i) => (
                <div key={i} className="operating-slot">
                  <div className="day-buttons">
                    {daysOfWeekFull.map((d, idx) => {
                      const disabled = isDayDisabled(i, d);
                      return (
                        <button
                          type="button"
                          key={idx}
                          className={`day-btn ${
                            slot.days.includes(d) ? "active" : ""
                          }`}
                          onClick={() => toggleDay(i, d)}
                          disabled={disabled}
                        >
                          {daysOfWeekShort[idx]}
                        </button>
                      );
                    })}
                  </div>

                  <div className="time-inputs">
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) =>
                        handleTimeChange(i, "startTime", e.target.value)
                      }
                    />
                    <span>to</span>
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) =>
                        handleTimeChange(i, "endTime", e.target.value)
                      }
                    />

                    {businessInfo.operatingHours.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTimeSlot(i)}
                        className="remove-btn"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {canAddMoreSlots() && (
                <button
                  type="button"
                  onClick={addTimeSlot}
                  className="add-btn"
                >
                  + Add Slot
                </button>
              )}

              {validationErrors.operatingHours && (
                <small className="error">
                  {validationErrors.operatingHours}
                </small>
              )}
            </div>
          </section>

          {/* --- Business Address --- */}
          <section className="form-section">
            <h2>Business Address</h2>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Street / House No *</label>
                <input
                  type="text"
                  name="houseStreet"
                  value={businessInfo.houseStreet}
                  onChange={handleBusinessChange}
                />
                {validationErrors.houseStreet && (
                  <small className="error">
                    {validationErrors.houseStreet}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Barangay *</label>
                <input
                  type="text"
                  name="barangay"
                  value={businessInfo.barangay}
                  onChange={handleBusinessChange}
                />
                {validationErrors.barangay && (
                  <small className="error">
                    {validationErrors.barangay}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>City / Municipality *</label>
                <input
                  type="text"
                  name="city"
                  value={businessInfo.city}
                  onChange={handleBusinessChange}
                />
                {validationErrors.city && (
                  <small className="error">
                    {validationErrors.city}
                  </small>
                )}
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label>Province *</label>
                <input
                  type="text"
                  name="province"
                  value={businessInfo.province}
                  onChange={handleBusinessChange}
                />
                {validationErrors.province && (
                  <small className="error">
                    {validationErrors.province}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Postal Code *</label>
                <input
                  type="text"
                  name="postalCode"
                  value={businessInfo.postalCode}
                  onChange={handleBusinessChange}
                />
                {validationErrors.postalCode && (
                  <small className="error">
                    {validationErrors.postalCode}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Country *</label>
                <input
                  type="text"
                  name="country"
                  value={businessInfo.country}
                  disabled
                />
              </div>
            </div>
          </section>

          {/* --- Documents --- */}
          <section className="form-section">
            <h2>Business Documents</h2>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Waiver *</label>
                <label className="file-btn">
                  <Upload size={20} />
                  <span>Choose File</span>
                  <input
                    type="file"
                    onChange={(e) =>
                      handleFileSelect(setWaiverFile, e, 1, "waiverFile")
                    }
                    hidden
                  />
                </label>
                {waiverFile && <span>{waiverFile.name}</span>}
                {validationErrors.waiverFile && (
                  <small className="error">
                    {validationErrors.waiverFile}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Facility Images *</label>
                <label className="file-btn">
                  <Upload size={20} />
                  <span>Choose Files</span>
                  <input
                    type="file"
                    multiple
                    onChange={(e) =>
                      handleMultiFileSelect(
                        setFacilityImages,
                        facilityImages,
                        e,
                        3,
                        "facilityImages"
                      )
                    }
                    hidden
                  />
                </label>
                {facilityImages.map((f, i) => (
                  <div key={i} className="file-item">
                    {f.name}{" "}
                    <button
                      type="button"
                      onClick={() => removeFile(setFacilityImages, i)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {validationErrors.facilityImages && (
                  <small className="error">
                    {validationErrors.facilityImages}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Payment Channel *</label>
                <label className="file-btn">
                  <Upload size={20} />
                  <span>Choose Files</span>
                  <input
                    type="file"
                    multiple
                    onChange={(e) =>
                      handleMultiFileSelect(
                        setPaymentChannelFiles,
                        paymentChannelFiles,
                        e,
                        3,
                        "paymentChannelFiles"
                      )
                    }
                    hidden
                  />
                </label>
                {paymentChannelFiles.map((f, i) => (
                  <div key={i} className="file-item">
                    {f.name}{" "}
                    <button
                      type="button"
                      onClick={() =>
                        removeFile(setPaymentChannelFiles, i)
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {validationErrors.paymentChannelFiles && (
                  <small className="error">
                    {validationErrors.paymentChannelFiles}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Business Permit *</label>
                <label className="file-btn">
                  <Upload size={20} />
                  <span>Choose File</span>
                  <input
                    type="file"
                    onChange={(e) =>
                      handleFileSelect(
                        setBusinessPermitFile,
                        e,
                        1,
                        "businessPermitFile"
                      )
                    }
                    hidden
                  />
                </label>
                {businessPermitFile && (
                  <span>{businessPermitFile.name}</span>
                )}
                {validationErrors.businessPermitFile && (
                  <small className="error">
                    {validationErrors.businessPermitFile}
                  </small>
                )}
              </div>
            </div>
          </section>

          {/* --- Employees --- */}
          <section className="form-section">
            <h2>Employee/s Information</h2>
            {employees.map((emp, i) => (
              <div className="employee-row" key={i}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      value={emp.fullName}
                      onChange={(e) =>
                        handleEmployeeChange(i, "fullName", e.target.value)
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Position *</label>
                    <div className="input-with-btn">
                      <input
                        type="text"
                        value={emp.position}
                        onChange={(e) =>
                          handleEmployeeChange(i, "position", e.target.value)
                        }
                      />
                      {employees.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmployee(i)}
                          className="remove-btn"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {validationErrors[`employee_${i}`] && (
                  <small className="error">
                    {validationErrors[`employee_${i}`]}
                  </small>
                )}
              </div>
            ))}

            <button
              type="button"
              className="add-btn"
              onClick={addEmployee}
            >
              + Add Employee
            </button>
          </section>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Proceed
            </button>
          </div>
        </form>
      </div>

      <Footer />
    </>
  );
}
