// supabase/functions/paymongo-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

serve(async (req) => {
  try {
    const body = await req.json()

    // 1. Get the Event Type and the Unique Checkout Session ID
    const eventType = body.data?.attributes?.type
    // PayMongo Session ID is located at body.data.attributes.data.id
    const checkoutSessionId = body.data?.attributes?.data?.id 

    console.log("Event type:", eventType, "Session ID:", checkoutSessionId)

    if (eventType !== "checkout_session.payment.paid") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })
    }

    // 2. Extract Metadata (metadata lives in payments array for webhooks)
    const checkoutAttributes = body.data?.attributes?.data?.attributes
    const payments = checkoutAttributes?.payments

    let metadata =
      payments?.[0]?.attributes?.metadata ||
      checkoutAttributes?.payment_intent?.attributes?.metadata ||
      checkoutAttributes?.metadata

    if (!metadata?.booking_payload) {
      throw new Error("Missing booking_payload in webhook metadata")
    }

    const bookingData = JSON.parse(metadata.booking_payload)
    const { user_id, provider_id, booking_date, time_slot, total_estimated_price, pets } = bookingData

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. ⭐ FIXED IDEMPOTENCY CHECK
    // Check by checkoutSessionId instead of user/date/time.
    // This allows the same user to book the same slot again in a NEW payment session.
    const { data: existingBooking } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('paymongo_session_id', checkoutSessionId)
      .maybeSingle()

    if (existingBooking) {
      console.log("⚠️ Duplicate webhook — transaction already processed:", checkoutSessionId)
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 })
    }

    // 4. Insert main booking (Including the Session ID)
    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .insert([{
        user_id,
        provider_id,
        booking_date,
        time_slot,
        total_estimated_price: parseFloat(total_estimated_price),
        status: 'for approval',
        paymongo_session_id: checkoutSessionId // ⭐ Save this to block future duplicates of THIS payment
      }])
      .select()
      .single()

    if (bErr) throw new Error(`Booking insert failed: ${bErr.message}`)

    // 5. Insert each pet and its services
    for (const pet of pets) {
      const { data: petRecord, error: pErr } = await supabaseAdmin
        .from('booking_pets')
        .insert([{
          booking_id: booking.id,
          pet_name: pet.pet_name,
          pet_type: pet.pet_type,
          birth_date: pet.birth_date || null,
          weight_kg: parseFloat(pet.weight_kg),
          calculated_size: pet.calculated_size,
          breed: pet.breed,
          gender: pet.gender,
          behavior: Array.isArray(pet.behavior) ? pet.behavior.join(', ') : (pet.behavior || ''),
          vaccine_card_url: pet.vaccine_url,
          grooming_specifications: pet.grooming_specifications || null,
          emergency_consent: pet.emergency_consent || false,
          registered_pet_id: pet.registered_pet_id || null,
          selected_haircut: pet.selected_haircut || null
        }])
        .select()
        .single()

      if (pErr) continue

      if (pet.services?.length && petRecord) {
        const serviceInserts = pet.services
          .filter((s: any) => s.id && s.service_name)
          .map((s: any) => ({
            booking_pet_id: petRecord.id,
            service_id: s.id,
            service_name: s.service_name,
            service_type: s.service_type || 'Individual Service',
            price: parseFloat(s.price)
          }))

        if (serviceInserts.length > 0) {
          await supabaseAdmin.from('booking_services').insert(serviceInserts)
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, booking_id: booking.id }), { status: 200 })

  } catch (err) {
    console.error("❌ Webhook processing error:", err.message)
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 200 })
  }
})