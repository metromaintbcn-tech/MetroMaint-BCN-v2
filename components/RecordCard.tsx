
import React from 'react';
import { 
  Trash2, Edit2, Droplets, Wind, Box, StickyNote, AlertTriangle, Clock, MapPin, Zap 
} from 'lucide-react';
import { MaintenanceRecord, DeviceType, EquipmentStatus } from '../types';

interface RecordCardProps {
  item: MaintenanceRecord;
  onEdit: (record: MaintenanceRecord) => void;
  onDelete: (record: MaintenanceRecord) => void;
  formatDate: (isoString: string) => string;
}

export const RecordCard: React.FC<RecordCardProps> = ({ item, onEdit, onDelete, formatDate }) => {
  
  const getLineColor = (deviceCode: string | undefined) => {
    if (!deviceCode) return 'border-l-gray-300 dark:border-l-gray-600'; 
    const match = deviceCode.match(/(\d{1,2})/);
    const num = match ? parseInt(match[0], 10) : -1;
    switch (num) {
        case 1: return 'border-l-red-600 dark:border-l-red-500';     
        case 2: return 'border-l-purple-600 dark:border-l-purple-500';  
        case 3: return 'border-l-green-600 dark:border-l-green-500';   
        case 4: return 'border-l-yellow-400 dark:border-l-yellow-400';  
        case 5: return 'border-l-blue-600 dark:border-l-blue-500';     
        case 9: return 'border-l-orange-400 dark:border-l-orange-400'; 
        case 10: return 'border-l-sky-400 dark:border-l-sky-400';    
        case 11: return 'border-l-lime-400 dark:border-l-lime-400';   
        default: return 'border-l-gray-300 dark:border-l-gray-600';   
    }
  };

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case DeviceType.POZO_AGOTAMIENTO: return <Droplets size={18} className="text-blue-700 dark:text-blue-400" />;
      case DeviceType.VENT_ESTACION:
      case DeviceType.VENT_TUNEL: return <Wind size={18} className="text-cyan-700 dark:text-cyan-400" />;
      case DeviceType.FOSA_SEPTICA: return <Box size={18} className="text-amber-700 dark:text-amber-400" />;
      default: return <Zap size={18} className="text-yellow-700 dark:text-yellow-400" />;
    }
  };

  const getDeviceIconBg = (type: DeviceType) => {
    switch (type) {
      case DeviceType.POZO_AGOTAMIENTO: return "bg-blue-100 dark:bg-blue-900/30";
      case DeviceType.VENT_ESTACION:
      case DeviceType.VENT_TUNEL: return "bg-cyan-100 dark:bg-cyan-900/30";
      case DeviceType.FOSA_SEPTICA: return "bg-amber-100 dark:bg-amber-900/30";
      default: return "bg-yellow-100 dark:bg-yellow-900/30";
    }
  };

  const renderReadings = () => {
    const r = item.readings || {};
    if (item.deviceType === DeviceType.POZO_AGOTAMIENTO || item.deviceType === DeviceType.FOSA_SEPTICA) {
      return (
        <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
           <span className="mr-1 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">B1:</span>{r.pump1 || '--'}A <span className="mx-1 text-slate-300">|</span> <span className="mr-1 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">B2:</span>{r.pump2 || '--'}A
        </span>
      );
    } else if (item.deviceType === DeviceType.VENT_ESTACION || item.deviceType === DeviceType.VENT_TUNEL) {
      return (
        <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
           <span className="mr-1 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Ráp:</span>{r.speedFast || '--'}A <span className="mx-1 text-slate-300">|</span> <span className="mr-1 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Len:</span>{r.speedSlow || '--'}A
        </span>
      );
    }
    return <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">{r.generic || '--'}</span>;
  };

  const renderExtraInfo = () => {
    const r = item.readings || {};
    if (item.deviceType === DeviceType.POZO_AGOTAMIENTO || item.deviceType === DeviceType.FOSA_SEPTICA) {
       const hasCycles = r.stroke !== undefined || r.filling !== undefined || r.emptyingB1 !== undefined || r.emptyingB2 !== undefined;
       if (!hasCycles) return null;
       return (
        <div className="flex items-center justify-between mt-2 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-md border border-slate-100 dark:border-slate-800">
            <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 shrink-0">T:</span>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm flex flex-wrap justify-end gap-x-2 sm:gap-x-3 text-right">
                <div className="flex items-center whitespace-nowrap"><span className="mr-0.5 text-[10px] text-slate-400 font-normal uppercase">Cur:</span>{r.stroke ?? '--'}s</div>
                <div className="flex items-center whitespace-nowrap"><span className="mr-0.5 text-[10px] text-slate-400 font-normal uppercase">Llen:</span>{r.filling ?? '--'}s</div>
                <div className="flex items-center whitespace-nowrap"><span className="mr-0.5 text-[10px] text-slate-400 font-normal uppercase">B1:</span>{r.emptyingB1 ?? '--'}s</div>
                <div className="flex items-center whitespace-nowrap"><span className="mr-0.5 text-[10px] text-slate-400 font-normal uppercase">B2:</span>{r.emptyingB2 ?? '--'}s</div>
            </div>
        </div>
       )
    }
    if (item.deviceType === DeviceType.VENT_ESTACION || item.deviceType === DeviceType.VENT_TUNEL) {
       const hasVib = r.vibrationSlow !== undefined || r.vibrationFast !== undefined;
       if (!hasVib) return null;
       return (
        <div className="flex items-center justify-between mt-2 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-md border border-slate-100 dark:border-slate-800">
            <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 shrink-0">Vibraciones m/s²</span>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm flex justify-end gap-x-4 text-right">
                <div className="flex items-center whitespace-nowrap"><span className="mr-1 text-[10px] text-slate-400 font-normal uppercase">Ráp:</span>{r.vibrationFast ?? '--'}</div>
                <div className="flex items-center whitespace-nowrap"><span className="mr-1 text-[10px] text-slate-400 font-normal uppercase">Len:</span>{r.vibrationSlow ?? '--'}</div>
            </div>
        </div>
       )
    }
    return null;
  };

  return (
    <div 
      className={`bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-lg shadow-sm border-l-8 ${getLineColor(item.deviceCode)} ${item.status === EquipmentStatus.INCIDENT ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''} border-r border-t border-b border-slate-200 dark:border-slate-700 transition-all hover:shadow-md`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
             <div className="min-h-[1.5rem]">
                {item.status === EquipmentStatus.INCIDENT && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 w-fit uppercase tracking-tighter">
                    <AlertTriangle size={12} /> INCIDENCIA
                  </span>
                )}
             </div>
             <div className={`p-1.5 rounded-full ${getDeviceIconBg(item.deviceType)}`}>
                 {getDeviceIcon(item.deviceType)}
             </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="font-black text-base sm:text-lg text-slate-950 dark:text-white truncate tracking-tight">{item.station}</h3>
                {item.deviceCode && (
                    <span className="font-mono text-[10px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 whitespace-nowrap">
                        {item.deviceCode}
                    </span>
                )}
                <span className="font-mono text-[10px] sm:text-xs font-black text-slate-900 dark:text-slate-100 bg-slate-200 dark:bg-slate-600 px-2 py-1 rounded border border-slate-400 dark:border-slate-500 whitespace-nowrap shadow-sm">
                    {(item.nes || '').startsWith('NES') ? item.nes : `NES${item.nes}`}
                </span>
          </div>

          {item.location && (
                <div className="mb-2 flex items-start gap-1 text-sm text-blue-800 dark:text-blue-300 font-bold">
                    <MapPin size={14} className="shrink-0 mt-0.5" /> 
                    <span className="line-clamp-2">{item.location}</span>
                </div>
          )}

          <div className="mb-1 flex items-center justify-between flex-wrap gap-2">
                 <span className="font-black text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase tracking-tighter">{item.deviceType}</span>
                 <div className="ml-auto">
                    {renderReadings()}
                 </div>
          </div>
          
          <div className="mb-1">{renderExtraInfo()}</div>
          
          {item.notes && (
              <div className="text-xs text-slate-600 dark:text-slate-400 italic flex items-start gap-1 mt-2 bg-slate-50 dark:bg-slate-900/20 p-2 rounded border border-slate-100 dark:border-slate-800">
                <StickyNote size={12} className="shrink-0 mt-0.5 text-slate-400" /> 
                <span className="line-clamp-3">{item.notes}</span>
              </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700 mt-2">
             <div className="flex items-center text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-wider">
                 <Clock size={10} className="mr-1" />
                 {formatDate(item.date)}
             </div>
             <div className="flex gap-2">
                <button onClick={() => onEdit(item)} className="p-2.5 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-lg transition-colors border border-blue-50 dark:border-transparent"><Edit2 size={18} /></button>
                <button onClick={() => onDelete(item)} className="p-2.5 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-slate-700 rounded-lg transition-colors border border-red-50 dark:border-transparent"><Trash2 size={18} /></button>
             </div>
        </div>
      </div>
    </div>
  );
};
