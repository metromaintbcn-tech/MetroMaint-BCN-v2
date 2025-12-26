
export enum DeviceType {
  POZO_AGOTAMIENTO = 'Pozo de Agotamiento',
  FOSA_SEPTICA = 'Fosa Séptica',
  VENT_ESTACION = 'Ventilación Estación',
  VENT_TUNEL = 'Ventilación Túnel',
  OTHER = 'Otro'
}

export enum EquipmentStatus {
  OPERATIONAL = 'Operativo',
  INCIDENT = 'Incidencia'
}

export interface ConsumptionReadings {
  // Para Fosas u Otros
  generic?: number; 
  // Para Pozos de Agotamiento (Bombas)
  pump1?: number; // B1
  pump2?: number; // B2
  // Para Ventilaciones (Velocidades)
  speedFast?: number; // Rápida
  speedSlow?: number; // Lenta
  
  // Nuevos campos para PA y FS (Tiempos/Ciclos)
  stroke?: number;      // Cursa en cm
  filling?: number;     // Llenado
  emptyingB1?: number;  // Vaciado B1
  emptyingB2?: number;  // Vaciado B2

  // Nuevos campos para VE y VT (Vibraciones)
  vibrationSlow?: number; // Vibración Lenta
  vibrationFast?: number; // Vibración Rápida

  // --- PROTECCIONES ELÉCTRICAS (GRUPO 1: B1 o Rápida) ---
  fuses1?: number;       // Fusibles 1
  thermalMin1?: number;  // Térmico Min 1
  thermalMax1?: number;  // Térmico Max 1
  regulated1?: number;   // Regulado 1 (A o Hz)

  // --- PROTECCIONES ELÉCTRICAS (GRUPO 2: B2 o Lenta) ---
  fuses2?: number;       // Fusibles 2
  thermalMin2?: number;  // Térmico Min 2
  thermalMax2?: number;  // Térmico Max 2
  regulated2?: number;   // Regulado 2 (A o Hz)

  // --- CONFIGURACIÓN ---
  hasVFD?: boolean; // ¿Tiene Variador de Frecuencia? (Para Ventilaciones)
  
  // Mantenemos los antiguos por compatibilidad si es necesario, 
  // aunque la UI usará los nuevos 1 y 2.
  fuses?: number;       
  thermalMin?: number;  
  thermalMax?: number;  
  regulated?: number;   
}

export interface MaintenanceRecord {
  id: string;
  station: string; // Estacion
  nes: string; // NES identifier (Numeric only, e.g., "123")
  deviceCode: string; // Matrix Code (e.g., "PA 01-12-30")
  deviceType: DeviceType; // Dispositivo
  status: EquipmentStatus; // Estado del equipo
  readings: ConsumptionReadings; // Objeto con las lecturas específicas
  location?: string; // Localización
  date: string; // ISO Date
  notes?: string;
  lastModifiedBy?: string;
}

export type ViewState = 'LIST' | 'ADD' | 'EDIT' | 'JOURNAL';

export const METRO_COLORS = {
  primary: '#dc2626', // Red-600 (Metro Red-ish)
  secondary: '#1e293b', // Slate-800
  accent: '#fbbf24', // Amber-400
  contrastDark: '#000000',
  contrastLight: '#ffffff',
  statusOk: '#22c55e',
  statusWarning: '#f59e0b',
  statusError: '#ef4444'
};
