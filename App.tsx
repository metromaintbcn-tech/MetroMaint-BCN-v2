
import React, { useState, useEffect, useRef } from 'react';
import { MaintenanceRecord, ViewState, DeviceType, EquipmentStatus } from './types';
import { StorageService } from './services/storageService';
import { GeminiService } from './services/geminiService';
import { RecordForm } from './components/RecordForm';
import { RecordCard } from './components/RecordCard';
import { 
  Plus, Search, Menu, X, Moon, Sun,
  AlertTriangle, History, Lock, Loader2, 
  Camera, Check, FileSpreadsheet, UploadCloud,
  ChevronLeft, ChevronRight, Clock, RotateCcw, List as ListIcon
} from 'lucide-react';

export default function App() {
  const [data, setData] = useState<MaintenanceRecord[]>([]);
  const [view, setView] = useState<ViewState>('LIST');
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info' | 'error'} | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<MaintenanceRecord | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const [batchSearchResults, setBatchSearchResults] = useState<string[] | null>(null);
  const [isScanningBatch, setIsScanningBatch] = useState(false);
  const batchFileRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [devMode, setDevMode] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinInputValue, setPinInputValue] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

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
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('touchstart', handleClickOutside); };
  }, [mobileMenuOpen]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, batchSearchResults, showAllRecords]);
  useEffect(() => { if (searchTerm) setShowAllRecords(false); }, [searchTerm]);
  useEffect(() => {
    if (recordToDelete && deleteCountdown > 0) {
      const timer = setTimeout(() => setDeleteCountdown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [recordToDelete, deleteCountdown]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => setToast({ message, type });
  
  const loadInitialData = async () => {
    // Usamos caché local primero sin forzar refresco de red (minimiza lecturas)
    await StorageService.seedData();
    const records = await StorageService.getAll(false);
    setData(records);
  };

  const handleSave = async (record: MaintenanceRecord) => {
    try {
      const updatedData = await StorageService.save(record, data);
      setData(updatedData);
      setView('LIST');
      setEditingRecord(null);
      showToast('Datos guardados correctamente');
    } catch (e) { showToast('Error al guardar. Comprueba tu conexión.', 'error'); }
  };

  const confirmDelete = async () => {
    if (!recordToDelete || !recordToDelete.id) return;
    try { 
      const updatedData = await StorageService.delete(recordToDelete.id, data);
      setData(updatedData);
      showToast('Registro eliminado', 'info'); 
    } 
    catch (error) { showToast('Error al eliminar', 'error'); } 
    finally { setRecordToDelete(null); }
  };

  const handleEdit = (record: MaintenanceRecord) => { setEditingRecord(record); setView('EDIT'); };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const MAX_WIDTH = 1024;
          let width = img.width; let height = img.height;
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error("Error de canvas")); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
        };
      };
    });
  };

  const handleBatchFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsScanningBatch(true); setBatchSearchResults(null); showToast('Analizando placa...', 'info');
    try {
        const base64Data = await compressImage(file);
        const codes = await GeminiService.extractCodesFromDocument(base64Data);
        if (codes && codes.length > 0) { 
          setBatchSearchResults(codes); 
          setSearchTerm(''); 
          setView('LIST'); 
          showToast(`Encontrados ${codes.length} equipos`, 'success'); 
        } else { 
          showToast('No se detectaron códigos claros', 'error'); 
        }
    } catch (error: any) { 
        showToast(`⚠️ Error en escáner: ${error.message || 'Fallo de conexión'}`, 'error');
    } finally { setIsScanningBatch(false); if (batchFileRef.current) batchFileRef.current.value = ''; }
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const text = evt.target?.result as string;
            const lines = text.split(/\r\n|\n/); const newRecords: MaintenanceRecord[] = [];
            const separator = lines[0].includes(';') ? ';' : ',';
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].trim().split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
                if (cols.length >= 2) {
                    newRecords.push({ id: crypto.randomUUID(), station: cols[0], deviceCode: cols[1], nes: cols[2] || 'S/N', deviceType: DeviceType.OTHER, status: EquipmentStatus.OPERATIONAL, readings: {}, date: new Date().toISOString() });
                }
            }
            if (newRecords.length > 0) { 
              await StorageService.importData(newRecords); 
              const refreshed = await StorageService.getAll(true);
              setData(refreshed);
              showToast(`Importados ${newRecords.length} equipos`, 'success'); 
            }
        } catch (err) { showToast('Error al importar CSV', 'error'); }
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    const headers = ['Estación', 'NES', 'Código', 'Tipo', 'Estado', 'Fecha'];
    const rows = data.map(item => [item.station, item.nes, item.deviceCode, item.deviceType, item.status, item.date].join(';'));
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `metro_bcn_informe.csv`;
    link.click();
  };

  const filteredData = data.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    if (showAllRecords && searchTerm === '') return true;
    let matchesBatch = true;
    if (batchSearchResults && batchSearchResults.length > 0) {
        const recordNes = (item.nes || '').toUpperCase().replace(/\s/g, '');
        const recordCode = (item.deviceCode || '').toUpperCase().replace(/\s/g, '');
        matchesBatch = batchSearchResults.some(scanned => {
            const s = scanned.toUpperCase().replace(/\s/g, ''); 
            if (s.length < 2) return false;
            return (recordNes.length > 0 && recordNes.includes(s)) || (recordCode.length > 0 && recordCode.includes(s));
        });
    }
    if (!matchesBatch) return false;
    if (searchTerm === '') return matchesBatch;
    return (item.station || '').toLowerCase().includes(searchLower) || 
           (item.nes || '').toLowerCase().includes(searchLower) || 
           (item.deviceCode || '').toLowerCase().includes(searchLower);
  }).sort((a, b) => (a.deviceCode || '').localeCompare(b.deviceCode || '', undefined, { numeric: true }));

  const activeIncidents = data.filter(item => item.status === EquipmentStatus.INCIDENT);
  const recentActivity = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
  
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentRecords = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatDate = (isoString: string) => {
      if (!isoString) return '';
      return new Date(isoString).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const isSearchActive = searchTerm.trim().length > 0 || (batchSearchResults !== null) || showAllRecords;

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900 transition-colors duration-200 pb-12">
        <header className="bg-slate-900 dark:bg-black text-white shadow-md sticky top-0 z-50 border-b border-slate-700">
          <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => { setSearchTerm(''); setBatchSearchResults(null); setShowAllRecords(false); setView('LIST'); }}>
              <div className="w-8 h-8 bg-red-600 flex items-center justify-center rounded font-bold">M</div>
              <h1 className="text-xl font-bold tracking-tight hidden sm:block">MetroMaint <span className="font-light opacity-75">BCN</span></h1>
            </div>
            <nav className="flex items-center space-x-1 md:space-x-2">
              <button onClick={() => setView('LIST')} className={`p-2 rounded-md ${view === 'LIST' ? 'bg-red-700' : 'text-gray-400 hover:bg-slate-800'}`}><ListIcon size={20}/></button>
            </nav>
            <button ref={menuBtnRef} className="p-2 text-gray-300 hover:text-white rounded hover:bg-slate-800" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X size={24}/> : <Menu size={24}/>}
            </button>
          </div>
          {mobileMenuOpen && (
            <div ref={menuRef} className="bg-slate-800 border-t border-slate-700 px-4 py-4 space-y-4 shadow-xl">
              <button onClick={() => setDarkMode(!darkMode)} className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-700/50 text-slate-200">
                <div className="flex items-center gap-3">{darkMode ? <Moon size={18}/> : <Sun size={18}/>}<span>Modo {darkMode ? 'Oscuro' : 'Claro'}</span></div>
                <div className={`w-8 h-4 rounded-full relative ${darkMode ? 'bg-blue-600' : 'bg-slate-500'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0.5'}`} /></div>
              </button>

              {devMode && (
                <div className="pt-4 border-t border-slate-700 grid grid-cols-2 gap-2">
                  <input type="file" accept=".csv" className="hidden" ref={importInputRef} onChange={handleImportChange}/>
                  <button onClick={() => importInputRef.current?.click()} className="p-2 bg-slate-700 text-blue-400 rounded text-xs flex flex-col items-center"><UploadCloud size={16}/>Importar</button>
                  <button onClick={handleExportCSV} className="p-2 bg-green-800 text-white rounded text-xs flex flex-col items-center"><FileSpreadsheet size={16}/>Excel</button>
                </div>
              )}
              <div className="flex justify-between items-center opacity-50"><p className="text-[10px]">v1.5.4 • MetroMaint BCN</p><button onClick={() => setShowPinInput(true)}><Lock size={12}/></button></div>
            </div>
          )}
        </header>

        <main className="flex-1 container mx-auto px-4 py-6">
          {view === 'LIST' && !isSearchActive && activeIncidents.length > 0 && (
            <div className="mb-8 animate-in slide-in-from-top duration-500">
                <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="text-amber-600" size={20} />
                        <h2 className="font-black text-slate-900 dark:text-slate-200 uppercase tracking-tight">Incidencias Activas</h2>
                        <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full text-xs font-black border border-amber-200 dark:border-amber-800 ml-1">
                            {activeIncidents.length}
                        </span>
                    </div>
                </div>
                <div className="flex overflow-x-auto pb-4 gap-3 no-scrollbar snap-x">
                    {activeIncidents.map(incident => (
                        <div key={incident.id} onClick={() => handleEdit(incident)} className="flex-shrink-0 w-[240px] sm:w-[280px] bg-white dark:bg-slate-800 p-3 rounded-xl border-l-4 border-amber-500 shadow-md border-t border-r border-b border-slate-200 dark:border-slate-700 snap-start cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">{incident.deviceCode}</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-500 font-bold flex items-center gap-1 uppercase tracking-tighter"><Clock size={10} /> {formatDate(incident.date).split(',')[0]}</span>
                            </div>
                            <h3 className="font-black text-slate-950 dark:text-white text-sm truncate mb-1 tracking-tight">{incident.station}</h3>
                            {incident.notes && (
                                <p className="text-[10px] text-slate-600 dark:text-slate-400 italic line-clamp-1 border-t border-slate-100 dark:border-slate-700 pt-1 mt-1 opacity-80">
                                    {incident.notes}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
          )}

          {view === 'LIST' && (
             <div className="max-w-2xl mx-auto w-full mb-8">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={24}/>
                    <input 
                        type="text" 
                        className={`block w-full pl-12 pr-12 py-5 bg-white dark:bg-slate-800 rounded-2xl text-lg shadow-xl text-slate-950 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-4 focus:ring-red-500/20 transition-all border border-slate-200 dark:border-slate-700 ${isSearchActive ? 'mb-2' : ''}`}
                        placeholder="Buscar Equipo o Estación..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {isSearchActive && (
                        <button onClick={() => { setSearchTerm(''); setBatchSearchResults(null); setShowAllRecords(false); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-red-600 transition-colors"><X size={24} /></button>
                    )}
                </div>
                {batchSearchResults && (
                    <div className="mt-2 px-2 flex items-center justify-between text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest">
                        <span>Resultados del escáner ({filteredData.length})</span>
                        <button onClick={() => setBatchSearchResults(null)} className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">Limpiar Escáner <X size={12}/></button>
                    </div>
                )}
             </div>
          )}

          {view === 'LIST' && (
            <>
              {!isSearchActive ? (
                <div className="flex flex-col items-center justify-start max-w-2xl mx-auto w-full animate-in fade-in">
                    <div className="grid grid-cols-2 gap-4 w-full px-4 mb-10">
                        <button onClick={() => { setEditingRecord(null); setView('ADD'); }} className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center transition-all active:scale-95 shadow-md hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-700 group">
                           <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors"><Plus className="text-blue-700 group-hover:text-white" size={28} /></div>
                           <span className="font-black dark:text-white uppercase tracking-tight text-slate-800">Nuevo</span>
                        </button>
                        <button onClick={() => batchFileRef.current?.click()} className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center transition-all active:scale-95 shadow-md hover:shadow-lg group hover:border-red-400 dark:hover:border-red-700">
                           <div className="h-14 w-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-red-600 transition-colors">
                                {isScanningBatch ? <Loader2 className="animate-spin text-white" size={28} /> : <Camera className="text-red-700 group-hover:text-white" size={28} />}
                           </div>
                           <span className="font-black dark:text-white uppercase tracking-tight text-slate-800">Escanear</span>
                        </button>
                    </div>
                    <input type="file" accept="image/*" capture="environment" className="hidden" ref={batchFileRef} onChange={handleBatchFileChange}/>
                    <div className="w-full px-4 mb-8">
                        <div className="flex items-center gap-2 mb-4 px-1">
                            <History className="text-slate-500" size={20} />
                            <h2 className="font-black text-slate-900 dark:text-slate-200 uppercase tracking-tight">Actividad Reciente</h2>
                        </div>
                        <div className="space-y-4">
                            {recentActivity.map(item => (
                                <RecordCard key={item.id} item={item} onEdit={handleEdit} onDelete={(r) => { setRecordToDelete(r); setDeleteCountdown(5); }} formatDate={formatDate} />
                            ))}
                        </div>
                    </div>
                </div>
              ) : (
                <div className="space-y-5 animate-in fade-in max-w-2xl mx-auto">
                  {currentRecords.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                        <Search size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-bold">No se encontraron equipos</p>
                    </div>
                  ) : (
                    currentRecords.map((item) => (
                        <RecordCard key={item.id} item={item} onEdit={handleEdit} onDelete={(r) => { setRecordToDelete(r); setDeleteCountdown(5); }} formatDate={formatDate} />
                    ))
                  )}
                  {totalPages > 1 && (
                    <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 mt-6 shadow-sm">
                      <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl disabled:opacity-20 transition-all active:scale-90"><ChevronLeft size={24} /></button>
                      <span className="text-sm font-black uppercase">Página {currentPage} / {totalPages}</span>
                      <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl disabled:opacity-20 transition-all active:scale-90"><ChevronRight size={24} /></button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {view === 'ADD' && <RecordForm existingRecords={data} onSave={handleSave} onCancel={() => setView('LIST')} />}
          {view === 'EDIT' && editingRecord && <RecordForm initialData={editingRecord} existingRecords={data} onSave={handleSave} onCancel={() => { setEditingRecord(null); setView('LIST'); }} />}
        </main>

        {toast && (
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-[100] ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'} text-white animate-in slide-in-from-bottom border border-white/10`}>
                <span className="font-black text-sm uppercase tracking-widest">{toast.message}</span>
            </div>
        )}

        {recordToDelete && (
             <div className="fixed inset-0 bg-slate-950/80 z-[110] flex items-center justify-center p-4 backdrop-blur-md">
                 <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
                     <h3 className="text-xl font-black mb-3 text-center uppercase tracking-tight">¿Borrar Registro?</h3>
                     <p className="text-sm font-bold text-slate-500 text-center mb-8">Vas a eliminar el equipo:<br/><span className="text-red-600 font-mono text-lg">{recordToDelete.deviceCode || recordToDelete.nes}</span></p>
                     <div className="flex gap-4">
                         <button onClick={() => setRecordToDelete(null)} className="flex-1 py-4 font-bold border rounded-xl active:scale-95 transition-all">Cerrar</button>
                         <button onClick={confirmDelete} disabled={deleteCountdown > 0} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black active:scale-95 transition-all disabled:opacity-50">
                             {deleteCountdown > 0 ? `ESPERA (${deleteCountdown})` : 'ELIMINAR'}
                         </button>
                     </div>
                 </div>
             </div>
        )}

        {showPinInput && (
            <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl">
                    <h3 className="font-bold mb-4 dark:text-white text-slate-900">PIN Administrador</h3>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (pinInputValue === '8386') { setDevMode(true); setShowPinInput(false); setPinInputValue(''); showToast('Modo Admin activado'); } 
                        else { showToast('PIN Incorrecto', 'error'); setPinInputValue(''); }
                    }} className="flex gap-2">
                        <input type="password" value={pinInputValue} onChange={(e) => setPinInputValue(e.target.value)} className="p-2 border rounded dark:bg-slate-700 dark:text-white text-slate-950" autoFocus />
                        <button type="submit" className="p-2 bg-red-600 text-white rounded"><Check/></button>
                        <button type="button" onClick={() => setShowPinInput(false)} className="p-2 bg-gray-200 rounded dark:bg-slate-600"><X/></button>
                    </form>
                </div>
            </div>
        )}
      </div>
    </div>
  );

  function paginate(page: number) { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }
}
