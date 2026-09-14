package com.dalecopeland.drcswingengine

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.android.gms.wearable.Node
import com.google.android.gms.wearable.Wearable
import org.json.JSONArray
import org.json.JSONObject

private data class SwingSample(
    val ax: Float,
    val ay: Float,
    val az: Float,
    val gx: Float,
    val gy: Float,
    val gz: Float,
    val timestamp: Long
)

class MainActivity : ComponentActivity(), SensorEventListener {
    private lateinit var sensorManager: SensorManager
    private var linear: Sensor? = null
    private var gyro: Sensor? = null
    private var latestGyro = floatArrayOf(0f, 0f, 0f)
    private val batch = ArrayList<SwingSample>(5)
    private var targetNode: Node? = null

    private var streaming by mutableStateOf(false)
    private var linkText by mutableStateOf("Finding phone")
    private var sampleCount by mutableStateOf(0L)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sensorManager = getSystemService(SENSOR_SERVICE) as SensorManager
        linear = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)
        gyro = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
        discoverPhone()

        setContent {
            MaterialTheme {
                WatchScreen(
                    linkText = linkText,
                    streaming = streaming,
                    sampleCount = sampleCount,
                    sensorsReady = linear != null && gyro != null,
                    onToggle = { if (streaming) stopStreaming() else startStreaming() }
                )
            }
        }
    }

    private fun discoverPhone() {
        Wearable.getNodeClient(this).connectedNodes
            .addOnSuccessListener { nodes ->
                targetNode = nodes.firstOrNull { it.isNearby } ?: nodes.firstOrNull()
                linkText = if (targetNode == null) "Phone not connected" else "Phone connected"
                targetNode?.let { sendJson(JSONObject().put("type", "watch_hello"), it) }
            }
            .addOnFailureListener { linkText = "Phone link error" }
    }

    private fun startStreaming() {
        if (linear == null || gyro == null) {
            linkText = "Sensors unavailable"
            return
        }
        if (targetNode == null) {
            discoverPhone()
            return
        }

        batch.clear()
        sampleCount = 0
        sensorManager.registerListener(this, gyro, 10_000)
        sensorManager.registerListener(this, linear, 10_000)
        streaming = true
        targetNode?.let {
            sendJson(JSONObject().put("type", "watch_status").put("status", "STREAMING"), it)
        }
    }

    private fun stopStreaming() {
        sensorManager.unregisterListener(this)
        flushBatch()
        streaming = false
        targetNode?.let {
            sendJson(JSONObject().put("type", "watch_status").put("status", "READY"), it)
        }
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (!streaming) return
        when (event.sensor.type) {
            Sensor.TYPE_GYROSCOPE -> {
                latestGyro = floatArrayOf(event.values[0], event.values[1], event.values[2])
            }
            Sensor.TYPE_LINEAR_ACCELERATION -> {
                batch.add(
                    SwingSample(
                        ax = event.values[0], ay = event.values[1], az = event.values[2],
                        gx = latestGyro[0], gy = latestGyro[1], gz = latestGyro[2],
                        timestamp = event.timestamp / 1_000_000L
                    )
                )
                sampleCount += 1
                if (batch.size >= 5) flushBatch()
            }
        }
    }

    private fun flushBatch() {
        if (batch.isEmpty()) return
        val node = targetNode ?: return
        val samplesJson = JSONArray()
        batch.forEach { s ->
            samplesJson.put(
                JSONObject()
                    .put("ax", s.ax).put("ay", s.ay).put("az", s.az)
                    .put("gx", s.gx).put("gy", s.gy).put("gz", s.gz)
                    .put("timestamp", s.timestamp)
            )
        }
        val payload = JSONObject()
            .put("type", "swing_samples")
            .put("samples", samplesJson)
        batch.clear()
        sendJson(payload, node)
    }

    private fun sendJson(payload: JSONObject, node: Node) {
        // react-native-wear-connectivity reads the JSON payload from MessageClient.path.
        Wearable.getMessageClient(this).sendMessage(node.id, payload.toString(), null)
            .addOnFailureListener {
                linkText = "Link interrupted"
                targetNode = null
            }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    override fun onPause() {
        if (streaming) stopStreaming()
        super.onPause()
    }
}

@Composable
private fun WatchScreen(
    linkText: String,
    streaming: Boolean,
    sampleCount: Long,
    sensorsReady: Boolean,
    onToggle: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(18.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("DRC", fontWeight = FontWeight.Black)
        Text("SWING ENGINE", fontWeight = FontWeight.Bold)
        Text(linkText, modifier = Modifier.padding(top = 8.dp))
        Text(if (sensorsReady) "Sensors ready" else "Sensors missing")
        if (streaming) Text("$sampleCount samples")
        Button(
            onClick = onToggle,
            enabled = sensorsReady,
            modifier = Modifier.padding(top = 12.dp)
        ) {
            Text(if (streaming) "STOP" else "START SWING")
        }
    }
}
