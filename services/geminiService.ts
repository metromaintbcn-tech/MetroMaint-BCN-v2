import { GoogleGenAI, Type } from "@google/genai";
import { MaintenanceRecord } from "../types";

// --- CONFIGURACIÓN DE GEMINI ---
// NOTA DE SEGURIDAD:
// Esta aplicación es "Client-Side Only" (sin servidor propio).
// Por tanto, es NECESARIO exponer la API Key con el prefijo VITE_ para que el navegador pueda llamar a Google.
// Para mejorar la seguridad, restringe esta API Key en Google Cloud Console para que solo acepte peticiones desde tu dominio (HTTP Referrer).

const getApiKey = () => {
  let apiKey = "";
  try {
    // @ts-ignore
    apiKey = import.meta.env.VITE_API_KEY;
  } catch (e) {}

  if (!apiKey && typeof process !== "undefined" && process.env) {
    apiKey = process.env.VITE_API_KEY || process.env.API_KEY;
  }
  
  // SANITIZACIÓN: Quitar comillas extra si el usuario las puso en Vercel
  if (apiKey) {
      apiKey = apiKey.replace(/['";]/g, '').trim();
  }

  return apiKey;
};

const getAI = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("MISSING_API_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

export const GeminiService = {
  // Función para verificar estado desde la UI
  checkConnection: (): boolean => {
      const k = getApiKey();
      return !!k && k.length > 10;
  },

  // Use Gemini to analyze data and suggest improvements
  analyzeDataAndProfile: async (records: MaintenanceRecord[], query: string) => {
    try {
      const ai = getAI();
      const totalRecords = records.length;
      
      const LIMIT = 4000; // Reducimos un poco para aligerar la carga
      const cleanRecords = records.slice(0, LIMIT).map(r => ({
        id: r.id,
        st: r.station,
        nes: r.nes,
        dev: r.deviceCode,
        type: r.deviceType,
        loc: r.location,
        stat: r.status,
        reads: r.readings,
        note: r.notes ? r.notes.substring(0, 50) : undefined
      }));

      const contextData = JSON.stringify(cleanRecords);
      const isTruncated = totalRecords > LIMIT;

      const prompt = `
        Actúa como un ingeniero senior de mantenimiento del Metro de Barcelona.
        Tienes acceso a la base de datos actual de equipos en formato JSON simplificado.
        
        RESUMEN DE DATOS DEL SISTEMA:
        - TOTAL REAL DE EQUIPOS REGISTRADOS: ${totalRecords}
        - Equipos analizados en este contexto (JSON): ${cleanRecords.length}
        ${isTruncated ? 'ATENCIÓN: La lista JSON está truncada por límites técnicos. Para reportes de cantidad total, usa el valor "TOTAL REAL DE EQUIPOS REGISTRADOS".' : ''}

        CLAVES JSON:
        id: ID, st: Estación, nes: NES, dev: Código Equipo, type: Tipo, stat: Estado, note: Notas, reads: Lecturas, loc: Localización.

        DATOS DE MANTENIMIENTO: 
        ${contextData}
        
        Pregunta del usuario: "${query}"
        
        REGLAS:
        - Responde de forma concisa.
        - Si preguntan por consumos, tiempos o vibraciones, usa los datos de 'reads'.
        - Genera tarjetas interactivas usando: [LINK:{id}|{st} - {nes} ({dev})]
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text;
    } catch (error: any) {
      console.error("Gemini Error:", error);
      const errStr = error.toString().toLowerCase();

      if (error.message === "MISSING_API_KEY") {
         return "⚠️ Error: Falta API KEY.";
      }

      // ERROR 429: RATE LIMIT
      if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('resource exhausted')) {
          return "⏳ **LÍMITE DE VELOCIDAD ALCANZADO**\n\nGoogle ha pausado la conexión momentáneamente porque has hecho muchas peticiones seguidas (Límite del plan gratuito: 5/min).\n\n**Espera 30 segundos** y vuelve a preguntar.";
      }

      if (errStr.includes('503') || errStr.includes('overloaded')) {
          return "🐢 **SERVIDORES SATURADOS**\n\nLos servidores de Google van lentos. Inténtalo de nuevo.";
      }

      // ERROR 403: DOMINIO NO PERMITIDO
      if (errStr.includes('403') || errStr.includes('permission denied')) {
          return "⛔ **ACCESO DENEGADO (403)**\nLa API Key existe, pero Google ha bloqueado la petición desde esta web.\n\n**Solución:** Ve a Google Cloud Console > Credenciales y añade la URL de Vercel a los sitios permitidos.";
      }

      return `Hubo un error de conexión con la IA (${error.message || 'Desconocido'}).`;
    }
  },

  // Use Gemini Vision to extract data from a photo of a meter or form
  extractDataFromImage: async (base64Image: string): Promise<Partial<MaintenanceRecord>> => {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', 
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: `Extrae datos de mantenimiento en JSON (station, nes, deviceCode, etc).` }
          ]
        }
      });
      const text = response.text;
      if (!text) return {};
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (error: any) {
      console.error("OCR Error:", error);
      throw error; 
    }
  },

  // Scan a document/list and extract all codes found
  extractCodesFromDocument: async (base64Image: string): Promise<string[]> => {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: `
                    Actúa como un experto OCR leyendo hojas de mantenimiento MANUSCRITAS.
                    Analiza la imagen adjunta. Ignora las líneas de la cuadrícula y enfócate en el texto escrito a mano.

                    TU MISIÓN: Extraer y NORMALIZAR los códigos de las columnas.

                    1. Busca códigos NES: Suelen estar en la columna "U. TÈCNICA".
                       Formato típico: "NES" seguido de 3 números y 2 letras (ej: NES004PE, NES003FS).

                    2. Busca CÓDIGOS DE EQUIPO: Suelen estar en la columna "DESCRIPCIÓ U.T." o "EQUIPO".
                       El texto manuscrito suele ser rápido y omitir ceros.
                       Busca patrones como: "PE 1-13-1", "FS 1-13-1", "VE 1-12-1".
                       A veces hay texto alrededor (ej: "0113 PE 1-13-1 NES..."), extrae SOLO el código del equipo.

                    REGLAS DE NORMALIZACIÓN (MUY IMPORTANTE):
                    Debes convertir el formato corto manuscrito al formato estándar de base de datos "XX 00-00-00".
                    - Si ves "PE 1-13-1" -> Devuelve "PE 01-13-01".
                    - Si ves "FS 1-13-1" -> Devuelve "FS 01-13-01".
                    - Si ves "PA 5-4-2"  -> Devuelve "PA 05-04-02".
                    
                    Añade siempre el cero a la izquierda si el número es de un solo dígito.

                    SALIDA:
                    Devuelve ÚNICAMENTE un Array JSON de strings con los códigos ya normalizados.
                    Ejemplo de respuesta válida: ["NES004PE", "PE 01-13-01", "NES003FS", "FS 01-13-01"]
                `}
            ]
        }
      });

      const text = response.text;
      if (!text) throw new Error("Respuesta vacía");
      
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        const result = JSON.parse(cleanText);
        return Array.isArray(result) ? result : [];
      } catch (e) {
          throw new Error("No pude leer JSON válido en la imagen.");
      }
    } catch (error: any) {
        console.error("Batch OCR Error:", error);
        const errStr = error.toString().toLowerCase();
        
        if (error.message === "MISSING_API_KEY") throw new Error("Falta API KEY");
        
        // RE-LANZAR EL ERROR 429 PARA QUE APP.TSX LO MUESTRE
        if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('exhausted')) {
            throw new Error("⏳ Límite de IA alcanzado (5 peticiones/min). Espera un poco.");
        }
        
        if (errStr.includes('403')) throw new Error("Acceso Denegado (403): Revisa dominios en Google Cloud.");
        
        throw error;
    }
  }
};