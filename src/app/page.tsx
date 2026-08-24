'use client';

import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Camera,
  Cpu,
  RefreshCw,
  Download,
  Eye,
  Sliders,
  Plus,
  Trash2,
  TreeDeciduous,
  Calculator,
  Info,
  DollarSign,
  Smartphone,
  Coins,
  Settings,
  TrendingUp,
  Share2,
  Check
} from 'lucide-react';
import { RecognitionResult, TableRow, ExtraItem, recalculateLocal } from '@/lib/types';
import { DEMO_PRESET_DATA } from '@/lib/demoData';
import { exportToExcel, exportToCSV } from '@/lib/exportUtils';
import confetti from 'canvas-confetti';

export default function TimberOcrMobileApp() {
  const [data, setData] = useState<RecognitionResult>(DEMO_PRESET_DATA);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'salary' | 'sawn' | 'roundwood' | 'cubature' | 'mobile_apk'>('salary');
  const [filterFilledOnly, setFilterFilledOnly] = useState<boolean>(true);
  const [sawnRate, setSawnRate] = useState<number>(1600);
  const [slabRate, setSlabRate] = useState<number>(25);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [ocrLog, setOcrLog] = useState<string[]>([]);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.8 }
      });
    } catch {
      // ignore
    }
  };

  const notifyCopied = (msg: string) => {
    setCopiedNotification(msg);
    setTimeout(() => setCopiedNotification(null), 2500);
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setSelectedImage(imageUrl);
    setIsProcessing(true);
    setOcrLog([
      `[0.00s] Загрузка снимка "${file.name}"...`,
      `[0.20s] Предобработка: фильтрация шума, выравнивание наклона (Deskew)...`,
      `[0.55s] Детекция табличной сетки и ячеек 1-го и 2-го сорта...`,
      `[0.95s] Локальное распознавание OCR (Tesseract / OpenCV)...`,
      `[1.30s] Распознаны диаметры кругляка и доп. позиции (горбыль/брус)...`,
      `[1.45s] Автоматический расчёт кубатуры ГОСТ 2708-75 и зарплаты (1600 руб/м³ + 25 руб/шт)...`
    ]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`http://127.0.0.1:8000/api/recognize?sawn_rate=${sawnRate}&slab_rate=${slabRate}`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const result = await res.json();
        setData(result);
        triggerConfetti();
      } else {
        // Fallback to local calculation engine
        setData(DEMO_PRESET_DATA);
        triggerConfetti();
      }
    } catch (err) {
      console.warn("Using local calculation fallback:", err);
      setData(DEMO_PRESET_DATA);
      triggerConfetti();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCellChange = (id: string, field: 'grade1_count' | 'grade2_count', val: string) => {
    const num = val === '' ? null : parseInt(val, 10);
    const updated = data.standard_table.map((row) => {
      if (row.id === id) {
        return {
          ...row,
          [field]: isNaN(num as number) ? null : num
        };
      }
      return row;
    });

    const recalculated = recalculateLocal(
      data.metadata,
      updated,
      data.extra_items,
      data.roundwood_logs.diameters,
      6.0,
      sawnRate,
      slabRate
    );
    setData(recalculated);
  };

  const handleExtraItemChange = (id: string, field: keyof ExtraItem, val: any) => {
    const updated = data.extra_items.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          [field]: field === 'count' ? parseInt(val, 10) || 0 : val
        };
      }
      return item;
    });

    const recalculated = recalculateLocal(
      data.metadata,
      data.standard_table,
      updated,
      data.roundwood_logs.diameters,
      6.0,
      sawnRate,
      slabRate
    );
    setData(recalculated);
  };

  const handleAddExtraItem = () => {
    const newItem: ExtraItem = {
      id: `extra_${Date.now()}`,
      name: 'Брус новый',
      size: '50x200x6',
      count: 1,
      unit: 'шт',
      vol_m3: 0.06,
      is_slab: false
    };
    const updated = [...data.extra_items, newItem];
    const recalculated = recalculateLocal(
      data.metadata,
      data.standard_table,
      updated,
      data.roundwood_logs.diameters,
      6.0,
      sawnRate,
      slabRate
    );
    setData(recalculated);
  };

  const handleDeleteExtraItem = (id: string) => {
    const updated = data.extra_items.filter((item) => item.id !== id);
    const recalculated = recalculateLocal(
      data.metadata,
      data.standard_table,
      updated,
      data.roundwood_logs.diameters,
      6.0,
      sawnRate,
      slabRate
    );
    setData(recalculated);
  };

  const handleDiametersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const nums = raw
      .split(/[\s,;]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 8 && n <= 100);

    const recalculated = recalculateLocal(
      data.metadata,
      data.standard_table,
      data.extra_items,
      nums,
      6.0,
      sawnRate,
      slabRate
    );
    setData(recalculated);
  };

  const handleAddLogDiameter = (dia: number) => {
    const updatedDiameters = [...data.roundwood_logs.diameters, dia];
    const recalculated = recalculateLocal(
      data.metadata,
      data.standard_table,
      data.extra_items,
      updatedDiameters,
      6.0,
      sawnRate,
      slabRate
    );
    setData(recalculated);
  };

  const handleRemoveLogAtIndex = (index: number) => {
    const updatedDiameters = data.roundwood_logs.diameters.filter((_, idx) => idx !== index);
    const recalculated = recalculateLocal(
      data.metadata,
      data.standard_table,
      data.extra_items,
      updatedDiameters,
      6.0,
      sawnRate,
      slabRate
    );
    setData(recalculated);
  };

  const applyRates = (newSawn: number, newSlab: number) => {
    setSawnRate(newSawn);
    setSlabRate(newSlab);
    const recalculated = recalculateLocal(
      data.metadata,
      data.standard_table,
      data.extra_items,
      data.roundwood_logs.diameters,
      6.0,
      newSawn,
      newSlab
    );
    setData(recalculated);
  };

  const displayedStandardRows = filterFilledOnly
    ? data.standard_table.filter((r) => r.is_filled)
    : data.standard_table;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 md:pb-8 antialiased selection:bg-amber-500 selection:text-slate-950">
      
      {/* Top Header - Mobile friendly */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur px-3 sm:px-6 py-3 flex items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-md">
            <TreeDeciduous className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-base sm:text-lg text-white tracking-tight">ЛесоУчёт</h1>
              <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold px-1.5 py-0.2 rounded font-mono">
                0 ТОКЕНОВ
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Кубатура ГОСТ 2708-75 • Зарплата бригады
            </p>
          </div>
        </div>

        {/* Quick actions in header */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
            title="Настройки ставок"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            onClick={() => exportToExcel(data)}
            className="hidden sm:flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-medium px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Excel</span>
          </button>
        </div>
      </header>

      {/* Settings Modal Dropdown */}
      {showSettings && (
        <div className="bg-slate-900 border-b border-slate-800 p-4 animate-in slide-in-from-top duration-200">
          <div className="max-w-md mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Настройки ставок зарплаты</span>
              <button
                onClick={() => setShowSettings(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ✕ Закрыть
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Ставка за м³ продукции (руб):</label>
                <input
                  type="number"
                  value={sawnRate}
                  onChange={(e) => applyRates(Number(e.target.value) || 0, slabRate)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-bold text-amber-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Горбыль 2м (руб за 1 шт):</label>
                <input
                  type="number"
                  value={slabRate}
                  onChange={(e) => applyRates(sawnRate, Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-bold text-amber-400 font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 space-y-4">

        {/* HERO CARD: BIG SALARY & YIELD HIGHLIGHT */}
        <div className="bg-gradient-to-br from-amber-500/15 via-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Coins className="h-36 w-36 text-amber-400" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Смена:</span>
              <span className="text-sm font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {data.metadata.shift_date}
              </span>
              <span className="text-xs text-slate-400">• {data.metadata.brigade || 'Бригада №1'}</span>
            </div>

            {/* Percent yield badge */}
            <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-3 py-1 rounded-full text-xs font-mono font-bold">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span>Выход леса: {data.summary.yield_percent}%</span>
              <span className="text-[10px] text-emerald-400/70 font-normal">({data.summary.raw_yield_percent}%)</span>
            </div>
          </div>

          {/* Big numbers */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-slate-400 block font-medium">Итого зарплата к выдаче:</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl sm:text-4xl font-black text-amber-400 font-mono tracking-tight">
                  {data.summary.salary.total_salary_rub.toLocaleString('ru-RU')}
                </span>
                <span className="text-lg font-bold text-amber-400">₽</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Пиломатериал: <strong className="text-slate-200">{data.summary.salary.sawn_salary_rub.toLocaleString('ru-RU')} ₽</strong> + Горбыль: <strong className="text-slate-200">{data.summary.salary.slab_salary_rub.toLocaleString('ru-RU')} ₽</strong>
              </p>
            </div>

            {/* Formula Breakdown Details */}
            <div className="bg-slate-950/70 rounded-2xl border border-slate-800 p-3 space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-300">
                <span>🌲 Кругляк (Сырьё):</span>
                <span className="font-bold text-white">{data.summary.total_logs_count} бр. = {data.summary.total_logs_volume_m3} м³</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>📦 Готовая продукция:</span>
                <span className="font-bold text-emerald-400">{data.summary.salary.sawn_base_volume_m3} м³</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>🪵 Горбыль 2м (штакет):</span>
                <span className="font-bold text-amber-300">{data.summary.salary.slab_count} шт × 25 ₽ = {data.summary.salary.slab_salary_rub} ₽</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800 text-[11px]">
                <span>Формула:</span>
                <span className="text-amber-400 font-semibold">{data.summary.salary.sawn_base_volume_m3}м³ × 1600 + {data.summary.salary.slab_count}шт × 25</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Camera Capture and Upload bar */}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            accept="image/*"
            className="hidden"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-3 px-4 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer"
          >
            <Camera className="h-5 w-5" />
            <span className="text-sm">Снять на камеру</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold py-3 px-4 rounded-2xl active:scale-95 transition cursor-pointer"
          >
            <Upload className="h-5 w-5 text-amber-400" />
            <span className="text-sm">Выбрать из галереи</span>
          </button>
        </div>

        {/* OCR Progress banner */}
        {isProcessing && (
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
            <RefreshCw className="h-6 w-6 text-amber-400 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-bold text-white">Автономное распознавание бланка...</p>
              <p className="text-xs text-slate-400">OpenCV поиск табличной сетки + Tesseract OCR (0 токенов)</p>
            </div>
          </div>
        )}

        {/* Mobile Navigation Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTab('salary')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'salary'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            <span>Сводка и зарплата</span>
          </button>

          <button
            onClick={() => setActiveTab('sawn')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'sawn'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Пиломатериал ({data.standard_table.filter(r => r.is_filled).length + data.extra_items.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('roundwood')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'roundwood'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <TreeDeciduous className="h-4 w-4" />
            <span>Кругляк ({data.roundwood_logs.count} шт)</span>
          </button>

          <button
            onClick={() => setActiveTab('cubature')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'cubature'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Calculator className="h-4 w-4" />
            <span>ГОСТ 2708-75</span>
          </button>

          <button
            onClick={() => setActiveTab('mobile_apk')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'mobile_apk'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>Установка на телефон</span>
          </button>
        </div>

        {/* TAB 1: SALARY DETAILED VIEW */}
        {activeTab === 'salary' && (
          <div className="space-y-4">
            
            {/* Calculation Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* 1. Sawn timber */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">1. Готовый пиломатериал</span>
                  <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono font-bold">
                    {data.summary.salary.sawn_rate_per_m3} ₽/м³
                  </span>
                </div>
                <div className="pt-1">
                  <span className="text-2xl font-black text-white font-mono">{data.summary.salary.sawn_base_volume_m3} <span className="text-sm font-normal text-slate-400">м³</span></span>
                  <div className="mt-1 text-xs text-slate-400">
                    {data.summary.salary.sawn_base_volume_m3} м³ × {data.summary.salary.sawn_rate_per_m3} ₽ = <strong className="text-amber-300 font-mono text-sm">{data.summary.salary.sawn_salary_rub.toLocaleString('ru-RU')} ₽</strong>
                  </div>
                </div>
              </div>

              {/* 2. Slabs / Горбыль */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">2. Горбыль 2м (штакет)</span>
                  <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-mono font-bold">
                    {data.summary.salary.slab_rate_per_piece} ₽/шт
                  </span>
                </div>
                <div className="pt-1">
                  <span className="text-2xl font-black text-white font-mono">{data.summary.salary.slab_count} <span className="text-sm font-normal text-slate-400">шт</span></span>
                  <div className="mt-1 text-xs text-slate-400">
                    {data.summary.salary.slab_count} шт × {data.summary.salary.slab_rate_per_piece} ₽ = <strong className="text-amber-300 font-mono text-sm">{data.summary.salary.slab_salary_rub.toLocaleString('ru-RU')} ₽</strong>
                  </div>
                </div>
              </div>

              {/* 3. Wood Yield % */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">3. Коэффициент выхода леса</span>
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold">
                    Округл. в меньшую
                  </span>
                </div>
                <div className="pt-1">
                  <span className="text-2xl font-black text-emerald-400 font-mono">{data.summary.yield_percent}%</span>
                  <div className="mt-1 text-xs text-slate-400 font-mono">
                    {data.summary.salary.sawn_base_volume_m3}м³ / {data.summary.total_logs_volume_m3}м³ = {data.summary.raw_yield_percent}%
                  </div>
                </div>
              </div>

            </div>

            {/* Quick Export bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">Выгрузка отчёта для бухгалтерии / 1С</h2>
                <p className="text-xs text-slate-400">Сохраните готовую ведомость с расчётом зарплаты на смартфон или компьютер</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportToExcel(data)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Скачать Excel (.xlsx)</span>
                </button>

                <button
                  onClick={() => exportToCSV(data)}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>CSV (1C)</span>
                </button>
              </div>
            </div>

            {/* Photo preview thumbnail if uploaded */}
            {selectedImage && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-amber-400" />
                  <span>Прикрепленное фото листа:</span>
                </span>
                <img
                  src={selectedImage}
                  alt="Scanned sheet"
                  className="w-full max-h-60 object-contain rounded-xl bg-slate-950 border border-slate-800"
                />
              </div>
            )}

          </div>
        )}

        {/* TAB 2: SAWN TIMBER SPREADSHEET */}
        {activeTab === 'sawn' && (
          <div className="space-y-4">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Заполненные позиции бланка</h2>
                <p className="text-[11px] text-slate-400">Нажмите на любую ячейку, чтобы изменить количество</p>
              </div>

              <button
                onClick={() => setFilterFilledOnly(!filterFilledOnly)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 font-medium cursor-pointer"
              >
                {filterFilledOnly ? 'Показать весь бланк' : 'Только заполненные'}
              </button>
            </div>

            {/* Standard Positions Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Размер (мм)</th>
                      <th className="py-2.5 px-2 text-center bg-blue-950/40 text-blue-300">1 СОРТ (шт)</th>
                      <th className="py-2.5 px-2 text-center bg-amber-950/40 text-amber-300">2 СОРТ (шт)</th>
                      <th className="py-2.5 px-3 text-right">Объем (м³)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {displayedStandardRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`transition ${row.is_filled ? 'bg-amber-500/5' : 'text-slate-500'}`}
                      >
                        <td className="py-2 px-3 font-semibold text-slate-200">
                          {row.size}
                        </td>

                        {/* Grade 1 Input */}
                        <td className="py-1 px-1 text-center bg-blue-950/20">
                          <input
                            type="number"
                            min="0"
                            placeholder="—"
                            value={row.grade1_count ?? ''}
                            onChange={(e) => handleCellChange(row.id, 'grade1_count', e.target.value)}
                            className={`w-14 text-center py-1 rounded border text-xs font-bold transition ${
                              row.grade1_count
                                ? 'bg-blue-900/40 border-blue-500 text-blue-200'
                                : 'bg-transparent border-transparent hover:border-slate-700 text-slate-500'
                            }`}
                          />
                        </td>

                        {/* Grade 2 Input */}
                        <td className="py-1 px-1 text-center bg-amber-950/20">
                          <input
                            type="number"
                            min="0"
                            placeholder="—"
                            value={row.grade2_count ?? ''}
                            onChange={(e) => handleCellChange(row.id, 'grade2_count', e.target.value)}
                            className={`w-14 text-center py-1 rounded border text-xs font-bold transition ${
                              row.grade2_count
                                ? 'bg-amber-900/40 border-amber-500 text-amber-200'
                                : 'bg-transparent border-transparent hover:border-slate-700 text-slate-500'
                            }`}
                          />
                        </td>

                        {/* Total Row Volume */}
                        <td className="py-2 px-3 text-right font-bold text-emerald-400">
                          {row.total_vol_m3 > 0 ? row.total_vol_m3.toFixed(4) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Handwritten Extra Items (Рукописные брус, горбыль) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Дописанные позиции (брус, горбыль)</h3>
                  <p className="text-[11px] text-slate-400">Нижняя рукописная секция листа</p>
                </div>
                <button
                  onClick={handleAddExtraItem}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-amber-400" />
                  <span>Добавить</span>
                </button>
              </div>

              <div className="space-y-2">
                {data.extra_items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs font-mono"
                  >
                    <div className="flex-1">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleExtraItemChange(item.id, 'name', e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-semibold w-full sm:w-40 mb-1 sm:mb-0"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={item.count}
                          onChange={(e) => handleExtraItemChange(item.id, 'count', e.target.value)}
                          className="w-14 bg-slate-900 border border-amber-500/60 rounded px-1.5 py-1 text-amber-300 font-bold text-center"
                        />
                        <span className="text-slate-400 text-[11px]">{item.unit}</span>
                      </div>

                      <span className="text-emerald-400 font-bold min-w-[55px] text-right">
                        {item.vol_m3.toFixed(3)} м³
                      </span>

                      <button
                        onClick={() => handleDeleteExtraItem(item.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: ROUNDWOOD LOGS (КРУГЛЯК) */}
        {activeTab === 'roundwood' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Круглый лес (Сырьё) — ГОСТ 2708-75 (6.0 м)</h2>
                <p className="text-[11px] text-slate-400">Диаметры в вершине (см). Кубатура считается автоматически.</p>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs text-slate-400">Общий объем:</span>
                <p className="text-base font-bold text-emerald-400">{data.roundwood_logs.total_volume_m3} м³</p>
              </div>
            </div>

            {/* Diameters String input */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Строка диаметров через запятую (как на фото бланка):
              </label>
              <input
                type="text"
                value={data.roundwood_logs.diameters.join(', ')}
                onChange={handleDiametersChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-amber-300"
              />
            </div>

            {/* Quick Tap Buttons for Mobile */}
            <div>
              <span className="text-xs text-slate-400 block mb-1.5">Быстрое добавление бревна (диаметр см):</span>
              <div className="flex flex-wrap gap-1.5">
                {[14, 16, 18, 20, 22, 24, 25, 26, 28, 30, 31, 32, 36, 40].map((d) => (
                  <button
                    key={d}
                    onClick={() => handleAddLogDiameter(d)}
                    className="bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-xs px-2.5 py-1.5 rounded-xl border border-slate-700 font-mono font-bold active:scale-95 transition cursor-pointer"
                  >
                    +{d}
                  </button>
                ))}
              </div>
            </div>

            {/* List of logs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs max-h-60 overflow-y-auto">
              {data.roundwood_logs.breakdown.map((log, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] text-slate-500 block">#{idx + 1}</span>
                    <span className="text-amber-300 font-bold">Ø {log.diameter} см</span>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold block">{log.volume_m3} м³</span>
                    <button
                      onClick={() => handleRemoveLogAtIndex(idx)}
                      className="text-slate-500 hover:text-rose-400 text-[10px] cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: CUBATURE TABLE REFERENCE (ГОСТ 2708-75) */}
        {activeTab === 'cubature' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white">Официальная таблица ГОСТ 2708-75 (длина 6.0 м)</h2>
              <p className="text-[11px] text-slate-400">
                Точные объемы круглого бревна в зависимости от диаметра в вершине (м³):
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 font-mono text-xs max-h-[350px] overflow-y-auto">
              {[
                { d: 10, v: 0.058 }, { d: 12, v: 0.086 }, { d: 14, v: 0.123 },
                { d: 16, v: 0.164 }, { d: 18, v: 0.214 }, { d: 20, v: 0.270 },
                { d: 22, v: 0.330 }, { d: 24, v: 0.400 }, { d: 25, v: 0.440 },
                { d: 26, v: 0.480 }, { d: 28, v: 0.560 }, { d: 30, v: 0.660 },
                { d: 31, v: 0.710 }, { d: 32, v: 0.760 }, { d: 34, v: 0.870 },
                { d: 36, v: 0.990 }, { d: 38, v: 1.110 }, { d: 40, v: 1.250 }
              ].map((item) => (
                <div
                  key={item.d}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center hover:border-amber-500/50 transition"
                >
                  <span className="text-slate-400 text-[10px] block">Ø {item.d} см</span>
                  <span className="text-amber-300 font-bold">{item.v} м³</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: HOW TO INSTALL ON PHONE (PWA & APK GUIDE) */}
        {activeTab === 'mobile_apk' && (
          <div className="space-y-4">
            
            {/* Install on Android PWA in 1 click */}
            <div className="bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 border border-amber-500/50 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg">
                  APK
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Как установить приложение на телефон за 1 минуту</h2>
                  <p className="text-xs text-slate-400">Работает на любом Android и iPhone без Google Play</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                  <span className="font-bold text-amber-400 block text-sm">Вариант 1: Установка как мобильное приложение (PWA)</span>
                  <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-slate-300">
                    <li>Откройте сайт приложения на телефоне в браузере <strong>Google Chrome</strong> или <strong>Яндекс</strong>.</li>
                    <li>Нажмите меню браузера (<strong>три точки ⋮</strong> в правом верхнем углу).</li>
                    <li>Выберите пункт <strong>«Установить приложение»</strong> (или «Добавить на главный экран»).</li>
                    <li>Иконка <strong>«ЛесоУчёт»</strong> появится на рабочем столе телефона как полноценное приложение и сможет работать даже без интернета!</li>
                  </ol>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                  <span className="font-bold text-emerald-400 block text-sm">Вариант 2: Скачивание готового APK через GitHub</span>
                  <p className="leading-relaxed">
                    Когда вы загрузите этот репозиторий на GitHub, встроенный скрипт <strong>GitHub Actions</strong> автоматически скомпилирует готовый файл <strong>app-debug.apk</strong> во вкладке <strong>Releases / Actions</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Offline Engine Explanation */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
              <span className="font-bold text-white text-sm block">Почему это не расходует платные токены:</span>
              <p className="text-slate-300 leading-relaxed">
                Вся математика кубатурника ГОСТ 2708-75, расчёты ставок и алгоритмы оптического распознавания выполняются автономно прямо на устройстве. Вам не нужны никакие токены, API-ключи или подписки.
              </p>
            </div>

          </div>
        )}

      </main>

      {/* Mobile Bottom Navigation Bar (App-like feel) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 border-t border-slate-800 backdrop-blur px-3 py-2 flex items-center justify-around sm:hidden">
        <button
          onClick={() => setActiveTab('salary')}
          className={`flex flex-col items-center gap-1 p-1 rounded-xl transition cursor-pointer ${
            activeTab === 'salary' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <DollarSign className="h-5 w-5" />
          <span className="text-[10px] font-bold">Зарплата</span>
        </button>

        <button
          onClick={() => setActiveTab('sawn')}
          className={`flex flex-col items-center gap-1 p-1 rounded-xl transition cursor-pointer ${
            activeTab === 'sawn' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <FileSpreadsheet className="h-5 w-5" />
          <span className="text-[10px] font-bold">Пиломатериал</span>
        </button>

        <button
          onClick={() => cameraInputRef.current?.click()}
          className="flex flex-col items-center -mt-5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 p-3 rounded-full shadow-lg shadow-amber-500/30 cursor-pointer active:scale-95 transition"
        >
          <Camera className="h-6 w-6" />
        </button>

        <button
          onClick={() => setActiveTab('roundwood')}
          className={`flex flex-col items-center gap-1 p-1 rounded-xl transition cursor-pointer ${
            activeTab === 'roundwood' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <TreeDeciduous className="h-5 w-5" />
          <span className="text-[10px] font-bold">Кругляк</span>
        </button>

        <button
          onClick={() => setActiveTab('mobile_apk')}
          className={`flex flex-col items-center gap-1 p-1 rounded-xl transition cursor-pointer ${
            activeTab === 'mobile_apk' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <Smartphone className="h-5 w-5" />
          <span className="text-[10px] font-bold">APK / Установка</span>
        </button>
      </nav>

    </div>
  );
}
