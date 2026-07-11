import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Vibration, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { getSetting, saveSetting, saveSession, todayLabel } from '../services/db';

const EXERCISES = [
  { id:'e1', name:'單腳站立（患腳）', icon:'🦶',
    desc:'扶椅背，右腳單腳站立，保持平衡',
    defaultDur:20,
    cues:['開始，右腳站穩，扶著椅背','保持骨盆水平，核心微收','感受腳底穩定感'],
    tip:'垂足術後重要：腳跟先著地，感受腳底與地面接觸' },
  { id:'e2', name:'腳跟—腳尖走路', icon:'👟',
    desc:'沿直線走，腳跟踩在前腳尖後方',
    defaultDur:30,
    cues:['開始，腳跟踩在腳尖後方','眼睛看前方，放慢步速','感受每一步的滾動感'],
    tip:'改善步態滾動感，對垂足代償非常有效' },
  { id:'e3', name:'側向移重（左右）', icon:'↔️',
    desc:'站立，緩慢將重心移到右腳再回左腳',
    defaultDur:40,
    cues:['開始，緩慢移重到右腳','感受右腳承重','回到左腳，再來回移動'],
    tip:'改善左右負重不均，對腰椎術後代償很重要' },
  { id:'e4', name:'前後移重', icon:'↕️',
    desc:'重心從腳跟慢慢移到腳尖再回來',
    defaultDur:30,
    cues:['開始，重心在腳跟','慢慢移到腳尖','再移回腳跟，感受足弓'],
    tip:'重建步態滾動感，對腳底知覺訓練很有幫助' },
  { id:'e5', name:'閉眼站立', icon:'👁️',
    desc:'雙腳站立，閉眼，挑戰本體覺',
    defaultDur:15,
    cues:['閉上眼睛','感受腳底與地面的接觸','核心微收，保持穩定'],
    tip:'進階訓練：去除視覺後的平衡調整，需有人在旁' },
];

const C_OV = 2 * Math.PI * 60;

