import React, { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, RefreshCw, MapPin, CheckCircle2, Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ALGERIA_WILAYAS } from "./constants";

interface MonitorStatus {
  lastChecked: string | null;
  isAvailable: boolean;
  wilayasFound: string[];
  error: string | null;
  details?: string;
}

export default function App() {
  const [selectedWilaya, setSelectedWilaya] = useState<string>("");
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [status, setStatus] = useState<MonitorStatus>({
    lastChecked: null,
    isAvailable: false,
    wilayasFound: [],
    error: null,
  });
  const [nextCheckIn, setNextCheckIn] = useState(60); // seconds
  const [history, setHistory] = useState<{ time: string; status: boolean }[]>([]);

  const requestNotificationPermission = async () => {
    try {
      if (!("Notification" in window)) {
        console.warn("Notifications not supported");
        return;
      }
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
    } catch (err) {
      console.error("Notification permission error:", err);
    }
  };

  const sendNotification = (message: string) => {
    try {
      if (notificationsEnabled && Notification.permission === "granted") {
        new Notification("تنبيه الأضاحي", {
          body: message,
        });
      }
    } catch (err) {
      console.error("Failed to send notification:", err);
    }
  };

  const checkAvailability = useCallback(async () => {
    try {
      const response = await fetch("/api/check");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `خطأ في الخادم (${response.status})`);
      }
      
      const data = await response.json();

      if (data.success) {
        const isAvailable = !!data.available;
        const foundWilayas = Array.isArray(data.wilayas) ? data.wilayas : [];
        
        const wilayaSpecificMatch = !!(selectedWilaya && foundWilayas.some((w: any) => w?.toString().includes(selectedWilaya)));
        
        if (isAvailable || wilayaSpecificMatch) {
          sendNotification(`أخبار جيدة! الأضاحي قد تكون متوفرة ${selectedWilaya ? `في ولاية ${selectedWilaya}` : ""}`);
        }

        const now = new Date().toLocaleTimeString("ar-DZ", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setStatus({
          lastChecked: now,
          isAvailable: isAvailable || wilayaSpecificMatch,
          wilayasFound: foundWilayas,
          error: null,
        });

        setHistory(prev => [{ time: now, status: isAvailable || wilayaSpecificMatch }, ...prev].slice(0, 10));
      } else {
        setStatus(prev => ({ ...prev, error: data.error || "خطأ غير متوقع", details: data.details }));
      }
    } catch (err: any) {
      setStatus(prev => ({ ...prev, error: err.message || "تعذر الاتصال بالخادم" }));
    }
  }, [selectedWilaya, notificationsEnabled]);

  useEffect(() => {
    let interval: any;
    let countdown: any;

    if (isMonitoring) {
      checkAvailability();
      interval = setInterval(checkAvailability, 60000); 
      
      setNextCheckIn(60);
      countdown = setInterval(() => {
        setNextCheckIn(prev => (prev > 0 ? prev - 1 : 60));
      }, 1000);
    } else {
      setNextCheckIn(60);
    }

    return () => {
      clearInterval(interval);
      clearInterval(countdown);
    };
  }, [isMonitoring, checkAvailability]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-emerald-600 selection:text-white" dir="rtl">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-10 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-extrabold text-emerald-600 flex items-center gap-2">
              <span className="text-3xl">🐑</span>
              <h1 className="tracking-tight">تنبيه الأضاحي</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold ${isMonitoring ? 'bg-red-50 text-red-600 whitespace-nowrap' : 'bg-slate-100 text-slate-500'}`}>
              <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-red-600 animate-pulse' : 'bg-slate-400'}`} />
              {isMonitoring ? "نظام المراقبة نشط" : "خامل"}
            </div>
            
            <button
              onClick={requestNotificationPermission}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                notificationsEnabled 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                  : 'bg-white border border-slate-200 hover:border-slate-800'
              }`}
            >
              {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
              {notificationsEnabled ? "مفعل" : "تفعيل التنبيهات"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-10 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Main Hero & Status */}
          <section className="lg:col-span-8 space-y-10">
            <div className="bg-white rounded-[32px] p-12 border border-slate-200 shadow-sm shadow-slate-200/50 relative overflow-hidden">
              <div className="max-w-xl text-right ml-auto">
                <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-[1.2] mb-6">تتبع توفر الأضاحي في ولايتك تلقائياً</h2>
                <p className="text-lg text-slate-500 leading-relaxed mb-10">
                  نحن نقوم بفحص موقع <span className="font-mono text-emerald-600 font-bold decoration-dotted underline">adhahi.dz</span> كل دقيقة.
                  بمجرد فتح باب التسجيل في ولايتك المحددة، سنرسل لك تنبيهاً فورياً.
                </p>

                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 md:p-10 text-center relative">
                  <AnimatePresence mode="wait">
                    {status.error ? (
                      <motion.div 
                        key="error"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-3 text-red-600"
                      >
                        <AlertTriangle size={32} />
                        <p className="font-bold text-lg">خطأ في الاتصال بالموقع</p>
                        <p className="text-sm opacity-80 mb-4">{status.error}</p>
                        <button 
                          onClick={checkAvailability}
                          className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-red-700 transition-colors"
                        >
                          <RefreshCw size={16} /> إعادة المحاولة
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key={status.lastChecked || "idle"}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                      >
                        <div className="flex justify-center mb-4 text-emerald-600">
                          {status.isAvailable ? <CheckCircle2 size={48} /> : <Clock size={48} className="text-slate-300" />}
                        </div>
                        <p className="text-xl md:text-2xl font-bold text-slate-600">
                          {isMonitoring 
                            ? (status.isAvailable ? "أضاحي متوفرة الآن!" : "لا توجد أضاحي متوفرة حالياً")
                            : "بدء المراقبة لتحديث الحالة"}
                        </p>
                        <p className="text-sm text-slate-400">
                          آخر تحديث: {status.lastChecked ? status.lastChecked : "لم يتم الفحص بعد"}
                        </p>
                        
                        {!isMonitoring && (
                          <button 
                            onClick={checkAvailability}
                            className="mt-6 px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors mx-auto"
                          >
                            <RefreshCw size={16} /> فحص يدوي الآن
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center flex-row-reverse">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">سجل النشاط</h3>
                <RefreshCw size={16} className={`text-slate-300 ${isMonitoring ? 'animate-spin' : ''}`} />
              </div>
              <div className="divide-y divide-slate-50">
                {history.length === 0 ? (
                  <div className="p-16 text-center text-slate-400 italic text-sm">في انتظار البيانات...</div>
                ) : (
                  history.map((h, i) => (
                    <div key={i} className="px-10 py-5 flex justify-between items-center hover:bg-slate-50 transition-colors flex-row-reverse">
                      <div className="flex items-center gap-4 flex-row-reverse">
                        <div className={`w-2.5 h-2.5 rounded-full ${h.status ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                        <span className="text-sm font-bold text-slate-700">{h.status ? 'متوفر' : 'غير متوفر'}</span>
                      </div>
                      <span className="text-xs font-mono font-medium text-slate-400">{h.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Sidebar Panel */}
          <aside className="lg:col-span-4 space-y-8">
            <div className="bg-white rounded-[24px] p-8 border border-slate-200 shadow-sm flex flex-col gap-8">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 block text-right">اختر الولاية</label>
                <div className="relative">
                  <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select
                    value={selectedWilaya}
                    onChange={(e) => setSelectedWilaya(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pr-12 pl-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 transition-all appearance-none text-right cursor-pointer"
                  >
                    <option value="">جميع الولايات</option>
                    {ALGERIA_WILAYAS.map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-600 block text-right">نوع التنبيه</label>
                <div className={`flex justify-between items-center p-4 rounded-xl border transition-all ${notificationsEnabled ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                   <div className="flex flex-col text-right">
                    <span className="text-sm font-bold">إشعارات المتصفح</span>
                    <span className={`text-[10px] font-bold ${notificationsEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {notificationsEnabled ? 'تنبيه فوري عند التوفر' : 'غير مفعل'}
                    </span>
                  </div>
                  <div 
                    onClick={requestNotificationPermission}
                    className={`w-12 h-6 rounded-full relative transition-all cursor-pointer ${notificationsEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notificationsEnabled ? 'right-1' : 'right-7'}`} />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsMonitoring(!isMonitoring)}
                className={`w-full py-5 rounded-xl font-extrabold text-sm tracking-widest uppercase transition-all shadow-lg ${
                  isMonitoring 
                    ? 'bg-slate-900 text-white hover:bg-black' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'
                }`}
              >
                {isMonitoring ? "إيقاف المراقبة" : "تفعيل وضع المراقبة"}
              </button>

              <p className="text-center text-[10px] font-bold text-slate-400">
                {isMonitoring ? "نشط - يتم التحديث كل دقيقة" : "المراقبة متوقفة حالياً"}
              </p>
            </div>

            {/* Countdown Widget */}
            <AnimatePresence>
              {isMonitoring && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-emerald-600 text-white rounded-[24px] p-8 overflow-hidden relative"
                >
                  <div className="relative z-10 flex justify-between items-center flex-row-reverse">
                    <div className="text-right">
                      <p className="text-[10px] font-extrabold tracking-[0.2em] text-emerald-100/60 mb-1 uppercase">التحديث القادم</p>
                      <p className="text-5xl font-mono italic tracking-tighter">{nextCheckIn}s</p>
                    </div>
                    <Clock className="text-emerald-400/30" size={56} />
                  </div>
                  <div className="absolute bottom-0 right-0 h-1.5 bg-white/20 transition-all duration-1000" style={{ width: `${(nextCheckIn / 60) * 100}%` }} />
                </motion.div>
              )}
            </AnimatePresence>
          </aside>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-10 py-12 text-center border-t border-slate-200 mt-20">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
          متصل بقاعدة بيانات adhahi.dz الرسمية • 2026 © جميع الحقوق محفوظة
        </p>
      </footer>
    </div>
  );
}
