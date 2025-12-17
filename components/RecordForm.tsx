
import React, { useState, useRef, useEffect } from 'react';
import { DeviceType, MaintenanceRecord, ConsumptionReadings, EquipmentStatus } from '../types';
import { Save, X, Loader2, AlertTriangle, Zap, CheckCircle2, Activity, Calculator, Watch, Play, Square, RotateCcw, Timer, Lock, Unlock, ShieldCheck, MapPin, Waves, Cpu, User } from 'lucide-react';

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
  // Try to get default operator from localStorage
  const defaultOperator = localStorage.getItem('metromaint_operator') || '';

  const [formData, setFormData] = useState<Partial<MaintenanceRecord>>(
    initialData || {
      station: '',
      nes: '',
      deviceCode: '',
      deviceType: '' as DeviceType,
      status: EquipmentStatus.OPERATIONAL,
      readings: {},
      notes: '',
      lastModifiedBy: defaultOperator
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
    if (formData.deviceType !== DeviceType.VENT_ESTACION && formData.deviceType !== DeviceType.VENT_TUNEL) {
        return false;
    }
    return (formData.deviceCode || '').includes(' 09-');
  };

  const isL9 = isLine9Vent();

  // --- INITIALIZATION LOGIC ---
  useEffect(() => {
    if (initialData && initialData.deviceCode) {
        const standardPattern = /^[A-Z]{2}\s\d{2}-\d{2}-\d{2}$/;
        if (!standardPattern.test(initialData.deviceCode)) {
            setIsManualCode(true);
        }
    }
  }, [initialData]);

  // --- VALIDATION LOGIC ---
  useEffect(() => {
    if (formData.deviceCode) validateDeviceCode(formData.deviceCode);
    if (formData.nes) validateNes(formData.nes);
  }, [isManualCode]); 

  // --- STOPWATCH LOGIC ---
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
          const acc = event.acceleration;
          if (acc && acc.x !== null) {
              const a = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);
              setVibValue(prev => (prev * 0.7) + (a * 0.3));
              setVibMax(prev => Math.max(prev, a));
          }
      };
      if (isMeasuringVib) {
          if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
              (DeviceMotionEvent as any).requestPermission()
                  .then((response: string) => {
                      if (response === 'granted') window.addEventListener('devicemotion', handleMotion);
                      else { setVibError("Permiso de sensores denegado."); setIsMeasuringVib(false); }
                  })
                  .catch((e: any) => { setVibError("Error sensores."); setIsMeasuringVib(false); });
          } else {
              window.addEventListener('devicemotion', handleMotion);
          }
      }
      return () => { window.removeEventListener('devicemotion', handleMotion); };
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
              alert("Para extrapolar, mide un tiempo e introduce la distancia.");
              return;
          }
      }
      handleReadingsChange(activeTimeField, finalValue.toString());
      closeTimeTool();
  };

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
      if (isMeasuringVib) setIsMeasuringVib(false);
      else { setVibValue(0); setVibMax(0); setIsMeasuringVib(true); }
  };

  const applyVibResult = () => {
      if (!activeVibrationField) return;
      handleReadingsChange(activeVibrationField, vibMax.toFixed(2));
      closeVibTool();
  };

  const formatSecondsToMinSec = (totalSeconds: number) => {
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m}m ${s}s`;
  };

  const validateDeviceCode = (value: string): boolean => {
    if (!value) { setDeviceCodeError(null); return true; }
    if (!isManualCode) {
        const isDuplicate = existingRecords.some(r => r.deviceCode === value && r.id !== formData.id);
        if (isDuplicate) { setDeviceCodeError("Código duplicado."); return false; }
    }
    setDeviceCodeError(null);
    return true;
  };

  const validateNes = (value: string): boolean => {
      if (!value) { setNesError(null); return true; }
      const isDuplicate = existingRecords.some(r => r.nes === value && r.id !== formData.id);
      if (isDuplicate) { setNesError("NES duplicado."); return false; }
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (formError) setFormError(null);
    if (name === 'station' && value.length > 0) finalValue = value.charAt(0).toUpperCase() + value.slice(1);
    
    if (name === 'deviceType') {
       const newType = value as DeviceType;
       const map = TYPE_MAPPING[newType];
       if (map) {
         let newCode = formData.deviceCode;
         if (!isManualCode) {
             const currentCodeNumbers = formData.deviceCode ? formData.deviceCode.replace(/^[A-Z]{2}\s/, '') : '';
             newCode = `${map.matrixPrefix} ${currentCodeNumbers}`;
         }
         const newNes = formData.nes ? formData.nes.replace(/[A-Z]+$/, '') + map.nesSuffix : '';
         setFormData(prev => ({ ...prev, deviceType: newType, deviceCode: newCode, nes: newNes }));
         validateDeviceCode(newCode || '');
         validateNes(newNes);
         return;
       }
    }
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleReadingsChange = (key: keyof ConsumptionReadings, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      readings: { ...prev.readings, [key]: typeof value === 'boolean' ? value : parseFloat(value) || 0 }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.station || !formData.deviceType || !formData.nes || !formData.lastModifiedBy) {
      setFormError('Faltan campos obligatorios (Estación, Tipo, NES, Operario).');
      return;
    }
    if (nesError || deviceCodeError) {
        setFormError('Corrige los errores en los códigos.');
        return;
    }

    // Save operator to localStorage for next time
    if (formData.lastModifiedBy) {
        localStorage.setItem('metromaint_operator', formData.lastModifiedBy);
    }

    onSave({
      ...formData,
      id: formData.id || generateId(),
      date: new Date().toISOString()
    } as MaintenanceRecord);
  };

  const getDeviceCodeNumeric = () => activePrefix && formData.deviceCode ? formData.deviceCode.replace(activePrefix, '').trim() : formData.deviceCode;
  const getNesNumeric = () => activeSuffix && formData.nes ? formData.nes.replace(activeSuffix, '') : formData.nes;

  const isPump = formData.deviceType === DeviceType.POZO_AGOTAMIENTO || formData.deviceType === DeviceType.FOSA_SEPTICA;
  const isVent = formData.deviceType === DeviceType.VENT_ESTACION || formData.deviceType === DeviceType.VENT_TUNEL;
  const showVFD = isVent;
  const hasVFD = formData.readings?.hasVFD || false;

  const labelGroup1 = isPump ? "Bomba 1" : "V. Rápida";
  const labelGroup2 = isPump ? "Bomba 2" : "V. Lenta";
  const unitRegulated = hasVFD ? "Hz" : "A";

  const renderProtectionGroup = (groupNum: 1 | 2, label: string) => {
      const suffix = groupNum === 1 ? '1' : '2';
      return (
          <div className="bg-gray-50 dark:bg-slate-900/50 p-3 rounded-lg border border-gray-100 dark:border-slate-700">
              <h4 className="text-xs font-bold uppercase text-gray-500 mb-2 border-b border-gray-200 dark:border-slate-700 pb-1">{label}</h4>
              <div className="space-y-2">
                  <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5">Fusibles (A)</label>
                      <input 
                        type="number" inputMode="numeric" placeholder="A"
                        value={formData.readings?.[`fuses${suffix}` as keyof ConsumptionReadings] as number || ''} 
                        onChange={(e) => handleReadingsChange(`fuses${suffix}` as keyof ConsumptionReadings, e.target.value)} 
                        className="w-full p-1.5 text-sm bg-white dark:bg-black border border-gray-300 dark:border-slate-600 rounded" 
                      />
                  </div>
                  {!hasVFD && (
                      <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">Rango Térmico (A)</label>
                          <div className="flex gap-1">
                              <input 
                                type="number" step="0.1" placeholder="Min"
                                value={formData.readings?.[`thermalMin${suffix}` as keyof ConsumptionReadings] as number || ''} 
                                onChange={(e) => handleReadingsChange(`thermalMin${suffix}` as keyof ConsumptionReadings, e.target.value)} 
                                className="w-full p-1.5 text-sm bg-white dark:bg-black border border-gray-300 dark:border-slate-600 rounded text-center" 
                              />
                              <input 
                                type="number" step="0.1" placeholder="Max"
                                value={formData.readings?.[`thermalMax${suffix}` as keyof ConsumptionReadings] as number || ''} 
                                onChange={(e) => handleReadingsChange(`thermalMax${suffix}` as keyof ConsumptionReadings, e.target.value)} 
                                className="w-full p-1.5 text-sm bg-white dark:bg-black border border-gray-300 dark:border-slate-600 rounded text-center" 
                              />
                          </div>
                      </div>
                  )}
                  <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5">
                          {hasVFD ? 'Frecuencia' : 'Regulado'} ({unitRegulated})
                      </label>
                      <input 
                        type="number" step="0.1" placeholder={unitRegulated}
                        value={formData.readings?.[`regulated${suffix}` as keyof ConsumptionReadings] as number || ''} 
                        onChange={(e) => handleReadingsChange(`regulated${suffix}` as keyof ConsumptionReadings, e.target.value)} 
                        className="w-full p-1.5 text-sm bg-white dark:bg-black border border-gray-300 dark:border-slate-600 rounded font-semibold text-blue-600 dark:text-blue-400" 
                      />
                  </div>
              </div>
          </div>
      );
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

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Operator - ESSENTIAL FOR TEAM OF 20 */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                <User size={16} className="text-blue-500" /> Operario Responsable *
            </label>
            <input 
                type="text" 
                name="lastModifiedBy" 
                value={formData.lastModifiedBy || ''} 
                onChange={handleInputChange} 
                className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white font-semibold" 
                placeholder="Tu nombre..." 
                required 
            />
            <p className="text-[10px] text-slate-400 mt-1">Se guardará como predeterminado en este móvil.</p>
          </div>

          {/* Station */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Estación *</label>
            <input type="text" name="station" value={formData.station} onChange={handleInputChange} className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white" placeholder="Ej. Sagrada Familia" required />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Tipo de Equipo *</label>
            <div className="relative">
                <select name="deviceType" value={formData.deviceType || ''} onChange={handleInputChange} className="w-full p-2.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg appearance-none text-black dark:text-white" required>
                <option value="" disabled>Selecciona...</option>
                {Object.values(DeviceType).map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
            </div>
          </div>

          {/* Equipo & NES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between items-center mb-1">
                 <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">Equipo *</label>
                 <button type="button" onClick={() => setIsManualCode(!isManualCode)} className={`flex items-center justify-center h-6 w-6 rounded transition-colors border ${isManualCode ? 'bg-blue-100 border-blue-200 text-blue-600' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>{isManualCode ? <Unlock size={12} /> : <Lock size={12} />}</button>
              </div>
              {isManualCode ? (
                  <input type="text" value={formData.deviceCode || ''} onChange={handleManualCodeChange} className={`w-full p-2.5 bg-white dark:bg-black border rounded-lg text-black dark:text-white font-mono ${deviceCodeError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`} placeholder="Código Manual..." required />
              ) : (
                  <div className={`flex items-center border rounded-lg overflow-hidden bg-white dark:bg-black ${deviceCodeError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}>
                     <div className="bg-gray-100 dark:bg-gray-800 px-2 py-2.5 text-gray-500 dark:text-gray-400 font-mono font-bold select-none border-r border-gray-200 dark:border-gray-700 min-w-[3rem] text-center text-sm">{activePrefix || '--'}</div>
                     <input type="text" inputMode="numeric" value={getDeviceCodeNumeric()} onChange={handleDeviceCodeNumberChange} disabled={!activePrefix} className="flex-1 p-2.5 bg-transparent border-none focus:ring-0 text-black dark:text-white font-mono outline-none disabled:cursor-not-allowed text-sm" placeholder="00-00-00" required />