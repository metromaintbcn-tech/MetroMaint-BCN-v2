import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { MaintenanceRecord, DeviceType, METRO_COLORS, EquipmentStatus } from '../types';
import { Zap } from 'lucide-react';

interface DashboardProps {
  data: MaintenanceRecord[];
}

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  // Aggregate data by device type
  const dataByType = Object.values(DeviceType).map(type => {
    return {
      name: type,
      value: data.filter(d => d.deviceType === type).length
    };
  });

  // Calculate Average Readings (Restored)
  const averages = [
    { name: 'Bomba 1', value: 0, count: 0 },
    { name: 'Bomba 2', value: 0, count: 0 },
    { name: 'V. Rápida', value: 0, count: 0 },
    { name: 'V. Lenta', value: 0, count: 0 },
  ];
  
  data.forEach(d => {
      if (d.readings) {
          if (d.readings.pump1) { averages[0].value += d.readings.pump1; averages[0].count++; }
          if (d.readings.pump2) { averages[1].value += d.readings.pump2; averages[1].count++; }
          if (d.readings.speedFast) { averages[2].value += d.readings.speedFast; averages[2].count++; }
          if (d.readings.speedSlow) { averages[3].value += d.readings.speedSlow; averages[3].count++; }
      }
  });
  
  const chartDataReadings = averages.map(a => ({
      name: a.name,
      value: a.count > 0 ? parseFloat((a.value / a.count).toFixed(2)) : 0
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#dc2626'];

  // Global Incident Count
  const incidentCount = data.filter(d => d.status === EquipmentStatus.INCIDENT).length;

  // Unique Stations Count
  const uniqueStations = new Set(data.map(d => d.station)).size;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Device Distribution */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Registros por Dispositivo</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataByType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => percent > 0 ? `${(percent * 100).toFixed(0)}%` : ''}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dataByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Average Readings Chart (RESTORED) */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
             <Zap size={20} className="text-yellow-500" />
             <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Promedio de Lecturas (Amperios)</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataReadings} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={true} vertical={true} />
                <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100}
                    stroke="#888888" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                />
                <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill={METRO_COLORS.statusWarning} radius={[0, 4, 4, 0]} barSize={20} name="Amperios (A)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold mb-2 text-slate-800 dark:text-white">Resumen Global</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded transition-colors">
                <p className="text-gray-500 dark:text-gray-400 text-sm">Total Visitas Realizadas</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-white">{data.length}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded transition-colors">
                <p className="text-gray-500 dark:text-gray-400 text-sm">Estaciones Mantenidas</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-white">{uniqueStations}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded transition-colors">
                <p className="text-gray-500 dark:text-gray-400 text-sm">Incidencias Activas</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{incidentCount}</p>
            </div>
        </div>
      </div>
    </div>
  );
};