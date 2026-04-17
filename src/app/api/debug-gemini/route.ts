import { GoogleGenerativeAI } from "@google/generative-ai";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY no configurada" }, { status: 400 });
  }

  try {
    console.log("[DEBUG-GEMINI] API Key presente. Largo:", apiKey.length);
    console.log("[DEBUG-GEMINI] Inicializando GoogleGenerativeAI...");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    console.log("[DEBUG-GEMINI] Modelo cargado, enviando request simple...");

    const result = await model.generateContent("Hola, ¿eres Gemini?");
    const text = result.response.text();

    return Response.json({
      success: true,
      message: text.substring(0, 100),
      model: "gemini-2.5-flash",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DEBUG-GEMINI] Error:", msg);
    console.error("[DEBUG-GEMINI] Full error:", err);

    return Response.json({
      error: msg,
      fullError: String(err),
      type: err?.constructor?.name,
    }, { status: 500 });
  }
}
