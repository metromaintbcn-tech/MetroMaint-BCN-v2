import { GoogleGenAI, Type } from "@google/genai";
import { MaintenanceRecord } from "../types";

// --- CONFIGURACIÓN DE USO ---
const DAILY_LIMIT = 20;
const INITIAL_COUNT = 7; // Según solicitud del usuario
const RESET_HOUR_SPAIN = 9;
const SPAIN_TZ = "Europe/Madrid";

const getUsageData = () => {
  const stored = localStorage.getItem('ai_usage_stats');
  const nowSpain = new Date(new Date().toLocaleString("en-US", { timeZone: SPAIN_TZ }));
  
  // Calcular cuándo fue el último reset teórico de las 9:00 AM
  const lastExpectedReset = new Date(nowSpain);
  lastExpectedReset.setHours(RESET_HOUR_SPAIN, 0, 0, 0);
  
  // Si aún no son las 9:00 AM de hoy, el reset válido fue el de ayer
  if (nowSpain < lastExpectedReset) {
    lastExpectedReset.setDate(lastExpectedReset.getDate() - 1);
  }

  if (!stored) {
    const initial = { count: INITIAL_COUNT, lastReset: nowSpain.toISOString() };
    localStorage.setItem('ai_usage_stats', JSON.stringify(initial));
    return initial;
  }

  let data = JSON.parse(stored);
  const lastUsedSpain = new Date(new Date(data.lastReset).toLocaleString("en-US", { timeZone: SPAIN_TZ }));

  // Si el último uso registrado fue ANTES del último reset de las 9 AM, reiniciamos a 0
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

// --- CONFIGURACIÓN DE GEMINI ---
const API_KEY = process.env.API_KEY || "";

export const GeminiService = {
  checkConnection: (): boolean => {
      return !!API_KEY && API_KEY.length > 10;
  },

  getUsage: () => {
    return getUsageData();
  },

  analyzeDataAndProfile: async (records: MaintenanceRecord[], query: string) => {
    try {
      const usage = getUsageData();
      if (usage.count >= DAILY_LIMIT) {
          return "🚫 **LÍMITE DIARIO ALCANZADO (20/20)**\n\nHas agotado las consultas de hoy. El contador se reiniciará mañana a las 9:00 AM.";
      }

      const ai = new GoogleGenAI({ apiKey: API_KEY });
      const LIMIT = 4000;
      const cleanRecords = records.slice(0, LIMIT).map(r => ({
        id: r.id, st: r.station, nes: r.nes, dev: r.deviceCode, type: r.deviceType, stat: r.status, reads: r.readings
      }));

      const contextData = JSON.stringify(cleanRecords);
      const prompt = `Actúa como ingeniero de Metro BCN. Datos: ${contextData}. Pregunta: "${query}". Responde conciso. Tarjetas: [LINK:{id}|{st} - {nes} ({dev})]`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      trackUsage(); 
      return response.text;
    } catch (error: any) {
      console.error("Gemini Error:", error);
      return `Error de conexión con la IA.`;
    }
  },

  extractCodesFromDocument: async (base64Image: string): Promise<string[]> => {
    try {
      const usage = getUsageData();
      if (usage.count >= DAILY_LIMIT) {
          throw new Error("Límite diario de 20 escaneos alcanzado.");
      }

      const ai = new GoogleGenAI({ apiKey: API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: `Extrae códigos NES (NES000XX) y Códigos Equipo (XX 00-00-00) de esta hoja. Devuelve solo un array JSON de strings.` }
            ]
        }
      });

      const text = response.text;
      if (!text) throw new Error("Respuesta vacía");
      
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanText);
      
      trackUsage(); 
      return Array.isArray(result) ? result : [];
    } catch (error: any) {
        throw error;
    }
  }
};
