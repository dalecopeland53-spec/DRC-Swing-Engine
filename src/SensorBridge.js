let timer = null;
let wearUnsubscribe = null;
let paired = false;

function normalizePayload(message) {
  if (!message) return null;
  if (typeof message === 'string') {
    try { return JSON.parse(message); } catch { return null; }
  }
  if (typeof message === 'object') {
    if (typeof message.message === 'string') {
      try { return JSON.parse(message.message); } catch { return message; }
    }
    return message;
  }
  return null;
}

function emitSamples(payload, onSample) {
  if (!payload) return;

  if (payload.type === 'swing_samples' && Array.isArray(payload.samples)) {
    payload.samples.forEach(sample => {
      if (
        Number.isFinite(Number(sample.ax)) &&
        Number.isFinite(Number(sample.ay)) &&
        Number.isFinite(Number(sample.az)) &&
        Number.isFinite(Number(sample.gx)) &&
        Number.isFinite(Number(sample.gy)) &&
        Number.isFinite(Number(sample.gz))
      ) {
        onSample?.({
          ax: Number(sample.ax), ay: Number(sample.ay), az: Number(sample.az),
          gx: Number(sample.gx), gy: Number(sample.gy), gz: Number(sample.gz),
          timestamp: Number(sample.timestamp) || Date.now()
        });
      }
    });
    return;
  }

  if (payload.type === 'swing_sample') {
    onSample?.({
      ax: Number(payload.ax) || 0,
      ay: Number(payload.ay) || 0,
      az: Number(payload.az) || 0,
      gx: Number(payload.gx) || 0,
      gy: Number(payload.gy) || 0,
      gz: Number(payload.gz) || 0,
      timestamp: Number(payload.timestamp) || Date.now()
    });
  }
}

export function startSensorBridge({ onPaired, onSample, onStatus }) {
  paired = false;
  onPaired?.(false);
  onStatus?.('WAITING_FOR_WATCH');

  try {
    const { watchEvents } = require('react-native-wear-connectivity');
    wearUnsubscribe = watchEvents.on('message', message => {
      const payload = normalizePayload(message);
      if (!payload) return;

      if (!paired) {
        paired = true;
        onPaired?.(true);
      }

      if (payload.type === 'watch_hello') {
        onStatus?.('WATCH_CONNECTED');
        return;
      }

      if (payload.type === 'watch_status') {
        onStatus?.(payload.status || 'WATCH_CONNECTED');
        return;
      }

      emitSamples(payload, onSample);
    });
    onStatus?.('BRIDGE_READY');
  } catch (error) {
    onStatus?.('NATIVE_BRIDGE_UNAVAILABLE');
  }

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
    if (wearUnsubscribe) wearUnsubscribe();
    wearUnsubscribe = null;
  };
}

export function stopSensorBridge() {
  if (timer) clearInterval(timer);
  timer = null;
  if (wearUnsubscribe) wearUnsubscribe();
  wearUnsubscribe = null;
}

export function startDemoSwing({ onPaired, onSample }) {
  if (timer) clearInterval(timer);
  paired = true;
  onPaired?.(true);

  const sequence = [];
  const push = (count, values) => {
    for (let i = 0; i < count; i += 1) sequence.push({ ...values });
  };

  push(10, { ax: 0.05, ay: 0.04, az: 0.03, gx: 0.1, gy: 0.1, gz: 0.1 });
  push(14, { ax: 2.2, ay: 1.1, az: 0.8, gx: 1.2, gy: 0.9, gz: 0.5 });
  push(4, { ax: 1.0, ay: 0.5, az: 0.4, gx: 0.2, gy: 0.2, gz: 0.15 });
  push(5, { ax: 7.0, ay: 4.0, az: 2.0, gx: 2.5, gy: 1.6, gz: 1.0 });
  push(1, { ax: 85.0, ay: 22.0, az: 10.0, gx: 4.0, gy: 2.2, gz: 1.2 });
  push(12, { ax: 2.0, ay: 1.0, az: 0.5, gx: 0.6, gy: 0.4, gz: 0.2 });

  let index = 0;
  timer = setInterval(() => {
    if (index >= sequence.length) {
      clearInterval(timer);
      timer = null;
      return;
    }
    onSample?.({ ...sequence[index], timestamp: Date.now() });
    index += 1;
  }, 50);
}

export function isNativeWearBridgeReady() {
  try {
    require('react-native-wear-connectivity');
    return true;
  } catch {
    return false;
  }
}
