import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const payload = await req.json();
    const { record, old_record, type, table } = payload;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let targetTemplateId = "";
    let templateParams: any = {};
    let config = {
      service_id: "",
      public_key: "",
      private_key: ""
    };

    // --- CASE A: PROFILES TABLE ---
    if (table === 'profiles') {
      config = {
        service_id: Deno.env.get('EMAILJS_SERVICE_ID')!,
        public_key: Deno.env.get('EMAILJS_PUBLIC_KEY')!,
        private_key: Deno.env.get('EMAILJS_PRIVATE_KEY')!
      };
      targetTemplateId = Deno.env.get('EMAILJS_TEMPLATE_ID')!;
      templateParams = {
        to_email: record.email,
        first_name: record.first_name,
        subject: '',
        message: ''
      };

      if (type === 'INSERT') {
        templateParams.subject = `Welcome to FurLink, ${record.first_name}! 🐾`;
        templateParams.message = "We're thrilled to have you here. Explore our services or set up your shop to get started!";
      } else if (type === 'UPDATE' && old_record.role !== record.role) {
        if (record.role === 'both') {
          templateParams.subject = "The best of both worlds! You're now a Provider & Owner 🐾";
          templateParams.message = "Congratulations! You can now book services and manage your own pet care business from one account.";
        }
      }
    }

    // --- CASE B: SERVICE_PROVIDERS TABLE ---
    else if (table === 'service_providers' && type === 'UPDATE') {
      if (old_record.status !== record.status) {
        config = {
          service_id: Deno.env.get('EMAILJS_SP_SERVICE_ID')!,
          public_key: Deno.env.get('EMAILJS_SP_PUBLIC_KEY')!,
          private_key: Deno.env.get('EMAILJS_SP_PRIVATE_KEY')!
        };
        const currentStatus = record.status?.toLowerCase();
        
        if (currentStatus === 'approved') {
          targetTemplateId = Deno.env.get('EMAILJS_SP_APPROVED_ID')!;
        } else if (currentStatus === 'rejected') {
          targetTemplateId = Deno.env.get('EMAILJS_SP_REJECTED_ID')!;
        }

        templateParams = {
          to_email: record.business_email,
          business_name: record.business_name,
          status: record.status,
          rejection_reason: record.rejection_reason || 'Please review our guidelines and try again.'
        };

        // --- IN-APP NOTIFICATION: Provider Approval/Rejection ---
        await supabaseAdmin.from('notifications').insert({
          user_id: record.user_id,
          title: currentStatus === 'approved' ? 'Application Approved! 🎉' : 'Application Update',
          message: currentStatus === 'approved' 
            ? `Welcome! Your shop ${record.business_name} is now live.` 
            : `Your application for ${record.business_name} requires changes.`,
          link: '/dashboard'
        });
      }
    }

    // --- CASE C: BOOKINGS TABLE ---
    else if (table === 'bookings') {
      config = {
        service_id: Deno.env.get('EMAILJS_BOOKING_SERVICE_ID')!,
        public_key: Deno.env.get('EMAILJS_BOOKING_PUBLIC_KEY')!,
        private_key: Deno.env.get('EMAILJS_BOOKING_PRIVATE_KEY')!
      };

      // Fetch User (Owner) & Provider (including user_id for notification)
      const { data: owner } = await supabaseAdmin.from('profiles').select('email, first_name').eq('id', record.user_id).single();
      const { data: provider } = await supabaseAdmin.from('service_providers').select('business_email, business_name, user_id').eq('id', record.provider_id).single();

      templateParams = {
        first_name: owner?.first_name,
        business_name: provider?.business_name,
        booking_date: record.booking_date,
        time_slot: record.time_slot,
        total_estimated_price: record.total_estimated_price,
        status: record.status
      };

      if (type === 'INSERT') {
        targetTemplateId = Deno.env.get('EMAILJS_NEW_BOOKING_TEMPLATE_ID')!;
        templateParams.to_email = provider?.business_email;

        // --- IN-APP NOTIFICATION: New Booking Request (Sent to Provider) ---
        if (provider?.user_id) {
          await supabaseAdmin.from('notifications').insert({
            user_id: record.user_id,
            title: 'Booking Request Sent 📧',
            message: `A request was sent to ${provider?.business_name}. Check your email for details.`,
            link: '/appointments'
          });
        }
      } 
      else if (type === 'UPDATE' && old_record.status !== record.status) {
        targetTemplateId = Deno.env.get('EMAILJS_STATUS_BOOKING_TEMPLATE_ID')!;
        templateParams.to_email = owner?.email;
        templateParams.rejection_reason_section = record.status === 'rejected' 
          ? `<p><strong>Reason for rejection:</strong> ${record.rejection_reason || 'Not specified.'}</p>` 
          : "<p>We look forward to seeing you and your pet!</p>";

        // --- IN-APP NOTIFICATION: Booking Status (Sent to Owner) ---
        await supabaseAdmin.from('notifications').insert({
          user_id: record.user_id,
          title: `Booking ${record.status.toUpperCase()}`,
          message: `Your booking for ${record.booking_date} with ${provider?.business_name} has been ${record.status}.`,
          link: '/appointments'
        });
      }
    }

    // --- SENDING EMAIL LOGIC ---
    if (targetTemplateId && templateParams.to_email) {
      await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: config.service_id,
          template_id: targetTemplateId,
          user_id: config.public_key,
          accessToken: config.private_key,
          template_params: templateParams
        }),
      });
      return new Response("OK", { status: 200 });
    }

    return new Response(JSON.stringify({ message: "No action taken" }), { status: 200 });

  } catch (err: any) {
    console.error("Critical Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});