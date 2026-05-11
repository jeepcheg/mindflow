import { useState, useEffect, useRef, useCallback } from "react";

const CATEGORIES = [
  { id: "work", label: "Работа", emoji: "💼", color: "#4A90D9", bg: "#EBF4FF" },
  { id: "switch", label: "Переключение", emoji: "🔀", color: "#E8854A", bg: "#FFF3EB" },
  { id: "rest", label: "Отдых", emoji: "🌿", color: "#5BAD6F", bg: "#EDFBF0" },
  { id: "personal", label: "Личное", emoji: "🏠", color: "#9B6DD4", bg: "#F5EFFF" },
  { id: "energy", label: "Энергия", emoji: "⚡", color: "#F0C444", bg: "#FFFBEB" },
  { id: "insight", label: "Инсайт", emoji: "💡", color: "#E8547A", bg: "#FFF0F4" },
];

const ENERGY_LEVELS = [
  { value: 1, label: "Устал", emoji: "😔" },
  { value: 2, label: "Нормально", emoji: "😐" },
  { value: 3, label: "Бодро", emoji: "😊" },
  { value: 4, label: "В потоке", emoji: "🔥" },
];

const STORAGE_KEY = "mindflow_entries_v1";
const API_KEY_STORE = "mindflow_api_key";

function getNow() { return new Date().toTimeString().slice(0, 5); }
function getToday() { return new Date().toISOString().slice(0, 10); }
function formatDate(iso) { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }); }
function loadEntries() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } }
function saveEntries(entries) { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }
function getApiKey() { return localStorage.getItem(API_KEY_STORE) || ""; }
function persistApiKey(key) { localStorage.setItem(API_KEY_STORE, key); }

