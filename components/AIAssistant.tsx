import React, { useState } from 'react';
import { Send, Bot, Loader2, Sparkles, AlertTriangle, RotateCcw, Wind, Droplets, Box, Terminal, ArrowRight, Edit2, Trash2, MapPin, Zap, StickyNote } from 'lucide-react';
import { EquipmentStatus, MaintenanceRecord, DeviceType } from '../types';
import { GeminiService } from '../services/geminiService';

interface AIAssistantProps {
  data: MaintenanceRecord[];
  onEditRecord: (record: MaintenanceRecord) => void;
  persistedState: { query: string; response: string | null };
  onPersistState: (state: { query: string; response: string | null }) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ data, onEditRecord, persistedState, onPersistState }) => {
  const [input, setInput] = useState(persistedState.query);
  const [loading, setLoading] = useState(false);

  const handleSend = async (e?: React.FormEvent, manualQuery?: string) => {
    if (e) e.preventDefault();
    const query = manualQuery || input;
    if (!query.trim()) return;

    setLoading(true);
    // Sync query with parent immediately so input sticks
    onPersistState({ query, response: null });
    
    // Update local input if manual trigger
    if (manualQuery) setInput(manualQuery);

    try {
        const result = await GeminiService.analyzeDataAndProfile(data, query);
        onPersistState({ query, response: result });
    } catch (error) {
        const errorMsg = "Hubo un error al conectar con el asistente. Intenta de nuevo.";
        onPersistState({ query, response: errorMsg });
    } finally {
        setLoading(false);
    }
  };

  const handleReset = () => {
    setInput('');
    setLoading(false);
    onPersistState({ query: '', response: null });
  };

  const suggestions = [
    "Listar equipos en Incidencia",
    "¿Qué estación tiene mayor consumo?",
    "Ver Pozos de Agotamiento",
    "Analizar vibraciones altas"
  ];

  // Parse response to find [LINK:{id}|{label}] patterns
  // Pattern defined in GeminiService prompt: [LINK:{id}|{st} - {nes} ({dev})]
  const parseResponse = (text: string) => {
    if (!text) return [];
    const regex = /\[LINK:([^|]+)\|([^\]]+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Text before match
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
        }
        // The match
        parts.push({ type: 'link', id: match[1], label: match[2] });
        lastIndex = regex.lastIndex;
    }
    // Remaining text
    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.substring(lastIndex) });
    }
    return parts;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[600px]">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                  <Bot size={24} className="text-white" />
              </div>
              <div>
                  <h2 className="font-bold text-lg">Asistente IA</h2>
                  <p className="text-xs text-slate-400">Analítica de Mantenimiento</p>
              </div>
          </div>
          <button onClick={handleReset} className="text-slate-400 hover:text-white transition-colors" title="Reiniciar Chat">
              <RotateCcw size={20} />
          </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!persistedState.response && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 space-y-6">
                  <Sparkles size={48} className="text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="max-w-md">Pregúntame sobre el estado de los equipos, consumos anómalos o análisis de incidencias.</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                      {suggestions.map((s, i) => (
                          <button 
                            key={i} 
                            onClick={() => handleSend(undefined, s)}
                            className="text-sm p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all text-left"
                          >
                              {s}
                          </button>
                      ))}
                  </div>
              </div>
          )}

          {persistedState.query && (
             <div className="flex justify-end">
                 <div className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white px-4 py-3 rounded-2xl rounded-tr-none max-w-[80%]">
                     <p className="font-medium">{persistedState.query}</p>
                 </div>
             </div>
          )}

          {loading && (
             <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-3">
                      <Loader2 className="animate-spin text-blue-500" size={20} />
                      <span className="text-slate-500 dark:text-slate-400 text-sm">Analizando datos...</span>
                  </div>
             </div>
          )}

          {persistedState.response && !loading && (
              <div className="flex justify-start w-full">
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl rounded-tl-none w-full max-w-3xl shadow-sm">
                      <div className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                          {parseResponse(persistedState.response).map((part, idx) => {
                              if (part.type === 'text') {
                                  return <span key={idx}>{part.content}</span>;
                              } else {
                                  // Link Chip
                                  const record = data.find(r => r.id === part.id);
                                  return (
                                      <button 
                                        key={idx}
                                        onClick={() => record && onEditRecord(record)}
                                        className="inline-flex items-center gap-2 mx-1 my-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer align-middle"
                                      >
                                          {record ? (
                                              <>
                                                {record.deviceType === DeviceType.POZO_AGOTAMIENTO && <Droplets size={14} />}
                                                {record.deviceType === DeviceType.VENT_ESTACION && <Wind size={14} />}
                                                {record.deviceType === DeviceType.VENT_TUNEL && <Wind size={14} />}
                                                {record.deviceType === DeviceType.FOSA_SEPTICA && <Box size={14} />}
                                                {record.status === EquipmentStatus.INCIDENT && <AlertTriangle size={14} className="text-amber-500" />}
                                                <span>{part.label}</span>
                                                <ArrowRight size={14} className="opacity-50" />
                                              </>
                                          ) : (
                                              <span>{part.label} (No encontrado)</span>
                                          )}
                                      </button>
                                  );
                              }
                          })}
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
          <form onSubmit={(e) => handleSend(e)} className="relative flex items-center">
              <div className="absolute left-4 text-slate-400">
                  <Terminal size={20} />
              </div>
              <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escribe tu consulta sobre el mantenimiento..."
                  className="w-full pl-12 pr-12 py-4 bg-slate-100 dark:bg-slate-800 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                  disabled={loading}
              />
              <button 
                  type="submit" 
                  disabled={!input.trim() || loading}
                  className="absolute right-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
              >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              </button>
          </form>
      </div>
    </div>
  );
};
