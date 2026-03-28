import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. DYNAMIC URL DETECTION (Option 2)
    // We grab the 'origin' from the request headers (e.g., https://your-codespace-5173.app.github.dev)
    const origin = req.headers.get("origin");
    
    // Fallback order: 1. Header Origin, 2. Supabase Secret, 3. Localhost
    const clientBaseUrl = origin || Deno.env.get("CLIENT_URL") || "http://localhost:5173";

    console.log(`Checkout request received from origin: ${clientBaseUrl}`);

    // PetDetails.jsx sends { metadata, totalAmount }
    const { metadata, totalAmount } = await req.json()

    if (!metadata || !totalAmount) {
      throw new Error("Missing required fields: metadata or totalAmount")
    }

    // PayMongo requires amount in CENTS (₱1.00 = 100)
    const amountInCents = Math.round(parseFloat(totalAmount) * 100)

    // 2. Create PayMongo Checkout Session
    const res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(Deno.env.get("PAYMONGO_SECRET_KEY") + ":")}`
      },
      body: JSON.stringify({
        data: {
          attributes: {
            show_description: true,
            line_items: [{
              amount: amountInCents,
              currency: "PHP",
              name: "FurLink Grooming Service - Full Payment",
              quantity: 1
            }],
            payment_method_types: ["gcash", "card", "paymaya"],
            
            // ⭐ DYNAMIC REDIRECTS: These now point back to whoever is currently booking
            success_url: `${clientBaseUrl}/booking-success?status=paid`,
            cancel_url: `${clientBaseUrl}/booking-failed?status=cancelled`,
            
            metadata: {
              // Stringify the entire booking payload so the webhook can reconstruct it
              booking_payload: JSON.stringify(metadata)
            }
          }
        }
      })
    })

    const data = await res.json()

    if (data.errors) {
      console.error("PayMongo API Error:", JSON.stringify(data.errors))
      throw new Error(data.errors[0].detail)
    }

    // 3. Return the checkout URL to the frontend
    return new Response(
      JSON.stringify({ checkout_url: data.data.attributes.checkout_url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (err) {
    console.error("Checkout creation error:", err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})