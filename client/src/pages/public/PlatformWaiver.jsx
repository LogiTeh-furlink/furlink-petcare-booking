import React from "react";
import { ShieldCheck, Info } from "lucide-react";
import "./PlatformWaiver.css";

const PlatformWaiver = () => {
  return (
    <div className="platform-waiver-wrapper">
      <div className="platform-waiver-header">
        <ShieldCheck size={36} className="waiver-shield-icon" />
        <div>
          <h2 className="waiver-title">Standard Platform Pet Care Waiver</h2>
          <p className="waiver-subtitle">
            Official guidelines and liability agreements for shops operating under platform standards.
          </p>
        </div>
      </div>

      <div className="platform-waiver-body">
        <div className="waiver-alert-box">
          <Info size={20} className="info-icon" />
          <p>
            <strong>Note to Pet Owner:</strong> Because this specific provider has not uploaded a custom waiver, this booking is governed by our platform's Standard Pet Care Waiver to ensure the safety of your pet, the staff, and the facility.
          </p>
        </div>

        <div className="waiver-section">
          <h3>1. Pet Health & Vaccinations</h3>
          <p>
            By proceeding with this booking, I verify that my pet is healthy, fit for the scheduled services, and is current on all required vaccinations (including, but not limited to, Rabies, Distemper, and Bordetella). I agree to provide valid proof of vaccination upon request. I also confirm that my pet is free of fleas, ticks, and contagious illnesses.
          </p>
        </div>

        <div className="waiver-section">
          <h3>2. Behavioral Disclosure</h3>
          <p>
            I understand that I am solely responsible for the behavior of my pet. I have fully disclosed any history of aggression, biting, or extreme anxiety to the Service Provider. If my pet becomes a danger to themselves, other animals, or the staff, I understand that the Service Provider reserves the right to halt the service immediately and I will be responsible for any charges incurred up to that point.
          </p>
        </div>

        <div className="waiver-section">
          <h3>3. Medical Emergencies</h3>
          <p>
            In the event of a medical emergency, the Service Provider will make every reasonable attempt to contact me using the provided emergency contact information. If I cannot be reached, I authorize the Service Provider to seek immediate veterinary care for my pet at the nearest available facility. I agree that I am financially responsible for all veterinary costs and related expenses.
          </p>
        </div>

        <div className="waiver-section">
          <h3>4. Matted Coats & Grooming Risks (If Applicable)</h3>
          <p>
            If my pet requires grooming and presents with a severely matted coat, I understand that removing mats carries a higher risk of nicks, cuts, or skin irritation. I authorize the Service Provider to clip my pet's coat as short as necessary to safely remove the mats, and I release the Service Provider from liability for any minor injuries or post-grooming skin conditions related to the matting.
          </p>
        </div>

        <div className="waiver-section">
          <h3>5. General Liability Release</h3>
          <p>
            While the Service Provider will exercise all due care and precautions to ensure the safety of my pet, I understand that working with animals involves inherent risks. I hereby release the Service Provider, its staff, and this booking platform from any and all liabilities, claims, or damages arising from injuries, illnesses, escape, or accidental death of my pet, except in cases of proven gross negligence.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlatformWaiver;