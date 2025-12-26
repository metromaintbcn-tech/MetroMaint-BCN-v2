
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
                { text: `Actúa como un experto en mantenimiento de Metro Barcelona. Analiza la imagen y extrae TODOS los códigos de identificación de equipos presentes en las placas. 
                
                Formatos CRÍTICOS a detectar:
                1. Códigos NES completos: Deben incluir el prefijo "NES", los números y el sufijo de dos letras al final. (Ejemplos válidos: NES003FS, NES001PV, NES120PE, NES045PT). Es vital capturar las letras del final.
                2. Códigos de Equipo (Matriz): Dos letras seguidas de números (ej. PE 01-13-01). 
                
                REGLAS DE NORMALIZACIÓN:
                - Códigos Matriz: Si los números tienen un solo dígito, DEBES transformarlo a dos dígitos (ej. 'PE 1-1-1' -> 'PE 01-01-01').
                - Códigos NES: Asegúrate de que contengan el prefijo "NES" y el sufijo completo.
                
                Devuelve solo un array JSON de strings con los códigos encontrados sin ningún texto adicional.` }
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
