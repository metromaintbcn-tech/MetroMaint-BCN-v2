
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

  extractCodesFromDocument: async (base64Image: string): Promise<string[]> => {
    try {
      const usage = getUsageData();
      if (usage.count >= DAILY_LIMIT) throw new Error("LÍMITE DIARIO DE IA ALCANZADO.");

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: `ERES UN EXPERTO EN DIGITALIZACIÓN DE PLACAS TÉCNICAS DE METRO BARCELONA. ANALIZA LA IMAGEN Y BUSCA ETIQUETAS.
                
                TU MISIÓN: Extraer CADA CÓDIGO de identificación de equipo de la placa.
                
                REGLAS CRÍTICAS PARA CÓDIGOS NES:
                - Estructura: "NES" + 3 dígitos + 2 letras al final.
                - EJEMPLOS: "NES003FS", "NES120PT", "NES001PV", "NES045PE".
                - ¡IMPORTANTE!: A veces hay espacios, por ejemplo "NES 003 FS". Debes CONCATENARLO TODO: "NES003FS".
                - ¡ALERTA!: Si ves "NES003" y hay letras como "FS" o "PV" cerca, ¡SON PARTE DEL CÓDIGO! No las ignores.
                - FORMATO NES INVÁLIDO: No devuelvas códigos NES que no tengan las dos letras finales (FS, PT, PV, PE, VT, VE).
                
                REGLAS PARA CÓDIGOS DE EQUIPO (MATRIZ):
                - Estructura: 2 letras (PE, VE, VT, FS, MA) + espacio + 00-00-00.
                - Ejemplo: "PE 01-11-05". Si ves "PE 1-1-1", conviértelo a "PE 01-01-01".

                SALIDA: Devuelve ÚNICAMENTE un array JSON de strings ["CÓDIGO1", "CÓDIGO2"].` }
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
  },

  // Fix: Added missing analyzeDataAndProfile method for AI Assistant
  analyzeDataAndProfile: async (data: MaintenanceRecord[], query: string): Promise<string> => {
    try {
      const usage = getUsageData();
      if (usage.count >= DAILY_LIMIT) throw new Error("LÍMITE DIARIO DE IA ALCANZADO.");

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Analiza estos datos de mantenimiento de Metro Barcelona y responde a la consulta: "${query}"
        
        DATOS ACTUALES:
        ${JSON.stringify(data.map(r => ({
          id: r.id,
          st: r.station,
          nes: r.nes,
          code: r.deviceCode,
          type: r.deviceType,
          status: r.status,
          notes: r.notes
        })))}
        
        FORMATO DE RESPUESTA:
        - Responde de forma técnica y profesional en español.
        - Si mencionas un equipo, usa OBLIGATORIAMENTE este formato para enlazarlo: [LINK:ID|ESTACIÓN - NES (CÓDIGO)].
        - Identifica anomalías o equipos con incidencias si se solicita.`,
      });

      trackUsage();
      return response.text || "No se pudo generar un análisis en este momento.";
    } catch (error: any) {
      console.error("Gemini Error:", error);
      throw new Error("Error en el asistente de IA: " + error.message);
    }
  }
};
