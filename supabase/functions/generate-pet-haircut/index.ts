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
    
    // Clean up grooming specs if provided
    const additionalSpecs = groomingSpecs && groomingSpecs.trim() !== "" 
      ? ` Additionally, ${groomingSpecs}.` 
      : "";

    let finalPrompt = "";

    if (isRetry) {
      // YOUR 2ND PROMPT (Redo)
      finalPrompt = `I want a completely better result, realistic background like a studio type. Generate an Image of a ${petType} ${breed} in a ${hairstyle}. Make sure it is realistic, it captures the whole body of the pet, no unnecessary elements included like a toy or background clutter.${additionalSpecs}`;
    } else {
      // YOUR 1ST PROMPT
      finalPrompt = `Generate an Image of a ${petType} ${breed} in a ${hairstyle}. Make sure it is realistic, it captures the whole body of the pet, no unnecessary elements included like a toy or background clutter.${additionalSpecs}`;
    }

    // Generate URL using a high-fidelity model (Flux)
    // We add a random seed to ensure the AI actually generates a new variation
    const randomSeed = Math.floor(Math.random() * 1000000);
    const generateUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&nologo=true&model=flux&seed=${randomSeed}`;

    return new Response(JSON.stringify({ 
      generatedImageUrl: generateUrl,
      description: finalPrompt 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    })
  }
})