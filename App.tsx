
import React, { useState, useEffect, useRef } from 'react';
import { MaintenanceRecord, ViewState, DeviceType, EquipmentStatus } from './types';
import { StorageService } from './services/storageService';
import { GeminiService } from './services/geminiService';
import { RecordForm } from './components/RecordForm';
import { RecordCard } from './components/RecordCard';
import { 
  Plus, Search, Menu, X, Moon, Sun,
  AlertTriangle, History, Lock, Loader2, 
  Camera, Check, List as ListIcon,
  Download, PowerOff, LayoutDashboard, ClipboardList, Trash, StickyNote,
  ChevronLeft, ChevronRight, ArrowRight
} from 'lucide-react';

const JOURNAL_STORAGE_KEY = 'metro_journal_results';
const RESULTS_PER_PAGE = 5;

export default function App() {
  const [searchResults, setSearchResults] = useState<MaintenanceRecord[]>([]);
  const [recentData, setRecentData] = useState<MaintenanceRecord[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<MaintenanceRecord[]>([]);
  const [totalEquipments, setTotalEquipments] = useState<number>(0);
  const [allData, setAllData] = useState<MaintenanceRecord[]>([]); 
  
  const [view, setView] = useState<ViewState>('LIST');
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);

  // Estados para Jornada con Persistencia Inmediata
  const [journalSearchTerm, setJournalSearchTerm] = useState('');
  const [journalResults, setJournalResults] = useState<MaintenanceRecord[]>(() => {
    const saved = localStorage.getItem(JOURNAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [toast, setToast] = useState<{message: string, type: 'success' | 'info' | 'error'} | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<MaintenanceRecord | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinInputValue, setPinInputValue] = useState('');
  const [usageStats, setUsageStats] = useState(StorageService.getUsageStats());

  const batchFileRef = useRef<HTMLInputElement>(null);
  const journalScannerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      await StorageService.seedData();
      const count = await StorageService.getTotalCount();
      setTotalEquipments(count);
    };
    init();

    const unsubIncidents = StorageService.subscribeToIncidents(setActiveIncidents);
    const unsubRecent = StorageService.subscribeToRecent(setRecentData);
    return () => { unsubIncidents(); unsubRecent(); };
  }, []);

  // Persistencia de Jornada
  useEffect(() => {
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(journalResults));
  }, [journalResults]);

  // EFECTO DE BÚSQUEDA QUIRÚRGICA (NES, Código o Estación)
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchTerm.length >= 2) {
        setIsSearching(true);
        const results = await StorageService.searchByText(searchTerm);
        setSearchResults(results);
        setCurrentPage(1); // Reset a la primera página al buscar
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 400); 
    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  const handleSave = async (record: MaintenanceRecord) => {
    try {
      await StorageService.save(record);
      setTotalEquipments(await StorageService.getTotalCount());
      
      // Si estamos en Jornada, actualizar la lista de Jornada también
      if (journalResults.some(r => r.id === record.id)) {
        setJournalResults(prev => prev.map(r => r.id === record.id ? record : r));
      }

      setView(view === 'JOURNAL' ? 'JOURNAL' : 'LIST');
      setEditingRecord(null);
      setSearchTerm('');
      showToast('Sincronizado');
    } catch (e) { showToast('Error al guardar', 'error'); }
  };

  const handleJournalSearch = async (manualCodes?: string[]) => {
    const codes = manualCodes || journalSearchTerm.split(',').map(c => c.trim().toUpperCase()).filter(c => c.length > 0);
    if (codes.length === 0) return;
    
    setIsSearching(true);
    try {
      const records = await StorageService.getByCodes(codes);
      if (records.length === 0) {
        showToast('No se encontraron registros', 'info');
      } else {
        setJournalResults(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const newOnes = records.filter(r => !existingIds.has(r.id));
          return [...prev, ...newOnes].sort((a, b) => a.deviceCode.localeCompare(b.deviceCode));
        });
        if (!manualCodes) setJournalSearchTerm('');
        showToast(`Añadidos ${records.length} equipos`);
      }
    } catch (e) {
      showToast('Error en búsqueda múltiple', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleBatchFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsScanning(true); showToast('Analizando placa...', 'info');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        const codes = await GeminiService.extractCodesFromDocument(base64);
        if (codes && codes.length > 0) {
          const records = await StorageService.getByCodes(codes);
          setSearchResults(records);
          setCurrentPage(1);
          setSearchTerm('');
          showToast(`Encontrados ${records.length} equipos`);
        } else {
          showToast('No se detectaron códigos', 'error');
        }
        setIsScanning(false);
      };
    } catch (e) { setIsScanning(false); showToast('Error en escáner', 'error'); }
  };

  const handleJournalScannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsScanning(true); showToast('Analizando placa...', 'info');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        const codes = await GeminiService.extractCodesFromDocument(base64);
        if (codes && codes.length > 0) {
          await handleJournalSearch(codes);
        } else {
          showToast('No se detectaron códigos', 'error');
        }
        setIsScanning(false);
      };
    } catch (e) { setIsScanning(false); showToast('Error en escáner', 'error'); }
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getLineColorClass = (deviceCode: string | undefined) => {
    if (!deviceCode) return 'border-l-slate-300 dark:border-l-slate-600'; 
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
        default: return 'border-l-slate-300 dark:border-l-slate-600';   
    }
  };

  const isSearchActive = searchTerm.length >= 2 || searchResults.length > 0;

  // Cálculo de Paginación
  const totalPages = Math.ceil(searchResults.length / RESULTS_PER_PAGE);
  const currentResults = searchResults.slice(
    (currentPage - 1) * RESULTS_PER_PAGE,
    currentPage * RESULTS_PER_PAGE
  );

  const handlePageChange = (newPage: number) => {
    setIsPageTransitioning(true);
    setTimeout(() => {
      setCurrentPage(newPage);
      setIsPageTransitioning(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 200);
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900 transition-colors duration-200 pb-12">
        <header className="bg-slate-900 dark:bg-black text-white shadow-md sticky top-0 z-50 border-b border-slate-700">
          <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => { setSearchTerm(''); setSearchResults([]); setView('LIST'); }}>
              <div className="w-8 h-8 bg-red-600 flex items-center justify-center rounded font-bold">M</div>
              <h1 className="text-xl font-bold tracking-tight">MetroMaint <span className="font-light opacity-75">BCN</span></h1>
            </div>
            <button className="p-2 text-gray-300 rounded hover:bg-slate-800" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Menu size={24}/>
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="bg-slate-800 border-t border-slate-700 px-4 py-4 shadow-xl">
              <button onClick={() => setDarkMode(!darkMode)} className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-700/50 text-slate-200">
                <div className="flex items-center gap-3">{darkMode ? <Moon size={18}/> : <Sun size={18}/>}<span>Modo {darkMode ? 'Oscuro' : 'Claro'}</span></div>
              </button>
              {devMode && (
                <div className="p-4 mt-4 bg-slate-900 rounded-xl border border-slate-700 space-y-4">
                  <div className="flex items-center gap-2 mb-2 text-blue-400 font-bold uppercase text-xs"><LayoutDashboard size={14}/> Consumo Firebase</div>
                  <div className="text-[10px] text-slate-400">Lecturas: {usageStats.reads} / 50,000</div>
                  <button onClick={async () => {
                    const csvData = await StorageService.getAll();
                    const headers = "id,station,nes,deviceCode,deviceType,status,date,notes\n";
                    const rows = csvData.map(r => `${r.id},${r.station},${r.nes},${r.deviceCode},${r.deviceType},${r.status},${r.date},"${r.notes || ''}"`).join("\n");
                    const blob = new Blob([headers + rows], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.setAttribute('hidden', '');
                    a.setAttribute('href', url);
                    a.setAttribute('download', `reporte_metro_${new Date().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    showToast('Reporte generado');
                  }} className="w-full py-2 bg-green-900/30 text-green-400 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 border border-green-800/30"><Download size={16}/> Exportar Reporte</button>
                  <button onClick={() => setDevMode(false)} className="w-full py-2 bg-red-900/20 text-red-500 rounded-lg text-xs font-bold border border-red-900/30 flex items-center justify-center gap-2"><PowerOff size={16}/> Salir Admin</button>
                </div>
              )}
              <div className="flex justify-between items-center opacity-50 px-2 mt-4"><p className="text-[10px]">v1.9.0 • Ultra-OCR • PatinatedResults</p><button onClick={() => setShowPinInput(true)}><Lock size={12}/></button></div>
            </div>
          )}
        </header>

        <main className="flex-1 container mx-auto px-4 py-6">
          {view === 'LIST' && !isSearchActive && activeIncidents.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3 px-1 text-amber-600 font-black uppercase text-sm tracking-tight"><AlertTriangle size={20} /> Incidencias Activas ({activeIncidents.length})</div>
              <div className="flex overflow-x-auto pb-4 gap-3 no-scrollbar snap-x">
                {activeIncidents.map(incident => (
                  <div 
                    key={incident.id} 
                    onClick={() => { setEditingRecord(incident); setView('EDIT'); }} 
                    className={`flex-shrink-0 w-[260px] bg-white dark:bg-slate-800 p-3 rounded-xl shadow-md snap-start cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors border-l-[6px] ${getLineColorClass(incident.deviceCode)}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter truncate max-w-[140px]">{incident.deviceCode}</div>
                      <div className="bg-amber-100 dark:bg-amber-900/40 p-0.5 rounded">
                        <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" />
                      </div>
                    </div>
                    <div className="font-black text-slate-950 dark:text-white text-sm truncate leading-tight">{incident.station}</div>
                    
                    {incident.notes && (
                      <div className="mt-2 text-[10px] text-slate-600 dark:text-slate-400 italic line-clamp-2 leading-tight flex items-start gap-1">
                        <StickyNote size={10} className="shrink-0 mt-0.5 opacity-60" />
                        <span className="truncate">{incident.notes}</span>
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-1">
                      <History size={10}/> {new Date(incident.date).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'LIST' && (
            <div className="max-w-2xl mx-auto w-full mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={24}/>
                <input 
                  type="text" 
                  className="block w-full pl-12 pr-12 py-5 bg-white dark:bg-slate-800 rounded-2xl text-lg shadow-xl text-slate-950 dark:text-white font-bold placeholder:text-slate-400 border border-slate-200 dark:border-slate-700 outline-none focus:ring-4 focus:ring-red-500/10"
                  placeholder="Ej: Clot vt, 038PE, PE 01-11-02" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {(isSearching || isScanning) && <div className="absolute right-12 top-1/2 -translate-y-1/2"><Loader2 className="animate-spin text-red-600" size={20}/></div>}
                {isSearchActive && (
                  <button onClick={() => { setSearchTerm(''); setSearchResults([]); setCurrentPage(1); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-red-600"><X size={24} /></button>
                )}
              </div>
              <div className="text-center mt-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Inventario total: {totalEquipments} equipos
              </div>
            </div>
          )}

          {view === 'LIST' && (
            <>
              {!isSearchActive ? (
                <div className="max-w-2xl mx-auto w-full">
                  <div className="grid grid-cols-3 gap-4 mb-10 px-4">
                    <button onClick={() => { setEditingRecord(null); setView('ADD'); }} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center shadow-lg active:scale-95 transition-all">
                      <div className="h-10 w-10 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center mb-2"><Plus size={24} /></div>
                      <span className="font-black dark:text-white uppercase text-[10px] tracking-widest">Nuevo</span>
                    </button>
                    <button onClick={() => batchFileRef.current?.click()} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center shadow-lg active:scale-95 transition-all">
                      <div className="h-10 w-10 bg-red-100 text-red-700 rounded-xl flex items-center justify-center mb-2"><Camera size={24} /></div>
                      <span className="font-black dark:text-white uppercase text-[10px] tracking-widest">Escáner</span>
                    </button>
                    <button onClick={() => setView('JOURNAL')} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center shadow-lg active:scale-95 transition-all relative">
                      {journalResults.length > 0 && (
                        <div className="absolute top-2 right-2 h-5 min-w-[20px] px-1 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white dark:border-slate-800 animate-pulse z-10">
                          {journalResults.length}
                        </div>
                      )}
                      <div className="h-10 w-10 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center mb-2"><ClipboardList size={24} /></div>
                      <span className="font-black dark:text-white uppercase text-[10px] tracking-widest">Jornada</span>
                    </button>
                    <input type="file" accept="image/*" capture="environment" className="hidden" ref={batchFileRef} onChange={handleBatchFileChange}/>
                  </div>
                  <div className="px-4">
                    <div className="flex items-center gap-2 mb-4 text-slate-500 font-black uppercase text-xs tracking-widest"><History size={16} /> Actividad Reciente</div>
                    <div className="space-y-4">
                      {recentData.map(item => <RecordCard key={item.id} item={item} onEdit={(r) => { setEditingRecord(r); setView('EDIT'); }} onDelete={(r) => setRecordToDelete(r)} formatDate={(d) => new Date(d).toLocaleString()} />)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`space-y-4 max-w-2xl mx-auto px-2 transition-all duration-300 ${isPageTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
                  {searchResults.length === 0 && !isSearching ? (
                    <div className="p-12 text-center text-slate-500 font-bold bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300">No se encontraron coincidencias exactas</div>
                  ) : (
                    <>
                      {currentResults.map(item => <RecordCard key={item.id} item={item} onEdit={(r) => { setEditingRecord(r); setView('EDIT'); }} onDelete={(r) => setRecordToDelete(r)} formatDate={(d) => new Date(d).toLocaleString()} />)}
                      
                      {/* Paginación Mejorada */}
                      {totalPages > 1 && (
                        <div className="flex flex-col items-center gap-4 pt-8 pb-12">
                          <div className="flex items-center justify-center gap-1 mb-2">
                             {Array.from({ length: totalPages }).map((_, i) => (
                               <div 
                                 key={i} 
                                 className={`h-1.5 transition-all duration-300 rounded-full ${currentPage === i + 1 ? 'w-8 bg-red-600' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}`}
                               />
                             ))}
                          </div>
                          <div className="flex items-center gap-4 w-full">
                            <button 
                              disabled={currentPage === 1 || isPageTransitioning}
                              onClick={() => handlePageChange(currentPage - 1)}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-4 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:grayscale font-black text-[10px] uppercase tracking-widest text-slate-700 dark:text-slate-200 active:scale-95 transition-all"
                            >
                              <ChevronLeft size={18} /> Anterior
                            </button>
                            <button 
                              disabled={currentPage === totalPages || isPageTransitioning}
                              onClick={() => handlePageChange(currentPage + 1)}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-4 bg-red-600 dark:bg-red-600 rounded-2xl shadow-xl shadow-red-500/20 border border-red-500 disabled:opacity-30 disabled:grayscale font-black text-[10px] uppercase tracking-widest text-white active:scale-95 transition-all"
                            >
                              Siguiente <ChevronRight size={18} />
                            </button>
                          </div>
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">
                            Viendo {currentResults.length} de {searchResults.length} resultados
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {view === 'JOURNAL' && (
            <div className="max-w-2xl mx-auto w-full px-4">
              <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button onClick={() => setView('LIST')} className="self-start flex items-center gap-2 text-slate-500 font-bold uppercase text-xs tracking-widest"><History size={16}/> Volver</button>
                <div className="flex flex-col items-center">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Menú Jornada</h2>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">{journalResults.length} Equipos en lista</span>
                </div>
                <button onClick={() => { if(confirm('¿Limpiar la lista de jornada?')) setJournalResults([]); }} className="self-end text-red-500 font-bold uppercase text-xs flex items-center gap-1"><Trash size={14}/> Limpiar</button>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 mb-8">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Añadir Equipos (Comas o Escáner)</label>
                <div className="flex flex-col gap-2">
                  <input 
                    type="text" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 outline-none font-bold text-slate-900 dark:text-white text-sm sm:text-base"
                    placeholder="NES001FS, PE 01-11-05..."
                    value={journalSearchTerm}
                    onChange={(e) => setJournalSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleJournalSearch()}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleJournalSearch()} disabled={isSearching || isScanning} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
                      {isSearching ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>}
                      Buscar
                    </button>
                    <button onClick={() => journalScannerRef.current?.click()} disabled={isScanning || isSearching} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
                      {isScanning ? <Loader2 size={16} className="animate-spin"/> : <Camera size={16}/>}
                      Cámara
                    </button>
                  </div>
                  <input type="file" accept="image/*" capture="environment" className="hidden" ref={journalScannerRef} onChange={handleJournalScannerChange}/>
                </div>
              </div>

              <div className="space-y-4">
                {journalResults.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 font-bold bg-white/50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    La lista está vacía. Busca equipos o escanea placas para empezar tu jornada.
                  </div>
                ) : (
                  journalResults.map(item => <RecordCard key={item.id} item={item} onEdit={(r) => { setEditingRecord(r); setView('EDIT'); }} onDelete={(r) => setRecordToDelete(r)} formatDate={(d) => new Date(d).toLocaleString()} />)
                )}
              </div>
            </div>
          )}

          {view === 'ADD' && <RecordForm existingRecords={allData} onSave={handleSave} onCancel={() => setView('LIST')} />}
          {view === 'EDIT' && editingRecord && <RecordForm initialData={editingRecord} existingRecords={allData} onSave={handleSave} onCancel={() => setView(view === 'JOURNAL' ? 'JOURNAL' : 'LIST')} />}
        </main>

        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-slate-900 text-white rounded-xl shadow-2xl z-[100] font-black text-xs uppercase tracking-widest animate-in slide-in-from-bottom border border-white/10">{toast.message}</div>
        )}

        {showPinInput && (
          <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl max-w-xs w-full animate-in zoom-in-95">
              <h3 className="font-black mb-4 dark:text-white uppercase text-center">Admin PIN</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (pinInputValue === '8386') { setDevMode(true); setShowPinInput(false); setPinInputValue(''); showToast('Admin activo'); } 
                else { showToast('PIN Incorrecto', 'error'); setPinInputValue(''); }
              }} className="flex gap-2">
                <input type="password" value={pinInputValue} onChange={(e) => setPinInputValue(e.target.value)} className="flex-1 p-3 border rounded-xl dark:bg-slate-700 dark:text-white text-center font-bold" autoFocus />
                <button type="submit" className="p-3 bg-red-600 text-white rounded-xl"><Check/></button>
              </form>
              <button onClick={() => setShowPinInput(false)} className="w-full mt-4 text-[10px] uppercase font-black text-slate-400">Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
