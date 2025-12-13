import React, { useState, useEffect, useRef } from 'react';
import { MaintenanceRecord, ViewState, DeviceType, EquipmentStatus } from './types';
import { StorageService } from './services/storageService';
import { GeminiService } from './services/geminiService';
import { RecordForm } from './components/RecordForm';
import { Dashboard } from './components/Dashboard';
import { AIAssistant } from './components/AIAssistant';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  LayoutGrid, 
  List as ListIcon, 
  Bot,
  Menu,
  X,
  Moon,
  Sun,
  Droplets,
  Wind,
  Box,
  StickyNote,
  AlertTriangle,
  CheckCircle2,
  Database,
  ChevronLeft,
  ChevronRight,
  ScanLine,
  Loader2,
  UploadCloud,
  Download,
  MapPin,
  Camera,
  History,
  Clock,
  Lock,
  Unlock,
  Zap,
  Settings,
  Terminal,
  Check,
  Smartphone
} from 'lucide-react';

export default function App() {
  const [data, setData] = useState<MaintenanceRecord[]>([]);
  const [view, setView] = useState<ViewState>('LIST');
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // Navigation Memory State
  const [returnToAI, setReturnToAI] = useState(false);

  // AI Persistence State
  const [aiPersistence, setAiPersistence] = useState<{query: string, response: string | null}>({
    query: '',
    response: null
  });
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  // Toast Notification State
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info' | 'error'} | null>(null);

  // Delete Confirmation Modal State (Single)
  const [recordToDelete, setRecordToDelete] = useState<MaintenanceRecord | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(0);

  // Mass Delete Modal State
  const [showMassDeleteModal, setShowMassDeleteModal] = useState(false);

  // Batch Scan State
  const [batchSearchResults, setBatchSearchResults] = useState<string[] | null>(null);
  const [isScanningBatch, setIsScanningBatch] = useState(false);
  const batchFileRef = useRef<HTMLInputElement>(null);

  // CSV Import State
  const importInputRef = useRef<HTMLInputElement>(null);

  // Menu Refs for Click Outside
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // --- DEVELOPER MODE STATE ---
  const [devMode, setDevMode] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinInputValue, setPinInputValue] = useState('');

  // --- PWA INSTALL PROMPT STATE ---
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    StorageService.seedData();
    loadData();

    // Listen for PWA install event
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Click Outside Menu Handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        mobileMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        menuBtnRef.current &&
        !menuBtnRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };

    // Añadimos 'touchstart' para mejorar respuesta en móviles
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  // Reset to page 1 when search term changes or showAll mode toggles
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, batchSearchResults, showAllRecords]);

  // If user starts searching, disable showAllRecords mode to avoid conflicts
  useEffect(() => {
      if (searchTerm) setShowAllRecords(false);
  }, [searchTerm]);

  // Timer for delete button safety
  useEffect(() => {
    if (recordToDelete && deleteCountdown > 0) {
      const timer = setTimeout(() => {
        setDeleteCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [recordToDelete, deleteCountdown]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const loadData = async () => {
    const records = await StorageService.getAll();
    setData(records);
  };

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        setInstallPrompt(null);
      }
    });
  };

  // --- DEVELOPER AUTH ---
  const handleUnlockDevMode = (e: React.FormEvent) => {
      e.preventDefault();
      if (pinInputValue === '8386') {
          setDevMode(true);
          setShowPinInput(false);
          setPinInputValue('');
          showToast('Modo Desarrollador activado', 'success');
      } else {
          showToast('PIN Incorrecto', 'error');
          setPinInputValue('');
      }
  };

  const handleLockDevMode = () => {
      setDevMode(false);
      showToast('Modo Desarrollador desactivado', 'info');
  };

  const handleSave = async (record: MaintenanceRecord) => {
    try {
      const updated = await StorageService.save(record);
      setData(updated);
      
      // Smart Navigation: Return to AI if we came from there
      if (returnToAI) {
          setView('AI_ASSISTANT');
          setReturnToAI(false); // Reset
      } else {
          setView('LIST');
      }
      
      setEditingRecord(null);
      showToast('Datos guardados correctamente en la nube');
    } catch (e) {
      console.error(e);
      showToast('Error al guardar. Comprueba tu conexión.', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!recordToDelete || !recordToDelete.id) return;

    try {
      const updated = await StorageService.delete(recordToDelete.id);
      setData(updated);
      showToast('Registro eliminado correctamente', 'info');
    } catch (error) {
      console.error(error);
      showToast('Error al eliminar el registro', 'error');
    } finally {
      setRecordToDelete(null); // Close modal
    }
  };

  const handleMassDelete = async () => {
      try {
          const updated = await StorageService.deleteAll();
          setData(updated);
          setShowMassDeleteModal(false);
          setBatchSearchResults(null);
          setCurrentPage(1);
          showToast('Base de datos vaciada correctamente', 'success');
      } catch (error) {
          console.error(error);
          showToast('Error al vaciar la base de datos', 'error');
      }
  };

  const handleDeleteClick = (record: MaintenanceRecord) => {
    // Open the custom modal instead of using window.confirm
    setRecordToDelete(record);
    // CHANGE: Increased from 5 to 10 seconds as requested
    setDeleteCountdown(10); 
  };

  const handleEdit = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setView('EDIT');
    setReturnToAI(false); // Default standard edit
  };

  // Special handler for editing from AI Assistant
  const handleAIEdit = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setReturnToAI(true); // Remember to go back to AI
    setView('EDIT');
  };

  const handleBatchScanClick = () => {
    if (batchFileRef.current) {
        batchFileRef.current.click();
    }
  };

  const handleBatchFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningBatch(true);
    setBatchSearchResults(null);
    showToast('Analizando listado...', 'info');

    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            const base64Data = base64.split(',')[1];
            const codes = await GeminiService.extractCodesFromDocument(base64Data);
            
            if (codes && codes.length > 0) {
                setBatchSearchResults(codes);
                setSearchTerm(''); // LIMPIAR EL BUSCADOR PARA EVITAR CONFLICTOS
                showToast(`Se encontraron ${codes.length} equipos en el documento`, 'success');
            } else {
                showToast('No se encontraron códigos válidos en la imagen', 'error');
            }
            setIsScanningBatch(false);
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error(error);
        setIsScanningBatch(false);
        showToast('Error al procesar la imagen', 'error');
    } finally {
        if (batchFileRef.current) batchFileRef.current.value = '';
    }
  };

  // --- CSV IMPORT LOGIC ROBUSTA ---
  const handleImportClick = () => {
    if (importInputRef.current) importInputRef.current.click();
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const text = evt.target?.result as string;
            if (!text) return;

            const lines = text.split(/\r\n|\n/);
            const newRecords: MaintenanceRecord[] = [];
            
            // Detección automática de separador (coma o punto y coma)
            const firstLine = lines[0] || '';
            const separator = firstLine.includes(';') ? ';' : ',';

            // Detección de Cabecera
            let startIndex = 0;
            const headerLower = firstLine.toLowerCase();
            if (headerLower.includes('estaci') || headerLower.includes('station') || headerLower.includes('equipo') || headerLower.includes('code')) {
                startIndex = 1;
            }

            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const cols = line.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
                
                if (cols.length >= 2) {
                    const station = cols[0];
                    const deviceCode = cols[1];
                    let nes = cols[2] || '';
                    const rawLocation = cols[3];
                    const location = (rawLocation && rawLocation.trim() !== '') ? rawLocation : undefined;

                    if (!station || !deviceCode) continue;

                    if (nes) {
                        nes = nes.replace(/^NES\s*/i, '').replace(/^"|"$/g, '');
                    }

                    let deviceType = DeviceType.OTHER;
                    const prefix = deviceCode.substring(0, 2).toUpperCase();
                    if (prefix === 'PA' || prefix === 'PE') deviceType = DeviceType.POZO_AGOTAMIENTO;
                    if (prefix === 'VE' || prefix === 'PV') deviceType = DeviceType.VENT_ESTACION;
                    if (prefix === 'VT' || prefix === 'PT') deviceType = DeviceType.VENT_TUNEL;
                    if (prefix === 'FS') deviceType = DeviceType.FOSA_SEPTICA;

                    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random().toString();

                    const record: MaintenanceRecord = {
                        id,
                        station,
                        deviceCode,
                        nes: nes || 'SIN-NES',
                        deviceType,
                        status: EquipmentStatus.OPERATIONAL,
                        readings: {},
                        date: new Date().toISOString(),
                        notes: ''
                    };
                    
                    if (location) record.location = location;

                    newRecords.push(record);
                }
            }

            if (newRecords.length > 0) {
                const count = await StorageService.importData(newRecords);
                setData(await StorageService.getAll());
                showToast(`¡Éxito! Se han importado ${newRecords.length} equipos. Total BD: ${count}`, 'success');
            } else {
                showToast('No se encontraron registros válidos. Revisa el formato CSV (Estación;Código;NES).', 'error');
            }

        } catch (err) {
            console.error(err);
            showToast('Error crítico al leer el archivo CSV.', 'error');
        }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleExportBackup = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `metro_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Copia de seguridad descargada', 'success');
  };

  // --- FILTERING & SORTING ---
  const filteredData = data.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    
    // If we are just showing all records, skip filtering
    if (showAllRecords && searchTerm === '') return true;

    let matchesBatch = true;
    if (batchSearchResults && batchSearchResults.length > 0) {
        const recordNes = (item.nes || '').toUpperCase().replace(/\s/g, '');
        const recordCode = (item.deviceCode || '').toUpperCase().replace(/\s/g, '');
        
        matchesBatch = batchSearchResults.some(scanned => {
            const s = scanned.toUpperCase().replace(/\s/g, ''); 
            if (s.length < 2) return false; // Ignore noise

            // Validar que los campos del registro no estén vacíos antes de hacer includes inverso
            const nesMatch = recordNes.length > 0 && (recordNes.includes(s) || s.includes(recordNes));
            const codeMatch = recordCode.length > 0 && (recordCode.includes(s) || s.includes(recordCode));
            
            return nesMatch || codeMatch;
        });
    }

    if (!matchesBatch) return false;
    
    // Si hay un filtro por batch activo, ignoramos searchLower si está vacío
    if (item.id === searchLower) return true;

    let searchSynonym = searchLower;
    if (searchLower.includes('pe')) searchSynonym = searchLower.replace('pe', 'pa');
    else if (searchLower.includes('pv')) searchSynonym = searchLower.replace('pv', 've');
    else if (searchLower.includes('pt')) searchSynonym = searchLower.replace('pt', 'vt');

    const stationMatch = (item.station || '').toLowerCase().includes(searchLower);
    const nesMatch = (item.nes || '').toLowerCase().includes(searchLower);
    const locationMatch = (item.location || '').toLowerCase().includes(searchLower);
    const codeMatchOriginal = (item.deviceCode || '').toLowerCase().includes(searchLower);
    const codeMatchSynonym = (item.deviceCode || '').toLowerCase().includes(searchSynonym);
    
    return stationMatch || nesMatch || locationMatch || codeMatchOriginal || codeMatchSynonym;

  }).sort((a, b) => {
      const codeA = a.deviceCode || '';
      const codeB = b.deviceCode || '';
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
  });

  // --- RECENT HISTORY LOGIC (Incidents) ---
  const activeIncidents = data.filter(d => d.status === EquipmentStatus.INCIDENT);
  const totalIncidentsCount = activeIncidents.length;

  const recentIncidents = [...activeIncidents]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10); // Top 10 recent incidents

  // --- RECENT MODIFIED LOGIC (For footer) ---
  const recentRecords = [...data]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  // --- PAGINATION ---
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRecords = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // --- HELPERS ---
  const formatDate = (isoString: string) => {
      if (!isoString) return '';
      const d = new Date(isoString);
      return d.toLocaleString('es-ES', { 
        day: '2-digit', 
        month: '2-digit', 
        year: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
  };

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case DeviceType.POZO_AGOTAMIENTO: return <Droplets size={18} className="text-blue-600 dark:text-blue-400" />;
      case DeviceType.VENT_ESTACION:
      case DeviceType.VENT_TUNEL: return <Wind size={18} className="text-cyan-600 dark:text-cyan-400" />;
      case DeviceType.FOSA_SEPTICA: return <Box size={18} className="text-amber-600 dark:text-amber-400" />;
      default: return <Zap size={18} className="text-yellow-600 dark:text-yellow-400" />;
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
        case 9: return 'border-l-orange-600 dark:border-l-orange-500';  
        case 10: return 'border-l-sky-400 dark:border-l-sky-400';    
        case 11: return 'border-l-lime-400 dark:border-l-lime-400';   
        default: return 'border-l-gray-300 dark:border-l-gray-600';   
    }
  };

  const getStatusBackground = (status: EquipmentStatus) => {
    switch (status) {
      case EquipmentStatus.INCIDENT: return 'bg-amber-50 dark:bg-amber-900/10';
      default: return 'bg-white dark:bg-slate-800'; 
    }
  };

  const getStatusBadge = (status: EquipmentStatus) => {
      switch (status) {
        case EquipmentStatus.INCIDENT:
            return (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 w-fit">
                   <AlertTriangle size={12} /> INCIDENCIA
                </span>
            );
        default: return null; 
      }
  };

  const renderReadings = (item: MaintenanceRecord) => {
    const r = item.readings || {};
    if (item.deviceType === DeviceType.POZO_AGOTAMIENTO || item.deviceType === DeviceType.FOSA_SEPTICA) {
      return (
        <span className="font-medium text-gray-800 dark:text-gray-200">
           <span className="mr-2 text-xs text-gray-500">B1:</span>{r.pump1 || '--'}A <span className="mx-1">|</span> <span className="mr-2 text-xs text-gray-500">B2:</span>{r.pump2 || '--'}A
        </span>
      );
    } else if (item.deviceType === DeviceType.VENT_ESTACION || item.deviceType === DeviceType.VENT_TUNEL) {
      return (
        <span className="font-medium text-gray-800 dark:text-gray-200">
           <span className="mr-2 text-xs text-gray-500">Ráp:</span>{r.speedFast || '--'}A <span className="mx-1">|</span> <span className="mr-2 text-xs text-gray-500">Len:</span>{r.speedSlow || '--'}A
        </span>
      );
    } else {
        return (
          <span className="font-medium text-gray-800 dark:text-gray-200">
             {r.generic || '--'}
          </span>
        );
    }
  };

  const renderCycles = (item: MaintenanceRecord) => {
    const r = item.readings || {};
    if (item.deviceType === DeviceType.POZO_AGOTAMIENTO || item.deviceType === DeviceType.FOSA_SEPTICA) {
       const hasCycles = r.stroke !== undefined || r.filling !== undefined || r.emptyingB1 !== undefined || r.emptyingB2 !== undefined;
       if (!hasCycles) return null;
       return (
        <p className="text-sm text-gray-600 dark:text-gray-400 flex justify-between items-center mt-1">
            <span>Tiempos:</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
                <span className="mr-1 text-xs text-gray-500">Cur:</span>{r.stroke ?? '--'} <span className="mx-1">|</span> 
                <span className="mr-1 text-xs text-gray-500">Llen:</span>{r.filling ?? '--'} <span className="mx-1">|</span> 
                <span className="mr-1 text-xs text-gray-500">B1:</span>{r.emptyingB1 ?? '--'} <span className="mx-1">|</span> 
                <span className="mr-1 text-xs text-gray-500">B2:</span>{r.emptyingB2 ?? '--'}
            </span>
        </p>
       )
    }
    if (item.deviceType === DeviceType.VENT_ESTACION || item.deviceType === DeviceType.VENT_TUNEL) {
       const hasVib = r.vibrationSlow !== undefined || r.vibrationFast !== undefined;
       if (!hasVib) return null;
       return (
        <p className="text-sm text-gray-600 dark:text-gray-400 flex justify-between items-center mt-1">
            <span>Vibraciones:</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
                <span className="mr-1 text-xs text-gray-500">Ráp:</span>{r.vibrationFast ?? '--'} <span className="mx-1">|</span>
                <span className="mr-1 text-xs text-gray-500">Len:</span>{r.vibrationSlow ?? '--'}
            </span>
        </p>
       )
    }
    return null;
  };

  // --- REUSABLE CARD RENDERER ---
  const renderRecordCard = (item: MaintenanceRecord) => {
      const lineColor = getLineColor(item.deviceCode);
      const bgClass = getStatusBackground(item.status);
      
      return (
        <div 
          key={item.id} 
          className={`bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border-l-4 ${lineColor} ${bgClass} border-r border-t border-b border-gray-100 dark:border-slate-700 transition-all hover:shadow-md`}
        >
          <div className="flex flex-col gap-2">
            <div className="flex-1 min-w-0">
              
              {/* LINE 1: Status Only */}
              <div className="flex justify-between items-start mb-2">
                 <div className="min-h-[1.5rem]">
                    {item.status === EquipmentStatus.INCIDENT && getStatusBadge(item.status)}
                 </div>
                 <div className={`p-1.5 rounded-full ${getDeviceIconBg(item.deviceType)}`}>
                     {getDeviceIcon(item.deviceType)}
                 </div>
              </div>
              
              {/* LINE 2: Station + Code + NES */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate">{item.station}</h3>
                    
                    {item.deviceCode && (
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded border border-slate-200 dark:border-slate-600 whitespace-nowrap">
                            {item.deviceCode}
                        </span>
                    )}
                    
                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded border border-slate-300 dark:border-slate-500 whitespace-nowrap">
                        {(item.nes || '').startsWith('NES') ? item.nes : `NES${item.nes}`}
                    </span>
              </div>

              {/* LINE 3: Location (if exists) */}
              {item.location && (
                    <div className="mb-2 flex items-start gap-1 text-sm text-blue-600 dark:text-blue-300 font-medium">
                        <MapPin size={14} className="shrink-0 mt-0.5" /> 
                        <span className="line-clamp-2">{item.location}</span>
                    </div>
              )}

              {/* LINE 4: Device Type + Readings */}
              <div className="mb-1 flex items-center gap-2 flex-wrap">
                     <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{item.deviceType}</span>
                     <span className="h-4 w-px bg-gray-300 dark:bg-gray-600 hidden sm:block"></span>
                     <span className="text-sm text-gray-600 dark:text-gray-400 ml-auto">
                        {renderReadings(item)}
                     </span>
              </div>
              
              {/* LINE 5: Times or Vibraciones */}
              <div className="mb-2">
                  {renderCycles(item)}
              </div>
              
              {/* LINE 6: Notes */}
              {item.notes && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 italic flex items-start gap-1 mt-1">
                    <StickyNote size={12} className="shrink-0 mt-0.5" /> 
                    <span className="line-clamp-2">{item.notes}</span>
                  </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-700 mt-2">
                 {/* DATE */}
                 <div className="flex items-center text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                     <Clock size={10} className="mr-1" />
                     {formatDate(item.date)}
                 </div>

                 <div className="flex gap-2">
                    <button
                        onClick={() => handleEdit(item)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center"
                        title="Editar"
                    >
                        <Edit2 size={20} />
                    </button>
                    <button
                        onClick={() => handleDeleteClick(item)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center"
                        title="Eliminar"
                    >
                        <Trash2 size={20} />
                    </button>
                 </div>
            </div>
          </div>
        </div>
      );
  };

  const NavButton = ({ label, target, icon: Icon, active }: any) => (
    <button
      onClick={() => {
        setView(target);
        setShowAllRecords(false);
        setMobileMenuOpen(false); // MEJORA: Cerrar menú al navegar
      }}
      className={`flex flex-col md:flex-row items-center justify-center md:space-x-2 px-3 py-2 rounded-md transition-colors ${
        active 
          ? 'text-white bg-slate-800 md:bg-red-700' 
          : 'text-gray-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon size={20} />
      <span className="text-[10px] md:text-sm font-medium mt-1 md:mt-0 hidden md:block">{label}</span>
    </button>
  );

  // DETERMINES IF WE ARE IN SEARCH MODE OR HERO MODE
  const isSearchActive = searchTerm.trim().length > 0 || (batchSearchResults !== null) || showAllRecords;

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900 transition-colors duration-200 pb-12">
        {/* Header (Barra Fija) */}
        <header className="bg-slate-900 dark:bg-black text-white shadow-md sticky top-0 z-50 border-b border-slate-700">
          <div className="container mx-auto px-4 py-3">
            <div className="flex justify-between items-center">
              
              {/* LOGO AREA */}
              <div className="flex items-center space-x-2 cursor-pointer shrink-0" onClick={() => { setSearchTerm(''); setBatchSearchResults(null); setShowAllRecords(false); setView('LIST'); }}>
                <div className="w-8 h-8 bg-red-600 flex items-center justify-center rounded font-bold text-white">M</div>
                <h1 className="text-xl font-bold tracking-tight hidden sm:block">MetroMaint <span className="font-light opacity-75">BCN</span></h1>
              </div>

              {/* CENTER NAV (ALWAYS VISIBLE) - Icons on Mobile, Text on Desktop */}
              <nav className="flex items-center space-x-1 md:space-x-2 mx-2">
                <NavButton label="Inicio" target="LIST" icon={ListIcon} active={view === 'LIST'} />
                <NavButton label="Estadísticas" target="DASHBOARD" icon={LayoutGrid} active={view === 'DASHBOARD'} />
                <NavButton label="Asistente" target="AI_ASSISTANT" icon={Bot} active={view === 'AI_ASSISTANT'} />
              </nav>

              {/* RIGHT SIDE: Hamburger Menu Trigger */}
              <div className="flex items-center">
                <button ref={menuBtnRef} className="p-2 text-gray-300 hover:text-white rounded hover:bg-slate-800 transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                    {mobileMenuOpen ? <X size={24}/> : <Menu size={24}/>}
                </button>
              </div>
            </div>
          </div>

          {/* Dropdown Menu (Config & Tools) */}
          {mobileMenuOpen && (
            <div ref={menuRef} className="bg-slate-800 dark:bg-slate-900 border-t border-slate-700 px-4 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200 shadow-xl">
              
              {/* SETTINGS GROUP */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                   <Settings size={12}/> Configuración
                </h3>
                
                {/* Dark Mode Toggle */}
                <button 
                  onClick={() => {
                      setDarkMode(!darkMode);
                      showToast(!darkMode ? 'Modo Oscuro activado' : 'Modo Claro activado', 'info');
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors text-slate-200"
                >
                  <div className="flex items-center gap-3">
                     {darkMode ? <Moon size={18} className="text-yellow-400"/> : <Sun size={18} className="text-yellow-400"/>}
                     <span className="text-sm font-medium">Modo {darkMode ? 'Oscuro' : 'Claro'}</span>
                  </div>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${darkMode ? 'bg-blue-600' : 'bg-slate-500'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0.5'}`} ></div>
                  </div>
                </button>
              </div>

              {/* DEV MODE & FOOTER (DISCREET) */}
              <div className="pt-4 border-t border-slate-700/50">
                 {!devMode ? (
                    // LOCKED: SHOW DISCREET TRIGGER
                    showPinInput ? (
                        <form onSubmit={handleUnlockDevMode} className="flex items-center gap-2 animate-in fade-in">
                            <input 
                                type="password" 
                                value={pinInputValue}
                                onChange={(e) => setPinInputValue(e.target.value)}
                                placeholder="PIN..."
                                autoFocus
                                className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-white outline-none focus:border-slate-400 placeholder:text-slate-600 font-mono"
                            />
                            <button type="submit" className="p-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors">
                                <Check size={14} />
                            </button>
                            <button type="button" onClick={() => { setShowPinInput(false); setPinInputValue(''); }} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
                                <X size={14} />
                            </button>
                        </form>
                    ) : (
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] text-slate-600">v1.3.1 • MetroMaint BCN</p>
                            <button onClick={() => setShowPinInput(true)} className="p-2 text-slate-700 hover:text-slate-500 transition-colors opacity-50 hover:opacity-100" title="Admin">
                                <Lock size={12} />
                            </button>
                        </div>
                    )
                 ) : (
                    // UNLOCKED: SHOW TOOLS COMPACTLY
                    <div className="animate-in fade-in slide-in-from-bottom-1">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Terminal size={10}/> Admin Tools
                            </span>
                            <button onClick={handleLockDevMode} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1">
                                <Unlock size={10} /> Bloquear
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                            {/* Hidden Inputs */}
                            <input type="file" accept=".csv" className="hidden" ref={importInputRef} onChange={handleImportChange}/>
                            
                            <button onClick={handleImportClick} className="flex flex-col items-center justify-center p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors gap-1 text-blue-400">
                               <UploadCloud size={16}/>
                               <span className="text-[9px]">Importar</span>
                            </button>
                            
                            <button onClick={handleExportBackup} className="flex flex-col items-center justify-center p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors gap-1 text-green-400">
                               <Download size={16}/>
                               <span className="text-[9px]">Backup</span>
                            </button>
                            
                            <button onClick={() => setShowMassDeleteModal(true)} className="flex flex-col items-center justify-center p-2 rounded bg-slate-700 hover:bg-red-900/30 transition-colors gap-1 text-red-500 hover:text-red-400 border border-transparent hover:border-red-500/50">
                               <Trash2 size={16}/>
                               <span className="text-[9px]">Reset BD</span>
                            </button>
                        </div>
                    </div>
                 )}
              </div>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-6">

          {/* INSTALL PROMPT BANNER */}
          {installPrompt && (
            <div className="mb-6 p-4 bg-slate-900 text-white rounded-xl shadow-lg flex items-center justify-between animate-in slide-in-from-top-4">
              <div className="flex items-center gap-3">
                <div className="bg-red-600 p-2 rounded-lg">
                  <Smartphone size={24} />
                </div>
                <div>
                  <h3 className="font-bold">Instalar MetroMaint</h3>
                  <p className="text-xs text-slate-300">Acceso rápido y pantalla completa</p>
                </div>
              </div>
              <button 
                onClick={handleInstallClick}
                className="bg-white text-slate-900 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-100 transition-colors"
              >
                INSTALAR
              </button>
            </div>
          )}
          
          {/* SEARCH BAR (Visible ONLY when searching or in other views) */}
          {(isSearchActive && view === 'LIST') || (view !== 'LIST' && view !== 'ADD') ? (
             <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               {view === 'LIST' && (
                 <div className="w-full md:w-auto flex-1 max-w-xl">
                   <div className="relative w-full flex items-center gap-2">
                     <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Equipo, NES o estación..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                            className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X size={18} />
                            </button>
                        )}
                     </div>
                     {/* Batch Scan Button Small */}
                     <input type="file" accept="image/*" capture="environment" className="hidden" ref={batchFileRef} onChange={handleBatchFileChange}/>
                     <button onClick={handleBatchScanClick} disabled={isScanningBatch} className={`p-2 rounded-lg border transition-colors ${batchSearchResults ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300'}`}>
                        {isScanningBatch ? <Loader2 className="animate-spin" size={20} /> : <ScanLine size={20} />}
                     </button>
                   </div>
                   
                   {batchSearchResults && (
                       <div className="mt-2 flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded text-sm text-blue-700 dark:text-blue-300">
                           <span className="flex items-center gap-2"><ScanLine size={14} /> Filtro Activo: {batchSearchResults.length} equipos</span>
                           <button onClick={() => setBatchSearchResults(null)} className="ml-2 p-1 hover:bg-blue-100 rounded-full"><X size={14} /></button>
                       </div>
                   )}
                 </div>
               )}
               
               {view !== 'LIST' && <div className="flex-1"></div>}

               {view === 'LIST' && (
                   <button onClick={() => { setEditingRecord(null); setReturnToAI(false); setView('ADD'); }} className="flex items-center justify-center space-x-2 bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 shadow-sm transition-colors w-full md:w-auto font-medium shrink-0">
                    <Plus size={20} /> <span>Nuevo Registro</span>
                   </button>
               )}
             </div>
          ) : null}


          {/* VIEW: LIST (Empty State / Hero vs Results) */}
          <div className="bg-transparent">
            {view === 'LIST' && (
              <>
                {!isSearchActive ? (
                  // --- HERO / LANDING VIEW ---
                  <div className="flex flex-col items-center justify-start pt-4 md:pt-8 min-h-[60vh] animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-2xl mx-auto">
                      
                      {/* INCIDENCIAS RECIENTES (Horizontal Scroll) */}
                      {totalIncidentsCount > 0 && (
                          <div className="mb-8 w-full">
                              <div className="flex items-center gap-2 mb-3 px-1">
                                  <AlertTriangle size={18} className="text-red-500" />
                                  <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Incidencias Activas</h3>
                                  <span className="bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-200 text-xs font-bold px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">{totalIncidentsCount}</span>
                              </div>
                              <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                                  {recentIncidents.map(inc => (
                                      <div 
                                        key={inc.id}
                                        onClick={() => handleEdit(inc)}
                                        className="min-w-[220px] max-w-[240px] bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-3 shadow-sm hover:shadow-md cursor-pointer transition-all border border-t-0 border-r-0 border-b-0"
                                      >
                                          <div className="flex justify-between items-start mb-1">
                                             <span className="font-bold text-slate-800 dark:text-white truncate text-sm">{inc.station}</span>
                                             <div className={`p-1 rounded-full ${getDeviceIconBg(inc.deviceType)} scale-75`}>
                                                {getDeviceIcon(inc.deviceType)}
                                             </div>
                                          </div>
                                          <div className="text-xs font-mono text-slate-600 dark:text-slate-300 mb-2 bg-white/50 dark:bg-black/20 rounded px-1 w-fit">
                                              {inc.deviceCode}
                                          </div>
                                          {inc.notes && (
                                              <div className="flex items-start gap-1 text-[10px] text-red-600 dark:text-red-400">
                                                  <StickyNote size={10} className="mt-0.5 shrink-0" />
                                                  <span className="line-clamp-2 leading-tight">{inc.notes}</span>
                                              </div>
                                          )}
                                          <div className="mt-2 text-[9px] text-slate-400 text-right">
                                              {formatDate(inc.date)}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      {/* Main Search Input */}
                      <div className="w-full px-4 mb-8">
                          <div className="relative group">
                              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                  <Search className="h-6 w-6 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                              </div>
                              <input
                                  type="text"
                                  className="block w-full pl-12 pr-4 py-5 bg-white dark:bg-slate-800 border-0 rounded-2xl text-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-none dark:ring-1 dark:ring-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-red-500 transition-all"
                                  placeholder="Buscar Equipo, Estación o Código..."
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                              />
                          </div>
                          <div className="flex justify-center mt-3">
                              <button 
                                onClick={() => setShowAllRecords(true)}
                                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center gap-1.5"
                              >
                                  <ListIcon size={14} />
                                  <span>Ver todo el inventario ordenado</span>
                              </button>
                          </div>
                      </div>

                      {/* Action Grid */}
                      <div className="grid grid-cols-2 gap-4 w-full px-4 mb-12">
                          {/* BUTTON 1: NUEVO REGISTRO (Ahora a la izquierda) */}
                          <button 
                            onClick={() => { setEditingRecord(null); setReturnToAI(false); setView('ADD'); }}
                            className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-red-500 dark:hover:border-red-500 hover:shadow-md transition-all group"
                          >
                             <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Plus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                             </div>
                             <span className="font-semibold text-slate-800 dark:text-white">Nuevo</span>
                             <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">Registro Manual</span>
                          </button>

                          {/* BUTTON 2: ESCANEAR (Ahora a la derecha) */}
                          <input type="file" accept="image/*" capture="environment" className="hidden" ref={batchFileRef} onChange={handleBatchFileChange}/>
                          <button 
                            onClick={handleBatchScanClick}
                            disabled={isScanningBatch}
                            className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-red-500 dark:hover:border-red-500 hover:shadow-md transition-all group"
                          >
                             {isScanningBatch ? (
                                <Loader2 className="h-8 w-8 text-red-500 animate-spin mb-3"/>
                             ) : (
                                <div className="h-12 w-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <Camera className="h-6 w-6 text-red-600 dark:text-red-400" />
                                </div>
                             )}
                             <span className="font-semibold text-slate-800 dark:text-white">Escanear</span>
                             <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">Lista por Foto</span>
                          </button>
                      </div>

                      {/* Recent History Section */}
                      {recentRecords.length > 0 && (
                          <div className="w-full px-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                              <div className="flex items-center gap-2 mb-4 text-slate-500 dark:text-slate-400">
                                  <History size={18} />
                                  <h3 className="text-sm font-bold uppercase tracking-wider">Última Actividad</h3>
                              </div>
                              <div className="space-y-3">
                                  {recentRecords.map(item => renderRecordCard(item))}
                              </div>
                          </div>
                      )}

                      {/* FOOTER TOTAL COUNT */}
                      <div className="mt-8 mb-6 w-full border-t border-slate-200 dark:border-slate-800/50 pt-4 flex justify-center">
                          <div className="text-xs font-medium text-slate-400 dark:text-slate-500 flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 px-3 py-1 rounded-full">
                               <Database size={12} />
                               <span>Total Equipos: {data.length}</span>
                          </div>
                      </div>
                  </div>
                ) : (
                  // --- SEARCH RESULTS VIEW ---
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-2 px-1">
                        <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300">
                          {showAllRecords ? 'Inventario Completo' : `Resultados (${filteredData.length})`}
                        </h2>
                        {(filteredData.length === 0 || showAllRecords) && (
                            <button onClick={() => { setSearchTerm(''); setBatchSearchResults(null); setShowAllRecords(false); }} className="text-sm text-red-500 hover:underline">
                                {showAllRecords ? 'Volver' : 'Limpiar Filtros'}
                            </button>
                        )}
                    </div>

                    {currentRecords.map((item) => renderRecordCard(item))}

                    {/* Empty State */}
                    {currentRecords.length === 0 && (
                        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg shadow border border-dashed border-gray-300 dark:border-slate-700">
                            <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                                <Database size={32} className="text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No se encontraron equipos</h3>
                            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2">
                               No hay coincidencias para "{searchTerm}". <br/>
                               <button onClick={() => { setSearchTerm(''); setBatchSearchResults(null); }} className="text-red-600 font-bold hover:underline mt-2">Volver al Inicio</button>
                            </p>
                        </div>
                    )}

                    {/* Pagination */}
                    {filteredData.length > 0 && (
                      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 mt-4">
                        <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-600 dark:text-slate-300">
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            Página {currentPage} de {totalPages}
                        </span>
                        <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-600 dark:text-slate-300">
                            <ChevronRight size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {view === 'ADD' && (
              <RecordForm
                existingRecords={data}
                onSave={handleSave}
                onCancel={() => { setEditingRecord(null); setReturnToAI(false); setView('LIST'); }}
              />
            )}

            {view === 'EDIT' && editingRecord && (
              <RecordForm
                initialData={editingRecord}
                existingRecords={data}
                onSave={handleSave}
                onCancel={() => {
                    setEditingRecord(null);
                    if (returnToAI) { setView('AI_ASSISTANT'); setReturnToAI(false); } 
                    else { setView('LIST'); }
                }}
              />
            )}

            {view === 'DASHBOARD' && <Dashboard data={data} />}
            
            {view === 'AI_ASSISTANT' && (
                <AIAssistant 
                    data={data} 
                    onEditRecord={handleAIEdit} 
                    persistedState={aiPersistence}
                    onPersistState={setAiPersistence}
                />
            )}
          </div>
        </main>

        {/* Floating Toast */}
        {toast && (
            <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-[100] ${
                toast.type === 'error' ? 'bg-red-600 text-white' : 
                toast.type === 'info' ? 'bg-slate-800 text-white' : 'bg-green-600 text-white'
            }`}>
                {toast.type === 'success' && <CheckCircle2 size={18} />}
                {toast.type === 'error' && <AlertTriangle size={18} />}
                {toast.type === 'info' && <StickyNote size={18} />}
                <span className="font-medium text-sm">{toast.message}</span>
            </div>
        )}

        {/* Delete Modal */}
        {recordToDelete && (
             <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
                 <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-700 transform scale-100 animate-in zoom-in-95 duration-200">
                     <div className="flex flex-col items-center text-center">
                         <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                             <Trash2 size={24} className="text-red-600 dark:text-red-400" />
                         </div>
                         <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">¿Eliminar registro?</h3>
                         <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                             Estás a punto de borrar el equipo <strong>{recordToDelete.deviceCode}</strong> de <strong>{recordToDelete.station}</strong>.
                         </p>
                         <div className="flex gap-3 w-full">
                             <button onClick={() => setRecordToDelete(null)} className="flex-1 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                             <button onClick={confirmDelete} disabled={deleteCountdown > 0} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                 {deleteCountdown > 0 ? `(${deleteCountdown})` : 'Eliminar'}
                             </button>
                         </div>
                     </div>
                 </div>
             </div>
        )}

        {/* Mass Delete Modal */}
        {showMassDeleteModal && (
             <div className="fixed inset-0 bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
                 <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border-2 border-red-500 transform scale-100 animate-in zoom-in-95 duration-200">
                     <div className="flex flex-col items-center text-center">
                         <AlertTriangle size={48} className="text-red-500 mb-4" />
                         <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">¡PELIGRO: BORRADO TOTAL!</h3>
                         <p className="text-slate-600 dark:text-slate-300 mb-6">Esta acción borrará <strong>TODOS</strong> los registros.<br/>¿Estás seguro?</p>
                         <div className="flex flex-col gap-3 w-full">
                             <button onClick={handleMassDelete} className="w-full py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg">SÍ, BORRAR TODO</button>
                             <button onClick={() => setShowMassDeleteModal(false)} className="w-full py-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
                         </div>
                     </div>
                 </div>
             </div>
        )}

      </div>
    </div>
  );
}