export default function MindflowTracker() {
  const [entries, setEntries] = useState(loadEntries);
  const [view, setView] = useState("log");
  const [form, setForm] = useState({ category: "work", text: "", energy: 2, timeStart: getNow(), timeEnd: getNow() });
  const [isRecording, setIsRecording] = useState(false);
  const [recStatus, setRecStatus] = useState("");
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState("all");
  const [apiKey, setApiKey] = useState(getApiKey);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => { saveEntries(entries); }, [entries]);
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }
  }, [toast]);

  const showToast = (msg, type = "ok") => setToast({ msg, type });

  // ── VOICE via Web Speech API ──
  const startVoice = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRecStatus("Голосовой ввод не поддерживается в этом браузере");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRecording(true);
      setRecStatus("Говорите…");
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) {
        setForm(f => ({ ...f, text: (f.text + " " + final).trim() }));
        setRecStatus("✓ Записано");
      } else if (interim) {
        setRecStatus("…" + interim);
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed") setRecStatus("Нет доступа к микрофону — разрешите в настройках");
      else if (e.error === "no-speech") setRecStatus("Речь не обнаружена — попробуйте ещё раз");
      else setRecStatus("Ошибка: " + e.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  }, []);

  const stopVoice = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const addEntry = () => {
    if (!form.text.trim()) { showToast("Добавьте описание", "err"); return; }
    const entry = { id: Date.now(), date: getToday(), createdAt: new Date().toISOString(), ...form };
    setEntries(prev => [entry, ...prev]);
    setForm(f => ({ ...f, text: "", timeStart: getNow(), timeEnd: getNow() }));
    setRecStatus("");
    setView("log");
    showToast("Запись добавлена ✓");
  };

  const deleteEntry = (id) => { setEntries(prev => prev.filter(e => e.id !== id)); showToast("Удалено"); };

  const exportForClaude = () => {
    const text = entries.slice(0, 50).map(e => {
      const cat = CATEGORIES.find(c => c.id === e.category);
      const en = ENERGY_LEVELS.find(l => l.value === e.energy);
      return `[${e.date} ${e.timeStart}–${e.timeEnd}] ${cat?.emoji} ${cat?.label} | ${en?.emoji} ${en?.label}\n${e.text}`;
    }).join("\n\n");
    navigator.clipboard?.writeText(text);
    showToast("Скопировано в буфер обмена!");
  };

  const saveApiKeyFromInput = () => {
    const val = apiKeyInput.trim();
    if (!val) { showToast("Введите ключ", "err"); return; }
    if (!val.startsWith("sk-")) { showToast("Ключ должен начинаться с sk-", "err"); return; }
    persistApiKey(val);
    setApiKey(val);
    setApiKeyInput("");
    setShowKey(false);
    showToast("Ключ сохранён ✓");
  };

  const deleteApiKey = () => {
    if (window.confirm("Удалить API ключ?")) {
      localStorage.removeItem(API_KEY_STORE);
      setApiKey("");
      setApiKeyInput("");
      showToast("Ключ удалён");
    }
  };

  const todayEntries = entries.filter(e => e.date === getToday());
  const filteredEntries = filter === "all" ? todayEntries : todayEntries.filter(e => e.category === filter);
  const catCounts = CATEGORIES.map(c => ({ ...c, count: todayEntries.filter(e => e.category === c.id).length }));
  const avgEnergy = todayEntries.length ? (todayEntries.reduce((s, e) => s + e.energy, 0) / todayEntries.length).toFixed(1) : null;
  const insightEntries = todayEntries.filter(e => e.category === "insight");
  const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
  const getEn = (v) => ENERGY_LEVELS.find(l => l.value === v) || ENERGY_LEVELS[1];

  return (
    <div style={s.root}>
      <div style={s.blob1} /><div style={s.blob2} />
      <div style={s.header}>
        <div><div style={s.logo}>MindFlow</div><div style={s.sublogo}>дневник осознанности</div></div>
        <div style={s.dateChip}>{new Date().toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}</div>
      </div>
      <div style={s.nav}>
        {[["log","📋","Лог"],["add","➕","Запись"],["stats","📊","Итоги"],["settings","⚙️","API"]].map(([v,ico,lbl]) => (
          <button key={v} style={{...s.navBtn,...(view===v?s.navBtnActive:{})}} onClick={()=>setView(v)}>
            <span>{ico}</span><span style={{fontSize:11}}>{lbl}</span>
          </button>
        ))}
      </div>

      {view==="add" && (
        <div style={s.card}>
          <div style={s.secTitle}>Новая запись</div>
          <div style={s.timeRow}>
            <div style={{flex:1}}><label style={s.label}>Начало</label><input style={s.timeInput} type="time" value={form.timeStart} onChange={e=>setForm(f=>({...f,timeStart:e.target.value}))}/></div>
            <div style={s.timeDash}>→</div>
            <div style={{flex:1}}><label style={s.label}>Конец</label><input style={s.timeInput} type="time" value={form.timeEnd} onChange={e=>setForm(f=>({...f,timeEnd:e.target.value}))}/></div>
          </div>
          <label style={s.label}>Категория</label>
          <div style={s.catGrid}>
            {CATEGORIES.map(c=>(
              <button key={c.id} style={{...s.catBtn,...(form.category===c.id?{background:c.color,color:"#fff",borderColor:c.color}:{background:c.bg,borderColor:"transparent"})}} onClick={()=>setForm(f=>({...f,category:c.id}))}>
                <span style={{fontSize:18}}>{c.emoji}</span><span style={{fontSize:11,marginTop:2}}>{c.label}</span>
              </button>
            ))}
          </div>
          <label style={s.label}>Энергия</label>
          <div style={s.energyRow}>
            {ENERGY_LEVELS.map(l=>(
              <button key={l.value} style={{...s.energyBtn,...(form.energy===l.value?s.energyBtnActive:{})}} onClick={()=>setForm(f=>({...f,energy:l.value}))}>
                <span style={{fontSize:20}}>{l.emoji}</span><span style={{fontSize:10}}>{l.label}</span>
              </button>
            ))}
          </div>
          <label style={s.label}>Описание</label>
          <div style={s.voiceRow}>
            <button
              style={{...s.micBtn,...(isRecording?s.micBtnActive:{})}}
              onClick={isRecording ? stopVoice : startVoice}>
              {isRecording ? "🔴" : "🎤"}
            </button>
            <span style={s.recStatus}>{recStatus || "Нажмите 🎤 — говорите — нажмите 🔴"}</span>
          </div>
          <textarea style={s.textarea} rows={3} placeholder="Что происходило? Как себя чувствовали?" value={form.text} onChange={e=>setForm(f=>({...f,text:e.target.value}))}/>
          <button style={s.addBtn} onClick={addEntry}>Сохранить запись</button>
        </div>
      )}

      {view==="log" && (
        <div>
          <div style={s.filterRow}>
            <button style={{...s.chip,...(filter==="all"?s.chipActive:{})}} onClick={()=>setFilter("all")}>Все</button>
            {CATEGORIES.filter(c=>todayEntries.some(e=>e.category===c.id)).map(c=>(
              <button key={c.id} style={{...s.chip,...(filter===c.id?{...s.chipActive,background:c.color}:{})}} onClick={()=>setFilter(c.id)}>{c.emoji}</button>
            ))}
          </div>
          {filteredEntries.length===0&&(<div style={s.emptyState}><div style={{fontSize:48}}>🌱</div><div style={{marginTop:12,color:"#999",fontSize:14}}>Записей пока нет</div><div style={{color:"#bbb",fontSize:12,marginTop:4}}>Нажмите ➕ чтобы начать</div></div>)}
          {filteredEntries.map(entry=>{
            const cat=getCat(entry.category);const en=getEn(entry.energy);
            return(<div key={entry.id} style={{...s.entryCard,borderLeft:`4px solid ${cat.color}`}}>
              <div style={s.entryHeader}>
                <div style={s.entryMeta}><span style={{...s.catTag,background:cat.bg,color:cat.color}}>{cat.emoji} {cat.label}</span><span style={s.entryTime}>{entry.timeStart} – {entry.timeEnd}</span></div>
                <div style={s.entryRight}><span title={en.label}>{en.emoji}</span><button style={s.delBtn} onClick={()=>deleteEntry(entry.id)}>×</button></div>
              </div>
              <div style={s.entryText}>{entry.text}</div>
            </div>);
          })}
        </div>
      )}

      {view==="stats" && (
        <div>
          <div style={s.card}>
            <div style={s.secTitle}>Сегодня — {formatDate(new Date().toISOString())}</div>
            <div style={s.statsRow}>
              <div style={s.statBox}><div style={s.statNum}>{todayEntries.length}</div><div style={s.statLbl}>записей</div></div>
              <div style={s.statBox}><div style={s.statNum}>{avgEnergy||"—"}</div><div style={s.statLbl}>ср. энергия</div></div>
              <div style={s.statBox}><div style={s.statNum}>{insightEntries.length}</div><div style={s.statLbl}>инсайтов</div></div>
              <div style={s.statBox}><div style={s.statNum}>{todayEntries.filter(e=>e.category==="switch").length}</div><div style={s.statLbl}>переключений</div></div>
            </div>
          </div>
          <div style={s.card}>
            <div style={s.secTitle}>По категориям</div>
            {catCounts.filter(c=>c.count>0).map(c=>(
              <div key={c.id} style={s.barRow}>
                <span style={{width:100,fontSize:13}}>{c.emoji} {c.label}</span>
                <div style={s.barTrack}><div style={{...s.barFill,width:`${(c.count/todayEntries.length)*100}%`,background:c.color}}/></div>
                <span style={{fontSize:12,color:"#999",width:20,textAlign:"right"}}>{c.count}</span>
              </div>
            ))}
            {catCounts.every(c=>c.count===0)&&<div style={{color:"#bbb",fontSize:13}}>Нет данных за сегодня</div>}
          </div>
          {insightEntries.length>0&&(<div style={s.card}><div style={s.secTitle}>💡 Инсайты дня</div>{insightEntries.map(e=>(<div key={e.id} style={s.insightBox}><div style={s.insightTime}>{e.timeStart}</div><div style={s.insightText}>{e.text}</div></div>))}</div>)}
          <button style={s.exportBtn} onClick={exportForClaude}>📋 Скопировать данные для анализа с Claude</button>
          <div style={{textAlign:"center",fontSize:11,color:"#bbb",marginTop:6,paddingBottom:16}}>Вставьте скопированный текст в чат с Claude для глубокого анализа</div>
        </div>
      )}

      {view==="settings" && (
        <div style={s.card}>
          <div style={s.secTitle}>Настройки API</div>
          <div style={{...s.keyStatus,...(apiKey?s.keyOk:s.keyNone)}}>{apiKey?"✓ API ключ подключён":"⚠ API ключ не задан"}</div>
          <label style={s.label}>Anthropic API ключ</label>
          <div style={s.settingsRow}>
            <input style={s.settingsInput} type={showKey?"text":"password"} placeholder="sk-ant-api03-..." value={apiKeyInput} onChange={e=>setApiKeyInput(e.target.value)} autoComplete="off" spellCheck="false"/>
            <button style={s.toggleBtn} onClick={()=>setShowKey(v=>!v)}>{showKey?"Скрыть":"Показать"}</button>
          </div>
          {apiKey&&!apiKeyInput&&(<div style={s.hint}>Текущий ключ: {apiKey.slice(0,8)}{"•".repeat(16)}{apiKey.slice(-4)}</div>)}
          <p style={s.hint}>Ключ хранится только в вашем браузере. Никуда не отправляется кроме Anthropic API.</p>
          <button style={s.saveBtn} onClick={saveApiKeyFromInput}>Сохранить ключ</button>
          <hr style={s.sep}/>
          <div style={{...s.secTitle,fontSize:14,marginBottom:8}}>Голосовой ввод</div>
          <p style={s.hint}>Используется встроенное распознавание речи браузера (Web Speech API). Работает на iOS Safari и Chrome без дополнительных настроек. Интернет-соединение требуется.</p>
          {apiKey&&(<><hr style={s.sep}/><button style={s.dangerBtn} onClick={deleteApiKey}>🗑 Удалить ключ</button></>)}
        </div>
      )}

      {toast&&(<div style={{...s.toast,background:toast.type==="err"?"#FF6B6B":"#2D9E6B"}}>{toast.msg}</div>)}
    </div>
  );
}

