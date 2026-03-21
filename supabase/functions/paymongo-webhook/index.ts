// supabase/functions/paymongo-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

serve(async (req) => {
  try {
    const body = await req.json()

    // Only process successful payment events
    const eventType = body.data?.attributes?.type
    console.log("Event type:", eventType)

    if (eventType !== "checkout_session.payment.paid") {
      console.log("Ignoring non-payment event:", eventType)
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })
    }

    // ✅ Based on your real PayMongo webhook payload, the metadata lives here:
    // body.data.attributes.data.attributes.payments[0].attributes.metadata
    //
    // We try multiple paths as fallbacks just in case PayMongo changes structure:
    const checkoutAttributes = body.data?.attributes?.data?.attributes
    const payments = checkoutAttributes?.payments

    let metadata =
      payments?.[0]?.attributes?.metadata ||          // ← real location from your logs
      checkoutAttributes?.payment_intent?.attributes?.metadata ||
      checkoutAttributes?.metadata ||
      body.data?.attributes?.metadata

    console.log("Extracted metadata:", JSON.stringify(metadata))

    if (!metadata?.booking_payload) {
      // Log the full structure so we can debug future changes
      console.error("❌ Missing booking_payload. Tried paths on checkoutAttributes:", JSON.stringify(Object.keys(checkoutAttributes || {})))
      console.error("Payments array:", JSON.stringify(payments?.map((p: any) => Object.keys(p?.attributes || {}))))
      throw new Error("Missing booking_payload in webhook metadata")
    }

    let bookingData
    try {
      bookingData = JSON.parse(metadata.booking_payload)
    } catch (parseErr) {
      throw new Error(`Failed to parse booking_payload: ${parseErr.message}`)
    }

    const { user_id, provider_id, booking_date, time_slot, total_estimated_price, pets } = bookingData

    if (!user_id || !provider_id || !booking_date || !time_slot || !pets?.length) {
      throw new Error(`Missing required booking fields: user_id=${user_id}, provider_id=${provider_id}`)
    }

    console.log(`✅ Processing booking: user=${user_id}, provider=${provider_id}, date=${booking_date}`)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Idempotency check — prevent duplicate bookings if webhook fires twice
    const { data: existingBooking } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('user_id', user_id)
      .eq('provider_id', provider_id)
      .eq('booking_date', booking_date)
      .eq('time_slot', time_slot)
      .eq('status', 'for approval')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingBooking) {
      console.log("⚠️ Duplicate webhook — booking already exists:", existingBooking.id)
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 })
    }

    // 1. Insert main booking
    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .insert([{
        user_id,
        provider_id,
        booking_date,
        time_slot,
        total_estimated_price: parseFloat(total_estimated_price),
        status: 'for approval'
      }])
      .select()
      .single()

    if (bErr) throw new Error(`Booking insert failed: ${bErr.message}`)
    console.log("✅ Booking created:", booking.id)

    // 2. Insert each pet and its services
    for (const pet of pets) {
      console.log(`Inserting pet: ${pet.pet_name}`)

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

      if (pErr) {
        console.error(`❌ Pet insert error for ${pet.pet_name}:`, pErr.message)
        continue
      }

      console.log("✅ Pet created:", petRecord.id)

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
          const { error: sErr } = await supabaseAdmin
            .from('booking_services')
            .insert(serviceInserts)

          if (sErr) {
            console.error(`❌ Services insert error:`, sErr.message)
          } else {
            console.log(`✅ Inserted ${serviceInserts.length} service(s) for pet ${petRecord.id}`)
          }
        }
      }
    }

    console.log("=== WEBHOOK PROCESSED SUCCESSFULLY ===")
    return new Response(JSON.stringify({ ok: true, booking_id: booking.id }), { status: 200 })

  } catch (err) {
    console.error("❌ Webhook processing error:", err.message)
    // Return 200 to stop PayMongo from retrying on logic errors
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 200 }
    )
  }
})