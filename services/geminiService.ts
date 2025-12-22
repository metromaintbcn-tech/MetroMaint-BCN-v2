import { GoogleGenAI, Type } from "@google/genai";
import { MaintenanceRecord } from "../types";

// --- CONFIGURACIÓN DE USO ---
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
  checkConnection: async (): Promise<boolean> => {
      // Verificación directa de la clave inyectada
      const key = process.env.API_KEY;
      if (key && key.length > 10) return true;
      
      try {
        // @ts-ignore
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
          // @ts-ignore
          return await window.aistudio.hasSelectedApiKey();
        }
      } catch (e) {
        console.warn("Error verificando conexión IA:", e);
      }
      return false;
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

      // Inicialización estrictamente según reglas
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
      if (error.message?.includes("API Key") || error.message?.includes("must be set")) {
        return "⚠️ **ERROR DE CLAVE**: No se ha detectado una clave de API válida. Pulsa 'Activar IA' en el menú lateral.";
      }
      return `⚠️ Error de conexión: ${error.message || 'La IA no responde'}.`;
    }
  },

  extractCodesFromDocument: async (base64Image: string): Promise<string[]> => {
    try {
      const usage = getUsageData();
      if (usage.count >= DAILY_LIMIT) {
          throw new Error("Límite diario de escaneos alcanzado.");
      }

      // Inicialización estrictamente según reglas
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: `Extrae todos los códigos NES (ej. 150FS) y de equipo (ej. VE 09-01-05) de esta imagen. Devuelve solo un array JSON de strings.` }
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
        if (error.message?.includes("API Key") || error.message?.includes("must be set")) {
          throw new Error("Clave de IA no configurada. Actívala en el menú lateral.");
        }
        throw new Error(error.message || "Fallo en el escáner.");
    }
  }
};
