import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const { record, old_record, type, table } = payload;
    const opType = type.toUpperCase();

    console.log(`🔔 Triggered: ${opType} on ${table}. ID: ${record?.id}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let subject = "FurLink Update 🐾";
    let htmlContent = "";
    let toEmail = "";
    let targetUserId = "";
    let notificationLink = "/dashboard";

    // ==========================================
    // 1. PROFILES (Scenarios: 1, 8, 11, 12)
    // ==========================================
    if (table === "profiles") {
      toEmail = record.email;
      targetUserId = record.id;

      if (opType === "INSERT") {
        subject = "Welcome to FurLink! 🐾"; // Scenario 1
        htmlContent = `<h2>Hi ${record.first_name}!</h2><p>Your account is ready. Explore our pet grooming services today.</p>`;
      } 
      else if (opType === "UPDATE") {
        const suspensionChanged = record.suspension_end_date !== old_record?.suspension_end_date;
        
        // Scenario 11: Account Suspended
        if (suspensionChanged && record.suspension_end_date !== null) {
          subject = "Account Suspended 🚫";
          htmlContent = `<p>Important: Your account has been suspended until <b>${new Date(record.suspension_end_date).toLocaleDateString()}</b>.</p>`;
        } 
        // Scenario 12: Suspension Ended
        else if (suspensionChanged && record.suspension_end_date === null && old_record?.suspension_end_date !== null) {
          subject = "Account Reactivated ✨";
          htmlContent = `<p>Your suspension period has ended. You may now use FurLink features again.</p>`;
        }
        // Scenario 8: General Warning / Active Status Toggle
        else if (record.is_active === true && old_record?.is_active === false) {
           subject = "Account Status Updated ⚠️";
           htmlContent = `<p>An admin has updated your account status. Please check your profile for details.</p>`;
        }
      }
    }

    // ==========================================
    // 2. SERVICE PROVIDERS (Scenarios: 2, 13)
    // ==========================================
    else if (table === "service_providers") {
      if (opType === "INSERT") {
        // Scenario 13: Admin receives notification of new application
        toEmail = Deno.env.get("ADMIN_EMAIL") ?? ""; 
        targetUserId = record.approved_by || null; // Ensure you handle admin notification logic
        subject = "New Provider Application 📨";
        htmlContent = `<p>A new shop application from <b>${record.business_name}</b> is pending review.</p>`;
        notificationLink = "/admin-dashboard";
      } 
      else if (opType === "UPDATE" && record.status !== old_record?.status) {
        // Scenario 2: Applicant notified of Approval/Rejection
        const { data: userProfile } = await supabaseAdmin.from("profiles").select("email, id").eq("id", record.user_id).single();
        toEmail = userProfile?.email;
        targetUserId = record.user_id;
        
        if (record.status === "approved") {
          subject = "Application Approved! 🎉";
          htmlContent = `<h2>Congratulations!</h2><p>Your shop <b>${record.business_name}</b> is now live on FurLink.</p>`;
          notificationLink = "/service/dashboard";
        } else if (record.status === "rejected") {
          subject = "Application Status Update";
          htmlContent = `<p>We regret to inform you that your application for ${record.business_name} was not approved at this time.</p>`;
        }
      }
    }

    // ==========================================
    // 3. BOOKINGS (Scenarios: 3, 4, 5, 6, 7, 10)
    // ==========================================
    else if (table === "bookings") {
      const { data: owner } = await supabaseAdmin.from("profiles").select("email, first_name").eq("id", record.user_id).single();
      const { data: provider } = await supabaseAdmin.from("service_providers").select("business_email, business_name, user_id").eq("id", record.provider_id).single();

      const curStatus = record.status?.toLowerCase();
      const prevStatus = old_record?.status?.toLowerCase();

      if (opType === "INSERT") {
        // Scenario 3: SP notified of new request
        toEmail = provider?.business_email;
        targetUserId = provider?.user_id;
        subject = "New Booking Request 📅";
        htmlContent = `<h3>New request from ${owner?.first_name}</h3><p>Date: ${record.booking_date} at ${record.time_slot}</p>`;
        notificationLink = "/service/dashboard";
      } 
      else if (opType === "UPDATE") {
        // Scenario 4: User Rebooks/Reschedules
        if (old_record?.booking_date !== record.booking_date || old_record?.time_slot !== record.time_slot) {
          toEmail = provider?.business_email;
          targetUserId = provider?.user_id;
          subject = "Appointment Rescheduled 🔄";
          htmlContent = `<p>${owner?.first_name} changed the booking to ${record.booking_date} at ${record.time_slot}.</p>`;
          notificationLink = "/service/dashboard";
        }
        // Scenario 5: SP Accepts/Declines
        else if (curStatus === "confirmed" && prevStatus === "pending") {
          toEmail = owner?.email;
          targetUserId = record.user_id;
          subject = "Booking Accepted! ✅";
          htmlContent = `<p>Your booking request with ${provider?.business_name} has been accepted.</p>`;
          notificationLink = "/appointments";
        }
        else if (curStatus === "declined" && prevStatus === "pending") {
          toEmail = owner?.email;
          targetUserId = record.user_id;
          subject = "Booking Declined ❌";
          htmlContent = `<p>Your booking with ${provider?.business_name} was declined.</p>`;
          notificationLink = "/booking-history";
        }
        // Scenario 6.1: Owner submits payment (Status changes to 'for review')
        else if (curStatus === "for review" && prevStatus !== "for review") {
          toEmail = provider?.business_email;
          targetUserId = provider?.user_id;
          subject = "Payment Proof Submitted 💰";
          htmlContent = `<p>A pet owner has submitted a payment verification request for a booking on ${record.booking_date}.</p>`;
          notificationLink = "/service/dashboard";
        }
        // Scenario 6.2: SP Accepts/Voids payment
        else if ((curStatus === "paid" || curStatus === "void") && prevStatus === "for review") {
          toEmail = owner?.email;
          targetUserId = record.user_id;
          subject = `Payment ${curStatus.toUpperCase()} ✨`;
          htmlContent = `<p>Your payment to ${provider?.business_name} has been marked as <b>${curStatus}</b>.</p>`;
          notificationLink = "/booking-history";
        }
        // Scenario 7: Cancellation
        else if (curStatus === "cancelled" && prevStatus !== "cancelled") {
          // If Owner cancels, notify SP. If SP cancels, notify Owner. 
          // Here we notify the "other party" based on who triggered it (simplified to notify SP)
          toEmail = provider?.business_email;
          targetUserId = provider?.user_id;
          subject = "Appointment Cancelled ❌";
          htmlContent = `<p>The appointment for ${record.booking_date} has been cancelled.</p>`;
        }
        // Scenario 10: Appointment Done -> Prompt Review
        else if (curStatus === "completed" && prevStatus !== "completed") {
          toEmail = owner?.email;
          targetUserId = record.user_id;
          subject = "How was the service? ⭐";
          htmlContent = `<p>Your appointment with ${provider?.business_name} is finished. Please leave a review to help others!</p>`;
          notificationLink = "/booking-history";
        }
      }
    }

    // ==========================================
    // 4. REVIEWS (Scenario: 9)
    // ==========================================
    else if (table === "reviews" && opType === "INSERT") {
      const { data: provider } = await supabaseAdmin.from("service_providers").select("business_email, user_id").eq("id", record.provider_id).single();
      toEmail = provider?.business_email;
      targetUserId = provider?.user_id;
      subject = "New Review Received! ⭐";
      htmlContent = `<p>A customer has left feedback on your business profile. View it in your insights.</p>`;
      notificationLink = "/service/customer-insight";
    }

    // ==========================================
    // 5. DISPATCH ACTIONS (In-App & Email)
    // ==========================================
    
    // 5A. Insert In-App Notification
    if (targetUserId && subject) {
      const { error: notifErr } = await supabaseAdmin.from("notifications").insert({
        user_id: targetUserId,
        title: subject,
        message: htmlContent.replace(/<[^>]*>?/gm, '').substring(0, 100) + "...", // Clean text
        link: notificationLink
      });
      if (notifErr) console.error("❌ Notification Error:", notifErr.message);
    }

    // 5B. Send Email via Nodemailer
    if (toEmail && htmlContent) {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: Deno.env.get("SMTP_USER"),
          pass: Deno.env.get("SMTP_PASS"),
        },
      });

      try {
        await transporter.sendMail({
          from: `"FurLink" <${Deno.env.get("SMTP_USER")}>`,
          to: toEmail,
          subject: subject,
          html: htmlContent,
        });
        console.log(`✅ Email sent to ${toEmail}`);
      } catch (smtpErr) {
        console.error("❌ SMTP Error:", smtpErr.message);
      }
    }

    return new Response(JSON.stringify({ message: "Processed Successfully" }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error("💥 Function Crash:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});