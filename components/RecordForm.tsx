import React, { useState, useRef, useEffect } from 'react';
import { DeviceType, MaintenanceRecord, ConsumptionReadings, EquipmentStatus } from '../types';
import { Save, X, Loader2, AlertTriangle, Zap, CheckCircle2, Activity, Calculator, Watch, Play, Square, RotateCcw, Timer, Lock, Unlock, ShieldCheck, MapPin, Waves } from 'lucide-react';

interface RecordFormProps {
  initialData?: MaintenanceRecord | null;
  existingRecords: MaintenanceRecord[];
  onSave: (record: MaintenanceRecord) => void;
  onCancel: () => void;
}

// MAPPING RULES
const TYPE_MAPPING = {
  [DeviceType.POZO_AGOTAMIENTO]: { nesSuffix: 'PE', matrixPrefix: 'PE' },
  [DeviceType.VENT_ESTACION]:    { nesSuffix: 'PV', matrixPrefix: 'VE' },
  [DeviceType.VENT_TUNEL]:       { nesSuffix: 'PT', matrixPrefix: 'VT' },
  [DeviceType.FOSA_SEPTICA]:     { nesSuffix: 'FS', matrixPrefix: 'FS' },
  [DeviceType.OTHER]:            { nesSuffix: '',   matrixPrefix: '' },
};

