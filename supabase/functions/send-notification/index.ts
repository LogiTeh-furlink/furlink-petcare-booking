import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const payload = await req.json()
    const { record, old_record, type, table } = payload

    // 1. Setup default parameters
    let templateParams = {
      to_email: record.email,
      first_name: record.first_name,
      role: '',
      subject: '',
      message: ''
    }

    let targetTemplateId = Deno.env.get('EMAILJS_TEMPLATE_ID'); // Default Template

    // --- SCENARIO 1: New Signup (INSERT) ---
    if (table === 'profiles' && type === 'INSERT') {
      templateParams.subject = `Welcome to FurLink, ${record.first_name}! 🐾`
      templateParams.role = record.role === 'pet_owner' ? 'Pet Owner' : 'Service Provider'
      templateParams.message = "We're thrilled to have you here. Explore our services or set up your shop to get started!"
    }

    // --- SCENARIO 2: Role Change (UPDATE) ---
    if (table === 'profiles' && type === 'UPDATE' && old_record.role !== record.role) {
      
      if (record.role === 'both') {
        // Use a more exciting subject and your specific "Both" template
        templateParams.subject = "The best of both worlds! You're now a Provider & Owner 🐾"
        templateParams.role = "Pet Owner & Service Provider"
        templateParams.message = "Congratulations! You can now book services for your pets and manage your own pet care business all from one account."
        
        // Use the specific Template ID for 'both' role if you have one, 
        // otherwise it stays as the default.
        // targetTemplateId = 'YOUR_NEW_BOTH_ROLE_TEMPLATE_ID' 
      } else {
        templateParams.subject = "Your FurLink Account Role has been Updated"
        templateParams.role = record.role === 'pet_owner' ? 'Pet Owner' : 'Service Provider'
        templateParams.message = `Your account has been updated to the ${templateParams.role} role.`
      }
    }

    // 2. Send to EmailJS if a subject was set (meaning a scenario matched)
    if (templateParams.to_email && templateParams.subject) {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: Deno.env.get('EMAILJS_SERVICE_ID'),
          template_id: targetTemplateId,
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