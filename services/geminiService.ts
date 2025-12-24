
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
                { text: `Actúa como un experto en mantenimiento de Metro. Analiza la imagen y extrae códigos de identificación de equipos. 
                Formatos esperados:
                1. Códigos NES: Deben empezar por NES seguido de números y el sufijo correspondiente (ej. NES004PE, NES150FS).
                2. Códigos de Equipo (Matriz): Dos letras seguidas de números separados por guiones (ej. PE 01-13-01). 
                
                REGLA CRÍTICA DE NORMALIZACIÓN:
                - Si los números en el código de equipo tienen un solo dígito, DEBES añadir un cero a la izquierda para que siempre tengan dos dígitos (ej. transforma 'PE 1-13-1' en 'PE 01-13-01').
                - Asegúrate de que el código NES incluya el prefijo "NES".
                
                Devuelve solo un array JSON de strings con los códigos encontrados.` }
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
