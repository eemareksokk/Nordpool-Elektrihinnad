/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  Cell,
  ReferenceLine
} from 'recharts';
import { format, addDays, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { et } from 'date-fns/locale';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  RefreshCw, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface PriceData {
  timestamp: number;
  price: number;
}

interface EleringResponse {
  success: boolean;
  data: {
    ee: PriceData[];
    lv: PriceData[];
    lt: PriceData[];
    fi: PriceData[];
  };
}

const REGIONS = [
  { id: 'ee', name: 'Eesti' },
  { id: 'fi', name: 'Soome' },
  { id: 'lv', name: 'Läti' },
  { id: 'lt', name: 'Leedu' },
];

export default function App() {
  const [data, setData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState('ee');
  const [viewDate, setViewDate] = useState(new Date());

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const start = startOfDay(viewDate).toISOString();
    const end = endOfDay(addDays(viewDate, 1)).toISOString();
    const url = `/api/prices?start=${start}&end=${end}`;
    
    console.log('Fetching electricity prices via proxy:', url);
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('API response error:', response.status, response.statusText);
        throw new Error(`Serveri viga: ${response.status} ${response.statusText}`);
      }
      
      const result: EleringResponse = await response.json();
      if (result.success && result.data[region as keyof typeof result.data]) {
        setData(result.data[region as keyof typeof result.data]);
      } else {
        console.error('API returned success:false or missing data:', result);
        throw new Error('Andmed puuduvad või API viga');
      }
    } catch (err) {
      console.error('Fetch error details:', err);
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError('Võrguviga (Failed to fetch). See võib olla tingitud CORS piirangust või puuduvast internetiühendusest. Kontrolli brauseri konsooli (F12).');
      } else {
        setError(err instanceof Error ? err.message : 'Tundmatu viga');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [region, viewDate]);

  const chartData = useMemo(() => {
    const now = new Date().getTime();
    return data.map((item, index) => {
      const itemTime = item.timestamp * 1000;
      const nextItemTime = data[index + 1] ? data[index + 1].timestamp * 1000 : itemTime + 3600000;
      const isCurrent = now >= itemTime && now < nextItemTime;
      
      return {
        time: format(new Date(itemTime), 'HH'),
        fullTime: format(new Date(itemTime), 'd. MMMM HH:mm', { locale: et }),
        price: Number((item.price / 10).toFixed(2)), // Convert MWh to kWh cents
        rawTimestamp: itemTime,
        isCurrent
      };
    });
  }, [data]);

  const currentPrice = useMemo(() => {
    const now = new Date().getTime();
    const current = data.find((item, index) => {
      const itemTime = item.timestamp * 1000;
      const nextItemTime = data[index + 1] ? data[index + 1].timestamp * 1000 : itemTime + 3600000;
      return now >= itemTime && now < nextItemTime;
    });
    return current ? Number((current.price / 10).toFixed(2)) : null;
  }, [data]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const prices = chartData.map(d => d.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2))
    };
  }, [chartData]);

  const getPriceColor = (price: number) => {
    if (price < 5) return 'text-emerald-500';
    if (price < 15) return 'text-amber-500';
    return 'text-rose-500';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/90 backdrop-blur-md border border-slate-200 p-3 rounded-xl shadow-xl">
          <p className="text-xs font-medium text-slate-500 mb-1">{data.fullTime}</p>
          <p className={`text-lg font-bold ${getPriceColor(data.price)}`}>
            {data.price} s/kWh
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Zap className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">Nord Pool Elektrihinnad</h1>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            {REGIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRegion(r.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  region === r.id 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>

          <button 
            onClick={fetchData}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-200 relative overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-1">Praegune hind</h2>
                <div className="flex items-baseline gap-2">
                  <AnimatePresence mode="wait">
                    <motion.span 
                      key={currentPrice}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`text-6xl font-black tracking-tighter ${currentPrice !== null ? getPriceColor(currentPrice) : 'text-slate-300'}`}
                    >
                      {currentPrice ?? '--'}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-slate-400 font-medium">s/kWh</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setViewDate(d => addDays(d, -1))}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-slate-400" />
                </button>
                <div className="text-center min-w-[120px]">
                  <p className="text-sm font-bold text-slate-900">
                    {format(viewDate, 'd. MMMM', { locale: et })}
                  </p>
                  <p className="text-xs text-slate-400 capitalize">
                    {format(viewDate, 'EEEE', { locale: et })}
                  </p>
                </div>
                <button 
                  onClick={() => setViewDate(d => addDays(d, 1))}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <ChevronRight className="w-6 h-6 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="h-[300px] w-full">
              {loading ? (
                <div className="h-full w-full flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : error ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <AlertCircle className="w-12 h-12" />
                  <p>{error}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="time" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      interval={2}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#94A3B8' }}
                      tickFormatter={(val) => `${val}`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9' }} />
                    <Bar dataKey="price" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isCurrent ? '#F43F5E' : '#4F46E5'} 
                        />
                      ))}
                    </Bar>
                    <ReferenceLine 
                      y={stats?.avg} 
                      stroke="#94A3B8" 
                      strokeDasharray="3 3"
                      label={{ position: 'right', value: 'Kesk.', fill: '#94A3B8', fontSize: 10 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>

          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="text-indigo-600 w-5 h-5" />
                </div>
                <h3 className="font-bold">Päeva statistika</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
                  <span className="text-sm text-slate-500">Keskmine</span>
                  <span className="font-bold text-slate-900">{stats?.avg ?? '--'} s/kWh</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-2xl">
                  <span className="text-sm text-emerald-600 font-medium">Madalaim</span>
                  <span className="font-bold text-emerald-700">{stats?.min ?? '--'} s/kWh</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-rose-50 rounded-2xl">
                  <span className="text-sm text-rose-600 font-medium">Kõrgeim</span>
                  <span className="font-bold text-rose-700">{stats?.max ?? '--'} s/kWh</span>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-indigo-600 rounded-3xl p-6 shadow-xl shadow-indigo-200 text-white"
            >
              <div className="flex items-center gap-3 mb-4">
                <Info className="w-5 h-5" />
                <h3 className="font-bold">Kas teadsid?</h3>
              </div>
              <p className="text-indigo-100 text-sm leading-relaxed">
                Elektrihinnad avaldatakse järgmise päeva kohta tavaliselt kella 14:00 ja 15:00 vahel. 
                Kasuta seda infot oma suuremate kodumasinate töö planeerimiseks!
              </p>
            </motion.div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-slate-400">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">Andmed pärinevad Eleringi API-st</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="text-sm text-slate-400 hover:text-indigo-600 transition-colors">Kasutustingimused</a>
            <a href="#" className="text-sm text-slate-400 hover:text-indigo-600 transition-colors">Privaatsus</a>
            <a href="#" className="text-sm text-slate-400 hover:text-indigo-600 transition-colors">Kontakt</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
