let timer = null;
let paired = false;

export function startSensorBridge({ onPaired, onSample }) {
  paired = false;
  onPaired?.(false);

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}

export function stopSensorBridge() {
  if (timer) clearInterval(timer);
  timer = null;
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
  return false;
}
