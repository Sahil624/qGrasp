package com.anonymous.quantumgrasp

import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.Strategy

/**
 * Google Nearby Connections bridge for classroom multiplayer.
 * JS reads this as NativeModules.QuantumNearby (see getName()).
 */
class QuantumNearbyModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    private val tag = "QuantumNearby"
    private val connectionsClient = Nearby.getConnectionsClient(reactContext.applicationContext)
    private val serviceId = "com.anonymous.quantumgrasp.qnet"

    private var advertising = false
    private var discovering = false

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            val body = payload.asBytes() ?: return
            val map = Arguments.createMap()
            map.putString("endpointId", endpointId)
            map.putString("base64", Base64.encodeToString(body, Base64.NO_WRAP))
            emit("QuantumNearby_payloadReceived", map)
        }

        override fun onPayloadTransferUpdate(
            endpointId: String,
            update: com.google.android.gms.nearby.connection.PayloadTransferUpdate
        ) {
        }
    }

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            val map = Arguments.createMap()
            map.putString("endpointId", endpointId)
            map.putString("endpointName", info.endpointName)
            map.putBoolean("incoming", info.isIncomingConnection)
            emit("QuantumNearby_connectionInitiated", map)
            connectionsClient.acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, resolution: ConnectionResolution) {
            val map = Arguments.createMap()
            map.putString("endpointId", endpointId)
            map.putInt("status", resolution.status.statusCode)
            map.putBoolean(
                "success",
                resolution.status.statusCode == ConnectionsStatusCodes.STATUS_OK
            )
            emit("QuantumNearby_connectionResult", map)
        }

        override fun onDisconnected(endpointId: String) {
            val map = Arguments.createMap()
            map.putString("endpointId", endpointId)
            emit("QuantumNearby_disconnected", map)
        }
    }

    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            val map = Arguments.createMap()
            map.putString("endpointId", endpointId)
            map.putString("endpointName", info.endpointName)
            map.putString("serviceId", serviceId)
            emit("QuantumNearby_endpointFound", map)
        }

        override fun onEndpointLost(endpointId: String) {
            val map = Arguments.createMap()
            map.putString("endpointId", endpointId)
            emit("QuantumNearby_endpointLost", map)
        }
    }

    init {
        reactContext.addLifecycleEventListener(this)
    }

    override fun getName(): String = "QuantumNearby"

    private fun emit(event: String, params: WritableMap?) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(event, params)
        } catch (e: Exception) {
            Log.w(tag, "emit failed: $event", e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
    }

    @ReactMethod
    fun removeListeners(count: Int) {
    }

    @ReactMethod
    fun startAdvertising(endpointName: String, promise: Promise) {
        if (advertising) {
            promise.resolve(null)
            return
        }
        val options = AdvertisingOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build()
        connectionsClient
            .startAdvertising(
                endpointName,
                serviceId,
                connectionLifecycleCallback,
                options
            )
            .addOnSuccessListener {
                advertising = true
                promise.resolve(null)
            }
            .addOnFailureListener { e ->
                Log.e(tag, "startAdvertising", e)
                promise.reject("E_ADVERTISE", e.message, e)
            }
    }

    @ReactMethod
    fun stopAdvertising(promise: Promise) {
        if (!advertising) {
            promise.resolve(null)
            return
        }
        // stopAdvertising / stopDiscovery / disconnectFromEndpoint / stopAllEndpoints are void (not Task).
        try {
            connectionsClient.stopAdvertising()
            advertising = false
            promise.resolve(null)
        } catch (e: Exception) {
            advertising = false
            promise.reject("E_STOP_ADVERTISE", e.message, e)
        }
    }

    @ReactMethod
    fun startDiscovery(promise: Promise) {
        if (discovering) {
            promise.resolve(null)
            return
        }
        val options = DiscoveryOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build()
        connectionsClient
            .startDiscovery(serviceId, endpointDiscoveryCallback, options)
            .addOnSuccessListener {
                discovering = true
                promise.resolve(null)
            }
            .addOnFailureListener { e ->
                Log.e(tag, "startDiscovery", e)
                promise.reject("E_DISCOVERY", e.message, e)
            }
    }

    @ReactMethod
    fun stopDiscovery(promise: Promise) {
        if (!discovering) {
            promise.resolve(null)
            return
        }
        try {
            connectionsClient.stopDiscovery()
            discovering = false
            promise.resolve(null)
        } catch (e: Exception) {
            discovering = false
            promise.reject("E_STOP_DISCOVERY", e.message, e)
        }
    }

    @ReactMethod
    fun requestConnection(endpointName: String, endpointId: String, promise: Promise) {
        connectionsClient
            .requestConnection(endpointName, endpointId, connectionLifecycleCallback)
            .addOnSuccessListener { promise.resolve(null) }
            .addOnFailureListener { e ->
                Log.e(tag, "requestConnection", e)
                promise.reject("E_REQUEST", e.message, e)
            }
    }

    @ReactMethod
    fun disconnect(endpointId: String, promise: Promise) {
        try {
            connectionsClient.disconnectFromEndpoint(endpointId)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_DISCONNECT", e.message, e)
        }
    }

    @ReactMethod
    fun disconnectAll(promise: Promise) {
        try {
            connectionsClient.stopAllEndpoints()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_DISCONNECT_ALL", e.message, e)
        }
    }

    @ReactMethod
    fun sendPayload(endpointId: String, base64: String, promise: Promise) {
        try {
            val bytes = Base64.decode(base64, Base64.NO_WRAP)
            val payload = Payload.fromBytes(bytes)
            connectionsClient
                .sendPayload(endpointId, payload)
                .addOnSuccessListener { promise.resolve(null) }
                .addOnFailureListener { e ->
                    promise.reject("E_SEND", e.message, e)
                }
        } catch (e: Exception) {
            promise.reject("E_SEND", e.message, e)
        }
    }

    @ReactMethod
    fun ensureSessionWithName(name: String, promise: Promise) {
        promise.resolve(null)
    }

    @ReactMethod
    fun getServiceId(promise: Promise) {
        promise.resolve(serviceId)
    }

    override fun onHostResume() {}

    override fun onHostPause() {}

    override fun onHostDestroy() {
        try {
            connectionsClient.stopAdvertising()
            connectionsClient.stopDiscovery()
            connectionsClient.stopAllEndpoints()
        } catch (_: Exception) {
        }
        advertising = false
        discovering = false
    }
}
