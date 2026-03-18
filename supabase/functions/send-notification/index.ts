import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const { record, old_record, type, table } = payload;
    
    // ⭐ PROTECTION: If the webhook was triggered by the 'notifications' table itself, EXIT.
    // This prevents infinite loops.
    if (table === "notifications") {
      return new Response("Ignore notification table changes", { status: 200 });
    }

    const opType = type.toUpperCase();
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let subject = "";
    let htmlContent = "";
    let toEmail = "";
    let targetUserId = "";
    let notificationLink = "/dashboard";
    let emailOnly = false;

    // ==========================================
    // 1. PROFILES (Scenarios: 1, 3, 4, 17)
    // ==========================================
    if (table === "profiles") {
      toEmail = record.email;
      targetUserId = record.id;

      if (opType === "INSERT") {
        subject = "Welcome to FurLink! 🐾";
        htmlContent = `<p>Hi ${record.first_name},</p><p>Your account has been successfully registered. You can now explore grooming services and manage your pet profiles.</p>`;
      } 
      else if (opType === "UPDATE") {
        const suspensionChanged = record.suspension_end_date !== old_record?.suspension_end_date;
        
        if (suspensionChanged && record.suspension_end_date !== null) {
          subject = "Account Suspended Notice 🚫";
          htmlContent = `<p>Important: Your account has been suspended until <b>${new Date(record.suspension_end_date).toLocaleDateString()}</b> due to a violation of guidelines.</p>`;
        } 
        else if (suspensionChanged && record.suspension_end_date === null && old_record?.suspension_end_date !== null) {
          subject = "Account Reactivated ✨";
          htmlContent = `<p>Your suspension has ended. You now have full access to FurLink features again.</p>`;
        }
        else if (record.warning_count > (old_record?.warning_count || 0)) {
           subject = "Account Warning ⚠️";
           htmlContent = `<p>An administrator has issued a warning to your account. Please ensure you follow our community standards.</p>`;
        }
      }
    }

    // ==========================================
    // 2. SERVICE PROVIDERS (Scenarios: 2, 16)
    // ==========================================
    else if (table === "service_providers") {
      if (opType === "INSERT") {
        toEmail = Deno.env.get("ADMIN_EMAIL") ?? ""; 
        subject = "New Provider Application 📨";
        htmlContent = `<p>A new shop application from <b>${record.business_name}</b> is pending review.</p>`;
        notificationLink = "/admin-dashboard";
        emailOnly = true; // Admin usually only gets email
      } 
      else if (opType === "UPDATE" && record.status !== old_record?.status) {
        const { data: userProfile } = await supabaseAdmin.from("profiles").select("email").eq("id", record.user_id).single();
        toEmail = userProfile?.email;
        targetUserId = record.user_id;
        
        if (record.status === "approved") {
          subject = "Application Approved! 🎉";
          htmlContent = `<p>Congratulations! Your shop <b>${record.business_name}</b> is now live on FurLink.</p>`;
          notificationLink = "/service/dashboard";
        } else if (record.status === "rejected") {
          subject = "Application Status Update";
          htmlContent = `<p>We regret to inform you that your application for ${record.business_name} was not approved at this time.</p>`;
        }
      }
    }

    // ==========================================
    // 3. BOOKINGS (Scenarios: 5, 6, 7, 8, 9, 10, 11, 12, 13, 14)
    // ==========================================
    else if (table === "bookings") {
      const { data: owner } = await supabaseAdmin.from("profiles").select("email, first_name").eq("id", record.user_id).single();
      const { data: provider } = await supabaseAdmin.from("service_providers").select("business_email, business_name, user_id").eq("id", record.provider_id).single();

      const curStatus = record.status?.toLowerCase();
      const prevStatus = old_record?.status?.toLowerCase();

      if (opType === "INSERT") {
        toEmail = provider?.business_email;
        targetUserId = provider?.user_id;
        subject = "New Booking Request 📅";
        htmlContent = `<p>New request from ${owner?.first_name} for ${record.booking_date} at ${record.time_slot}.</p>`;
        notificationLink = "/service/dashboard";
      } 
      else if (opType === "UPDATE") {
        // Scenario 13: Rescheduled
        if (old_record?.booking_date !== record.booking_date || old_record?.time_slot !== record.time_slot) {
          toEmail = provider?.business_email;
          targetUserId = provider?.user_id;
          subject = "Appointment Rescheduled 🔄";
          htmlContent = `<p>${owner?.first_name} changed the booking to ${record.booking_date} at ${record.time_slot}.</p>`;
          notificationLink = "/service/dashboard";
        }
        // Scenario 6: SP Accepts/Declines
        else if (curStatus === "confirmed" && prevStatus === "pending") {
          toEmail = owner?.email;
          targetUserId = record.user_id;
          subject = "Booking Accepted! ✅";
          htmlContent = `<p>Your booking with ${provider?.business_name} has been accepted.</p>`;
          notificationLink = "/appointments";
        }
        else if (curStatus === "declined" && prevStatus === "pending") {
          toEmail = owner?.email;
          targetUserId = record.user_id;
          subject = "Booking Declined ❌";
          htmlContent = `<p>Your booking with ${provider?.business_name} was declined.</p>`;
          notificationLink = "/booking-history";
        }
        // Scenario 7: Payment Proof
        else if (curStatus === "for review" && prevStatus !== "for review") {
          toEmail = provider?.business_email;
          targetUserId = provider?.user_id;
          subject = "Payment Proof Submitted 💰";
          htmlContent = `<p>A pet owner submitted payment proof for a booking on ${record.booking_date}.</p>`;
          notificationLink = "/service/dashboard";
        }
        // Scenario 8: Payment Result
        else if ((curStatus === "paid" || curStatus === "void") && prevStatus === "for review") {
          toEmail = owner?.email;
          targetUserId = record.user_id;
          subject = `Payment ${curStatus.toUpperCase()} ✨`;
          htmlContent = `<p>Your payment to ${provider?.business_name} has been marked as ${curStatus}.</p>`;
          notificationLink = "/booking-history";
        }
        // Scenario 11/12: Cancellation
        else if (curStatus === "cancelled" && prevStatus !== "cancelled") {
          const byProvider = record.cancelled_by === 'provider';
          toEmail = byProvider ? owner?.email : provider?.business_email;
          targetUserId = byProvider ? record.user_id : provider?.user_id;
          subject = "Appointment Cancelled ❌";
          htmlContent = `<p>The appointment for ${record.booking_date} has been cancelled.</p>`;
        }
        // Scenario 14: Completed
        else if (curStatus === "completed" && prevStatus !== "completed") {
          toEmail = owner?.email;
          targetUserId = record.user_id;
          subject = "Service Completed! ⭐";
          htmlContent = `<p>Your service is done. Please leave a review for ${provider?.business_name}!</p>`;
          notificationLink = "/booking-history";
        }
      }
    }

    // ==========================================
    // 4. REVIEWS (Scenario: 15)
    // ==========================================
    else if (table === "reviews" && opType === "INSERT") {
      const { data: provider } = await supabaseAdmin.from("service_providers").select("business_email, user_id").eq("id", record.provider_id).single();
      toEmail = provider?.business_email;
      targetUserId = provider?.user_id;
      subject = "New Review Received! ⭐";
      htmlContent = `<p>A customer left feedback on your profile. View it in your insights.</p>`;
      notificationLink = "/service/customer-insight";
    }

    // ==========================================
    // 5. DISPATCH (IDEMPOTENT FIX)
    // ==========================================
    
    if (!subject || !htmlContent || !targetUserId) {
      return new Response("No target user or content", { status: 200 });
    }

    // ⭐ STEP A: CHECK FOR RECENT DUPLICATES (Anti-Double Count)
    // We check if a notification with this EXACT title was sent to this user in the last 5 seconds.
    const { data: recentNotif } = await supabaseAdmin
      .from("notifications")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("title", subject)
      .gt("created_at", new Date(Date.now() - 5000).toISOString()) // 5 second window
      .maybeSingle();

    if (recentNotif) {
      console.log("⚠️ Duplicate detected. Skipping redundant notification.");
      return new Response("Duplicate blocked", { status: 200 });
    }

    // ⭐ STEP B: PROCEED WITH SINGLE INSERT
    if (!emailOnly) {
      await supabaseAdmin.from("notifications").insert({
        user_id: targetUserId,
        title: subject,
        message: htmlContent.replace(/<[^>]*>?/gm, '').substring(0, 100),
        link: notificationLink
      });
    }

    // ⭐ STEP C: SEND EMAIL
    if (toEmail) {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com", port: 465, secure: true,
        auth: { user: Deno.env.get("SMTP_USER"), pass: Deno.env.get("SMTP_PASS") },
      });

      await transporter.sendMail({
        from: `"FurLink" <${Deno.env.get("SMTP_USER")}>`,
        to: toEmail,
        subject: subject,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px;">
            <h2 style="color: #0E2679; border-bottom: 2px solid #0E2679; padding-bottom: 10px;">FurLink Update</h2>
            <div style="padding: 20px 0; font-size: 16px; line-height: 1.5; color: #333;">
              ${htmlContent}
            </div>
          </div>`
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    console.error("💥 Function Crash:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});