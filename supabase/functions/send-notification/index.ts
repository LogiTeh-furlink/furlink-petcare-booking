import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const payload = await req.json()
    const { record, old_record, type, table } = payload

    // 1. Initialize params with first_name
    let templateParams = {
      to_email: record.email,
      first_name: record.first_name, // Changed from user_name
      role: '',
      subject: '',
      message: ''
    }

    // --- SCENARIO 1: New Signup ---
    if (table === 'profiles' && type === 'INSERT') {
      templateParams.subject = `Welcome to FurLink, ${record.first_name}!`
      templateParams.role = record.role === 'pet_owner' ? 'Pet Owner' : 'Service Provider'
      templateParams.message = "We're thrilled to have you here. Explore our services or set up your shop to get started!"
    }

    // --- SCENARIO 2: Role Change (e.g., to 'both') ---
    if (table === 'profiles' && type === 'UPDATE' && old_record.role !== record.role) {
      templateParams.subject = "Your Account Role has been Updated"
      templateParams.role = record.role === 'both' ? 'Pet Owner & Service Provider' : record.role
      templateParams.message = `Your role has successfully changed to ${templateParams.role}. You now have access to more features!`
    }

    // 2. Send the request to EmailJS
    if (templateParams.to_email && templateParams.subject) {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: Deno.env.get('EMAILJS_SERVICE_ID'),
          template_id: Deno.env.get('EMAILJS_TEMPLATE_ID'),
          user_id: Deno.env.get('EMAILJS_PUBLIC_KEY'),
          accessToken: Deno.env.get('EMAILJS_PRIVATE_KEY'),
          template_params: templateParams
        }),
      })

      const status = await response.text()
      return new Response(status, { status: response.status })
    }

    return new Response(JSON.stringify({ message: "No notification sent" }), { status: 200 })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})