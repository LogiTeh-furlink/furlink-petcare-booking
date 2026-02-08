import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const payload = await req.json()
    const { record, old_record, type, table } = payload

    // 1. Initialize variables to be filled by the logic below
    let targetTemplateId = "";
    let templateParams: any = {};
    let config = {
      service_id: "",
      public_key: "",
      private_key: ""
    };

    // --- CASE A: PROFILES TABLE (User Signup & Role Upgrades) ---
    // Uses Account 1: logiteh045@gmail.com
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
        templateParams.subject = `Welcome to FurLink, ${record.first_name}! 🐾`
        templateParams.message = "We're thrilled to have you here. Explore our services or set up your shop to get started!"
      } 
      else if (type === 'UPDATE' && old_record.role !== record.role) {
        if (record.role === 'both') {
          templateParams.subject = "The best of both worlds! You're now a Provider & Owner 🐾"
          templateParams.message = "Congratulations! You can now book services and manage your own pet care business from one account."
        } else {
          templateParams.subject = "Your FurLink Account Role has been Updated"
          templateParams.message = `Your account has been updated to the ${record.role} role.`
        }
      }
    }

    // --- CASE B: SERVICE_PROVIDERS TABLE (Admin Approval/Rejection) ---
    // Uses Account 2: furlinkbylogitehserviceprovide@gmail.com
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
      }
    }

    // 2. SENDING LOGIC
    // We only execute the fetch if we found a valid template and a destination email
    if (targetTemplateId && (templateParams.to_email)) {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: config.service_id,
          template_id: targetTemplateId,
          user_id: config.public_key,
          accessToken: config.private_key,
          template_params: templateParams
        }),
      })

      const status = await response.text()
      return new Response(status, { status: response.status })
    }

    return new Response(JSON.stringify({ message: "No notification criteria met" }), { status: 200 })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})