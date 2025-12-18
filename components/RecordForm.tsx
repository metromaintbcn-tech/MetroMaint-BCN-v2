
import React, { useState, useRef, useEffect } from 'react';
import { DeviceType, MaintenanceRecord, ConsumptionReadings, EquipmentStatus } from '../types';
import { Save, X, Loader2, AlertTriangle, Zap, CheckCircle2, Activity, Calculator, Watch, Play, Square, RotateCcw, Timer, Lock, Unlock, ShieldCheck, MapPin, Waves, Cpu, SlidersHorizontal, ChevronRight, Minus, Plus } from 'lucide-react';

interface RecordFormProps {
  initialData?: MaintenanceRecord | null;
  existingRecords: MaintenanceRecord[];
  onSave: (record: MaintenanceRecord) => void;
  onCancel: () => void;
}

const TYPE_MAPPING = {
  [DeviceType.POZO_AGOTAMIENTO]: { nesSuffix: 'PE', matrixPrefix: 'PE' },
  [DeviceType.VENT_ESTACION]:    { nesSuffix: 'PV', matrixPrefix: 'VE' },
  [DeviceType.VENT_TUNEL]:       { nesSuffix: 'PT', matrixPrefix: 'VT' },
  [DeviceType.FOSA_SEPTICA]:     { nesSuffix: 'FS', matrixPrefix: 'FS' },
  [DeviceType.OTHER]:            { nesSuffix: '',   matrixPrefix: '' },
};

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
  const [isManualCode, setIsManualCode] = useState(false);

  // --- HERRAMIENTAS DE TIEMPO ---
  const [activeTimeField, setActiveTimeField] = useState<keyof ConsumptionReadings | null>(null); 
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [stopwatchStartTime, setStopwatchStartTime] = useState<number | null>(null);
  const [calcDist, setCalcDist] = useState('');
  const [useExtrapolation, setUseExtrapolation] = useState(false);

  // --- HERRAMIENTAS DE VIBRACIÓN ---
  const [activeVibrationField, setActiveVibrationField] = useState<keyof ConsumptionReadings | null>(null);
  const [vibValue, setVibValue] = useState(0); 
  const [vibMax, setVibMax] = useState(0); 
  const [vibAdjustment, setVibAdjustment] = useState(0); 
  const [isMeasuringVib, setIsMeasuringVib] = useState(false);
  const [vibError, setVibError] = useState<string | null>(null);
  const vibBufferRef = useRef<number[]>([]);
  const BUFFER_SIZE = 30; 

  if (!formData.readings) formData.readings = {};
  if (!formData.status) formData.status = EquipmentStatus.OPERATIONAL;

  const currentTypeMap = TYPE_MAPPING[formData.deviceType as DeviceType];
  const activePrefix = currentTypeMap?.matrixPrefix || '';
  const activeSuffix = currentTypeMap?.nesSuffix || '';

  const isL9Vent = (formData.deviceType === DeviceType.VENT_ESTACION || formData.deviceType === DeviceType.VENT_TUNEL) && (formData.deviceCode || '').includes(' 09-');
  const isPump = formData.deviceType === DeviceType.POZO_AGOTAMIENTO || formData.deviceType === DeviceType.FOSA_SEPTICA;
  const isVent = formData.deviceType === DeviceType.VENT_ESTACION || formData.deviceType === DeviceType.VENT_TUNEL;

  useEffect(() => {
    if (initialData?.deviceCode && !/^[A-Z]{2}\s\d{2}-\d{2}-\d{2}$/.test(initialData.deviceCode)) {
        setIsManualCode(true);
    }
  }, []);

  useEffect(() => {
    let interval: number;
    if (isStopwatchRunning && stopwatchStartTime) {
        interval = window.setInterval(() => {
            setStopwatchSeconds(Math.floor((Date.now() - stopwatchStartTime) / 1000));
        }, 500);
    }
    return () => clearInterval(interval);
  }, [isStopwatchRunning, stopwatchStartTime]);

  useEffect(() => {
      const handleMotion = (event: DeviceMotionEvent) => {
          if (!isMeasuringVib) return;
          const acc = event.acceleration; 
          if (acc?.x !== null && acc?.y !== null && acc?.z !== null) {
              const a_raw = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);
              const multiplier = 1 + (vibAdjustment / 100);
              const a_scaled = a_raw * 1000 * Math.max(0.01, multiplier);
              vibBufferRef.current.push(a_scaled);
              if (vibBufferRef.current.length > BUFFER_SIZE) vibBufferRef.current.shift();
              const rms = Math.sqrt(vibBufferRef.current.reduce((a, b) => a + (b*b), 0) / vibBufferRef.current.length);
              setVibValue(rms);
              setVibMax(prev => Math.max(prev, rms));
          }
      };

      if (isMeasuringVib) {
          if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
              (DeviceMotionEvent as any).requestPermission().then((res: string) => {
                  if (res === 'granted') window.addEventListener('devicemotion', handleMotion);
                  else setVibError("Permiso denegado");
              });
          } else {
              window.addEventListener('devicemotion', handleMotion);
          }
      }
      return () => window.removeEventListener('devicemotion', handleMotion);
  }, [isMeasuringVib, vibAdjustment]);

  const toggleStopwatch = () => {
      if (isStopwatchRunning) setIsStopwatchRunning(false);
      else {
          setStopwatchStartTime(Date.now() - (stopwatchSeconds * 1000));
          setIsStopwatchRunning(true);
      }
  };

  const openTimeTool = (field: keyof ConsumptionReadings) => {
      setActiveTimeField(field);
      setStopwatchSeconds(0);
      setIsStopwatchRunning(false);
  };

  const applyTimeToolResult = () => {
      let val = stopwatchSeconds;
      if (useExtrapolation) {
          const d_med = parseFloat(calcDist);
          const d_norm = formData.readings?.stroke || 0;
          if (d_med > 0 && d_norm > 0) val = Math.round((stopwatchSeconds / d_med) * d_norm);
      }
      handleReadingsChange(activeTimeField!, val.toString());
      setActiveTimeField(null);
  };

  const openVibTool = (field: keyof ConsumptionReadings) => {
      setActiveVibrationField(field);
      setVibValue(0); setVibMax(0);
      setIsMeasuringVib(false);
      vibBufferRef.current = [];
  };

  const handleReadingsChange = (key: keyof ConsumptionReadings, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      readings: { ...prev.readings, [key]: typeof value === 'boolean' ? value : parseFloat(value) || 0 }
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'deviceType') {
       const newType = value as DeviceType;
       const map = TYPE_MAPPING[newType];
       const currentNum = formData.deviceCode?.replace(/^[A-Z]{2}\s/, '') || '';
       setFormData(prev => ({ 
           ...prev, 
           deviceType: newType, 
           deviceCode: `${map.matrixPrefix} ${currentNum}`,
           nes: prev.nes?.replace(/[A-Z]+$/, '') + map.nesSuffix
       }));
       return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, id: formData.id || generateId(), date: new Date().toISOString() } as MaintenanceRecord);
  };

  const renderProtectionGroup = (groupNum: 1 | 2, label: string) => {
    const suffix = groupNum === 1 ? '1' : '2';
    const hasVFD = formData.readings?.hasVFD || false;
    const unitRegulated = hasVFD ? "Hz" : "A";
    
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
                      className="w-full p-1.5 text-sm bg-white dark:bg-black border border-gray-300 dark:border-slate-600 rounded text-slate-900 dark:text-white font-bold" 
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
                              className="w-full p-1.5 text-sm bg-white dark:bg-black border border-gray-300 dark:border-slate-600 rounded text-center text-slate-900 dark:text-white" 
                            />
                            <input 
                              type="number" step="0.1" placeholder="Max"
                              value={formData.readings?.[`thermalMax${suffix}` as keyof ConsumptionReadings] as number || ''} 
                              onChange={(e) => handleReadingsChange(`thermalMax${suffix}` as keyof ConsumptionReadings, e.target.value)} 
                              className="w-full p-1.5 text-sm bg-white dark:bg-black border border-gray-300 dark:border-slate-600 rounded text-center text-slate-900 dark:text-white" 
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
                      className="w-full p-1.5 text-sm bg-white dark:bg-black border border-gray-300 dark:border-slate-600 rounded font-black text-blue-600 dark:text-blue-400" 
                    />
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 max-w-2xl mx-auto overflow-hidden">
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">{formData.id ? 'Editar Ficha' : 'Nueva Ficha de Campo'}</h2>
        <button onClick={onCancel} className="p-1 hover:bg-slate-700 rounded-full transition-colors"><X size={24} /></button>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-black text-slate-900 dark:text-slate-200 mb-1">Estación *</label>
                <input type="text" name="station" value={formData.station} onChange={handleInputChange} className="w-full p-2.5 bg-slate-50 dark:bg-black border border-slate-300 dark:border-gray-600 rounded-lg text-slate-900 dark:text-white font-bold" required />
              </div>
              <div>
                <label className="block text-sm font-black text-slate-900 dark:text-slate-200 mb-1">Tipo Equipo *</label>
                <select name="deviceType" value={formData.deviceType || ''} onChange={handleInputChange} className="w-full p-2.5 bg-slate-50 dark:bg-black border border-slate-300 dark:border-gray-600 rounded-lg text-slate-900 dark:text-white font-bold" required>
                    <option value="" disabled>Seleccionar...</option>
                    {Object.values(DeviceType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-black text-slate-900 dark:text-slate-200 mb-1">Cód. Equipo *</label>
              <input type="text" value={formData.deviceCode || ''} onChange={(e) => setFormData({...formData, deviceCode: e.target.value.toUpperCase()})} className="w-full p-2.5 bg-slate-50 dark:bg-black border border-slate-300 dark:border-gray-600 rounded-lg font-mono text-slate-900 dark:text-white font-black" required />
            </div>
            <div>
              <label className="block text-sm font-black text-slate-900 dark:text-slate-200 mb-1">NES *</label>
              <input type="text" value={formData.nes || ''} onChange={(e) => setFormData({...formData, nes: e.target.value.toUpperCase()})} className="w-full p-2.5 bg-slate-50 dark:bg-black border border-slate-300 dark:border-gray-600 rounded-lg font-mono text-slate-900 dark:text-white font-black" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-black text-slate-900 dark:text-slate-200 mb-2">Estado</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setFormData({ ...formData, status: EquipmentStatus.OPERATIONAL })} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${formData.status === EquipmentStatus.OPERATIONAL ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700' : 'border-gray-100 dark:border-slate-700 text-gray-400'}`}><CheckCircle2 size={20} /><span className="font-bold">OPERATIVO</span></button>
              <button type="button" onClick={() => setFormData({ ...formData, status: EquipmentStatus.INCIDENT })} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${formData.status === EquipmentStatus.INCIDENT ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700' : 'border-gray-100 dark:border-slate-700 text-gray-400'}`}><AlertTriangle size={20} /><span className="font-bold">INCIDENCIA</span></button>
            </div>
          </div>

          {/* LOCALIZACIÓN UNIVERSAL */}
          <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
              <label className="block text-sm font-black text-blue-900 dark:text-blue-300 mb-1 flex items-center gap-2">
                  <MapPin size={16} /> Localización / Ubicación Específica
              </label>
              <input 
                  type="text" 
                  name="location" 
                  value={formData.location || ''} 
                  onChange={handleInputChange} 
                  placeholder="Ej. Andén L1, Pasillo Transbordo, Pozo Fondo..."
                  className="w-full p-2.5 bg-white dark:bg-black border border-blue-200 dark:border-blue-800 rounded-lg text-slate-900 dark:text-white font-bold" 
              />
          </div>

          <div className="border-t border-gray-100 dark:border-slate-700 my-4"></div>

          {/* SECCIÓN CONSUMOS */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl space-y-4 border border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2"><Zap size={14} className="text-yellow-500"/> Lecturas de Potencia</h3>
              <div className="grid grid-cols-2 gap-4">
                  {isPump ? (
                      <>
                        <div><label className="text-[10px] font-black text-gray-500 block mb-1">BOMBA 1 (A)</label><input type="number" step="0.1" value={formData.readings?.pump1 || ''} onChange={(e) => handleReadingsChange('pump1', e.target.value)} className="w-full p-2 bg-white dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg text-lg font-black text-blue-700 dark:text-blue-400" /></div>
                        <div><label className="text-[10px] font-black text-gray-500 block mb-1">BOMBA 2 (A)</label><input type="number" step="0.1" value={formData.readings?.pump2 || ''} onChange={(e) => handleReadingsChange('pump2', e.target.value)} className="w-full p-2 bg-white dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg text-lg font-black text-blue-700 dark:text-blue-400" /></div>
                      </>
                  ) : (
                      <>
                        <div><label className="text-[10px] font-black text-gray-500 block mb-1">V. RÁPIDA (A)</label><input type="number" step="0.1" value={formData.readings?.speedFast || ''} onChange={(e) => handleReadingsChange('speedFast', e.target.value)} className="w-full p-2 bg-white dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg text-lg font-black text-cyan-700 dark:text-cyan-400" /></div>
                        <div><label className="text-[10px] font-black text-gray-500 block mb-1">V. LENTA (A)</label><input type="number" step="0.1" value={formData.readings?.speedSlow || ''} onChange={(e) => handleReadingsChange('speedSlow', e.target.value)} className="w-full p-2 bg-white dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg text-lg font-black text-cyan-700 dark:text-cyan-400" /></div>
                      </>
                  )}
              </div>
          </div>

          {/* RESTAURACIÓN SECCIÓN TIEMPOS / CICLOS (DEBAJO DE CONSUMOS) */}
          {isPump && (
              <div className="bg-blue-50/30 dark:bg-blue-900/5 p-4 rounded-xl space-y-4 border border-blue-100 dark:border-blue-900/30">
                  <h3 className="text-xs font-black text-blue-900 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2"><Timer size={14} className="text-blue-500"/> Tiempos y Ciclos (seg.)</h3>
                  <div className="grid grid-cols-4 gap-2">
                      <div className="col-span-1">
                          <label className="text-[9px] font-black text-gray-500 block mb-1">CURSA (cm)</label>
                          <input type="number" value={formData.readings?.stroke || ''} onChange={(e) => handleReadingsChange('stroke', e.target.value)} className="w-full p-2 bg-white dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-white" />
                      </div>
                      <div className="col-span-1">
                          <label className="text-[9px] font-black text-gray-500 block mb-1 flex justify-between">LLENADO <button type="button" onClick={() => openTimeTool('filling')}><Watch size={10} className="text-blue-500"/></button></label>
                          <input type="number" value={formData.readings?.filling || ''} onChange={(e) => handleReadingsChange('filling', e.target.value)} className="w-full p-2 bg-white dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-white" />
                      </div>
                      <div className="col-span-1">
                          <label className="text-[9px] font-black text-gray-500 block mb-1 flex justify-between">B1 <button type="button" onClick={() => openTimeTool('emptyingB1')}><Watch size={10} className="text-blue-500"/></button></label>
                          <input type="number" value={formData.readings?.emptyingB1 || ''} onChange={(e) => handleReadingsChange('emptyingB1', e.target.value)} className="w-full p-2 bg-white dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-white" />
                      </div>
                      <div className="col-span-1">
                          <label className="text-[9px] font-black text-gray-500 block mb-1 flex justify-between">B2 <button type="button" onClick={() => openTimeTool('emptyingB2')}><Watch size={10} className="text-blue-500"/></button></label>
                          <input type="number" value={formData.readings?.emptyingB2 || ''} onChange={(e) => handleReadingsChange('emptyingB2', e.target.value)} className="w-full p-2 bg-white dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-white" />
                      </div>
                  </div>
              </div>
          )}

          {/* VIBRACIONES PARA VENTILADORES */}
          {isVent && (
              <div className="bg-purple-50/30 dark:bg-purple-900/5 p-4 rounded-xl space-y-4 border border-purple-100 dark:border-purple-900/30">
                  <h3 className="text-xs font-black text-purple-900 dark:text-purple-400 uppercase tracking-widest flex items-center gap-2"><Waves size={14} className="text-purple-500"/> Vibraciones RMS (mm/s²)</h3>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-[10px] font-black text-gray-500 block mb-1 flex justify-between">RÁPIDA <button type="button" onClick={() => openVibTool('vibrationFast')}><Activity size={12} className="text-purple-500"/></button></label>
                          <input type="number" step="0.1" value={formData.readings?.vibrationFast || ''} onChange={(e) => handleReadingsChange('vibrationFast', e.target.value)} className="w-full p-2 bg-white dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-white" />
                      </div>
                      <div>
                          <label className="text-[10px] font-black text-gray-500 block mb-1 flex justify-between">LENTA <button type="button" onClick={() => openVibTool('vibrationSlow')}><Activity size={12} className="text-purple-500"/></button></label>
                          <input type="number" step="0.1" value={formData.readings?.vibrationSlow || ''} onChange={(e) => handleReadingsChange('vibrationSlow', e.target.value)} className="w-full p-2 bg-white dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-white" />
                      </div>
                  </div>
              </div>
          )}

          {/* PROTECCIONES ELÉCTRICAS */}
          {!isL9Vent && (
              <div className="space-y-3">
                  <div className="flex justify-between items-center">
                      <label className="block text-sm font-black text-slate-900 dark:text-slate-200 flex items-center gap-2">
                          <ShieldCheck size={16} className="text-orange-500" /> Protecciones Eléctricas
                      </label>
                      {isVent && (
                          <label className="flex items-center gap-2 cursor-pointer bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full text-[10px] font-black text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 select-none">
                              <Cpu size={12} className={formData.readings?.hasVFD ? "text-blue-500" : "text-gray-400"} />
                              <span>Variador</span>
                              <input type="checkbox" checked={formData.readings?.hasVFD || false} onChange={(e) => handleReadingsChange('hasVFD', e.target.checked)} className="accent-blue-600" />
                          </label>
                      )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      {renderProtectionGroup(1, isPump ? "Bomba 1" : "V. Rápida")}
                      {renderProtectionGroup(2, isPump ? "Bomba 2" : "V. Lenta")}
                  </div>
              </div>
          )}

          {/* OBSERVACIONES */}
          <div>
            <label className="block text-sm font-black text-slate-900 dark:text-slate-200 mb-1">Observaciones Técnicas</label>
            <textarea name="notes" value={formData.notes} onChange={handleInputChange} className="w-full p-2.5 bg-slate-50 dark:bg-black border border-slate-300 dark:border-gray-600 rounded-lg text-slate-900 dark:text-white font-medium" rows={2} placeholder="Indicar cualquier anomalía observada..." />
          </div>

          <div className="pt-4 flex gap-3">
              <button type="button" onClick={onCancel} className="flex-1 py-3.5 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-500 bg-white dark:bg-transparent">CANCELAR</button>
              <button type="submit" className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-black shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"><Save size={20}/> GUARDAR FICHA</button>
          </div>
        </form>
      </div>

      {/* MODAL CRONÓMETRO */}
      {activeTimeField && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-slate-700 pb-3">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Watch size={20} className="text-blue-500"/> Cronómetro de Campo</h3>
                    <button onClick={() => setActiveTimeField(null)} className="text-gray-400 hover:text-red-500"><X size={24}/></button>
                </div>
                <div className="mb-4 flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1">
                    <button type="button" onClick={() => setUseExtrapolation(false)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${!useExtrapolation ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-gray-500'}`}>Directa</button>
                    <button type="button" onClick={() => setUseExtrapolation(true)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${useExtrapolation ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-gray-500'}`}>Extrapolación</button>
                </div>
                <div className="flex flex-col items-center mb-8">
                    <div className="text-6xl font-black font-mono text-slate-800 dark:text-white mb-6 tabular-nums">{stopwatchSeconds}s</div>
                    <div className="flex gap-4 w-full">
                        <button type="button" onClick={toggleStopwatch} className={`flex-1 py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all shadow-md ${isStopwatchRunning ? 'bg-red-100 text-red-600 border-2 border-red-200' : 'bg-green-600 text-white'}`}>{isStopwatchRunning ? 'STOP' : 'START'}</button>
                        <button type="button" onClick={() => setStopwatchSeconds(0)} className="px-6 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 rounded-xl"><RotateCcw size={20} /></button>
                    </div>
                </div>
                {useExtrapolation && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Cursa (cm)</label><div className="p-2.5 bg-white dark:bg-black rounded-lg border border-gray-200 text-center font-bold text-slate-900 dark:text-white">{formData.readings?.stroke || 0}</div></div>
                            <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-1">D. Medida (cm)</label><input type="number" value={calcDist} onChange={(e) => setCalcDist(e.target.value)} placeholder="cm" className="w-full p-2 bg-white dark:bg-black border border-gray-300 rounded-lg text-center font-bold text-blue-700" /></div>
                        </div>
                    </div>
                )}
                <button type="button" onClick={applyTimeToolResult} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black shadow-lg">CARGAR TIEMPO</button>
            </div>
        </div>
      )}

      {/* MODAL VIBRÓMETRO PROFESSIONAL */}
      {activeVibrationField && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 relative overflow-hidden">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2 tracking-tight"><Activity size={20} className="text-purple-500"/> VIBRÓMETRO RMS</h3>
                    <button onClick={() => setActiveVibrationField(null)} className="text-gray-400 hover:text-red-500 transition-colors"><X size={24}/></button>
                </div>
                <div className="flex flex-col items-center mb-8">
                    <div className="w-40 h-40 rounded-full border-8 border-slate-100 dark:border-slate-900 flex flex-col items-center justify-center mb-6 bg-slate-50 dark:bg-black/40 shadow-inner relative overflow-hidden">
                         <div className="absolute bottom-0 left-0 right-0 bg-purple-500/20 transition-all duration-75" style={{ height: `${Math.min((vibValue / 800) * 100, 100)}%` }}></div>
                         <span className="text-5xl font-black font-mono text-slate-800 dark:text-white tabular-nums z-10">{vibValue.toFixed(1)}</span>
                         <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest z-10 mt-1">mm/s² RMS</span>
                    </div>
                    <div className="w-full bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-3 px-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><SlidersHorizontal size={12}/> Trim / Sensibilidad</label>
                            <span className={`text-xs font-mono font-black px-2 py-0.5 rounded ${vibAdjustment === 0 ? 'bg-gray-200 text-gray-600' : vibAdjustment > 0 ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                {vibAdjustment > 0 ? '+' : ''}{vibAdjustment}%
                            </span>
                        </div>
                        <div className="relative pt-2 pb-6">
                            <input type="range" min="-90" max="100" step="1" value={vibAdjustment} onChange={(e) => setVibAdjustment(parseInt(e.target.value))} className="w-full h-2.5 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600 relative z-10" />
                            <div className="absolute left-[calc(47%)] top-1 h-5 w-1.5 bg-red-500 rounded-full z-20 shadow-sm border border-white"></div>
                            <div className="absolute left-0 right-0 bottom-0 flex justify-between text-[9px] font-black text-gray-400 uppercase px-1">
                                <span className="flex items-center gap-0.5"><Minus size={10}/> Reducir</span>
                                <span className="text-red-500/40">Fábrica 0</span>
                                <span className="flex items-center gap-0.5">Aumentar <Plus size={10}/></span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <button type="button" onClick={() => setIsMeasuringVib(!isMeasuringVib)} className={`w-full py-4 rounded-xl font-black text-white shadow-lg transition-all flex items-center justify-center gap-3 ${isMeasuringVib ? 'bg-red-500 animate-pulse' : 'bg-purple-600 hover:bg-purple-700'}`}>
                        {isMeasuringVib ? <Square size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}
                        {isMeasuringVib ? 'DETENER MEDICIÓN' : 'INICIAR TEST'}
                    </button>
                    <button type="button" onClick={() => { handleReadingsChange(activeVibrationField!, vibMax.toFixed(1)); setActiveVibrationField(null); }} disabled={vibMax === 0} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black shadow-lg disabled:opacity-30 flex items-center justify-center gap-2">
                        <CheckCircle2 size={20}/> CARGAR PICO: {vibMax.toFixed(1)}
                    </button>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};
