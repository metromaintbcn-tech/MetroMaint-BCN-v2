
import { GoogleGenAI, Type } from "@google/genai";
import { MaintenanceRecord } from "../types";

// --- CONFIGURACIÓN DE USO ---
const DAILY_LIMIT = 50; // Aumentado para evitar bloqueos innecesarios
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
  checkConnection: (): boolean => {
      // Verificación dinámica de la existencia de la clave
      const key = process.env.API_KEY;
      return !!key && key.length > 10;
  },

  getUsage: () => {
    return getUsageData();
  },

  analyzeDataAndProfile: async (records: MaintenanceRecord[], query: string) => {
    try {
      const usage = getUsageData();
      if (usage.count >= DAILY_LIMIT) {
          return "🚫 **LÍMITE DIARIO ALCANZADO**\n\nEl contador se reiniciará mañana a las 9:00 AM.";
      }

      // Inicialización directa según especificaciones
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const LIMIT = 3000;
      const cleanRecords = records.slice(0, LIMIT).map(r => ({
        id: r.id, st: r.station, nes: r.nes, dev: r.deviceCode, type: r.deviceType, stat: r.status, reads: r.readings
      }));

      const contextData = JSON.stringify(cleanRecords);
      const prompt = `Actúa como ingeniero de mantenimiento de Metro BCN.
      DATOS DEL INVENTARIO: ${contextData}
      PREGUNTA DEL OPERARIO: "${query}"
      
      INSTRUCCIONES:
      1. Responde de forma muy concisa y técnica.
      2. Si mencionas equipos específicos, usa el formato: [LINK:{id}|{st} - {nes} ({dev})] para que el operario pueda pulsar sobre ellos.
      3. Analiza consumos anómalos o falta de lecturas si se solicita.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      trackUsage(); 
      return response.text || "No he podido generar una respuesta clara.";
    } catch (error: any) {
      console.error("Gemini Assistant Error:", error);
      return `⚠️ Error de conexión: ${error.message || 'La IA no responde'}.`;
    }
  },

  extractCodesFromDocument: async (base64Image: string): Promise<string[]> => {
    try {
      const usage = getUsageData();
      if (usage.count >= DAILY_LIMIT) {
          throw new Error("Límite diario de escaneos alcanzado.");
      }

      // Inicialización directa
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: `Analiza esta imagen de mantenimiento. Extrae todos los códigos que parezcan:
                - NES (ejemplos: NES0023, 023PE, 150FS)
                - Código Equipo (formato XX 00-00-00, ejemplo: VE 09-01-05, PA 01-12-30)
                Devuelve la lista como un array JSON de strings.` }
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

      const text = response.text;
      if (!text) return [];
      
      const result = JSON.parse(text);
      trackUsage(); 
      return Array.isArray(result) ? result : [];
    } catch (error: any) {
        console.error("Gemini OCR Error:", error);
        throw new Error(`Fallo en el escáner: ${error.message}`);
    }
  }
};
