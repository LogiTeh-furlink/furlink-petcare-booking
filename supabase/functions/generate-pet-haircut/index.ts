import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { hairstyle, petType, breed, groomingSpecs, isRetry, bookingId } = await req.json()
    const HUGGING_FACE_TOKEN = Deno.env.get("HUGGING_FACE_ACCESS_TOKEN");
    
    // Initialize Supabase Admin for DB saving
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const additionalSpecs = groomingSpecs && groomingSpecs.trim() !== "" 
      ? ` Additionally, ${groomingSpecs}.` 
      : "";

    // YOUR EXACT PROMPTS
    let finalPrompt = "";
    if (isRetry) {
      finalPrompt = `I want a completely better result, realistic background like a studio type. Generate an Image of a ${petType} ${breed} in a ${hairstyle}. Make sure it is realistic, it captures the whole body of the pet, no unnecessary elements included like a toy or background clutter.${additionalSpecs}`;
    } else {
      finalPrompt = `Generate an Image of a ${petType} ${breed} in a ${hairstyle}. Make sure it is realistic, it captures the whole body of the pet, no unnecessary elements included like a toy or background clutter.${additionalSpecs}`;
    }

    let finalImageUrl = "";
    let source = "";

    try {
      if (!HUGGING_FACE_TOKEN) throw new Error("Missing HF Token");

      // ATTEMPT 1: Hugging Face (New Router Endpoint)
      const hfResponse = await fetch(
        "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0",
        {
          headers: { 
            Authorization: `Bearer ${HUGGING_FACE_TOKEN}`,
            "Content-Type": "application/json"
          },
          method: "POST",
          body: JSON.stringify({ 
            inputs: finalPrompt,
            options: { wait_for_model: true } 
          }),
        }
      );

      if (hfResponse.ok) {
        const imageBlob = await hfResponse.blob();
        const arrayBuffer = await imageBlob.arrayBuffer();
        
        // Binary to Base64 conversion
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8Array.byteLength; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        finalImageUrl = `data:image/jpeg;base64,${btoa(binary)}`;
        source = 'huggingface';
      } else {
        throw new Error("HF Busy/New Endpoint Error");
      }

    } catch (hfError) {
      console.warn("Hugging Face failed, using Pollinations fallback.");

      // ATTEMPT 2: Pollinations Fallback
      const randomSeed = Math.floor(Math.random() * 1000000);
      finalImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&nologo=true&model=flux&seed=${randomSeed}`;
      source = 'pollinations';
    }

    // --- DB SAVING LOGIC ---
    // If bookingId is passed (e.g., from an "Edit" or "Re-generate" action), save to DB immediately
    if (bookingId && finalImageUrl) {
      const { error: dbError } = await supabaseAdmin
        .from('booking_pets')
        .update({ ai_generated_url: finalImageUrl })
        .eq('booking_id', bookingId);
      
      if (dbError) console.error("Database Update Error:", dbError.message);
    }

    return new Response(JSON.stringify({ 
      generatedImageUrl: finalImageUrl,
      description: finalPrompt,
      source: source
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Critical Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    })
  }
})