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

    // ==========================================
    // 1. PROFILES (Signups & Admin Warnings)
    // ==========================================
    if (table === "profiles") {
      toEmail = record.email;
      targetUserId = record.id;

      if (opType === "INSERT") {
        subject = "Welcome to FurLink! 🐾";
        htmlContent = `<h2>Hi ${record.first_name}!</h2><p>Your account is ready. Explore our pet grooming services today.</p>`;
      } 
      else if (opType === "UPDATE" && record.suspension_end_date !== old_record?.suspension_end_date && record.suspension_end_date !== null) {
        subject = "Account Warning ⚠️";
        htmlContent = `<h2>Important Notice</h2><p>An admin has updated your account status. Suspension end date: ${record.suspension_end_date}</p>`;
      }
    } 

    // ==========================================
    // 2. BOOKINGS (New, Rebook, Accept, Pay, Cancel)
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
        htmlContent = `<h3>New request from ${owner?.first_name || 'User'}</h3><p>Date: ${record.booking_date} at ${record.time_slot}</p>`;
      } 
      else if (opType === "UPDATE") {
        if (old_record?.booking_date !== record.booking_date || old_record?.time_slot !== record.time_slot) {
          toEmail = provider?.business_email;
          targetUserId = provider?.user_id;
          subject = "Appointment Rescheduled 🔄";
          htmlContent = `<h3>Schedule Updated</h3><p>${owner?.first_name || 'Owner'} changed the booking to ${record.booking_date} at ${record.time_slot}.</p>`;
        }
        else if (curStatus === "cancelled" && prevStatus !== "cancelled") {
          toEmail = provider?.business_email;
          targetUserId = provider?.user_id;
          subject = "Booking Cancelled ❌";
          htmlContent = `<p>The booking for ${record.booking_date} has been cancelled.</p>`;
        }
        else if ((curStatus === "paid" || curStatus === "void") && prevStatus === "for review") {
          toEmail = owner?.email;
          targetUserId = record.user_id;
          subject = `Payment ${curStatus.toUpperCase()} ✨`;
          htmlContent = `<p>Your payment to ${provider?.business_name} was ${curStatus}.</p>`;
        }
        // Fail-safe fallback if none of the above specific updates matched
        else if (!htmlContent) {
           toEmail = provider?.business_email;
           targetUserId = provider?.user_id;
           htmlContent = `<p>A booking update occurred. New status: <strong>${curStatus}</strong></p>`;
        }
      }
    }

    // ==========================================
    // 3. REVIEWS (Owner -> SP)
    // ==========================================
    else if (table === "reviews" && opType === "INSERT") {
      const { data: provider } = await supabaseAdmin.from("service_providers").select("business_email, user_id").eq("id", record.provider_id).single();
      const { data: owner } = await supabaseAdmin.from("profiles").select("first_name").eq("id", record.user_id).single();

      toEmail = provider?.business_email;
      targetUserId = provider?.user_id;
      subject = "New Review Received! ⭐";
      htmlContent = `<h3>New Feedback from ${owner?.first_name}</h3><p>Rating: ${record.rating_overall}/5</p>`;
    }

    // ==========================================
    // 4. PERSIST IN-APP NOTIFICATION
    // ==========================================
    if (targetUserId && subject) {
      const { error: notifErr } = await supabaseAdmin.from("notifications").insert({
        user_id: targetUserId,
        title: subject,
        message: "Check your email for full details.",
        link: "/dashboard"
      });
      if (notifErr) console.error("❌ Notification Error:", notifErr.message);
      else console.log("✅ In-App Notification Sent");
    }

    // ==========================================
    // 5. SEND EMAIL VIA NODEMAILER (Modern Fix)
    // ==========================================
    if (toEmail && htmlContent) {
      console.log(`📧 Dispatching Nodemailer email to: ${toEmail}`);
      
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true, // Use Port 465 for Implicit TLS
        auth: {
          user: Deno.env.get("SMTP_USER"),
          pass: Deno.env.get("SMTP_PASS"), // Ensure no spaces in App Password
        },
      });

      try {
        const info = await transporter.sendMail({
          from: `"FurLink" <${Deno.env.get("SMTP_USER")}>`,
          to: toEmail,
          subject: subject,
          text: htmlContent.replace(/<[^>]*>?/gm, ''), // Plain text fallback
          html: htmlContent,
        });

        console.log("✅ SUCCESS: Email sent via Nodemailer!", info.messageId);
      } catch (smtpErr) {
        console.error("❌ Nodemailer Failure:", smtpErr.message);
      }
    } else {
      console.log("⚠️ Skipping Email: toEmail or htmlContent is missing.");
    }

    return new Response(JSON.stringify({ message: "Success" }), { 
      status: 200,
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error("💥 Function Crash:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});