
import { GoogleGenAI, Type } from "@google/genai";
import { MaintenanceRecord } from "../types";

const DAILY_LIMIT = 50; 
const RESET_HOUR_SPAIN = 9;
const SPAIN_TZ = "Europe/Madrid";

const getUsageData = () => {
  const stored = localStorage.getItem('ai_usage_stats');
  const nowSpain = new Date(new Date().toLocaleString("en-US", { timeZone: SPAIN_TZ }));
  
  const lastExpectedReset = new Date(nowSpain);
  lastExpectedReset.setHours(RESET_HOUR_SPAIN, 0, 0, 0);
  
  if (nowSpain < lastExpectedReset) {
    lastExpectedReset.setDate(lastExpectedReset.getDate() - 1);
  }

  if (!stored) {
    const initial = { count: 0, lastReset: nowSpain.toISOString() };
    localStorage.setItem('ai_usage_stats', JSON.stringify(initial));
    return initial;
  }

  let data = JSON.parse(stored);
  const lastUsedSpain = new Date(new Date(data.lastReset).toLocaleString("en-US", { timeZone: SPAIN_TZ }));

  if (lastUsedSpain < lastExpectedReset) {
    data = { count: 0, lastReset: nowSpain.toISOString() };
    localStorage.setItem('ai_usage_stats', JSON.stringify(data));
  }
  
  return data;
};

const trackUsage = () => {
  const data = getUsageData();
  data.count += 1;
  data.lastReset = new Date().toISOString();
  localStorage.setItem('ai_usage_stats', JSON.stringify(data));
};

export const GeminiService = {
  getUsage: () => getUsageData(),

  analyzeDataAndProfile: async (records: MaintenanceRecord[], query: string) => {
    try {
      const usage = getUsageData();
      if (usage.count >= DAILY_LIMIT) return "🚫 **LÍMITE ALCANZADO**\nReintento mañana 9:00 AM.";

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const cleanRecords = records.slice(0, 3000).map(r => ({
        id: r.id, st: r.station, nes: r.nes, dev: r.deviceCode, type: r.deviceType, stat: r.status, reads: r.readings
      }));

      const prompt = `Actúa como ingeniero de Metro BCN. Datos: ${JSON.stringify(cleanRecords)}. Consulta: "${query}". Responde técnico y conciso. Usa [LINK:id|label] para equipos.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      trackUsage(); 
      return response.text || "Sin respuesta.";
    } catch (error: any) {
      console.error("AI Error:", error);
      return `⚠️ Error: ${error.message || 'Sin conexión a IA'}.`;
    }
  },

  extractCodesFromDocument: async (base64Image: string): Promise<string[]> => {
    try {
      const usage = getUsageData();
      if (usage.count >= DAILY_LIMIT) throw new Error("Límite diario alcanzado.");

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: `ERES UN EXPERTO EN MANTENIMIENTO DE METRO BARCELONA. ANALIZA ESTA PLACA TÉCNICA O ETIQUETA.
                
                OBJETIVO: Extraer CADA CÓDIGO de identificación.
                
                PATRONES OBLIGATORIOS (BUSCA ESTO ESPECÍFICAMENTE):
                1. CÓDIGO NES (CRÍTICO): Empieza por "NES", luego 3 números, y termina con 2 LETRAS.
                   EJEMPLOS REALES: "NES003FS", "NES001PV", "NES120PT", "NES045PE", "NES010VE".
                   IMPORTANTE: No te comas las letras finales. Si ves "NES003", mira bien qué letras siguen.
                
                2. CÓDIGO DE MATRIZ: Dos letras (PE, VE, VT, FS, PA, PE) seguidas de números con guiones.
                   EJEMPLOS: "PE 01-11-05", "VE 01-01-01".
                   NORMALIZACIÓN: Si ves "PE 1-1-1", conviértelo a "PE 01-01-01".

                INSTRUCCIONES DE EXTRACCIÓN:
                - Devuelve TODOS los códigos que veas que sigan estos patrones.
                - Si el código NES está escrito como "NES 003 FS" (con espacios), júntalo todo: "NES003FS".
                - Limpia cualquier símbolo extraño.
                
                SALIDA: Devuelve solo un array JSON de strings con los códigos hallados.` }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
      });

      const result = JSON.parse(response.text || "[]");
      trackUsage(); 
      return result;
    } catch (error: any) {
        throw new Error("Fallo en escáner: " + error.message);
    }
  }
};
