import { GoogleGenAI, Type } from "@google/genai";
import { MaintenanceRecord } from "../types";

// --- CONFIGURACIÓN DE GEMINI ---
// NOTA DE SEGURIDAD:
// Esta aplicación es "Client-Side Only" (sin servidor propio).
// Por tanto, es NECESARIO exponer la API Key con el prefijo VITE_ para que el navegador pueda llamar a Google.
// Para mejorar la seguridad, restringe esta API Key en Google Cloud Console para que solo acepte peticiones desde tu dominio (HTTP Referrer).

const getAI = () => {
  let apiKey = "";

  // 1. Intentar acceso estándar de Vite (import.meta.env)
  try {
    // @ts-ignore
    apiKey = import.meta.env.VITE_API_KEY;
  } catch (e) {
    // Ignorar error si import.meta no existe
  }

  // 2. Fallback a process.env (si el entorno lo inyecta)
  if (!apiKey && typeof process !== "undefined" && process.env) {
    apiKey = process.env.VITE_API_KEY || process.env.API_KEY;
  }

  if (!apiKey) {
    console.error("Falta la API Key. Asegúrate de tener VITE_API_KEY en tus variables de entorno en Vercel.");
  }

  return new GoogleGenAI({ apiKey: apiKey || '' });
};

export const GeminiService = {
  // Use Gemini to analyze data and suggest improvements (The "Profiling" request)
  analyzeDataAndProfile: async (records: MaintenanceRecord[], query: string) => {
    try {
      const ai = getAI();
      const totalRecords = records.length;
      
      // OPTIMIZATION: Previously limited to 600. Increased to 5000 to cover more devices.
      // Gemini Flash has a large context window, so we can send more data.
      // We strip unnecessary data to reduce payload size while maintaining context.
      const LIMIT = 5000;
      const cleanRecords = records.slice(0, LIMIT).map(r => ({
        id: r.id,
        st: r.station, // Shortened keys to save tokens/bandwidth
        nes: r.nes,
        dev: r.deviceCode,
        type: r.deviceType,
        loc: r.location, // Localización (especial L9)
        stat: r.status,
        reads: r.readings, // Included readings for analysis
        note: r.notes ? r.notes.substring(0, 50) : undefined // Truncate notes
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

        CLAVES LECTURAS (reads):
        - Consumos (A): pump1, pump2 (Para Pozos y Fosas), speedFast, speedSlow.
        - Tiempos (s) / Ciclos: stroke (Cursa cm), filling (Llenado), emptyingB1/B2 (Vaciado).
        - Vibraciones: vibrationFast, vibrationSlow.
        - Protecciones (A): fuses (Fusibles), thermalMin (Térmico Min), thermalMax (Térmico Max), regulated (Regulado).

        DATOS DE MANTENIMIENTO: 
        ${contextData}
        
        Pregunta del usuario: "${query}"
        
        CONTEXTO TÉCNICO:
        - Códigos estándar: "TT LL-EE-NN" (LL=Línea, EE=Estación, NN=Número).
        - Tipos: PA/PE (Pozo), VE/PV (Vent Estación), VT/PT (Vent Túnel), FS (Fosa).
        - Estado: INCIDENT (Incidencia), OPERATIONAL (Operativo).
        - Especial L9: Las ventilaciones (09) tienen 'loc' (Localización) en vez de protecciones.
        - Análisis de Protecciones: Compara si los 'Consumos' superan lo 'Regulado' o el rango 'Térmico' (Min-Max) para detectar fallos.

        REGLAS:
        1. Para DUPLICADOS NES: Compara 'nes' carácter a carácter exacto. Ignora si uno termina en PE y otro en PV.
        2. CÓDIGOS MANUALES: Son los que no siguen el patrón "AA 00-00-00".
        3. SI BUSCAS/LISTAS:
           - Genera tarjetas interactivas usando: [LINK:{id}|{st} - {nes} ({dev})]
           - No escribas introducciones largas.
           - Si el usuario pregunta por consumos, tiempos o vibraciones, usa los datos de 'reads'.
           - Si el usuario pregunta "cuantos equipos hay", "total de equipos", etc., responde SIEMPRE con el ${totalRecords} (TOTAL REAL), no con el número de elementos en el JSON.
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text;
    } catch (error: any) {
      console.error("Gemini Error:", error);
      if (error.message && error.message.includes("API_KEY")) {
        return "⚠️ CONFIGURACIÓN REQUERIDA: No se detectó la variable de entorno VITE_API_KEY. Verifica tu configuración en Vercel.";
      }
      return "Hubo un error de conexión con la IA. Intenta de nuevo más tarde.";
    }
  },

  // Use Gemini Vision to extract data from a photo of a meter or form
  extractDataFromImage: async (base64Image: string): Promise<Partial<MaintenanceRecord>> => {
    try {
      const ai = getAI();
      
      // Use gemini-2.5-flash for multimodal input
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', 
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: `
              Analiza esta imagen técnica. Extrae datos en JSON válido.
              
              Campos:
              - "station": Nombre Estación.
              - "nes": Identificador (ej "123PE").
              - "deviceCode": Código (ej "PA 01-12-30"). Normaliza "1-12-3" a "01-12-03".
              - "deviceType": PA, VE, VT, FS.
              - "status": 'Incidencia' o 'Operativo'.
              - "location": Ubicación texto libre (si aparece).
              - "readings": { 
                  pump1, pump2, speedFast, speedSlow, generic, 
                  stroke, filling, emptyingB1, emptyingB2, 
                  vibrationFast, vibrationSlow,
                  fuses, thermalMin, thermalMax, regulated 
                }.

              Salida JSON pura sin markdown.
            ` }
          ]
        }
      });

      const text = response.text;
      if (!text) return {};

      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (error: any) {
      console.error("OCR Error:", error);
      throw new Error("No se pudo procesar la imagen. Verifica la API KEY.");
    }
  },

  // Scan a document/list and extract all codes found
  extractCodesFromDocument: async (base64Image: string): Promise<string[]> => {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // Usamos el modelo Flash (rápido y económico)
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: `
                    Analiza esta hoja de mantenimiento. Céntrate en las filas impresas de la tabla.
                    
                    EXTRAE LOS SIGUIENTES DATOS DE LAS COLUMNAS:
                    1. Columna "U. TÈCNICA" -> Extrae el código NES (Ej: "NES004PE").
                    2. Columna "DESCRIPCIÓ U.T." -> Busca códigos de equipo (Ej: "PE 1-13-1").
                    
                    REGLA DE NORMALIZACIÓN (CRÍTICA):
                    - Si ves un código corto como "PE 1-13-1", transfórmalo a formato estándar con ceros: "PE 01-13-01".
                    - Si ves "PA 1-5-2", devuélvelo como "PA 01-05-02".
                    - Formato deseado: AA 00-00-00.

                    Devuelve ÚNICAMENTE un array JSON de strings con los códigos encontrados (NES y Equipos).
                    Ejemplo: ["NES004PE", "PE 01-13-01", "NES005PE", "PE 01-14-01"]
                `}
            ]
        }
      });

      const text = response.text;
      if (!text) return [];
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanText);
      return Array.isArray(result) ? result : [];
    } catch (error) {
        console.error("Batch OCR Error:", error);
        return [];
    }
  }
};