const s = {
  root:{minHeight:"100vh",background:"#F8F6F2",fontFamily:"'Georgia',serif",maxWidth:420,margin:"0 auto",padding:"0 0 80px",position:"relative",overflow:"hidden"},
  blob1:{position:"fixed",top:-80,right:-80,width:260,height:260,borderRadius:"50%",background:"radial-gradient(circle,#FFE8D6 0%,transparent 70%)",pointerEvents:"none",zIndex:0},
  blob2:{position:"fixed",bottom:60,left:-60,width:200,height:200,borderRadius:"50%",background:"radial-gradient(circle,#E8F4FF 0%,transparent 70%)",pointerEvents:"none",zIndex:0},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"24px 20px 12px",position:"relative",zIndex:1},
  logo:{fontSize:26,fontWeight:"700",color:"#1A1A1A",letterSpacing:"-0.5px"},
  sublogo:{fontSize:12,color:"#999",marginTop:2,fontStyle:"italic"},
  dateChip:{background:"#1A1A1A",color:"#fff",padding:"6px 12px",borderRadius:20,fontSize:12},
  nav:{display:"flex",gap:8,padding:"8px 20px 16px",position:"relative",zIndex:1},
  navBtn:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"10px 8px",border:"none",borderRadius:14,cursor:"pointer",background:"#fff",color:"#888",fontSize:18,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",transition:"all 0.2s",fontFamily:"Georgia,serif"},
  navBtnActive:{background:"#1A1A1A",color:"#fff",boxShadow:"0 4px 16px rgba(0,0,0,0.2)"},
  card:{margin:"0 16px 16px",background:"#fff",borderRadius:20,padding:"20px",boxShadow:"0 2px 16px rgba(0,0,0,0.06)",position:"relative",zIndex:1},
  secTitle:{fontSize:16,fontWeight:"700",color:"#1A1A1A",marginBottom:16},
  label:{fontSize:12,color:"#888",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.5px",display:"block",marginBottom:8,marginTop:14},
  timeRow:{display:"flex",alignItems:"center",gap:8,marginBottom:4},
  timeDash:{color:"#ccc",fontSize:18,marginTop:16},
  timeInput:{width:"100%",padding:"10px 12px",borderRadius:12,border:"2px solid #F0F0F0",fontSize:16,fontFamily:"monospace",color:"#1A1A1A",background:"#FAFAFA",outline:"none",boxSizing:"border-box"},
  catGrid:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8},
  catBtn:{display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 8px",border:"2px solid transparent",borderRadius:14,cursor:"pointer",transition:"all 0.15s",fontSize:13,color:"#444",fontFamily:"Georgia,serif"},
  energyRow:{display:"flex",gap:8},
  energyBtn:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"10px 4px",border:"2px solid #F0F0F0",borderRadius:14,cursor:"pointer",background:"#FAFAFA",color:"#666",fontSize:12,transition:"all 0.15s",fontFamily:"Georgia,serif"},
  energyBtnActive:{border:"2px solid #1A1A1A",background:"#1A1A1A",color:"#fff"},
  voiceRow:{display:"flex",alignItems:"center",gap:10,marginBottom:8},
  micBtn:{width:52,height:52,borderRadius:"50%",border:"none",cursor:"pointer",fontSize:22,background:"#F0F0F0",flexShrink:0,boxShadow:"0 2px 8px rgba(0,0,0,0.08)",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center"},
  micBtnActive:{background:"#FFE8E8",transform:"scale(1.1)",boxShadow:"0 0 0 6px rgba(255,100,100,0.2)"},
  recStatus:{fontSize:12,color:"#999",fontStyle:"italic"},
  textarea:{width:"100%",padding:"12px",borderRadius:14,border:"2px solid #F0F0F0",fontSize:14,color:"#1A1A1A",resize:"vertical",fontFamily:"Georgia,serif",background:"#FAFAFA",outline:"none",boxSizing:"border-box",lineHeight:1.6},
  addBtn:{width:"100%",padding:"14px",marginTop:16,border:"none",borderRadius:14,background:"#1A1A1A",color:"#fff",fontSize:16,fontWeight:"700",cursor:"pointer",letterSpacing:"0.3px",fontFamily:"Georgia,serif"},
  filterRow:{display:"flex",gap:8,padding:"0 16px 12px",overflowX:"auto",position:"relative",zIndex:1},
  chip:{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",background:"#fff",fontSize:13,color:"#666",whiteSpace:"nowrap",boxShadow:"0 2px 6px rgba(0,0,0,0.06)",fontFamily:"Georgia,serif"},
  chipActive:{background:"#1A1A1A",color:"#fff"},
  emptyState:{textAlign:"center",padding:"60px 20px",position:"relative",zIndex:1},
  entryCard:{margin:"0 16px 10px",background:"#fff",borderRadius:16,padding:"14px 16px",boxShadow:"0 2px 10px rgba(0,0,0,0.05)",position:"relative",zIndex:1},
  entryHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8},
  entryMeta:{display:"flex",alignItems:"center",gap:8},
  catTag:{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:"600"},
  entryTime:{fontSize:12,color:"#bbb",fontFamily:"monospace"},
  entryRight:{display:"flex",alignItems:"center",gap:8},
  delBtn:{background:"none",border:"none",cursor:"pointer",color:"#ccc",fontSize:18,lineHeight:1,padding:"0 2px"},
  entryText:{fontSize:14,color:"#444",lineHeight:1.6},
  statsRow:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:4},
  statBox:{background:"#F8F6F2",borderRadius:14,padding:"12px 8px",textAlign:"center"},
  statNum:{fontSize:24,fontWeight:"700",color:"#1A1A1A"},
  statLbl:{fontSize:10,color:"#999",marginTop:2},
  barRow:{display:"flex",alignItems:"center",gap:10,marginBottom:10},
  barTrack:{flex:1,height:8,background:"#F0F0F0",borderRadius:4,overflow:"hidden"},
  barFill:{height:"100%",borderRadius:4,transition:"width 0.5s ease"},
  insightBox:{background:"#FFF8F0",borderRadius:12,padding:"12px 14px",marginBottom:10,borderLeft:"3px solid #F0C444"},
  insightTime:{fontSize:11,color:"#bbb",fontFamily:"monospace",marginBottom:4},
  insightText:{fontSize:14,color:"#444",lineHeight:1.6,fontStyle:"italic"},
  exportBtn:{display:"block",margin:"0 16px 8px",width:"calc(100% - 32px)",padding:"14px",border:"2px solid #1A1A1A",borderRadius:14,background:"#fff",color:"#1A1A1A",fontSize:14,fontWeight:"700",cursor:"pointer",fontFamily:"Georgia,serif"},
  toast:{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",color:"#fff",padding:"10px 20px",borderRadius:20,fontSize:13,fontWeight:"600",zIndex:100,boxShadow:"0 4px 16px rgba(0,0,0,0.2)",whiteSpace:"nowrap"},
  keyStatus:{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:12,fontSize:13,marginBottom:16},
  keyOk:{background:"#EDFBF0",color:"#2D9E6B"},
  keyNone:{background:"#FFF3EB",color:"#E8854A"},
  settingsRow:{display:"flex",alignItems:"center",gap:10,marginBottom:8},
  settingsInput:{flex:1,padding:"10px 12px",borderRadius:12,border:"2px solid #F0F0F0",fontSize:14,fontFamily:"monospace",color:"#1A1A1A",background:"#FAFAFA",outline:"none"},
  toggleBtn:{padding:"8px 14px",borderRadius:10,border:"2px solid #F0F0F0",background:"#FAFAFA",cursor:"pointer",fontSize:13,color:"#666",whiteSpace:"nowrap",fontFamily:"Georgia,serif"},
  saveBtn:{width:"100%",padding:"13px",border:"none",borderRadius:14,background:"#1A1A1A",color:"#fff",fontSize:15,fontWeight:"700",cursor:"pointer",marginTop:8,fontFamily:"Georgia,serif"},
  hint:{fontSize:12,color:"#888",marginTop:6,lineHeight:1.5},
  sep:{margin:"16px 0",border:"none",borderTop:"1px solid #F0F0F0"},
  dangerBtn:{width:"100%",padding:"11px",border:"2px solid #FFD0D0",borderRadius:14,background:"#fff",color:"#E05050",fontSize:13,cursor:"pointer",marginTop:8,fontFamily:"Georgia,serif"},
};
