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
      Vibration.vibrate(result.metrics.verdict === 'ON TEMPO' ? 80 : [0, 60, 70, 60]);
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
  hero: { backgroundColor: C.panel, borderRadius: radius.lg, padding: 22, borderWidth: 1, borderColor: C.line, marginBottom: 18 },
  heroLabel: { color: C.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
  heroState: { color: C.text, fontSize: 42, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  heroHint: { color: C.blue2, fontSize: 13, textAlign: 'center', marginTop: 2 },
  liveRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  metric: { flex: 1, backgroundColor: C.bg2, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: C.line, alignItems: 'center' },
  metricValue: { color: C.champagne2, fontSize: 19, fontWeight: '900' },
  metricLabel: { color: C.muted, fontSize: 9, fontWeight: '800', marginTop: 4, letterSpacing: 1 },
  section: { color: C.champagne, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginTop: 7, marginBottom: 9 },
  clubRow: { paddingBottom: 6 },
  clubChip: { backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 99, marginRight: 8 },
  clubChipOn: { backgroundColor: C.champagne, borderColor: C.champagne },
  clubText: { color: C.champagne, fontSize: 12, fontWeight: '800' },
  clubTextOn: { color: C.black },
  actionCard: { marginTop: 13, backgroundColor: C.panel, borderRadius: radius.lg, padding: 17, borderWidth: 1, borderColor: C.line },
  actionTitle: { color: C.text, fontSize: 16, fontWeight: '900' },
  actionCopy: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  primaryBtn: { backgroundColor: C.gold, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', marginTop: 14 },
  primaryBtnText: { color: C.black, fontSize: 12, fontWeight: '900', letterSpacing: .6 },
  lastCard: { backgroundColor: C.panel, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: C.line },
  lastTempo: { color: C.text, fontSize: 44, fontWeight: '900', textAlign: 'center' },
  verdict: { color: C.gold, textAlign: 'center', fontSize: 12, fontWeight: '900', marginTop: 2 },
  verdictGood: { color: C.green },
  empty: { color: C.muted, fontSize: 13, textAlign: 'center', paddingVertical: 14 },
  summaryGrid: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, backgroundColor: C.panel2, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: C.line, alignItems: 'center' },
  statValue: { color: C.text, fontSize: 20, fontWeight: '900' },
  statLabel: { color: C.muted, fontSize: 9, fontWeight: '900', letterSpacing: .8, marginTop: 3 },
  historyCard: { backgroundColor: C.panel, borderRadius: radius.lg, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line },
  historyRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, gap: 10 },
  historyClub: { color: C.champagne2, fontSize: 13, fontWeight: '900', width: 76 },
  historyTime: { color: C.muted, fontSize: 9, marginTop: 2 },
  historyTempo: { flex: 1, color: C.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  historyVerdict: { width: 110, color: C.gold, fontSize: 9, fontWeight: '900', textAlign: 'right' },
  footer: { color: C.muted, fontSize: 9, textAlign: 'center', marginTop: 24, opacity: .8 }
});
