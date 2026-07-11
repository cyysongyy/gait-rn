import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Animated, Vibration, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useGaitSensor } from '../hooks/useGaitSensor';
import { sendSessionNotification } from '../services/background';

const C = 2 * Math.PI * 54;

export default function HomeScreen() {
  const { isActive, isMoving, score, grade, gamma, sway, elapsed } =
    useGaitSensor({
      onSessionSaved: async (result) => {
        Vibration.vibrate(200);
        await sendSessionNotification(result);
      },
    });

  const ringAnim = useRef(new Animated.Value(C)).current;
  const dotScale = useRef(new Animated.Value(1)).current;

  // Pulse dot when moving
  useEffect(() => {
    if (isMoving) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotScale, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(dotScale, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      dotScale.stopAnimation();
      Animated.timing(dotScale, { toValue: 1.0, duration: 200, useNativeDriver: true }).start();
    }
  }, [isMoving]);

  // Ring animation
  useEffect(() => {
    if (score !== null) {
      Animated.timing(ringAnim, {
        toValue: C * (1 - score / 100),
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [score]);

  const ringColor = score === null ? '#e4e6f0'
    : score >= 85 ? '#22c55e'
    : score >= 70 ? '#667eea'
    : score >= 55 ? '#f59e0b'
    : '#ef4444';

  const gradeColor = score === null ? '#9898b8'
    : score >= 85 ? '#15803d'
    : score >= 70 ? '#3d4db5'
    : score >= 55 ? '#a16207'
    : '#991b1b';

  const dotColor = !isMoving ? '#9898b8'
    : score === null ? '#667eea'
    : score >= 70 ? '#22c55e'
    : score >= 55 ? '#f59e0b'
    : '#ef4444';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.hdr}>
          <View>
            <Text style={styles.hdrTitle}>步態平衡追蹤</Text>
            <Text style={styles.hdrSub}>Gait Balance Tracker</Text>
          </View>
          {/* Live dot */}
          <Animated.View style={[
            styles.liveDot,
            { backgroundColor: dotColor, transform: [{ scale: dotScale }] }
          ]}>
            <Text style={styles.liveDotText}>{isMoving ? '●' : '○'}</Text>
          </Animated.View>
        </View>

        {/* Status bar */}
        <View style={[styles.statusBar, isActive && styles.statusActive]}>
          <Text style={[styles.statusText, isActive && styles.statusTextActive]}>
            {isActive
              ? `🚶 記錄中 ${elapsed}秒 · 晃動 ${sway.toFixed(1)}°`
              : isMoving
              ? '偵測到移動，開始分析…'
              : '靜止中 · 走動自動開始記錄'}
          </Text>
        </View>

        {/* Balance ring */}
        <View style={styles.ringCard}>
          <Text style={styles.cardTitle}>即時平衡</Text>
          <View style={styles.ringWrap}>
            <Svg width={160} height={160} style={{ transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={80} cy={80} r={54} fill="none" stroke="#e4e6f0" strokeWidth={10}/>
              <AnimatedCircle
                cx={80} cy={80} r={54}
                fill="none"
                stroke={ringColor}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={ringAnim}
              />
            </Svg>
            <View style={styles.ringLabel}>
              <Text style={styles.ringScore}>{score ?? '--'}</Text>
              <Text style={styles.ringUnit}>平衡分</Text>
              <Text style={[styles.ringGrade, { color: gradeColor }]}>{grade ?? '--'}</Text>
            </View>
          </View>

          {/* Bar */}
          <View style={styles.barWrap}>
            <View style={styles.barLabels}>
              <Text style={styles.barLbl}>← 左傾</Text>
              <Text style={styles.barLbl}>中立</Text>
              <Text style={styles.barLbl}>右傾 →</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={styles.barFill}/>
              <View style={styles.barCenter}/>
              <View style={[
                styles.barNeedle,
                { left: `${Math.max(5, Math.min(95, 50 + (gamma / 30) * 50))}%` }
              ]}/>
            </View>
          </View>

          {/* Values */}
          <View style={styles.valRow}>
            {[
              { label: '左傾角', value: Math.max(0, -gamma).toFixed(1), unit: '°' },
              { label: '重心偏移', value: gamma.toFixed(1), unit: '°' },
              { label: '晃動幅度', value: sway.toFixed(1), unit: '°' },
            ].map((v, i) => (
              <View key={i} style={styles.valBox}>
                <Text style={styles.valLbl}>{v.label}</Text>
                <Text style={styles.valNum}>{v.value}</Text>
                <Text style={styles.valUnit}>{v.unit}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📱 自動記錄說明</Text>
          <Text style={styles.infoText}>
            • 開啟 App 後感測器自動啟動{'\n'}
            • 開始走動 → 自動開始記錄{'\n'}
            • 靜止 4 秒 → 自動存入記錄{'\n'}
            • App 在背景也會定時提醒你走動{'\n'}
            • 不需要手動按任何按鈕
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// Animated SVG Circle
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f4f5fb' },
  scroll: { flex: 1 },
  content:{ padding: 16, gap: 12 },

  hdr:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: '#667eea', borderRadius: 16, padding: 18 },
  hdrTitle:   { fontSize: 20, fontWeight: '700', color: '#fff' },
  hdrSub:     { fontSize: 12, color: 'rgba(255,255,255,.7)', marginTop: 2 },
  liveDot:    { width: 44, height: 44, borderRadius: 22,
                alignItems: 'center', justifyContent: 'center' },
  liveDotText:{ fontSize: 20 },

  statusBar:       { backgroundColor: '#fff', borderRadius: 12, padding: 12,
                     borderWidth: 1, borderColor: '#e4e6f0' },
  statusActive:    { backgroundColor: '#eef0fd', borderColor: '#c7ccf7' },
  statusText:      { fontSize: 13, color: '#5a5a7a', textAlign: 'center' },
  statusTextActive:{ color: '#3d4db5', fontWeight: '600' },

  ringCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 16,
               borderWidth: 1, borderColor: '#e4e6f0' },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#5a5a7a',
               letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 14 },

  ringWrap:  { alignItems: 'center', marginBottom: 16, position: 'relative' },
  ringLabel: { position: 'absolute', alignItems: 'center', justifyContent: 'center',
               top: 0, bottom: 0, left: 0, right: 0 },
  ringScore: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
               fontSize: 40, fontWeight: '500', color: '#1a1a2e', lineHeight: 44 },
  ringUnit:  { fontSize: 11, color: '#9898b8', marginTop: 2 },
  ringGrade: { fontSize: 13, fontWeight: '700', marginTop: 2 },

  barWrap:   { marginBottom: 14 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barLbl:    { fontSize: 10.5, color: '#9898b8' },
  barTrack:  { height: 12, backgroundColor: '#eee', borderRadius: 6,
               position: 'relative', overflow: 'visible' },
  barFill:   { ...StyleSheet.absoluteFillObject,
               borderRadius: 6,
               // gradient simulation via multiple views
               backgroundColor: '#f59e0b' },
  barCenter: { position: 'absolute', left: '50%', top: -4,
               width: 2, height: 20, backgroundColor: '#5a5a7a',
               opacity: 0.3, borderRadius: 1 },
  barNeedle: { position: 'absolute', top: -5,
               width: 6, height: 22, backgroundColor: '#1a1a2e',
               borderRadius: 3,
               shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3 },

  valRow: { flexDirection: 'row', gap: 7 },
  valBox: { flex: 1, backgroundColor: '#f4f5fb', borderRadius: 12,
            borderWidth: 1, borderColor: '#e4e6f0', padding: 9, alignItems: 'center' },
  valLbl: { fontSize: 10, color: '#9898b8', marginBottom: 3 },
  valNum: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
            fontSize: 19, fontWeight: '500', color: '#1a1a2e' },
  valUnit:{ fontSize: 9.5, color: '#9898b8', marginTop: 1 },

  infoCard:  { backgroundColor: '#eef0fd', borderRadius: 14,
               borderWidth: 1, borderColor: '#c7ccf7', padding: 16 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#3d4db5', marginBottom: 8 },
  infoText:  { fontSize: 13, color: '#3d4db5', lineHeight: 22 },
});
