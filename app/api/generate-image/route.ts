import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const encodedPrompt = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 1000000);
    const pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=1024&height=1024&nologo=true`;

    const response = await fetch(pollUrl);
    
    if (!response.ok) {
      throw new Error("Failed to generate image via Pollinations API");
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64Data}`;

    return NextResponse.json({ success: true, imageUrl });
  } catch (error: any) {
    console.error("Image Gen Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}