import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getSessions, getStats, exportCSV } from '../services/db';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function HistoryScreen() {
  const [sessions, setSessions] = useState([]);
  const [stats,    setStats]    = useState(null);
  const [grouped,  setGrouped]  = useState({});

  useFocusEffect(useCallback(() => {
    loadData();
  }, []));

  async function loadData() {
    const [s, st] = await Promise.all([getSessions(60), getStats()]);
    setSessions(s);
    setStats(st);

    // Group by date_label
    const g = {};
    s.forEach(r => {
      const key = r.date_label || r.date?.slice(0, 10) || '未知';
      if (!g[key]) g[key] = [];
      g[key].push(r);
    });
    setGrouped(g);
  }

  async function handleExport() {
    try {
      const csv  = await exportCSV();
      const path = FileSystem.documentDirectory + 'gait_history.csv';
      await FileSystem.writeAsStringAsync(path, csv, { encoding: 'utf8' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv' });
      } else {
        Alert.alert('匯出', '檔案已儲存到 App 資料夾');
      }
    } catch (e) {
      Alert.alert('錯誤', e.message);
    }
  }

  const scoreColor = (sc) =>
    sc >= 85 ? '#15803d' : sc >= 70 ? '#3d4db5' : sc >= 55 ? '#a16207' : '#991b1b';
  const scoreBg = (sc) =>
    sc >= 85 ? '#dcfce7' : sc >= 70 ? '#eef0fd' : sc >= 55 ? '#fef9c3' : '#fee2e2';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {/* Stats */}
        {stats && (
          <View style={s.card}>
            <Text style={s.cardTitle}>統計摘要</Text>
            <View style={s.statsGrid}>
              {[
                { label: '本週測量次數', val: stats.week?.count ?? '--', unit: '次' },
                { label: '平均平衡分',   val: stats.week?.avgScore ? Math.round(stats.week.avgScore) : '--', unit: '分' },
                { label: '最佳分數',     val: stats.allTime?.bestScore ?? '--', unit: '分' },
                { label: '訓練總時長',   val: stats.allTime?.totalDur ? Math.round(stats.allTime.totalDur / 60) : '--', unit: '分鐘' },
              ].map((item, i) => (
                <View key={i} style={s.statBox}>
                  <Text style={s.statLabel}>{item.label}</Text>
                  <Text style={s.statVal}>{item.val}</Text>
                  <Text style={s.statUnit}>{item.unit}</Text>
                </View>
              ))}
            </View>

            {/* Mini trend */}
            {sessions.filter(r => r.score && r.type === 'walk').length >= 2 && (
              <MiniTrend sessions={sessions.filter(r => r.score && r.type === 'walk').slice(0, 14)} />
            )}
          </View>
        )}

        {/* History list */}
        <View style={s.card}>
          <Text style={s.cardTitle}>測量記錄</Text>
          {Object.keys(grouped).length === 0
            ? <Text style={s.empty}>尚無記錄</Text>
            : Object.entries(grouped).map(([day, rows]) => (
                <View key={day} style={s.dayGroup}>
                  <Text style={s.dayLabel}>{day}</Text>
                  {rows.map((r, i) => {
                    const time = r.date
                      ? new Date(r.date).toLocaleTimeString('zh-TW',
                          { hour: '2-digit', minute: '2-digit' })
                      : '--';
                    const isEx = r.type === 'exercise';
                    return (
                      <View key={r.id ?? i} style={s.histRow}>
                        <Text style={s.histTime}>{time}</Text>
                        <View style={s.histInfo}>
                          <Text style={s.histType}>
                            {isEx ? `🏋️ ${r.grade}` : '⚖️ 步態測量'}
                          </Text>
                          <Text style={s.histDetail}>
                            {isEx
                              ? `${r.duration}秒`
                              : `晃動 ${r.sway}° · ${r.duration}秒`}
                          </Text>
                        </View>
                        {!isEx && r.score !== null && (
                          <View style={[s.badge,
                            { backgroundColor: scoreBg(r.score) }]}>
                            <Text style={[s.badgeText,
                              { color: scoreColor(r.score) }]}>
                              {r.score}
                            </Text>
                            <Text style={[s.badgeGrade,
                              { color: scoreColor(r.score) }]}>
                              {r.grade}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))
          }

          <TouchableOpacity style={s.exportBtn} onPress={handleExport}>
            <Text style={s.exportText}>⬇ 匯出 CSV</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// Mini bar chart
function MiniTrend({ sessions }) {
  const pts = [...sessions].reverse().slice(-12);
  const max = 100, min = 0;

  return (
    <View style={t.wrap}>
      <Text style={t.label}>近期平衡分趨勢</Text>
      <View style={t.chart}>
        {pts.map((r, i) => {
          const h = ((r.score - min) / (max - min)) * 60;
          const c = r.score >= 85 ? '#22c55e'
                  : r.score >= 70 ? '#667eea'
                  : r.score >= 55 ? '#f59e0b' : '#ef4444';
          return (
            <View key={i} style={t.barWrap}>
              <View style={[t.bar, { height: h, backgroundColor: c }]}/>
              <Text style={t.barVal}>{r.score}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const t = StyleSheet.create({
  wrap:   { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e4e6f0' },
  label:  { fontSize: 11, color: '#9898b8', marginBottom: 8 },
  chart:  { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 4 },
  barWrap:{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar:    { width: '100%', borderRadius: 3 },
  barVal: { fontSize: 9, color: '#9898b8', marginTop: 2 },
});

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f4f5fb' },
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },

  card:      { backgroundColor: '#fff', borderRadius: 16,
               borderWidth: 1, borderColor: '#e4e6f0', padding: 16 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#5a5a7a',
               letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 14 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox:   { flex: 1, minWidth: '45%', backgroundColor: '#f4f5fb',
               borderRadius: 12, borderWidth: 1, borderColor: '#e4e6f0', padding: 12 },
  statLabel: { fontSize: 10.5, color: '#9898b8', marginBottom: 4 },
  statVal:   { fontSize: 24, fontWeight: '700', color: '#1a1a2e', lineHeight: 28 },
  statUnit:  { fontSize: 10, color: '#9898b8' },

  dayGroup:  { marginBottom: 14 },
  dayLabel:  { fontSize: 11.5, fontWeight: '700', color: '#9898b8',
               letterSpacing: 0.5, textTransform: 'uppercase',
               marginBottom: 6, paddingLeft: 2 },
  histRow:   { flexDirection: 'row', alignItems: 'center', gap: 10,
               padding: 10, backgroundColor: '#f4f5fb',
               borderRadius: 10, marginBottom: 5,
               borderWidth: 1, borderColor: '#e4e6f0' },
  histTime:  { fontSize: 11.5, color: '#9898b8', width: 40 },
  histInfo:  { flex: 1 },
  histType:  { fontSize: 12.5, fontWeight: '600', color: '#1a1a2e' },
  histDetail:{ fontSize: 11, color: '#9898b8', marginTop: 1 },
  badge:     { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4,
               borderRadius: 20 },
  badgeText: { fontSize: 14, fontWeight: '700', lineHeight: 17 },
  badgeGrade:{ fontSize: 10, lineHeight: 13 },

  empty:     { textAlign: 'center', padding: 20, fontSize: 13, color: '#9898b8' },
  exportBtn: { marginTop: 12, padding: 13, borderRadius: 12,
               borderWidth: 1.5, borderColor: '#e4e6f0',
               alignItems: 'center' },
  exportText:{ fontSize: 13.5, fontWeight: '600', color: '#5a5a7a' },
});
