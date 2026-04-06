import Foundation
import MultipeerConnectivity
import React

/// MultipeerConnectivity bridge; same JS API / events as Android QuantumNearbyModule.
@objc(QuantumNearbyModule)
class QuantumNearbyModule: RCTEventEmitter, MCNearbyServiceAdvertiserDelegate, MCNearbyServiceBrowserDelegate, MCSessionDelegate {
  private let serviceType = "qgrasp-qnet"
  private let appServiceId = "com.anonymous.quantumgrasp.qnet"

  private var mcSession: MCSession?
  private var advertiser: MCNearbyServiceAdvertiser?
  private var browser: MCNearbyServiceBrowser?
  private var discoveredPeers: [String: MCPeerID] = [:]

  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func supportedEvents() -> [String]! {
    [
      "QuantumNearby_endpointFound",
      "QuantumNearby_endpointLost",
      "QuantumNearby_connectionInitiated",
      "QuantumNearby_connectionResult",
      "QuantumNearby_disconnected",
      "QuantumNearby_payloadReceived",
    ]
  }

  @objc
  func addListener(_ eventName: String) {}

  @objc
  func removeListeners(_ count: Double) {}

  private func ensureSession(displayName: String) -> MCSession {
    if let s = mcSession, s.myPeerID.displayName == displayName {
      return s
    }
    let peer = MCPeerID(displayName: displayName)
    let s = MCSession(peer: peer, securityIdentity: nil, encryptionPreference: .required)
    s.delegate = self
    mcSession = s
    return s
  }

  @objc(startAdvertising:resolver:rejecter:)
  func startAdvertising(_ endpointName: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.stopBrowsingAndAdvertising()
      self.discoveredPeers.removeAll()
      let sess = self.ensureSession(displayName: endpointName)
      let adv = MCNearbyServiceAdvertiser(
        peer: sess.myPeerID,
        discoveryInfo: ["serviceId": self.appServiceId],
        serviceType: self.serviceType
      )
      adv.delegate = self
      adv.startAdvertisingPeer()
      self.advertiser = adv
      resolve(nil)
    }
  }

  @objc(stopAdvertising:rejecter:)
  func stopAdvertising(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.advertiser?.stopAdvertisingPeer()
      self.advertiser = nil
      resolve(nil)
    }
  }

  @objc(startDiscovery:rejecter:)
  func startDiscovery(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let sess = self.mcSession else {
        reject("E_DISCOVERY", "Set your display name first (ensureSessionWithName).", nil)
        return
      }
      self.browser?.stopBrowsingForPeers()
      self.discoveredPeers.removeAll()
      let br = MCNearbyServiceBrowser(peer: sess.myPeerID, serviceType: self.serviceType)
      br.delegate = self
      br.startBrowsingForPeers()
      self.browser = br
      resolve(nil)
    }
  }

  @objc(stopDiscovery:rejecter:)
  func stopDiscovery(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.browser?.stopBrowsingForPeers()
      self.browser = nil
      resolve(nil)
    }
  }

  @objc(ensureSessionWithName:resolver:rejecter:)
  func ensureSessionWithName(_ name: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      _ = self.ensureSession(displayName: name)
      resolve(nil)
    }
  }

  @objc(requestConnection:endpointId:resolver:rejecter:)
  func requestConnection(_ endpointName: String, endpointId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      _ = self.ensureSession(displayName: endpointName)
      guard let browser = self.browser else {
        reject("E_REQUEST", "Discovery not started", nil)
        return
      }
      guard let target = self.discoveredPeers[endpointId] else {
        reject("E_REQUEST", "Peer not found — wait for discovery", nil)
        return
      }
      browser.invitePeer(target, to: self.mcSession!, withContext: nil, timeout: 30)
      resolve(nil)
    }
  }

  @objc(disconnect:resolver:rejecter:)
  func disconnect(_ endpointId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let sess = self.mcSession else {
        resolve(nil)
        return
      }
      if let p = sess.connectedPeers.first(where: { $0.displayName == endpointId }) {
        sess.cancelConnectPeer(p)
      }
      resolve(nil)
    }
  }

  @objc(disconnectAll:rejecter:)
  func disconnectAll(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.stopBrowsingAndAdvertising()
      self.mcSession?.disconnect()
      self.mcSession = nil
      self.discoveredPeers.removeAll()
      resolve(nil)
    }
  }

  @objc(sendPayload:base64:resolver:rejecter:)
  func sendPayload(_ endpointId: String, base64: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let sess = self.mcSession,
            let data = Data(base64Encoded: base64),
            let peer = sess.connectedPeers.first(where: { $0.displayName == endpointId }) else {
        reject("E_SEND", "Peer not connected", nil)
        return
      }
      do {
        try sess.send(data, toPeers: [peer], with: .reliable)
        resolve(nil)
      } catch {
        reject("E_SEND", error.localizedDescription, error)
      }
    }
  }

  @objc(getServiceId:rejecter:)
  func getServiceId(_ resolve: RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(appServiceId)
  }

  private func stopBrowsingAndAdvertising() {
    advertiser?.stopAdvertisingPeer()
    advertiser = nil
    browser?.stopBrowsingForPeers()
    browser = nil
  }

  func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
    guard let sess = mcSession else {
      invitationHandler(false, nil)
      return
    }
    sendEvent(withName: "QuantumNearby_connectionInitiated", body: [
      "endpointId": peerID.displayName,
      "endpointName": peerID.displayName,
      "incoming": true,
    ])
    invitationHandler(true, sess)
  }

  func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
    discoveredPeers[peerID.displayName] = peerID
    sendEvent(withName: "QuantumNearby_endpointFound", body: [
      "endpointId": peerID.displayName,
      "endpointName": peerID.displayName,
      "serviceId": info?["serviceId"] ?? appServiceId,
    ])
  }

  func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
    discoveredPeers.removeValue(forKey: peerID.displayName)
    sendEvent(withName: "QuantumNearby_endpointLost", body: [
      "endpointId": peerID.displayName,
    ])
  }

  func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
    switch state {
    case .connected:
      sendEvent(withName: "QuantumNearby_connectionResult", body: [
        "endpointId": peerID.displayName,
        "status": 0,
        "success": true,
      ])
    case .notConnected:
      sendEvent(withName: "QuantumNearby_disconnected", body: [
        "endpointId": peerID.displayName,
      ])
    case .connecting:
      sendEvent(withName: "QuantumNearby_connectionInitiated", body: [
        "endpointId": peerID.displayName,
        "endpointName": peerID.displayName,
        "incoming": false,
      ])
    @unknown default:
      break
    }
  }

  func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
    sendEvent(withName: "QuantumNearby_payloadReceived", body: [
      "endpointId": peerID.displayName,
      "base64": data.base64EncodedString(),
    ])
  }

  func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}

  func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}

  func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}
