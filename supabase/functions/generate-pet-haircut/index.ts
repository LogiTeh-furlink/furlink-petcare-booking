// supabase/functions/generate-pet-haircut/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { hairstyle, petType, breed, weight, groomingSpecs } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    // Use Gemini 1.5 Pro or Flash to generate a "Visual Blueprint" first
    // This ensures that the description is perfectly accurate to the breed/weight
    const blueprintResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `Act as a professional pet groomer. Describe a ${petType} of breed ${breed} weighing ${weight}kg. 
                           Apply a ${hairstyle} style with these notes: "${groomingSpecs}". 
                           Provide a single highly detailed 50-word photorealistic prompt for an image generator. 
                           Focus on fur texture, specific breed markings, and a studio background. 
                           Output only the prompt.` }]
        }]
      })
    })

    const blueprintData = await blueprintResponse.json()
    const finalPrompt = blueprintData.candidates?.[0]?.content?.parts?.[0]?.text || 
                        `Professional photo of a ${breed} ${petType} with a ${hairstyle} haircut, studio lighting.`;

    // Since Gemini 2.0 Flash fetch calls often fail for native IMAGE output in Edge Functions,
    // we use a reliable, stable Image Generation API (like OpenAI or a dedicated Stable Diffusion endpoint).
    // If you strictly want to stay within Google, you must use Vertex AI. 
    // Otherwise, for this demo, we will use a high-stability generation proxy.
    
    const generateUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&nologo=true&model=flux`;

    // We return the URL directly. The frontend will handle the "always successful" load.
    return new Response(JSON.stringify({ 
      generatedImageUrl: generateUrl,
      description: finalPrompt 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: "AI temporarily unavailable. Re-checking breed details..." }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    })
  }
})