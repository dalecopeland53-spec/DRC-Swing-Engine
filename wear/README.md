# DRC Swing Engine — Wear OS module

This folder is reserved for the native Galaxy Watch companion app.

The phone app deliberately talks to a narrow `SensorBridge` boundary. The Wear OS module will publish timestamped accelerometer/gyroscope packets into that bridge after hardware validation.

## Rules

- Watch sampling and swing detection stay native to Wear OS.
- Do not push raw 100 Hz samples directly into React state.
- Batch or throttle telemetry before crossing to the phone UI.
- Use sensor timestamps for swing timing rather than wall-clock arrival times.
- Validate thresholds from real swings before presenting them as measured golf performance.
- Keep camera analysis separate from the watch sensor pipeline.

## Packet contract

```json
{
  "timestamp": 0,
  "ax": 0,
  "ay": 0,
  "az": 0,
  "gx": 0,
  "gy": 0,
  "gz": 0
}
```

`ax/ay/az` are linear acceleration in m/s² and `gx/gy/gz` are angular velocity in rad/s.
