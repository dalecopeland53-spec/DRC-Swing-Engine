import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { C, radius } from './src/theme';
import { createSwingEngine } from './src/SwingEngine';
import { initDatabase, saveSwing, getRecentSwings, getPerformanceSummary } from './src/SwingDatabase';
import { startDemoSwing, startSensorBridge } from './src/SensorBridge';

const CLUBS = ['Driver', '3-Wood', '5-Iron', '7-Iron', '9-Iron', 'Wedge'];

export default function App() {
  const [activeClub, setActiveClub] = useState('7-Iron');
  const [paired, setPaired] = useState(false);
  const [swingState, setSwingState] = useState('ADDRESS');
  const [liveG, setLiveG] = useState(0);
  const [liveRotation, setLiveRotation] = useState(0);
  const [lastSwing, setLastSwing] = useState(null);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({ total: 0, averageTempo: 0, averageLinearG: 0, onTempoPercent: 0 });
  const engineRef = useRef(createSwingEngine(activeClub));

  const refresh = () => {
    setHistory(getRecentSwings(8));
    setSummary(getPerformanceSummary());
  };

  const handleSample = sample => {
    const result = engineRef.current.process(sample);
    setSwingState(result.state);
    if (typeof result.linearG === 'number') setLiveG(result.linearG);
    if (typeof result.rotation === 'number') setLiveRotation(result.rotation);

    if (result.event === 'SWING_COMPLETE') {
      const record = { clubTag: activeClub, metrics: result.metrics };
      saveSwing(record);
      setLastSwing(result.metrics);
      setLiveG(result.metrics.peakLinearG);
      
      // Precision Haptic Verification Signals
      if (result.metrics.verdict === 'ON TEMPO') {
        Vibration.vibrate(80); // Crisp single confirmation pulse
      } else {
        Vibration.vibrate([0, 60, 70, 60]); // Distinct corrective double pulse
      }
      refresh();
    }
  };

  useEffect(() => {
    initDatabase();
    refresh();
    const stop = startSensorBridge({ onPaired: setPaired, onSample: handleSample });
    return stop;
  }, []);

  useEffect(() => {
    engineRef.current.setClub(activeClub);
  }, [activeClub]);

  const stateMessage = useMemo(() => {
    if (swingState === 'ADDRESS') return 'Ready for takeaway';
    if (swingState === 'BACKSWING') return 'Backswing detected';
    if (swingState === 'DOWNSWING') return 'Transition locked';
    return 'Impact captured';
  }, [swingState]);

  const runDemo = () => {
    engineRef.current.reset();
    setSwingState('ADDRESS');
    startDemoSwing({ onPaired: setPaired, onSample: handleSample });
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <View style={s.brandRow}>
          <View>
            <Text style={s.eyebrow}>DRC PERFORMANCE LAB</Text>
            <Text style={s.title}>SWING ENGINE</Text>
            <Text style={s.subtitle}>S24 + Galaxy Watch swing analysis</Text>
          </View>
          <View style={[s.statusPill, paired && s.statusPillOn]}>
            <View style={[s.statusDot, paired && s.statusDotOn]} />
            <Text style={s.statusText}>{paired ? 'WATCH LINK' : 'WATCH OFFLINE'}</Text>
          </View>
        </View>

        <View style={s.hero}>
          <Text style={s.heroLabel}>LIVE SWING STATE</Text>
          <Text style={s.heroState}>{swingState}</Text>
          <Text style={s.heroHint}>{stateMessage}</Text>
          <View style={s.liveRow}>
            <Metric label="LINEAR G" value={liveG.toFixed(1)} />
            <Metric label="ROTATION" value={liveRotation.toFixed(2)} />
          </View>
        </View>

        <SectionTitle title="ACTIVE CLUB" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.clubRow}>
          {CLUBS.map(club => (
            <TouchableOpacity
              key={club}
              style={[s.clubChip, activeClub === club && s.clubChipOn]}
              onPress={() => setActiveClub(club)}
            >
              <Text style={[s.clubText, activeClub === club && s.clubTextOn]}>{club}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.actionCard}>
          <Text style={s.actionTitle}>Hardware test path</Text>
          <Text style={s.actionCopy}>
            The native Wear bridge is isolated from the analysis engine. Until the watch module is wired in, use the controlled demo swing to test the full phone pipeline safely.
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={runDemo}>
            <Text style={s.primaryBtnText}>RUN CONTROLLED DEMO SWING</Text>
          </TouchableOpacity>
        </View>

        <SectionTitle title="LAST SWING" />
        <View style={s.lastCard}>
          {lastSwing ? (
            <>
              <Text style={s.lastTempo}>{lastSwing.tempoRatio.toFixed(1)} : 1</Text>
              <Text style={[s.verdict, lastSwing.verdict === 'ON TEMPO' && s.verdictGood]}>{lastSwing.verdict}</Text>
              <View style={s.liveRow}>
                <Metric label="BACKSWING" value={`${(lastSwing.backswingMs / 1000).toFixed(2)}s`} />
                <Metric label="DOWNSWING" value={`${(lastSwing.downswingMs / 1000).toFixed(2)}s`} />
                <Metric label="PEAK G" value={lastSwing.peakLinearG.toFixed(1)} />
              </View>
            </>
          ) : (
            <Text style={s.empty}>No swing stored yet.</Text>
          )}
        </View>

        <SectionTitle title="SESSION" />
        <View style={s.summaryGrid}>
          <Stat label="SWINGS" value={summary.total} />
          <Stat label="AVG TEMPO" value={summary.total ? `${summary.averageTempo.toFixed(1)}:1` : '—'} />
          <Stat label="ON TEMPO" value={`${summary.onTempoPercent}%`} />
        </View>

        <SectionTitle title="RECENT SWINGS" />
        <View style={s.historyCard}>
          {history.length === 0 ? (
            <Text style={s.empty}>History will appear here.</Text>
          ) : history.map(row => (
            <View key={row.id} style={s.historyRow}>
              <View>
                <Text style={s.historyClub}>{row.club_tag}</Text>
                <Text style={s.historyTime}>{new Date(row.timestamp).toLocaleTimeString()}</Text>
              </View>
              <Text style={s.historyTempo}>{Number(row.tempo_ratio).toFixed(1)}:1</Text>
              <Text style={[s.historyVerdict, row.verdict === 'ON TEMPO' && s.verdictGood]}>{row.verdict}</Text>
            </View>
          ))}
        </View>

        <Text style={s.footer}>DRC · matte anti-glare training interface · build 0.1</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }) {
  return <Text style={s.section}>{title}</Text>;
}

function Metric({ label, value }) {
  return (
    <View style={s.metric}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  page: { padding: 18, paddingBottom: 36 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  eyebrow: { color: C.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: 1.2, marginTop: 2 },
  subtitle: { color: C.muted, fontSize: 12, marginTop: 3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg2, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 },
  statusPillOn: { borderColor: C.green },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.muted },
  statusDotOn: { backgroundColor: C.green },
  statusText: { color: C.champagne, fontSize: 9, fontWeight: '900' },
  hero: { backgroundColor: C.panel, borderRadius: radius.lg, padding: 22, borderWidth: 1, borderColor: C.line, alignItems: 'center', marginVertical: 10 },
  heroLabel: { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroState: { color: C.text, fontSize: 36, fontWeight: '950', marginVertical: 6 },
  heroHint: { color: C.muted, fontSize: 14, marginBottom: 16, fontWeight: '600' },
  liveRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 10 },
  metric: { alignItems: 'center', minWidth: 80 },
  metricValue: { color: C.text, fontSize: 20, fontWeight: '800' },
  metricLabel: { color: C.muted, fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  section: { color: C.gold, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, marginTop: 20, marginBottom: 10 },
  clubRow: { paddingVertical: 4 },
  clubChip: { backgroundColor: C.panel, borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, borderWidth: 1, borderColor: C.line },
  clubChipOn: { backgroundColor: C.gold, borderColor: C.gold },
  clubText: { color: C.text, fontSize: 13, fontWeight: '700' },
  clubTextOn: { color: C.bg, fontWeight: '900' },
  actionCard: { backgroundColor: C.panel, borderRadius: radius.md, padding: 16, marginVertical: 14, borderWidth: 1, borderColor: C.line },
  actionTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  actionCopy: { color: C.muted, fontSize: 12, marginVertical: 8, lineHeight: 16 },
  primaryBtn: { backgroundColor: C.text, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