export default function ExerciseScreen() {
  const [durs,     setDurs]     = useState({});
  const [selected, setSelected] = useState({});
  const [done,     setDone]     = useState({});
  const [adjEx,    setAdjEx]    = useState(null);
  const [running,  setRunning]  = useState(false);
  const [ovState,  setOvState]  = useState(null); // { ex, stepIdx, rem, total }
  const timerRef = useRef(null);
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const d = {};
      for (const ex of EXERCISES) {
        d[ex.id] = await getSetting('dur_' + ex.id, ex.defaultDur);
      }
      setDurs(d);
    })();
  }, []);

  const getDur = (id) => durs[id] ?? EXERCISES.find(e => e.id === id).defaultDur;

  const toggleSelect = (id) => {
    if (done[id]) return;
    setSelected(s => ({ ...s, [id]: !s[id] }));
  };

  const adjustDur = async (id, delta) => {
    const cur = getDur(id);
    const next = Math.max(10, Math.min(120, cur + delta));
    setDurs(d => ({ ...d, [id]: next }));
    await saveSetting('dur_' + id, next);
  };

  const selList  = EXERCISES.filter(e => selected[e.id] && !done[e.id]);
  const totalSec = selList.reduce((a, e) => a + getDur(e.id), 0);

  // ── Batch runner ──
  const startBatch = () => {
    if (!selList.length) return;
    setRunning(true);
    runStep(selList, 0);
  };

  const runStep = (queue, idx) => {
    if (idx >= queue.length) { finishBatch(queue); return; }
    const ex  = queue[idx];
    const dur = getDur(ex.id);
    let rem   = dur;

    setOvState({ ex, idx, total: queue.length, rem, dur });

    Animated.timing(ringAnim, { toValue: 0, duration: 0, useNativeDriver: false }).start();

    const cueStep = Math.floor(dur / ex.cues.length);
    let elapsed = 0;

    timerRef.current = setInterval(() => {
      rem--; elapsed++;
      setOvState(s => ({ ...s, rem }));

      // Ring animation
      Animated.timing(ringAnim, {
        toValue: C_OV * (rem / dur),
        duration: 950,
        useNativeDriver: false,
      }).start();

      // Cue at intervals
      if (elapsed % cueStep === 0) {
        const ci = Math.floor(elapsed / cueStep) - 1;
        if (ci < ex.cues.length) setOvState(s => ({ ...s, cue: ex.cues[ci] }));
      }

      if (rem <= 0) {
        clearInterval(timerRef.current);
        Vibration.vibrate([0, 200, 100, 200]);

        // Save exercise record
        saveSession({
          date: new Date().toISOString(),
          dateLabel: todayLabel(),
          type: 'exercise',
          duration: dur,
          grade: ex.name,
        });

        setDone(d => ({ ...d, [ex.id]: true }));
        setSelected(s => ({ ...s, [ex.id]: false }));

        // Rest 3s before next
        if (idx + 1 < queue.length) {
          setOvState(s => ({ ...s, rem: 3, phase: 'rest' }));
          let rest = 3;
          const restT = setInterval(() => {
            rest--;
            setOvState(s => ({ ...s, rem: rest }));
            if (rest <= 0) { clearInterval(restT); runStep(queue, idx + 1); }
          }, 1000);
        } else {
          finishBatch(queue);
        }
      }
    }, 1000);
  };

  const finishBatch = (queue) => {
    setRunning(false);
    setOvState(null);
    setDone({});
    Vibration.vibrate([0, 300, 150, 300, 150, 300]);
  };

  const cancelBatch = () => {
    clearInterval(timerRef.current);
    setRunning(false);
    setOvState(null);
    setDone({});
  };

  const toggleAll = () => {
    const anySelected = EXERCISES.some(e => selected[e.id]);
    const next = {};
    EXERCISES.forEach(e => { if (!done[e.id]) next[e.id] = !anySelected; });
    setSelected(next);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {/* Batch bar */}
        <View style={s.batchBar}>
          <Text style={s.batchInfo}>
            已選 <Text style={s.batchBold}>{selList.length}</Text> 個 ·{' '}
            預計 <Text style={s.batchBold}>{totalSec}</Text> 秒
          </Text>
          <TouchableOpacity onPress={toggleAll} style={s.selAllBtn}>
            <Text style={s.selAllText}>全選 / 清除</Text>
          </TouchableOpacity>
        </View>

        {/* Exercise list */}
        <View style={s.card}>
          <Text style={s.cardTitle}>平衡訓練動作</Text>
          {EXERCISES.map(ex => {
            const sel = selected[ex.id];
            const dn  = done[ex.id];
            const dur = getDur(ex.id);
            const isAdj = adjEx === ex.id;
            return (
              <View key={ex.id} style={[s.exRow, sel && s.exSel, dn && s.exDone]}>
                <TouchableOpacity style={s.exTop} onPress={() => toggleSelect(ex.id)}>
                  <View style={[s.exCb, sel && s.exCbSel, dn && s.exCbDone]}>
                    {(sel || dn) && <Text style={s.exCbCheck}>✓</Text>}
                  </View>
                  <Text style={s.exIcon}>{ex.icon}</Text>
                  <View style={s.exInfo}>
                    <Text style={s.exName}>{ex.name}</Text>
                    <Text style={s.exDesc}>{ex.desc}</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.durBadge, dn && s.durBadgeDone]}
                    onPress={() => setAdjEx(isAdj ? null : ex.id)}
                  >
                    <Text style={[s.durText, dn && s.durTextDone]}>{dur}秒 ✎</Text>
                  </TouchableOpacity>
                </TouchableOpacity>

                {/* Duration adjuster */}
                {isAdj && (
                  <View style={s.adjRow}>
                    <Text style={s.adjLabel}>訓練時長</Text>
                    <TouchableOpacity style={s.adjBtn} onPress={() => adjustDur(ex.id, -5)}>
                      <Text style={s.adjBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={s.adjVal}>{dur}</Text>
                    <TouchableOpacity style={s.adjBtn} onPress={() => adjustDur(ex.id, 5)}>
                      <Text style={s.adjBtnText}>+</Text>
                    </TouchableOpacity>
                    <Text style={s.adjUnit}>秒</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Start batch button */}
        <TouchableOpacity
          style={[s.startBtn, !selList.length && s.startBtnDisabled]}
          onPress={startBatch}
          disabled={!selList.length || running}
        >
          <Text style={s.startBtnText}>▶ 一貫完成選取動作</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Timer Overlay */}
      <Modal visible={!!ovState} transparent animationType="fade">
        <View style={s.ovBg}>
          <View style={s.ovBox}>
            {ovState && (
              <>
                <Text style={s.ovStep}>
                  動作 {ovState.idx + 1} / {ovState.total}
                </Text>
                <Text style={s.ovName}>{ovState.ex.name}</Text>
                <Text style={s.ovTip}>{ovState.ex.tip}</Text>

                {/* Ring */}
                <View style={s.ovRingWrap}>
                  <Svg width={150} height={150}
                    style={{ transform: [{ rotate: '-90deg' }] }}>
                    <Circle cx={75} cy={75} r={60} fill="none" stroke="#e4e6f0" strokeWidth={10}/>
                    <AnimatedCircle
                      cx={75} cy={75} r={60}
                      fill="none" stroke="#667eea" strokeWidth={10}
                      strokeLinecap="round"
                      strokeDasharray={C_OV}
                      strokeDashoffset={ringAnim}
                    />
                  </Svg>
                  <View style={s.ovNumWrap}>
                    <Text style={s.ovCount}>{ovState.rem}</Text>
                    <Text style={s.ovUnit}>
                      {ovState.phase === 'rest' ? '秒後繼續' : '秒'}
                    </Text>
                  </View>
                </View>

                <Text style={s.ovPhase}>
                  {ovState.phase === 'rest' ? '換下一個動作…' : '進行中'}
                </Text>
                <Text style={s.ovCue}>{ovState.cue || ''}</Text>

                {/* Progress dots */}
                <View style={s.ovDots}>
                  {Array.from({ length: ovState.total }).map((_, i) => (
                    <View key={i} style={[
                      s.ovDot,
                      i < ovState.idx && s.ovDotDone,
                      i === ovState.idx && s.ovDotActive,
                    ]}/>
                  ))}
                </View>

                <TouchableOpacity style={s.cancelBtn} onPress={cancelBatch}>
                  <Text style={s.cancelText}>取消訓練</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f4f5fb' },
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },

  batchBar:   { flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#fff', borderRadius: 12,
                borderWidth: 1, borderColor: '#e4e6f0', padding: 12 },
  batchInfo:  { flex: 1, fontSize: 13, color: '#5a5a7a' },
  batchBold:  { fontWeight: '700', color: '#1a1a2e' },
  selAllBtn:  { padding: 6, borderRadius: 8,
                borderWidth: 1, borderColor: '#e4e6f0' },
  selAllText: { fontSize: 12, color: '#5a5a7a' },

  card:      { backgroundColor: '#fff', borderRadius: 16,
               borderWidth: 1, borderColor: '#e4e6f0', padding: 16 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#5a5a7a',
               letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },

  exRow:    { borderWidth: 1.5, borderColor: '#e4e6f0', borderRadius: 12,
              padding: 11, marginBottom: 8 },
  exSel:    { borderColor: '#667eea', backgroundColor: '#eef0fd' },
  exDone:   { borderColor: '#22c55e', backgroundColor: '#dcfce7' },
  exTop:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exCb:     { width: 22, height: 22, borderRadius: 11, borderWidth: 2,
              borderColor: '#e4e6f0', alignItems: 'center', justifyContent: 'center' },
  exCbSel:  { backgroundColor: '#667eea', borderColor: '#667eea' },
  exCbDone: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  exCbCheck:{ color: '#fff', fontSize: 12, fontWeight: '700' },
  exIcon:   { fontSize: 20 },
  exInfo:   { flex: 1 },
  exName:   { fontSize: 13.5, fontWeight: '600', color: '#1a1a2e' },
  exDesc:   { fontSize: 11.5, color: '#9898b8', marginTop: 2 },
  durBadge: { backgroundColor: '#eef0fd', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  durBadgeDone: { backgroundColor: '#dcfce7' },
  durText:  { fontSize: 11.5, fontWeight: '600', color: '#3d4db5' },
  durTextDone: { color: '#15803d' },

  adjRow:   { flexDirection: 'row', alignItems: 'center', gap: 8,
              marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#e4e6f0' },
  adjLabel: { flex: 1, fontSize: 12, color: '#9898b8' },
  adjBtn:   { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5,
              borderColor: '#e4e6f0', alignItems: 'center', justifyContent: 'center' },
  adjBtnText: { fontSize: 18, fontWeight: '700', color: '#667eea' },
  adjVal:   { fontSize: 20, fontWeight: '700', color: '#1a1a2e', minWidth: 40, textAlign: 'center' },
  adjUnit:  { fontSize: 12, color: '#9898b8' },

  startBtn: { backgroundColor: '#22c55e', borderRadius: 14, padding: 16,
              alignItems: 'center' },
  startBtnDisabled: { backgroundColor: '#d1d5db' },
  startBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Overlay
  ovBg:  { flex: 1, backgroundColor: 'rgba(26,26,46,.88)',
           alignItems: 'center', justifyContent: 'center', padding: 20 },
  ovBox: { backgroundColor: '#fff', borderRadius: 24, padding: 28,
           width: '100%', maxWidth: 340, alignItems: 'center' },
  ovStep:{ fontSize: 11, color: '#9898b8', letterSpacing: 1,
           textTransform: 'uppercase', marginBottom: 6 },
  ovName:{ fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 4, textAlign: 'center' },
  ovTip: { fontSize: 12.5, color: '#9898b8', marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  ovRingWrap: { position: 'relative', width: 150, height: 150, marginBottom: 14 },
  ovNumWrap:  { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  ovCount:    { fontSize: 48, fontWeight: '500', color: '#1a1a2e', lineHeight: 52 },
  ovUnit:     { fontSize: 11, color: '#9898b8', marginTop: 2 },
  ovPhase:    { fontSize: 15, fontWeight: '700', color: '#667eea', marginBottom: 6 },
  ovCue:      { fontSize: 12.5, color: '#9898b8', marginBottom: 14, minHeight: 18, textAlign: 'center' },
  ovDots:     { flexDirection: 'row', gap: 6, marginBottom: 16 },
  ovDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e4e6f0' },
  ovDotDone:  { backgroundColor: '#22c55e' },
  ovDotActive:{ backgroundColor: '#667eea' },
  cancelBtn:  { paddingHorizontal: 28, paddingVertical: 12, backgroundColor: '#f4f5fb',
                borderRadius: 12, borderWidth: 1.5, borderColor: '#e4e6f0' },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#5a5a7a' },
});
