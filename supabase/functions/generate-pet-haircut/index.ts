// supabase/functions/generate-pet-haircut/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { hairstyle, petType, breed, groomingSpecs, isRetry } = await req.json()
    const HUGGING_FACE_TOKEN = Deno.env.get("HUGGING_FACE_ACCESS_TOKEN");
    
    const additionalSpecs = groomingSpecs && groomingSpecs.trim() !== "" 
      ? ` Additionally, ${groomingSpecs}.` 
      : "";

    let finalPrompt = "";
    if (isRetry) {
      finalPrompt = `I want a completely better result, realistic background like a studio type. Generate an Image of a ${petType} ${breed} in a ${hairstyle}. Make sure it is realistic, it captures the whole body of the pet, no unnecessary elements included like a toy or background clutter.${additionalSpecs}`;
    } else {
      finalPrompt = `Generate an Image of a ${petType} ${breed} in a ${hairstyle}. Make sure it is realistic, it captures the whole body of the pet, no unnecessary elements included like a toy or background clutter.${additionalSpecs}`;
    }

    try {
      if (!HUGGING_FACE_TOKEN) throw new Error("Missing HF Token");

      // UPDATED ENDPOINT: Using the new router endpoint
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
        const base64String = btoa(binary);
        const dataUri = `data:image/jpeg;base64,${base64String}`;

        return new Response(JSON.stringify({ 
          generatedImageUrl: dataUri,
          description: finalPrompt,
          source: 'huggingface'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      throw new Error("HF Busy/New Endpoint Error");

    } catch (hfError) {
      console.warn("Hugging Face failed, using Pollinations fallback.");

      const randomSeed = Math.floor(Math.random() * 1000000);
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&nologo=true&model=flux&seed=${randomSeed}`;

      return new Response(JSON.stringify({ 
        generatedImageUrl: pollinationsUrl,
        description: finalPrompt,
        source: 'pollinations'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    })
  }
})