// Robust ID Generator
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const RecordForm: React.FC<RecordFormProps> = ({ initialData, existingRecords, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<MaintenanceRecord>>(
    initialData || {
      station: '',
      nes: '',
      deviceCode: '',
      deviceType: '' as DeviceType,
      status: EquipmentStatus.OPERATIONAL,
      readings: {},
      notes: ''
    }
  );
  
  const [deviceCodeError, setDeviceCodeError] = useState<string | null>(null);
  const [nesError, setNesError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  
  // MANUAL CODE STATE
  const [isManualCode, setIsManualCode] = useState(false);

  // --- UNIFIED TIME TOOL STATE ---
  const [activeTimeField, setActiveTimeField] = useState<keyof ConsumptionReadings | null>(null); 
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [stopwatchStartTime, setStopwatchStartTime] = useState<number | null>(null);
  
  const [calcDist, setCalcDist] = useState('');
  const [useExtrapolation, setUseExtrapolation] = useState(false);

  // --- VIBRATION TOOL STATE ---
  const [activeVibrationField, setActiveVibrationField] = useState<keyof ConsumptionReadings | null>(null);
  const [vibValue, setVibValue] = useState(0); // Current Instant Value
  const [vibMax, setVibMax] = useState(0); // Max held value
  const [isMeasuringVib, setIsMeasuringVib] = useState(false);
  const [vibError, setVibError] = useState<string | null>(null);

  // Ensure nested objects exist
  if (!formData.readings) formData.readings = {};
  if (!formData.status) formData.status = EquipmentStatus.OPERATIONAL;

  const currentTypeMap = TYPE_MAPPING[formData.deviceType as DeviceType];
  const activePrefix = currentTypeMap?.matrixPrefix || '';
  const activeSuffix = currentTypeMap?.nesSuffix || '';

  // Helper to detect Line 9 Ventilations
  const isLine9Vent = () => {
    // Must be a Ventilation Type
    if (formData.deviceType !== DeviceType.VENT_ESTACION && formData.deviceType !== DeviceType.VENT_TUNEL) {
        return false;
    }
    // Check code. Standard format "VE 09-..." or "VT 09-..."
    // The formData.deviceCode might be "VE 09-12-30" or manual "VE 09..."
    // We check if it contains " 09-" which is the standard separator for line 09
    return (formData.deviceCode || '').includes(' 09-');
  };

  const isL9 = isLine9Vent();

  // --- INITIALIZATION LOGIC ---
  useEffect(() => {
    // Check if the initial device code follows the standard pattern for the selected type.
    if (initialData && initialData.deviceCode) {
        const standardPattern = /^[A-Z]{2}\s\d{2}-\d{2}-\d{2}$/;
        if (!standardPattern.test(initialData.deviceCode)) {
            setIsManualCode(true);
        }
    }
  }, []);

  // --- VALIDATION LOGIC ---
  useEffect(() => {
    if (formData.deviceCode) validateDeviceCode(formData.deviceCode);
    if (formData.nes) validateNes(formData.nes);
  }, [isManualCode]); // Re-validate if mode changes

  // --- STOPWATCH LOGIC (WALL CLOCK TIME) ---
  useEffect(() => {
    let interval: number;
    if (isStopwatchRunning && stopwatchStartTime) {
        const updateTimer = () => {
            const now = Date.now();
            const diff = Math.floor((now - stopwatchStartTime) / 1000);
            setStopwatchSeconds(diff);
        };
        updateTimer(); 
        interval = window.setInterval(updateTimer, 500);
    }
    return () => {
        if (interval) clearInterval(interval);
    };
  }, [isStopwatchRunning, stopwatchStartTime]);

  // --- VIBRATION SENSOR LOGIC ---
  useEffect(() => {
      let sensorInterval: number;

      const handleMotion = (event: DeviceMotionEvent) => {
          if (!isMeasuringVib) return;

          // Get acceleration without gravity (if available), otherwise handle manually
          // Most modern browsers support acceleration (without gravity)
          const acc = event.acceleration;
          
          if (acc && acc.x !== null) {
              // Calculate Magnitude of acceleration vector (m/s^2)
              const a = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);
              
              // Direct Reading in m/s² (No integration)
              // Smooth visuals
              setVibValue(prev => (prev * 0.7) + (a * 0.3));
              setVibMax(prev => Math.max(prev, a));
          }
      };

      if (isMeasuringVib) {
          // Request Permission for iOS 13+
          if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
              (DeviceMotionEvent as any).requestPermission()
                  .then((response: string) => {
                      if (response === 'granted') {
                          window.addEventListener('devicemotion', handleMotion);
                      } else {
                          setVibError("Permiso de sensores denegado.");
                          setIsMeasuringVib(false);
                      }
                  })
                  .catch((e: any) => {
                      console.error(e);
                      // In non-https dev environments this might fail
                      setVibError("Error accediendo a sensores (¿HTTPS?)."); 
                      setIsMeasuringVib(false);
                  });
          } else {
              // Non-iOS or older devices
              window.addEventListener('devicemotion', handleMotion);
          }
      }

      return () => {
          window.removeEventListener('devicemotion', handleMotion);
      };
  }, [isMeasuringVib]);

  const toggleStopwatch = () => {
      if (isStopwatchRunning) {
          setIsStopwatchRunning(false);
          setStopwatchStartTime(null);
      } else {
          const startTime = Date.now() - (stopwatchSeconds * 1000);
          setStopwatchStartTime(startTime);
          setIsStopwatchRunning(true);
      }
  };

  const resetStopwatch = () => {
      setIsStopwatchRunning(false);
      setStopwatchStartTime(null);
      setStopwatchSeconds(0);
  };

  const openTimeTool = (field: keyof ConsumptionReadings) => {
      setActiveTimeField(field);
      setStopwatchSeconds(0);
      setStopwatchStartTime(null);
      setIsStopwatchRunning(false);
      setCalcDist('');
      setUseExtrapolation(false); 
  };

  const closeTimeTool = () => {
      setActiveTimeField(null);
      setIsStopwatchRunning(false);
      setStopwatchStartTime(null);
  };

  const applyTimeToolResult = () => {
      if (!activeTimeField) return;

      let finalValue = stopwatchSeconds;

      if (useExtrapolation) {
          const d_med = parseFloat(calcDist);
          const t_med = stopwatchSeconds; 
          const d_norm = formData.readings?.stroke || 0;

          if (d_med > 0 && t_med > 0 && d_norm > 0) {
              const tlc = t_med / d_med;
              finalValue = Math.round(tlc * d_norm);
          } else {
              alert("Para extrapolar, mide un tiempo con el cronómetro e introduce la distancia recorrida.");
              return;
          }
      }

      handleReadingsChange(activeTimeField, finalValue.toString());
      closeTimeTool();
  };

  // --- VIB TOOL HELPERS ---
  const openVibTool = (field: keyof ConsumptionReadings) => {
      setActiveVibrationField(field);
      setVibValue(0);
      setVibMax(0);
      setVibError(null);
      setIsMeasuringVib(false);
  };

  const closeVibTool = () => {
      setActiveVibrationField(null);
      setIsMeasuringVib(false);
  };

  const toggleVibMeasure = () => {
      if (isMeasuringVib) {
          setIsMeasuringVib(false);
      } else {
          setVibValue(0);
          setVibMax(0);
          setIsMeasuringVib(true);
      }
  };

  const applyVibResult = () => {
      if (!activeVibrationField) return;
      // We apply the MAX value recorded during the session as it captures the peak vibration
      handleReadingsChange(activeVibrationField, vibMax.toFixed(2));
      closeVibTool();
  };

  const formatSecondsToMinSec = (totalSeconds: number) => {
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m}m ${s}s`;
  };

  // --- FORM HANDLERS ---
  const validateDeviceCode = (value: string): boolean => {
    if (!value) {
        setDeviceCodeError(null);
        return true;
    }

    if (!isManualCode) {
        // Duplicate check
        const isDuplicate = existingRecords.some(r => r.deviceCode === value && r.id !== formData.id);
        if (isDuplicate) {
            setDeviceCodeError("Este código de Equipo ya existe.");
            return false;
        }

        // Format check
        const parts = value.split(' ');
        const nums = parts[1];
        if (nums) {
            const firstPair = nums.split('-')[0];
            const num = parseInt(firstPair, 10);
            if (!isNaN(num) && (num < 1 || num > 11)) {
                setDeviceCodeError("El primer número (Línea) debe estar entre 01 y 11");
                return false;
            }
        }
    }
    
    setDeviceCodeError(null);
    return true;
  };

  const validateNes = (value: string): boolean => {
      if (!value) {
          setNesError(null);
          return true;
      }
      const isDuplicate = existingRecords.some(r => r.nes === value && r.id !== formData.id);
      if (isDuplicate) {
          setNesError("Este NES ya existe.");
          return false;
      }
      setNesError(null);
      return true;
  };

  const handleDeviceCodeNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val.length > 6) val = val.slice(0, 6);
      let formatted = '';
      if (val.length > 0) formatted += val.slice(0, 2);
      if (val.length > 2) formatted += '-' + val.slice(2, 4);
      if (val.length > 4) formatted += '-' + val.slice(4, 6);
      const fullCode = activePrefix ? `${activePrefix} ${formatted}` : formatted;
      setFormData(prev => ({ ...prev, deviceCode: fullCode }));
      validateDeviceCode(fullCode);
  };

  const handleManualCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.toUpperCase();
      setFormData(prev => ({ ...prev, deviceCode: val }));
      validateDeviceCode(val);
  };

  const handleNesNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      const fullNes = activeSuffix ? `${val}${activeSuffix}` : val;
      setFormData(prev => ({ ...prev, nes: fullNes }));
      validateNes(fullNes);
  };

  const updateNesSuffix = (newType: DeviceType, currentNes: string | undefined) => {
    const map = TYPE_MAPPING[newType];
    const numbers = currentNes ? currentNes.replace(/[A-Z]+$/, '') : '';
    return `${numbers}${map?.nesSuffix || ''}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (formError) setFormError(null);

    if (name === 'station' && value.length > 0) {
      finalValue = value.charAt(0).toUpperCase() + value.slice(1);
    }
    
    if (name === 'deviceType') {
       const newType = value as DeviceType;
       const map = TYPE_MAPPING[newType];
       if (map) {
         let newCode = formData.deviceCode;
         if (!isManualCode) {
             const currentCodeNumbers = formData.deviceCode ? formData.deviceCode.replace(/^[A-Z]{2}\s/, '') : '';
             newCode = `${map.matrixPrefix} ${currentCodeNumbers}`;
         }
         
         const newNes = updateNesSuffix(newType, formData.nes);
         
         setFormData(prev => ({
           ...prev,
           deviceType: newType,
           deviceCode: newCode,
           nes: newNes
         }));
         validateDeviceCode(newCode || '');
         validateNes(newNes);
         return;
       }
    }
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleReadingsChange = (key: keyof ConsumptionReadings, value: string) => {
    setFormData(prev => ({
      ...prev,
      readings: { ...prev.readings, [key]: parseFloat(value) || 0 }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.station || !formData.deviceType || !formData.nes) {
      setFormError('Por favor completa los campos obligatorios.');
      return;
    }
    
    if (nesError || deviceCodeError) {
        setFormError('Corrige los errores antes de guardar.');
        return;
    }

    // Change Detection
    let hasChanged = false;
    if (!initialData) {
        hasChanged = true;
    } else {
        if (
            formData.station !== initialData.station ||
            formData.nes !== initialData.nes ||
            formData.deviceCode !== initialData.deviceCode ||
            formData.deviceType !== initialData.deviceType ||
            formData.status !== initialData.status ||
            (formData.location || '') !== (initialData.location || '') ||
            (formData.notes || '') !== (initialData.notes || '')
        ) {
            hasChanged = true;
        }
        if (!hasChanged) {
            const r1 = initialData.readings || {};
            const r2 = formData.readings || {};
            const k1 = Object.keys(r1);
            const k2 = Object.keys(r2);
            if (k1.length !== k2.length) {
                hasChanged = true;
            } else {
                for (const key of k1) {
                    if ((r1 as any)[key] !== (r2 as any)[key]) {
                        hasChanged = true;
                        break;
                    }
                }
            }
        }
    }

    const dateToSave = hasChanged ? new Date().toISOString() : (initialData?.date || new Date().toISOString());

    onSave({
      ...formData,
      id: formData.id || generateId(),
      date: dateToSave
    } as MaintenanceRecord);
  };

  const getDeviceCodeNumeric = () => {
      if (!formData.deviceCode) return '';
      if (activePrefix) return formData.deviceCode.replace(activePrefix, '').trim();
      return formData.deviceCode;
  };

  const getNesNumeric = () => {
      if (!formData.nes) return '';
      if (activeSuffix) return formData.nes.replace(activeSuffix, '');
      return formData.nes;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-w-2xl mx-auto">
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center rounded-t-lg">
        <h2 className="text-xl font-bold flex items-center gap-2">
            {formData.id ? 'Editar Registro' : 'Nuevo Registro'}
        </h2>
        <button onClick={onCancel} className="p-1 hover:bg-slate-700 rounded-full transition-colors">
            <X size={24} />
        </button>
      </div>

      <div className="p-6">
        {formError && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded flex items-start gap-3">
                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                <p className="text-red-600 dark:text-red-300 text-sm font-medium">{formError}</p>
            </div>
        )}

        {/* Removed Camera Button Section as requested */}

        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Station */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Estación *</label>
            <input
              type="text"
              name="station"
              value={formData.station}
              onChange={handleInputChange}
              className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white"
              placeholder="Ej. Sagrada Familia"
              required
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Tipo de Equipo *</label>
            <div className="relative">
                <select
                name="deviceType"
                value={formData.deviceType || ''}
                onChange={handleInputChange}
                className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg appearance-none text-black dark:text-white"
                required
                >
                <option value="" disabled>Selecciona...</option>
                {Object.values(DeviceType).map((type) => (
                    <option key={type} value={type}>{type}</option>
                ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>
          </div>

          {/* Equipo & NES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between items-center mb-1">
                 <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">Equipo *</label>
                 <button 
                    type="button" 
                    onClick={() => setIsManualCode(!isManualCode)}
                    className={`flex items-center justify-center h-6 w-6 rounded transition-colors border ${
                        isManualCode 
                        ? 'bg-blue-100 border-blue-200 text-blue-600 hover:bg-blue-200 dark:bg-blue-900 dark:border-blue-800 dark:text-blue-300' 
                        : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-400'
                    }`}
                    title={isManualCode ? "Bloquear formato estándar" : "Desbloquear formato libre"}
                  >
                      {isManualCode ? <Unlock size={12} /> : <Lock size={12} />}
                  </button>
              </div>
              
              {isManualCode ? (
                  // MANUAL FREE TEXT INPUT
                  <input
                    type="text"
                    value={formData.deviceCode || ''}
                    onChange={handleManualCodeChange}
                    className={`w-full p-2.5 bg-white dark:bg-black border rounded-lg text-black dark:text-white font-mono ${
                        deviceCodeError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Código Manual..."
                    required
                 />
              ) : (
                  // STANDARD COMPOSITE INPUT
                  <div className={`flex items-center border rounded-lg overflow-hidden bg-white dark:bg-black ${
                      deviceCodeError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}>
                     <div className="bg-gray-100 dark:bg-gray-800 px-2 py-2.5 text-gray-500 dark:text-gray-400 font-mono font-bold select-none border-r border-gray-200 dark:border-gray-700 min-w-[3rem] text-center text-sm">
                         {activePrefix || '--'}
                     </div>
                     <input
                        type="text"
                        inputMode="numeric"
                        value={getDeviceCodeNumeric()}
                        onChange={handleDeviceCodeNumberChange}
                        disabled={!activePrefix}
                        className="flex-1 p-2.5 bg-transparent border-none focus:ring-0 text-black dark:text-white font-mono outline-none disabled:cursor-not-allowed text-sm"
                        placeholder="00-00-00"
                        required
                     />
                  </div>
              )}
              
              <div className="min-h-[1rem]">
                {deviceCodeError ? (
                    <p className="text-[10px] text-red-500 mt-1">{deviceCodeError}</p>
                ) : (
                    <p className="text-[10px] text-gray-400 mt-1">
                        {isManualCode ? '(Formato Libre)' : '(Tipo Línea-Estación-Número)'}
                    </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">NES *</label>
              <div className={`flex items-center border rounded-lg overflow-hidden bg-white dark:bg-black ${
                  nesError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}>
                 <input
                    type="text"
                    inputMode="numeric"
                    value={getNesNumeric()}
                    onChange={handleNesNumberChange}
                    disabled={!activeSuffix}
                    className="flex-1 p-2.5 bg-transparent border-none focus:ring-0 text-black dark:text-white text-right font-mono outline-none disabled:cursor-not-allowed text-sm"
                    placeholder="000"
                    required
                 />
                 <div className="bg-gray-100 dark:bg-gray-800 px-2 py-2.5 text-gray-500 dark:text-gray-400 font-mono font-bold select-none border-l border-gray-200 dark:border-gray-700 min-w-[3rem] text-center text-sm">
                     {activeSuffix || '--'}
                 </div>
              </div>
              <div className="min-h-[1rem]">
               {nesError ? (
                  <p className="text-[10px] text-red-500 mt-1">{nesError}</p>
              ) : (
                  <p className="text-[10px] text-gray-400 mt-1">(Números + Sufijo)</p>
              )}
              </div>
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Estado del Equipo</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, status: EquipmentStatus.OPERATIONAL })}
                className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-all ${
                  formData.status === EquipmentStatus.OPERATIONAL
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500'
                }`}
              >
                <CheckCircle2 size={18} className={formData.status === EquipmentStatus.OPERATIONAL ? 'fill-green-100' : ''} />
                <span className="font-bold text-sm">Operativo</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, status: EquipmentStatus.INCIDENT })}
                className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-all ${
                  formData.status === EquipmentStatus.INCIDENT
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500'
                }`}
              >
                <AlertTriangle size={18} className={formData.status === EquipmentStatus.INCIDENT ? 'fill-amber-100' : ''} />
                <span className="font-bold text-sm">Incidencia</span>
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-slate-700 my-3"></div>

          {/* Consumos */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                <Zap size={16} className="text-yellow-500" /> Consumos
            </label>
            
            {(formData.deviceType === DeviceType.POZO_AGOTAMIENTO || formData.deviceType === DeviceType.FOSA_SEPTICA) ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Bomba 1</label>
                  <input type="number" step="0.1" value={formData.readings?.pump1 || ''} onChange={(e) => handleReadingsChange('pump1', e.target.value)} className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" placeholder="0.0" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Bomba 2</label>
                  <input type="number" step="0.1" value={formData.readings?.pump2 || ''} onChange={(e) => handleReadingsChange('pump2', e.target.value)} className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" placeholder="0.0" />
                </div>
              </div>
            ) : (formData.deviceType === DeviceType.VENT_ESTACION || formData.deviceType === DeviceType.VENT_TUNEL) ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Velocidad Rápida</label>
                  <input type="number" step="0.1" value={formData.readings?.speedFast || ''} onChange={(e) => handleReadingsChange('speedFast', e.target.value)} className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" placeholder="0.0" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Velocidad Lenta</label>
                  <input type="number" step="0.1" value={formData.readings?.speedSlow || ''} onChange={(e) => handleReadingsChange('speedSlow', e.target.value)} className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" placeholder="0.0" />
                </div>
              </div>
            ) : (
              <div>
                 <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Lectura General</label>
                 <input type="number" step="0.1" value={formData.readings?.generic || ''} onChange={(e) => handleReadingsChange('generic', e.target.value)} className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" placeholder="0.0" />
              </div>
            )}
          </div>

          {/* Tiempos / Ciclos (PA y FS) */}
          {(formData.deviceType === DeviceType.POZO_AGOTAMIENTO || formData.deviceType === DeviceType.FOSA_SEPTICA) && (
             <div className="mt-3">
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                    <Timer size={16} className="text-blue-500" /> Tiempos / Ciclos (en seg.)
                </label>
                <div className="grid grid-cols-4 gap-2">
                    <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Cursa (cm)</label>
                        <input type="number" inputMode="numeric" step="1" value={formData.readings?.stroke || ''} onChange={(e) => handleReadingsChange('stroke', e.target.value)} className="w-full p-2 text-sm bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" placeholder="0" />
                    </div>
                    {/* LLENADO */}
                    <div className="relative">
                        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block flex justify-between">
                            Llenado
                            <button type="button" onClick={() => openTimeTool('filling')} className="text-blue-500 hover:text-blue-600"><Watch size={14}/></button>
                        </label>
                        <input type="number" inputMode="numeric" step="1" value={formData.readings?.filling || ''} onChange={(e) => handleReadingsChange('filling', e.target.value)} className="w-full p-2 text-sm bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" placeholder="0" />
                    </div>
                    {/* B1 - MODIFICADO ETIQUETA */}
                    <div className="relative">
                        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block flex justify-between">
                            Vcdo.B1
                            <button type="button" onClick={() => openTimeTool('emptyingB1')} className="text-blue-500 hover:text-blue-600"><Watch size={14}/></button>
                        </label>
                        <input type="number" inputMode="numeric" step="1" value={formData.readings?.emptyingB1 || ''} onChange={(e) => handleReadingsChange('emptyingB1', e.target.value)} className="w-full p-2 text-sm bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" placeholder="0" />
                    </div>
                    {/* B2 - MODIFICADO ETIQUETA */}
                    <div className="relative">
                        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block flex justify-between">
                            Vcdo.B2
                            <button type="button" onClick={() => openTimeTool('emptyingB2')} className="text-blue-500 hover:text-blue-600"><Watch size={14}/></button>
                        </label>
                        <input type="number" inputMode="numeric" step="1" value={formData.readings?.emptyingB2 || ''} onChange={(e) => handleReadingsChange('emptyingB2', e.target.value)} className="w-full p-2 text-sm bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" placeholder="0" />
                    </div>
                </div>
             </div>
          )}

          {/* Vibraciones (Vents) - MODIFICADO ETIQUETA Y UNIDADES */}
          {(formData.deviceType === DeviceType.VENT_ESTACION || formData.deviceType === DeviceType.VENT_TUNEL) && (
            <div className="mt-3">
               <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                   <Activity size={16} className="text-purple-500" /> Vibraciones (m/s²)
               </label>
               <div className="grid grid-cols-2 gap-2">
                   <div className="relative">
                       <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block flex justify-between">
                           Rápida
                           <button type="button" onClick={() => openVibTool('vibrationFast')} className="text-purple-500 hover:text-purple-600"><Waves size={14}/></button>
                       </label>
                       <input type="number" inputMode="decimal" step="0.1" value={formData.readings?.vibrationFast || ''} onChange={(e) => handleReadingsChange('vibrationFast', e.target.value)} className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" placeholder="0.0" />
                   </div>
                   <div className="relative">
                       <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block flex justify-between">
                           Lenta
                           <button type="button" onClick={() => openVibTool('vibrationSlow')} className="text-purple-500 hover:text-purple-600"><Waves size={14}/></button>
                       </label>
                       <input type="number" inputMode="decimal" step="0.1" value={formData.readings?.vibrationSlow || ''} onChange={(e) => handleReadingsChange('vibrationSlow', e.target.value)} className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" placeholder="0.0" />
                   </div>
               </div>
            </div>
          )}

          {/* Protecciones Eléctricas (Oculto para L9) o Localización (Solo L9) */}
          <div className="mt-3">
             {isL9 ? (
                // L9: Show Location, Hide Protections
                <div>
                    <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-2">
                        <MapPin size={16} className="text-blue-500" /> Localización (Línea 9)
                    </label>
                    <input 
                        type="text" 
                        name="location"
                        value={formData.location || ''} 
                        onChange={handleInputChange} 
                        className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" 
                        placeholder="Ej. Pasillo de enlace, Andén 1..." 
                    />
                </div>
             ) : (
                // Standard: Show Protections
                <div>
                    <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-orange-500" /> Protecciones Eléctricas (A)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Fusibles</label>
                            <input type="number" inputMode="numeric" value={formData.readings?.fuses || ''} onChange={(e) => handleReadingsChange('fuses', e.target.value)} className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" placeholder="A" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Rango Térmico</label>
                            <div className="flex items-center gap-1">
                                <input 
                                    type="number" 
                                    inputMode="decimal" 
                                    step="0.1" 
                                    value={formData.readings?.thermalMin || ''} 
                                    onChange={(e) => handleReadingsChange('thermalMin', e.target.value)} 
                                    className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white text-center" 
                                    placeholder="Min" 
                                />
                                <span className="text-gray-400">-</span>
                                <input 
                                    type="number" 
                                    inputMode="decimal" 
                                    step="0.1" 
                                    value={formData.readings?.thermalMax || ''} 
                                    onChange={(e) => handleReadingsChange('thermalMax', e.target.value)} 
                                    className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white text-center" 
                                    placeholder="Max" 
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Regulado</label>
                            <input type="number" inputMode="decimal" step="0.1" value={formData.readings?.regulated || ''} onChange={(e) => handleReadingsChange('regulated', e.target.value)} className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" placeholder="A" />
                        </div>
                    </div>
                </div>
             )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Observaciones</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 text-black dark:text-white"
              rows={3}
              placeholder="Detalles adicionales..."
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onCancel} className="flex-1 py-3 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold flex justify-center items-center gap-2 shadow-lg shadow-red-500/30">
              <Save size={20} />
              Guardar
            </button>
          </div>
        </form>
      </div>

      {/* UNIFIED TIME TOOL MODAL */}
      {activeTimeField && (
        <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-slate-700 pb-3">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Watch size={18} className="text-blue-500"/>
                        Asistente: {activeTimeField === 'filling' ? 'Llenado' : activeTimeField === 'emptyingB1' ? 'Vcdo.B1' : 'Vcdo.B2'}
                    </h3>
                    <button onClick={closeTimeTool} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X size={20}/>
                    </button>
                </div>
                
                {/* Mode Selector for Extrapolation - Available for ALL fields now */}
                <div className="mb-4 flex bg-slate-100 dark:bg-slate-900 rounded p-1">
                    <button 
                        type="button" 
                        onClick={() => setUseExtrapolation(false)}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded ${!useExtrapolation ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}
                    >
                        Medición Directa
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setUseExtrapolation(true)}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded ${useExtrapolation ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}
                    >
                        Extrapolación
                    </button>
                </div>

                {/* STOPWATCH SECTION */}
                <div className="flex flex-col items-center mb-6">
                    <div className="text-4xl font-mono font-bold text-slate-800 dark:text-white mb-4 tabular-nums">
                        {formatSecondsToMinSec(stopwatchSeconds)}
                    </div>
                    <div className="flex gap-3 w-full">
                        <button 
                            type="button" 
                            onClick={toggleStopwatch}
                            className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${
                                isStopwatchRunning 
                                    ? 'bg-red-100 text-red-600 border border-red-200 hover:bg-red-200' 
                                    : 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                            }`}
                        >
                            {isStopwatchRunning ? <><Square size={18} fill="currentColor"/> STOP</> : <><Play size={18} fill="currentColor"/> START</>}
                        </button>
                        <button 
                            type="button" 
                            onClick={resetStopwatch}
                            className="px-4 py-3 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
                        >
                            <RotateCcw size={18} />
                        </button>
                    </div>
                </div>

                {/* EXTRAPOLATION INPUTS */}
                {useExtrapolation && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
                        <p className="text-xs text-blue-600 dark:text-blue-300 mb-2 flex items-center gap-1">
                            <Calculator size={12}/> Proyección matemática
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cursa Total</label>
                                <div className="p-2 bg-white dark:bg-black rounded border border-gray-200 dark:border-slate-600 text-center font-mono text-sm text-slate-900 dark:text-white">
                                    {formData.readings?.stroke || 0} cm
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Dist. Medida</label>
                                <input 
                                    type="number" 
                                    value={calcDist}
                                    onChange={(e) => setCalcDist(e.target.value)}
                                    placeholder="cm"
                                    className="w-full p-2 bg-white dark:bg-black border border-gray-300 dark:border-slate-600 rounded text-center font-mono text-sm focus:ring-1 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 text-center">
                            *Se usará el tiempo del cronómetro ({stopwatchSeconds}s) como tiempo medido.
                        </p>
                    </div>
                )}

                <button 
                    type="button"
                    onClick={applyTimeToolResult}
                    className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold shadow-lg hover:opacity-90 transition-opacity"
                >
                    Aplicar {useExtrapolation ? 'Proyección' : 'Tiempo'}
                </button>
            </div>
        </div>
      )}

      {/* VIBRATION TOOL MODAL - UPDATED UNITS AND MATH */}
      {activeVibrationField && (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4">
             <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 relative overflow-hidden">
                 
                 {/* Decorative background pulse */}
                 {isMeasuringVib && (
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                         <div className="w-64 h-64 rounded-full bg-purple-500 animate-ping"></div>
                     </div>
                 )}

                 <div className="flex justify-between items-center mb-6 relative z-10">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Activity size={18} className="text-purple-500"/>
                        Sensor de Vibración
                    </h3>
                    <button onClick={closeVibTool} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X size={20}/>
                    </button>
                </div>

                {vibError ? (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg mb-4 text-center text-sm">
                        {vibError}
                        <p className="text-xs mt-2 opacity-70">Asegúrate de estar en un dispositivo móvil con HTTPS.</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center mb-6 relative z-10">
                        <div className="w-32 h-32 rounded-full border-4 border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center mb-4 relative">
                             {/* Gauge fill based on value (clamped to 20 m/s^2 for visuals) */}
                             <div 
                                className="absolute bottom-0 left-0 right-0 bg-purple-500/20 transition-all duration-100 rounded-b-full" 
                                style={{ height: `${Math.min((vibValue / 20) * 100, 100)}%` }}
                             ></div>

                             <span className="text-3xl font-bold font-mono text-slate-800 dark:text-white tabular-nums">
                                 {vibValue.toFixed(1)}
                             </span>
                             <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">m/s²</span>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-xs text-gray-400 uppercase font-bold">Pico detectado:</span>
                            <span className="text-sm font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded">
                                {vibMax.toFixed(2)}
                            </span>
                        </div>

                        {!isMeasuringVib ? (
                            <p className="text-xs text-center text-gray-500 mb-4 max-w-[240px]">
                                Apoya el móvil firmemente sobre la carcasa del equipo y pulsa Iniciar.
                            </p>
                        ) : (
                            <p className="text-xs text-center text-purple-600 dark:text-purple-400 animate-pulse mb-4 font-bold">
                                Midiendo Aceleración...
                            </p>
                        )}

                        <div className="flex gap-3 w-full">
                            <button 
                                type="button" 
                                onClick={toggleVibMeasure}
                                className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${
                                    isMeasuringVib 
                                        ? 'bg-red-100 text-red-600 border border-red-200 hover:bg-red-200' 
                                        : 'bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200'
                                }`}
                            >
                                {isMeasuringVib ? 'DETENER' : 'INICIAR'}
                            </button>
                        </div>
                    </div>
                )}
                
                <button 
                    type="button"
                    onClick={applyVibResult}
                    disabled={vibMax === 0}
                    className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                >
                    Aplicar Pico ({vibMax.toFixed(2)})
                </button>
             </div>
        </div>
      )}
    </div>
  );
};