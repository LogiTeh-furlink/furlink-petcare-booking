// supabase/functions/create-paymongo-checkout/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // PetDetails.jsx sends { metadata, totalAmount }
    const { metadata, totalAmount } = await req.json()

    if (!metadata || !totalAmount) {
      throw new Error("Missing required fields: metadata or totalAmount")
    }

    // Charge the FULL total amount (not 30% down payment)
    const amountInCents = Math.round(parseFloat(totalAmount) * 100)

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
            success_url: "https://fuzzy-space-rotary-phone-r4r9vj9p9vp62xrgw-5173.app.github.dev/booking-success?status=paid",
            cancel_url: "https://fuzzy-space-rotary-phone-r4r9vj9p9vp62xrgw-5173.app.github.dev/booking-history?status=cancelled",
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