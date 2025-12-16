import { GoogleGenAI, Type } from "@google/genai";
import { MaintenanceRecord } from "../types";

// --- CONFIGURACIÓN DE GEMINI ---
const getApiKey = () => {
  let apiKey = "";
  try {
    // @ts-ignore
    apiKey = import.meta.env.VITE_API_KEY;
  } catch (e) {}

  if (!apiKey && typeof process !== "undefined" && process.env) {
    apiKey = process.env.VITE_API_KEY || process.env.API_KEY;
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
      return !!getApiKey();
  },

  // Use Gemini to analyze data and suggest improvements
  analyzeDataAndProfile: async (records: MaintenanceRecord[], query: string) => {
    try {
      const ai = getAI();
      const totalRecords = records.length;
      
      const LIMIT = 5000;
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
      if (error.message === "MISSING_API_KEY" || (error.message && error.message.includes("API_KEY"))) {
        return "⚠️ **ERROR DE CONFIGURACIÓN EN EL SERVIDOR**\n\nNo se detectó la `VITE_API_KEY` en las variables de entorno del despliegue (Vercel/Firebase).\n\n**Solución:**\nVe al panel de control de tu hosting y añade la variable de entorno `VITE_API_KEY` con tu clave de Google AI.";
      }
      return "Hubo un error de conexión con la IA. Intenta de nuevo más tarde.";
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
      if (error.message === "MISSING_API_KEY") throw error; // Re-throw to UI
      throw new Error("No se pudo procesar la imagen.");
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
                    1. Columna "U. TÈCNICA" o "NES" -> Extrae el código (Ej: "NES004PE").
                    2. Columna "DESCRIPCIÓ U.T." o "EQUIPO" -> Busca códigos de equipo (Ej: "PE 1-13-1").
                    
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
    } catch (error: any) {
        console.error("Batch OCR Error:", error);
        if (error.message === "MISSING_API_KEY") throw error; // Re-throw to UI
        return [];
    }
  }
};