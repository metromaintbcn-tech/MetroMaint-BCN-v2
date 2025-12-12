import { GoogleGenAI, Type } from "@google/genai";
import { MaintenanceRecord } from "../types";

// --- CONFIGURACIÓN DE GEMINI ---
// 1. Consigue tu clave gratis en: https://aistudio.google.com/app/apikey
// 2. Pégala abajo dentro de las comillas, sustituyendo el texto.
// 3. IMPORTANTE: En la consola de Google Cloud, restringe esta clave a tu dominio web (Referrer HTTP) para seguridad.

const GEMINI_API_KEY = "PEGAR_TU_CLAVE_AQUI"; 

const getAI = () => {
  // Si el usuario no ha puesto la clave, intentamos usar la variable de entorno por si acaso
  const apiKey = GEMINI_API_KEY !== "PEGAR_TU_CLAVE_AQUI" ? GEMINI_API_KEY : process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("Falta la API Key de Gemini. Configúrala en services/geminiService.ts");
  }
  return new GoogleGenAI({ apiKey });
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
      if (error.message.includes("Falta la API Key")) {
        return "⚠️ CONFIGURACIÓN INCOMPLETA: Necesitas añadir una API Key de Gemini en el archivo 'services/geminiService.ts' para usar la IA.";
      }
      return "Hubo un error de conexión con la IA. Intenta de nuevo más tarde.";
    }
  },

  // Use Gemini Vision to extract data from a photo of a meter or form
  extractDataFromImage: async (base64Image: string): Promise<Partial<MaintenanceRecord>> => {
    try {
      const ai = getAI();
      
      // NOTE: gemini-2.5-flash-image does NOT support responseSchema/responseMimeType.
      // We must request JSON in the prompt and parse it manually.
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
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
      if (error.message.includes("Falta la API Key")) {
        throw new Error("Falta configurar la API Key de Gemini");
      }
      throw new Error("No se pudo procesar la imagen.");
    }
  },

  // Scan a document/list and extract all codes found
  extractCodesFromDocument: async (base64Image: string): Promise<string[]> => {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: `
                    Analiza este listado. Extrae TODOS los códigos de equipo o NES encontrados.
                    Devuelve JSON array de strings: ["123PE", "PA 01-10-05"].
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