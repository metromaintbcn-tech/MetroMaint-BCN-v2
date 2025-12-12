
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

  // Nuevos campos de Protecciones Eléctricas
  fuses?: number;       // Fusibles
  thermalMin?: number;  // Térmico Min
  thermalMax?: number;  // Térmico Max
  regulated?: number;   // Regulado
}

export interface MaintenanceRecord {
  id: string;
  station: string; // Estacion
  nes: string; // NES identifier (Numeric only, e.g., "123")
  deviceCode: string; // Matrix Code (e.g., "PA 01-12-30")
  deviceType: DeviceType; // Dispositivo
  status: EquipmentStatus; // Estado del equipo
  readings: ConsumptionReadings; // Objeto con las lecturas específicas
  location?: string; // Localización (Específico L9)
  date: string; // ISO Date
  notes?: string;
  lastModifiedBy?: string;
}

export type ViewState = 'LIST' | 'ADD' | 'EDIT' | 'DASHBOARD' | 'AI_ASSISTANT';

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