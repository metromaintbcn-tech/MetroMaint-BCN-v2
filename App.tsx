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
  Loader2,
  UploadCloud,
  Download,
  MapPin,
  Camera,
  History,
  Clock,
  Lock,
  Unlock,
  Settings,
  Terminal,
  Check,
  Smartphone,
  FileSpreadsheet,
  Zap,
  Square
} from 'lucide-react';

export default function App() {
  const [data, setData] = useState<MaintenanceRecord[]>([]);
  const [view, setView] = useState<ViewState>('LIST');
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  const [returnToAI, setReturnToAI] = useState(false);
  const [aiPersistence, setAiPersistence] = useState<{query: string, response: string | null}>({
    query: '',
    response: null
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info' | 'error'} | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<MaintenanceRecord | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const [showMassDeleteModal, setShowMassDeleteModal] = useState(false);
  const [batchSearchResults, setBatchSearchResults] = useState<string[] | null>(null);
  const [isScanningBatch, setIsScanningBatch] = useState(false);
  const batchFileRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const [devMode, setDevMode] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinInputValue, setPinInputValue] = useState('');
  
  const [isAiConfigured, setIsAiConfigured] = useState(false);
  const [aiUsage, setAiUsage] = useState({ count: 0, lastReset: '' });

  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    StorageService.seedData();
    loadData();
    setIsAiConfigured(GeminiService.checkConnection());
    setAiUsage(GeminiService.getUsage());

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      setAiUsage(GeminiService.getUsage());
    }
  }, [mobileMenuOpen, view]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (mobileMenuOpen && menuRef.current && !menuRef.current.contains(event.target as Node) && menuBtnRef.current && !menuBtnRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, batchSearchResults, showAllRecords]);
  useEffect(() => { if (searchTerm) setShowAllRecords(false); }, [searchTerm]);
  useEffect(() => {
    if (recordToDelete && deleteCountdown > 0) {
      const timer = setTimeout(() => { setDeleteCountdown((prev) => prev - 1); }, 1000);
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
      if (choiceResult.outcome === 'accepted') setInstallPrompt(null);
    });
  };

  const handleUnlockDevMode = (e: React.FormEvent) => {
      e.preventDefault();
      if (pinInputValue === '8386') {
          setDevMode(true);
          setShowPinInput(false);
          setPinInputValue('');
          showToast('Modo Desarrollador activado');
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
      if (returnToAI) {
          setView('AI_ASSISTANT');
          setReturnToAI(false);
      } else setView('LIST');
      setEditingRecord(null);
      showToast('Datos guardados correctamente');
    } catch (e) {
      showToast('Error al guardar', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!recordToDelete || !recordToDelete.id) return;
    try {
      const updated = await StorageService.delete(recordToDelete.id);
      setData(updated);
      showToast('Registro eliminado', 'info');
    } catch (error) {
      showToast('Error al eliminar', 'error');
    } finally { setRecordToDelete(null); }
  };

  const handleMassDelete = async () => {
      try {
          const updated = await StorageService.deleteAll();
          setData(updated);
          setShowMassDeleteModal(false);
          setBatchSearchResults(null);
          setCurrentPage(1);
          showToast('Base de datos vaciada', 'success');
      } catch (error) {
          showToast('Error al vaciar BD', 'error');
      }
  };

  const handleDeleteClick = (record: MaintenanceRecord) => {
    setRecordToDelete(record);
    setDeleteCountdown(10); 
  };

  const handleEdit = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setView('EDIT');
    setReturnToAI(false);
  };

  const handleAIEdit = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setReturnToAI(true);
    setView('EDIT');
  };

  const handleBatchScanClick = () => {
    if (batchFileRef.current) batchFileRef.current.click();
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const MAX_WIDTH = 1024;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error("Canvas context error")); return; }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl.split(',')[1]);
        };
      };
    });
  };

  const handleBatchFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningBatch(true);
    setBatchSearchResults(null);
    showToast('Escaneando...', 'info');
    try {
        const base64Data = await compressImage(file);
        const codes = await GeminiService.extractCodesFromDocument(base64Data);
        if (codes && codes.length > 0) {
            setBatchSearchResults(codes);
            setSearchTerm('');
            showToast(`Encontrados ${codes.length} equipos.`, 'success');
            setAiUsage(GeminiService.getUsage());
        } else showToast('No se encontraron códigos.', 'error');
    } catch (error: any) {
        showToast(`⚠️ ${error.message || 'Error'}`, 'error');
    } finally {
        setIsScanningBatch(false);
        if (batchFileRef.current) batchFileRef.current.value = '';
    }
  };

  const handleImportClick = () => { if (importInputRef.current) importInputRef.current.click(); };
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
            const separator = lines[0].includes(';') ? ';' : ',';
            let startIndex = lines[0].toLowerCase().includes('estaci') ? 1 : 0;
            for (let i = startIndex; i < lines.length; i++) {
                const cols = lines[i].split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
                if (cols.length >= 2) {
                    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random().toString();
                    newRecords.push({ id, station: cols[0], deviceCode: cols[1], nes: (cols[2] || '').replace(/^NES\s*/i, ''), deviceType: DeviceType.OTHER, status: EquipmentStatus.OPERATIONAL, readings: {}, date: new Date().toISOString(), notes: '', location: cols[3] } as MaintenanceRecord);
                }
            }
            if (newRecords.length > 0) {
                await StorageService.importData(newRecords);
                loadData();
                showToast(`Importados ${newRecords.length} equipos.`);
            }
        } catch (err) { showToast('Error al importar CSV.', 'error'); }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleExportBackup = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `metro_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    showToast('Copia de seguridad guardada');
  };

  const handleExportCSV = () => {
    const headers = ['Estación', 'NES', 'Código', 'Tipo', 'Estado', 'B1/Ráp', 'B2/Len', 'VFD', 'Cursa', 'Llenado', 'Vaciado B1', 'Vaciado B2', 'Vib Ráp', 'Vib Len', 'Fecha', 'Notas'];
    const rows = data.map(item => {
      const r = item.readings || {};
      return [item.station, item.nes, item.deviceCode, item.deviceType, item.status, r.pump1 || r.speedFast || '', r.pump2 || r.speedSlow || '', r.hasVFD ? 'SI' : 'NO', r.stroke || '', r.filling || '', r.emptyingB1 || '', r.emptyingB2 || '', r.vibrationFast || '', r.vibrationSlow || '', item.date, (item.notes || '').replace(/\n/g, ' ')].join(';');
    });
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `informe_metro_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast('Excel generado');
  };

  const filteredData = data.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    if (showAllRecords && searchTerm === '') return true;
    let matchesBatch = true;
    if (batchSearchResults && batchSearchResults.length > 0) {
        matchesBatch = batchSearchResults.some(scanned => {
            const s = scanned.toUpperCase().replace(/\s/g, ''); 
            if (s.length < 2) return false;
            return (item.nes || '').toUpperCase().includes(s) || (item.deviceCode || '').toUpperCase().replace(/\s/g, '').includes(s);
        });
    }
    if (!matchesBatch) return false;
    if (item.id === searchLower) return true;
    return (item.station || '').toLowerCase().includes(searchLower) || (item.nes || '').toLowerCase().includes(searchLower) || (item.deviceCode || '').toLowerCase().includes(searchLower);
  }).sort((a, b) => (a.deviceCode || '').localeCompare(b.deviceCode || '', undefined, { numeric: true }));

  const activeIncidents = data.filter(d => d.status === EquipmentStatus.INCIDENT);
  const totalIncidentsCount = activeIncidents.length;
  const recentIncidents = [...activeIncidents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
  const recentRecords = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentRecords = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case DeviceType.POZO_AGOTAMIENTO: return <Droplets size={18} className="text-blue-500"/>;
      case DeviceType.VENT_ESTACION:
      case DeviceType.VENT_TUNEL: return <Wind size={18} className="text-cyan-500"/>;
      case DeviceType.FOSA_SEPTICA: return <Box size={18} className="text-amber-500"/>;
      default: return <Zap size={18} className="text-yellow-500"/>;
    }
  };

  const getLineColorClass = (code: string) => {
      const num = parseInt(code?.match(/\d+/)?.[0] || '0');
      switch(num) {
          case 1: return 'border-l-red-600'; case 2: return 'border-l-purple-600'; case 3: return 'border-l-green-600'; case 4: return 'border-l-yellow-400';
          case 5: return 'border-l-blue-600'; case 9: return 'border-l-orange-400'; case 10: return 'border-l-sky-400'; case 11: return 'border-l-lime-400';
          default: return 'border-l-gray-300';
      }
  };

  const renderIncidentCard = (item: MaintenanceRecord) => {
      return (
        <div key={item.id} className="bg-red-50/50 dark:bg-red-900/10 p-3 rounded-lg border-l-4 border-l-red-600 border-t border-b border-r border-red-100 dark:border-red-900/30 w-[220px] flex-shrink-0 relative shadow-sm">
            <div className="flex justify-between items-start">
                <h4 className="font-bold text-slate-800 dark:text-white truncate pr-6">{item.station}</h4>
                <div className="absolute top-3 right-3 opacity-60">
                    {getDeviceIcon(item.deviceType)}
                </div>
            </div>
            <p className="text-[10px] font-mono text-slate-500 mt-1">{item.deviceCode}</p>
            <div className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 mt-2 font-medium">
                <Square size={10} />
                <span className="truncate">{item.notes || 'Incidencia activa'}</span>
            </div>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-4 text-right">
                {formatDate(item.date)}
            </div>
        </div>
      );
  };

  const renderRecordCard = (item: MaintenanceRecord) => {
      return (
        <div key={item.id} className={`bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border-l-8 ${getLineColorClass(item.deviceCode)} border-r border-t border-b border-gray-100 dark:border-slate-700 transition-all hover:shadow-md mb-3 flex flex-col gap-2 relative`}>
            <div className="flex justify-between items-start">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate">{item.station}</h3>
                    <div className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300">NES{item.nes}</div>
                </div>
                <div className="opacity-80">
                    {getDeviceIcon(item.deviceType)}
                </div>
            </div>
            <p className="text-xs font-mono text-slate-500 -mt-1">{item.deviceCode}</p>
            {item.location && <div className="flex items-center gap-1 text-xs text-blue-600 font-medium"><MapPin size={12} /> {item.location}</div>}
            
            <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-slate-700 mt-1">
                 <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1"><Clock size={10} />{formatDate(item.date)}</div>
                 <div className="flex gap-2">
                    <button onClick={() => handleEdit(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={18} /></button>
                    <button onClick={() => handleDeleteClick(item)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                 </div>
            </div>
        </div>
      );
  };

  const isSearchActive = searchTerm.trim().length > 0 || (batchSearchResults !== null) || showAllRecords;

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900 transition-colors duration-200 pb-12">
        <header className="bg-slate-900 dark:bg-black text-white shadow-md sticky top-0 z-50 border-b border-slate-700">
          <div className="container mx-auto px-4 py-3 flex justify-between items-center">
              <div className="flex items-center space-x-2 cursor-pointer shrink-0" onClick={() => { setSearchTerm(''); setBatchSearchResults(null); setShowAllRecords(false); setView('LIST'); }}>
                <div className="w-8 h-8 bg-red-600 flex items-center justify-center rounded font-bold text-white">M</div>
                <h1 className="text-xl font-bold tracking-tight hidden sm:block">MetroMaint <span className="font-light opacity-75">BCN</span></h1>
              </div>
              <nav className="flex items-center space-x-1 md:space-x-2 mx-2">
                <button onClick={() => { setView('LIST'); setMobileMenuOpen(false); }} className={`p-2 rounded-md ${view === 'LIST' ? 'bg-red-700' : 'text-gray-400 hover:bg-slate-800'}`}><ListIcon size={20}/></button>
                <button onClick={() => { setView('DASHBOARD'); setMobileMenuOpen(false); }} className={`p-2 rounded-md ${view === 'DASHBOARD' ? 'bg-red-700' : 'text-gray-400 hover:bg-slate-800'}`}><LayoutGrid size={20}/></button>
                <button onClick={() => { setView('AI_ASSISTANT'); setMobileMenuOpen(false); }} className={`p-2 rounded-md ${view === 'AI_ASSISTANT' ? 'bg-red-700' : 'text-gray-400 hover:bg-slate-800'}`}><Bot size={20}/></button>
              </nav>
              <button ref={menuBtnRef} className="p-2 text-gray-300 hover:text-white rounded hover:bg-slate-800 transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X size={24}/> : <Menu size={24}/>}
              </button>
          </div>

          {mobileMenuOpen && (
            <div ref={menuRef} className="bg-slate-800 dark:bg-slate-900 border-t border-slate-700 px-4 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200 shadow-xl">
              <div>
                <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Settings size={10}/> Configuración</h3>
                <div className="flex items-center justify-between px-1 py-1 mb-2 border-b border-slate-700/50 pb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isAiConfigured ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-red-500'}`}></div>
                    <div className="flex flex-col">
                        <span className={`text-[10px] font-bold leading-none ${isAiConfigured ? 'text-green-400' : 'text-red-400'}`}>AI Online</span>
                        <span className="text-[9px] text-slate-500 font-medium">Consultas: {aiUsage.count}/20</span>
                    </div>
                  </div>
                  <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 bg-slate-700 rounded-md text-yellow-400">
                    {darkMode ? <Moon size={16}/> : <Sun size={16}/>}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-700/50">
                 {!devMode ? (
                    showPinInput ? (
                        <form onSubmit={handleUnlockDevMode} className="flex items-center gap-2 animate-in fade-in"><input type="password" value={pinInputValue} onChange={(e) => setPinInputValue(e.target.value)} placeholder="PIN..." autoFocus className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-white outline-none font-mono" /><button type="submit" className="p-1.5 bg-slate-700 rounded text-slate-300"><Check size={14} /></button></form>
                    ) : (
                        <div className="flex justify-between items-center"><p className="text-[9px] text-slate-600">v1.3.6 • MetroMaint BCN</p><button onClick={() => setShowPinInput(true)} className="p-2 text-slate-700 opacity-50 hover:opacity-100"><Lock size={12} /></button></div>
                    )
                 ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-1">
                        <div className="flex justify-between mb-2"><span className="text-[9px] font-bold text-slate-500 uppercase">Admin Tools</span><button onClick={handleLockDevMode} className="text-[9px] text-red-400">Bloquear</button></div>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="file" accept=".csv" className="hidden" ref={importInputRef} onChange={handleImportChange}/>
                            <button onClick={handleImportClick} className="flex flex-col items-center justify-center p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors gap-1 text-blue-400 text-[9px]"><UploadCloud size={14}/>Importar</button>
                            <button onClick={handleExportBackup} className="flex flex-col items-center justify-center p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors gap-1 text-green-400 text-[9px]"><Download size={14}/>Backup JSON</button>
                            <button onClick={handleExportCSV} className="col-span-2 flex flex-col items-center justify-center p-2 rounded bg-green-800 hover:bg-green-700 text-white text-[9px]"><FileSpreadsheet size={14}/>Exportar Excel</button>
                            <button onClick={() => setShowMassDeleteModal(true)} className="col-span-2 p-2 rounded bg-red-900/20 text-red-500 border border-red-500/30 text-[9px]">Reset BD</button>
                        </div>
                    </div>
                 )}
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 container mx-auto px-4 py-6">
          {installPrompt && (
            <div className="mb-6 p-4 bg-slate-900 text-white rounded-xl shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-3"><div className="bg-red-600 p-2 rounded-lg"><Smartphone size={24} /></div><div><h3 className="font-bold">Instalar MetroMaint</h3><p className="text-xs text-slate-300">Acceso rápido y pantalla completa</p></div></div>
              <button onClick={handleInstallClick} className="bg-white text-slate-900 px-4 py-2 rounded-lg font-bold text-sm">INSTALAR</button>
            </div>
          )}
          
          <div className="bg-transparent">
            {view === 'LIST' && (
              <>
                {!isSearchActive ? (
                  <div className="flex flex-col items-center justify-start pt-4 md:pt-8 min-h-[60vh] animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-2xl mx-auto">
                      {totalIncidentsCount > 0 && (
                          <div className="mb-8 w-full">
                              <div className="flex items-center gap-2 mb-3 px-1"><AlertTriangle size={18} className="text-red-500" /><h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Incidencias Activas</h3><span className="bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-200 text-xs font-bold px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">{totalIncidentsCount}</span></div>
                              <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">{recentIncidents.map(inc => renderIncidentCard(inc))}</div>
                          </div>
                      )}
                      <div className="w-full px-4 mb-8">
                          <div className="relative group"> <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"> <Search className="h-6 w-6 text-slate-400 group-focus-within:text-red-500 transition-colors" /> </div> <input type="text" className="block w-full pl-12 pr-4 py-5 bg-white dark:bg-slate-800 border-0 rounded-2xl text-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-none dark:ring-1 dark:ring-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-red-500 transition-all" placeholder="Buscar Equipo, Estación o Código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /> </div>
                          <div className="flex justify-center mt-3"><button onClick={() => setShowAllRecords(true)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center gap-1.5"><ListIcon size={14} /><span>Ver todo el inventario ordenado</span></button></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 w-full px-4 mb-12">
                          <button onClick={() => { setEditingRecord(null); setReturnToAI(false); setView('ADD'); }} className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-red-500 transition-all group"> <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"> <Plus className="h-6 w-6 text-blue-600 dark:text-blue-400" /> </div> <span className="font-semibold text-slate-800 dark:text-white">Nuevo</span> <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">Registro Manual</span> </button>
                          <input type="file" accept="image/*" capture="environment" className="hidden" ref={batchFileRef} onChange={handleBatchFileChange}/><button onClick={handleBatchScanClick} disabled={isScanningBatch} className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-red-500 transition-all group"> {isScanningBatch ? ( <Loader2 className="h-8 w-8 text-red-500 animate-spin mb-3"/> ) : ( <div className="h-12 w-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"> <Camera className="h-6 w-6 text-red-600 dark:text-red-400" /> </div> )} <span className="font-semibold text-slate-800 dark:text-white">Escanear</span> <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">Lista por Foto</span> </button>
                      </div>
                      {recentRecords.length > 0 && ( <div className="w-full px-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100"> <div className="flex items-center gap-2 mb-4 text-slate-500 dark:text-slate-400"> <History size={18} /> <h3 className="text-sm font-bold uppercase tracking-wider">Última Actividad</h3> </div> <div className="space-y-3"> {recentRecords.map(item => renderRecordCard(item))} </div> </div> )}
                      <div className="mt-8 mb-6 w-full border-t border-slate-200 dark:border-slate-800/50 pt-4 flex justify-center"><div className="text-xs font-medium text-slate-400 flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full"><Database size={12} /><span>Total Equipos: {data.length}</span></div></div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-300 max-w-2xl mx-auto">
                    <div className="flex justify-between items-center mb-2 px-1"><h2 className="text-lg font-bold text-slate-700 dark:text-slate-300">{showAllRecords ? 'Inventario Completo' : `Resultados (${filteredData.length})`}</h2><button onClick={() => { setSearchTerm(''); setBatchSearchResults(null); setShowAllRecords(false); }} className="text-sm text-red-500 underline">Limpiar</button></div>
                    {currentRecords.map(item => renderRecordCard(item))}
                    {filteredData.length > 0 && (
                      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 mt-4">
                        <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="p-2 disabled:opacity-50"><ChevronLeft size={20} /></button>
                        <span className="text-sm font-medium">Página {currentPage} de {totalPages}</span>
                        <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 disabled:opacity-50"><ChevronRight size={20} /></button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {view === 'ADD' && <RecordForm existingRecords={data} onSave={handleSave} onCancel={() => setView('LIST')} />}
            {view === 'EDIT' && editingRecord && <RecordForm initialData={editingRecord} existingRecords={data} onSave={handleSave} onCancel={() => returnToAI ? setView('AI_ASSISTANT') : setView('LIST')} />}
            {view === 'DASHBOARD' && <Dashboard data={data} />}
            {view === 'AI_ASSISTANT' && <AIAssistant data={data} onEditRecord={handleAIEdit} persistedState={aiPersistence} onPersistState={setAiPersistence} />}
          </div>
        </main>

        {toast && (
            <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl flex items-center gap-3 z-[100] ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-slate-800' : 'bg-green-600'} text-white`}>
                <span className="font-medium text-sm">{toast.message}</span>
            </div>
        )}

        {recordToDelete && (
             <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
                 <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 max-w-sm w-full animate-in zoom-in-95">
                     <div className="flex flex-col items-center text-center">
                         <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4"><Trash2 size={24} className="text-red-600" /></div>
                         <h3 className="text-lg font-bold mb-2">¿Eliminar registro?</h3>
                         <p className="text-sm text-slate-500 mb-6">Se borrará <strong>{recordToDelete.deviceCode}</strong>.</p>
                         <div className="flex gap-3 w-full"><button onClick={() => setRecordToDelete(null)} className="flex-1 py-2.5 rounded-lg border">Cancelar</button><button onClick={confirmDelete} disabled={deleteCountdown > 0} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold">{deleteCountdown > 0 ? `(${deleteCountdown})` : 'Eliminar'}</button></div>
                     </div>
                 </div>
             </div>
        )}

        {showMassDeleteModal && (
             <div className="fixed inset-0 bg-black/70 z-[120] flex items-center justify-center p-4">
                 <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border-2 border-red-500 max-w-md w-full animate-in zoom-in-95">
                     <div className="flex flex-col items-center text-center">
                         <AlertTriangle size={48} className="text-red-500 mb-4" />
                         <h3 className="text-xl font-bold mb-2">¡PELIGRO: BORRADO TOTAL!</h3>
                         <p className="text-slate-600 mb-6">Esta acción borrará <strong>TODOS</strong> los registros.</p>
                         <div className="flex flex-col gap-3 w-full"><button onClick={handleMassDelete} className="w-full py-3 rounded-lg bg-red-600 text-white font-bold">SÍ, BORRAR TODO</button><button onClick={() => setShowMassDeleteModal(false)} className="w-full py-3 rounded-lg bg-slate-100">Cancelar</button></div>
                     </div>
                 </div>
             </div>
        )}
      </div>
    </div>
  );
}
