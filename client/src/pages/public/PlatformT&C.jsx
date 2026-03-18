import React from "react";
import { Scale, Info } from "lucide-react";
import "./PlatformTerms.css";

const PlatformTerms = () => {
  return (
    <div className="platform-terms-wrapper">
      <div className="platform-terms-header">
        <Scale size={36} className="terms-scale-icon" />
        <div>
          <h2 className="terms-title">Terms and Conditions</h2>
          <p className="terms-subtitle">
            Please read these terms carefully before using the Furlink platform.
          </p>
        </div>
      </div>

      <div className="platform-terms-body">
        <div className="terms-alert-box">
          <Info size={20} className="info-icon" />
          <p>
            These Terms and Conditions (“Terms”) shall govern your access and use of the Platform and of the services therein. The term “Platform” pertains to the website operated by LogiTeh and its affiliates at <strong>https://furlink.com</strong>, including the website and social media pages made available by us. By continuing to access or use the Platform and/or any of the services therein, you represent that you are at least 13 years old and you have read, understood, and agree, without limitation or qualification, to be bound by these Terms and our Privacy Policy.
          </p>
        </div>

        <div className="terms-section">
          <h3>General</h3>
          <p>In using the Platform and the services therein, you agree to:</p>
          <ol>
            <li>Do so only for its intended and lawful purposes;</li>
            <li>Ensure that all information or data you provide in the Platform are accurate and agree to take sole responsibility for such information and data;</li>
            <li>Be responsible for maintaining confidentiality of your account information and password and for restricting access to such information and to your computer. You agree to accept responsibility for all activities that occur under your account, whether such activity is authorized or not. You should notify us immediately if you have knowledge of that or have reason for suspecting that the confidentiality of your account has been compromised or if there has been any unauthorized use thereof;</li>
            <li>Not try or attempt to try to interrupt or harm the Platform, its operations, services, facilities, or software in any manner;</li>
            <li>Not impersonate any person or entity or falsely state or otherwise misrepresent your affiliation with any person or entity; and</li>
            <li>Not use or upload any material that contains, or which you have reason to suspect contains, viruses, worms, trojan horses, spyware, adware, damaging components, malicious code or harmful or disruptive components which may impair or corrupt the Platform’s data or damage or interfere with the operation of the Platform.</li>
          </ol>
        </div>

        <div className="terms-section">
          <h3>Obligations for Pet Owners</h3>
          <p>To ensure the safety of Service Providers and the well-being of your pets, you agree to:</p>
          <ol>
            <li>Do so only for its intended and lawful purposes;</li>
            <li>Provide truthful and complete details regarding your pet’s health, temperament, vaccination status, and behavioral history.</li>
            <li>Disclose if a pet has a history of aggression or specific medical triggers.</li>
            <li>Take sole responsibility for the data provided in your pet’s profile.</li>
            <li>Be responsible for maintaining confidentiality of your account information and password and for restricting access to such information and to your computer. You agree to accept responsibility for all activities that occur under your account, whether such activity is authorized or not. You should notify us immediately if you have knowledge of that or have reason for suspecting that the confidentiality of your account has been compromised or if there has been any unauthorized use thereof;</li>
            <li>Not try or attempt to try to interrupt or harm the Platform, its operations, services, facilities, or software in any manner;</li>
            <li>Not impersonate any person or entity or falsely state or otherwise misrepresent your affiliation with any person or entity; and</li>
            <li>Not use or upload any material that contains, or which you have reason to suspect contains, viruses, worms, trojan horses, spyware, adware, damaging components, malicious code or harmful or disruptive components which may impair or corrupt the Platform’s data or damage or interfere with the operation of the Platform.</li>
          </ol>
        </div>

        <div className="terms-section">
          <h3>Obligations for Service Providers</h3>
          <p>To maintain professional standards on the Platform, you agree to:</p>
          <ol>
            <li>Do so only for its intended and lawful purposes;</li>
            <li>Ensure your profile accurately reflects your experience, certifications, and the specific services you are equipped to provide.</li>
            <li>Use the Platform tools (listing creation, booking, and payments confirmation) as intended and maintain the confidentiality of the Pet Owner’s home and personal details.</li>
            <li>Be responsible for maintaining confidentiality of your account information and password and for restricting access to such information and to your computer. You agree to accept responsibility for all activities that occur under your account, whether such activity is authorized or not. You should notify us immediately if you have knowledge of that or have reason for suspecting that the confidentiality of your account has been compromised or if there has been any unauthorized use thereof;</li>
            <li>Not try or attempt to try to interrupt or harm the Platform, its operations, services, facilities, or software in any manner;</li>
            <li>Not impersonate any person or entity or falsely state or otherwise misrepresent your affiliation with any person or entity; and</li>
            <li>Not use or upload any material that contains, or which you have reason to suspect contains, viruses, worms, trojan horses, spyware, adware, damaging components, malicious code or harmful or disruptive components which may impair or corrupt the Platform’s data or damage or interfere with the operation of the Platform.</li>
          </ol>
        </div>

        <div className="terms-section">
          <h3>Registration and Account Security</h3>
          <p>To access and use the Platform, you are required to register and create an account. However, we have the absolute discretion to refuse your registration and/or to terminate the same for any reason whatsoever at any time, with or without notice.</p>
          <p>Upon registration:</p>
          <ol>
            <li>You must provide us with accurate, complete, and up-to-date registration information; and</li>
            <li>We are authorized to assume that any person using the Platform with your username and password is either you yourself or is authorized to act on your behalf.</li>
          </ol>
          <p>
            You are responsible for safeguarding your username and password that you use to access the Platform and for any activities or actions under your password. You shall be liable for every transaction made under your login and as such, agree to indemnify us for all claims, losses, damages whatsoever arising from the actions of a person in connection with the access and use of the Platform using your login details.
          </p>
          <p>
            At any time, we may request that you update your username and/or password. We shall not be liable or responsible for any losses suffered by you arising out of or in connection with or by reason of such request or due to any invalidation in username or password, regardless of cause.
          </p>
        </div>

        <div className="terms-section">
          <h3>User Information</h3>
          <p>
            Other than Personal Data as defined under Republic Act No. 10173 (Data Privacy Act of 2012), which is subject to our Privacy Policy (https://furlink.com.ph/privacy), any material, information, suggestions, idea, concept, know-how, technique, question, comment, feedback/review, or other communication you transmit, upload, or post to or through the Platform in any manner ("User Communications") are and will be considered non-confidential and non-proprietary. 
          </p>
          <p>
            We may use any or all User Communications for any purpose whatsoever, including, without limitation, reproduction, transmission, disclosure, publication, broadcast, development, deletion and/or marketing in any manner whatsoever for any or all commercial or non-commercial purposes. We may, but are not obligated to, monitor, or review any User Communications. We shall have no obligation to use, return, review, or respond to any User Communications. We will have no liability related to the content of any such User Communications, whether or not arising under the laws of copyright, libel, privacy, obscenity, or otherwise. However, we retain the right to remove any or all User Communications that includes any material we deem inappropriate or unacceptable.
          </p>
        </div>

        <div className="terms-section">
          <h3>Creating an Account and Booking Services</h3>
          <p>
            Upon creation of an account, you may already book available grooming services in the Platform, choose your preferred schedule, and customize your booking by providing the details of your pet. By clicking the "Confirm booking appointment" button, you are effectively submitting your offer to book an appointment for Service/s, which service providers may accept or reject. You shall be responsible for ensuring the completeness and accuracy of the information provided for the appointment booked. Service availability may vary per service provider.
          </p>
        </div>

        <div className="terms-section">
          <h3>Payment</h3>
          <p>All prices indicated in the Platform are in Philippine Peso. When an appointment is booked in the Platform, you have the following payment options:</p>
          <ol>
            <li><strong>No Payment Gateway.</strong> The Platform does not provide an in-app payment gateway. All payments, including downpayments, are made directly to the service provider using the payment details they provide (e.g., QR codes, e-wallets, bank transfer, or other agreed methods).</li>
            <li><strong>Downpayment and Refund Policy.</strong> A thirty percent (30%) downpayment may be required by service providers to confirm a booking. All downpayments made are non-refundable if the pet owner cancels the booking for any reason. The Platform does not verify the authenticity of payment proof uploads (e.g., GCash screenshots). Service Providers are solely responsible for verifying their own bank/e-wallet balances before confirming a booking as 'Paid'. The Platform is not liable for financial losses due to fraudulent proof-of-payment uploads.</li>
            <li><strong>Service Provider Cancellation.</strong> In the event that the service provider cancels a confirmed booking, the service provider shall be solely responsible for contacting the pet owner and refunding the full thirty percent (30%) downpayment made by the pet owner. The Platform shall not process or guarantee such refunds.</li>
            <li>If you fail to make any required payment after the service provider accepts your booking request, we reserve the right to cancel the appointment.</li>
            <li>All financial transactions occur outside of the Platform. Pet Owners and Service Providers acknowledge that furlink does not hold, handle, or escrow funds. Any disputes regarding payments, including the 30% downpayment and subsequent refunds, must be resolved directly between the parties involved. In cases that users cannot settle the disputes they may contact furlink via email (logiteh045@gmail.com).</li>
          </ol>
        </div>

        <div className="terms-section">
          <h3>Services</h3>
          <p>
            We do our best to provide you with an accurate description of the grooming services featured on the Platform, but we cannot assure you that such description, information, images, or other content available are accurate, complete, reliable, current, or free from error. Service providers may at any time change the price and other specifications of the Services. Service providers may, without prior notice, limit the Services indicated in the booking and/or cancel your booking. We will notify you through the email address provided for any cancellation or change in booking status.
          </p>
          <p>
            <strong>Pet Pickup and Transport.</strong> The Platform does not offer pet pickup or transport services. Any arrangement for pet pickup, drop-off, or transport shall be strictly between the service provider and the pet owner and is outside the responsibility and control of the Platform.
          </p>
        </div>

        <div className="terms-section">
          <h3>Grooming Salon</h3>
          <p>
            Service providers will handle your pet with the utmost care, but we cannot guarantee the possible stressful effects of grooming service on your pet. If your pet has any medical condition (including medications within 72 hours), pregnancy, allergies, ticks, fleas, or a history of aggressive behavior, it should be declared upon registration.
          </p>
          <p>
            Service providers have the right to refuse service to customers whose pets may pose a threat to the health and safety of staff, customers, and other pets.
          </p>
          <p>
            During the grooming service, groomers may uncover hidden pre-existing conditions in your pet, which they will bring to your attention.
          </p>
          <p>
            Service providers (and the Platform) will not be held responsible for clipper burn, minor nicks or cuts, irritation, allergic reactions to shampoos or grooming products, or any adverse effects resulting from or in connection with the Services provided, including sickness, injury, or death of the pet, unless attributable to fault or gross negligence of the service provider.
          </p>
        </div>

        <div className="terms-section">
          <h3>Limitation of Liability</h3>
          <p>The Platform acts solely as a venue to connect pet owners and service providers. Accordingly:</p>
          <ol>
            <li>The Platform shall not be liable for any disputes, claims, damages, injuries, losses, or liabilities arising between pet owners and service providers, including but not limited to pet bites, allergic reactions to grooming products, dissatisfaction with services, injuries, or other incidents.</li>
            <li>The Platform shall not be liable for any inconsistency, dissatisfaction, or disagreement regarding haircut styles, grooming outcomes, or service results as requested by the pet owner.</li>
            <li>The Platform shall not be liable for any late bookings, missed appointments, delays, or scheduling issues. All such matters shall be resolved solely through communication between the service provider and the pet owner.</li>
            <li>The Platform does not offer any insurance coverage for pets, pet owners, or service providers. Any risks associated with the Services are assumed by the users.</li>
            <li>The Platform’s responsibility is limited to facilitating bookings and account management. All service-related liabilities rest solely with the service provider and pet owner.</li>
          </ol>
        </div>

        <div className="terms-section">
          <h3>Termination of Account and Platform Services</h3>
          <p>
            We may suspend or terminate your account or your use of the Platform at any time once proved of Terms and Conditions negligence. We reserve the right to change, suspend, or discontinue all or any aspect of the Platform at any time, with prior notice. You are personally liable for any transactions or charges that you incur prior to termination or suspension of your account and/or Platform services.
          </p>
          <p>
            Our Platform may contain typographical errors or inaccuracies and may not be complete or current. As such, we may correct any errors, inaccuracies, or omissions (including after an appointment has been booked) and change or update information at any time without prior notice. Such errors, inaccuracies or omissions may relate to pricing and availability, and we may cancel or refuse to accept any appointment booked based on incorrect pricing or availability of information.
          </p>
          <p>
            We may suspend or terminate your account or your use of the Platform at any time upon proven violation of these Terms and Conditions.
          </p>
          <p>
            <strong>Account Deactivation for Linked Roles.</strong> In the event of account cancellation where a single email address is tied to both a pet owner account and a service provider account, both accounts shall be deactivated simultaneously upon termination of the account.
          </p>
          <p>
            You are personally liable for any transactions or charges incurred prior to termination or suspension of your account.
          </p>
          <p>
            Upon deactivation, any 'Paid' bookings of the Pet Owner will be automatically cancelled. It is the responsibility of the Service Provider to settle any outstanding refunds manually prior to deactivation.
          </p>
        </div>

        <div className="terms-section">
          <h3>Disclaimer of Warranties (Additional Clarification)</h3>
          <p>
            Your access and use of the Platform and our Services are for your personal use and made voluntarily, at your own risk. You fully understand and agree that the Services, materials, information, software, facilities, and all other content featured on this Platform are provided “as is” and “as available” without warranties of any kind, express or implied. To the fullest extent permissible pursuant to applicable law, furlink, its parents, subsidiaries, affiliates or partners and our/their respective directors, officers, shareholders, and agents disclaim all representations or warranties of any kind, express or implied, including but not limited to fitness for a particular purpose or non-infringement. 
          </p>
          <p>
            furlink does not warrant or make any representations regarding the use or the results of the use of the materials, information, software, facilities, services, or other content in the Platform will not infringe the rights of others and furlink assumes no liability or responsibility for any errors or omissions in such materials, information, software, facilities, services or other content in the Platform or any other website. You also agree that furlink does not warrant that the information you transmitted, uploaded, or posted through the Platform will be secured and may be accessed, used, disclosed, disseminated, distributed, and copied by any unauthorized third party without our prior written consent. Neither advice nor information, oral or written, obtained from furlink or through the Platform, will create any warranty of any kind.
          </p>
          <p>
            The Platform does not provide any form of insurance, warranty, or guarantee for pet safety, service outcomes, or conduct of service providers. All services are availed at the user’s own risk.
          </p>
        </div>

        <div className="terms-section">
          <h3>Revisions to the Terms of Use</h3>
          <p>
            Our online services will continue to evolve to bring you new features and services and to implement technological advances. As a result, we may change these Terms from time to time without prior notice. Revised versions of these Terms will be posted on this page, together with an updated effective date. In some cases, we may also send an email or other communication notifying users of the changes. You should check this page periodically to see if there are any recent changes to these Term. By downloading, installing, accessing, or using any of our online services after we post any such changes, you agree to the updated Terms. Your continued use of any of our services shall be deemed as acceptance of any of the revisions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlatformTerms;