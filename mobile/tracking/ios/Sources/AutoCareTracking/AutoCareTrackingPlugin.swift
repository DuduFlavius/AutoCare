import Foundation
import Capacitor
import CoreLocation
import UIKit

private final class NativeTracker: NSObject, CLLocationManagerDelegate {
    static let shared = NativeTracker()
    let manager = CLLocationManager()
    var state: [String: Any]
    var pending: ((Error?) -> Void)?
    override init() {
        state = UserDefaults.standard.dictionary(forKey: "autocare-gps-trip-v1") ?? [:]
        super.init()
        // iOS force-quit is a stop; never restart location silently on next launch.
        if state["active"] as? Bool == true { state["active"] = false; state["endedAt"] = state["updatedAt"]; stop() }
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.activityType = .automotiveNavigation
        manager.distanceFilter = kCLDistanceFilterNone
        manager.pausesLocationUpdatesAutomatically = false
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
    }
    func persist() {
        UserDefaults.standard.set(state, forKey: "autocare-gps-trip-v1")
        if let owner = state["ownerId"] as? String { UserDefaults.standard.set(state, forKey: "autocare-gps-owner-v1-"+owner) }
    }
    func forOwner(_ owner: String) -> [String: Any] { if state["ownerId"] as? String == owner { var result = state; result["lastFixAt"] = UserDefaults.standard.double(forKey: "autocare-gps-fix-at"); return result }; return UserDefaults.standard.dictionary(forKey: "autocare-gps-owner-v1-"+owner) ?? [:] }
    func begin(_ completion: @escaping (Error?) -> Void) {
        pending = completion
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestAlwaysAuthorization()
        case .authorizedAlways, .authorizedWhenInUse: activate()
        default: failPermission()
        }
    }
    func activate() {
        guard manager.accuracyAuthorization == .fullAccuracy else { failPermission(); return }
        state["active"] = true; state.removeValue(forKey: "endedAt"); persist()
        manager.startUpdatingLocation()
        let resolve = pending; pending = nil; resolve?(nil)
    }
    func failPermission() {
        stop(); let resolve = pending; pending = nil
        resolve?(NSError(domain: "AutoCareGPS", code: 1, userInfo: [NSLocalizedDescriptionKey: "Permite localizarea precisă în setările telefonului."]))
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if pending != nil {
            if manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse { activate() }
            else if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted { failPermission() }
        } else if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted { stop() }
    }
    func stop() {
        manager.stopUpdatingLocation()
        if !state.isEmpty {
            if state["automatic"] as? Bool == true, let disconnected = state["disconnectedAt"] as? Double {
                state["distance"] = state["disconnectDistance"] ?? 0.0; state["points"] = state["disconnectPoints"] ?? [[String: Any]](); state["endedAt"] = disconnected
            } else if state["active"] as? Bool == true { state["endedAt"] = Date().timeIntervalSince1970*1000 }
            for key in ["stopAt", "disconnectedAt", "disconnectDistance", "disconnectPoints"] { state.removeValue(forKey: key) }
            state["active"] = false; AutoDriveState.enqueue(state); persist()
        }
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { if (error as? CLError)?.code == .denied { stop() } }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard state["active"] as? Bool == true else { return }
        if let at = state["stopAt"] as? Double, Date().timeIntervalSince1970*1000 >= at { stop(); return }
        for location in locations {
            let now = Date().timeIntervalSince1970 * 1000, timestamp = location.timestamp.timeIntervalSince1970 * 1000
            guard location.horizontalAccuracy >= 0, location.horizontalAccuracy <= 50, timestamp <= now+5000, now-timestamp <= 15000 else { continue }
            UserDefaults.standard.set(now, forKey: "autocare-gps-fix-at")
            var points = state["points"] as? [[String: Any]] ?? []
            var gap = points.isEmpty, meters = 0.0
            if let previous = points.last, let lat = previous["latitude"] as? Double, let lon = previous["longitude"] as? Double, let time = previous["timestamp"] as? Double, let accuracy = previous["accuracy"] as? Double {
                let seconds = (timestamp-time)/1000
                if seconds <= 0 { continue }; gap = seconds > 45
                if !gap {
                    meters = location.distance(from: CLLocation(latitude: lat, longitude: lon))
                    if (location.speed >= 0 && (location.speed < 0.7 || location.speed > 55)) || meters/seconds > 55 || meters < max(8, min(35, accuracy+location.horizontalAccuracy)) { continue }
                }
            }
            if points.count >= 1500 { points.removeFirst(points.count-1499) }
            points.append(["latitude": location.coordinate.latitude, "longitude": location.coordinate.longitude, "accuracy": location.horizontalAccuracy, "timestamp": timestamp, "breakBefore": gap])
            state["points"] = points; state["distance"] = (state["distance"] as? Double ?? 0) + (gap ? 0 : meters); state["updatedAt"] = now; persist()
        }
    }
}

@objc(AutoCareTrackingPlugin)
public class AutoCareTrackingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AutoCareTrackingPlugin"
    public let jsName = "AutoCareTracking"
    public let pluginMethods: [CAPPluginMethod] = ["snapshot", "start", "stop", "clear", "automationStatus", "configureAutomation", "disableAutomation", "openLocationSettings", "pendingTrips", "acknowledgeTrips", "updateAutomationVehicle"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private func owned(_ call: CAPPluginCall) -> Bool { NativeTracker.shared.state["ownerId"] as? String == call.getString("ownerId") }
    @objc func snapshot(_ call: CAPPluginCall) { DispatchQueue.main.async { call.resolve(NativeTracker.shared.forOwner(call.getString("ownerId") ?? "")) } }
    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let tracker = NativeTracker.shared
            guard let owner = call.getString("ownerId"), !owner.isEmpty, let vehicle = call.getString("vehicleId"), let id = call.getString("id"), let baseline = call.getInt("baseline"), baseline >= 0 else { call.reject("Invalid GPS trip"); return }
            if tracker.state["ownerId"] as? String != owner {
                guard tracker.state["active"] as? Bool != true else { call.reject("O altă urmărire este deja activă pe acest dispozitiv."); return }
                tracker.state = tracker.forOwner(owner)
            }
            if tracker.state["automatic"] as? Bool == true && tracker.state["active"] as? Bool != true { call.reject("Traseul automat așteaptă sincronizarea. Deschide AutoDrive."); return }
            if !tracker.state.isEmpty {
                guard self.owned(call), tracker.state["id"] as? String == id else { call.reject("Salvează sau șterge traseul existent înainte de altă urmărire."); return }
            } else {
                let now = Date().timeIntervalSince1970 * 1000
                tracker.state = ["id": id, "ownerId": owner, "vehicleId": vehicle, "baseline": baseline, "startedAt": now, "updatedAt": now, "active": false, "distance": 0.0, "points": [[String: Any]]()]
            }
            tracker.begin { error in if let error = error { call.reject(error.localizedDescription) } else { call.resolve(tracker.state) } }
        }
    }
    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { guard self.owned(call) || NativeTracker.shared.state.isEmpty else { call.resolve(NativeTracker.shared.forOwner(call.getString("ownerId") ?? "")); return }; if NativeTracker.shared.state["automatic"] as? Bool == true, let vehicle = NativeTracker.shared.state["vehicleId"] as? String { UserDefaults.standard.set(true, forKey: "autocare-auto-suppressed-"+vehicle) }; NativeTracker.shared.stop(); call.resolve(NativeTracker.shared.state) }
    }
    @objc func clear(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let tracker = NativeTracker.shared, owner = call.getString("ownerId") ?? ""
            guard tracker.forOwner(owner)["active"] as? Bool != true else { call.reject("Stop GPS before clearing"); return }
            if self.owned(call) { tracker.state = [:]; tracker.persist() }
            UserDefaults.standard.removeObject(forKey: "autocare-gps-owner-v1-"+owner)
            call.resolve()
        }
    }

    @MainActor public static func automationVehicles() -> [[String: String]] {
        AutoDriveState.bindings.compactMap { id,value in guard value["enabled"] as? Bool == true, value["ownerId"] as? String == AutoDriveState.owner else { return nil }; return ["id": id, "name": value["vehicleName"] as? String ?? "AutoCare"] }
    }
    @MainActor public static func startAutomatic(vehicleId: String) throws {
        let tracker = NativeTracker.shared
        if UserDefaults.standard.bool(forKey: "autocare-auto-suppressed-"+vehicleId) { return }
        guard let config = AutoDriveState.bindings[vehicleId], config["enabled"] as? Bool == true, let owner = config["ownerId"] as? String, owner == AutoDriveState.owner, !owner.isEmpty else { throw AutoDriveState.error("Configurează mașina în AutoCare înainte de automatizare.") }
        guard tracker.manager.authorizationStatus == .authorizedAlways, tracker.manager.accuracyAuthorization == .fullAccuracy else { throw AutoDriveState.error("Permite localizarea Întotdeauna și locația precisă din setări.") }
        guard AutoDriveState.pending(owner).count < 200 else { throw AutoDriveState.error("Deschide AutoCare pentru sincronizarea traseelor.") }
        if tracker.state["active"] as? Bool == true {
            guard tracker.state["automatic"] as? Bool == true, tracker.state["vehicleId"] as? String == vehicleId else { throw AutoDriveState.error("Există deja un traseu activ.") }
            for key in ["stopAt", "disconnectedAt", "disconnectDistance", "disconnectPoints"] { tracker.state.removeValue(forKey: key) }; tracker.persist(); return
        }
        if !tracker.state.isEmpty && tracker.state["automatic"] as? Bool != true { throw AutoDriveState.error("Salvează traseul manual înainte de pornirea automată.") }
        let now = Date().timeIntervalSince1970*1000
        tracker.state = ["id": UUID().uuidString.lowercased(), "ownerId": owner, "vehicleId": vehicleId, "baseline": config["baseline"] as? Int ?? 0, "startedAt": now, "updatedAt": now, "distance": 0.0, "active": true, "automatic": true, "points": [[String: Any]]()]
        tracker.activate()
    }
    @MainActor public static func stopAutomatic(vehicleId: String) {
        UserDefaults.standard.removeObject(forKey: "autocare-auto-suppressed-"+vehicleId)
        let tracker = NativeTracker.shared
        guard tracker.state["automatic"] as? Bool == true, tracker.state["vehicleId"] as? String == vehicleId, tracker.state["ownerId"] as? String == AutoDriveState.owner, tracker.state["active"] as? Bool == true else { return }
        if tracker.state["stopAt"] != nil { return }
        let now = Date().timeIntervalSince1970*1000, deadline = now+AutoDriveState.stopDelay
        tracker.state["stopAt"] = deadline; tracker.state["disconnectedAt"] = now; tracker.state["disconnectDistance"] = tracker.state["distance"]; tracker.state["disconnectPoints"] = tracker.state["points"]; tracker.persist()
        DispatchQueue.main.asyncAfter(deadline: .now()+120) { if let at = tracker.state["stopAt"] as? Double, at == deadline, Date().timeIntervalSince1970*1000 >= at { tracker.stop() } }
    }
    @objc func automationStatus(_ call: CAPPluginCall) { DispatchQueue.main.async {
        let owner = call.getString("ownerId") ?? "", values = AutoDriveState.bindings.values.filter { $0["ownerId"] as? String == owner }
        call.resolve(["apiVersion": 2, "platform": "ios", "supported": ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 16, "bindings": Array(values), "pendingCount": AutoDriveState.pending(owner).count, "backgroundLocation": NativeTracker.shared.manager.authorizationStatus == .authorizedAlways, "error": ""])
    } }
    @objc func configureAutomation(_ call: CAPPluginCall) { DispatchQueue.main.async {
        let manager = NativeTracker.shared.manager
        guard manager.authorizationStatus == .authorizedAlways, manager.accuracyAuthorization == .fullAccuracy else {
            if manager.authorizationStatus == .notDetermined || manager.authorizationStatus == .authorizedWhenInUse { manager.requestAlwaysAuthorization() }
            call.reject("Permite localizarea Întotdeauna și locația precisă, apoi reîncearcă.", "BACKGROUND_PERMISSION_REQUIRED"); return
        }
        guard let owner = call.getString("ownerId"), !owner.isEmpty, let vehicle = call.getString("vehicleId"), let baseline = call.getInt("baseline"), baseline >= 0 else { call.reject("Invalid vehicle"); return }
        AutoDriveState.configure(owner: owner, vehicle: vehicle, name: call.getString("vehicleName") ?? "AutoCare", baseline: baseline); self.automationStatus(call)
    } }
    @objc func disableAutomation(_ call: CAPPluginCall) { DispatchQueue.main.async { AutoDriveState.disable(owner: call.getString("ownerId") ?? "", vehicle: call.getString("vehicleId")); call.resolve() } }
    @objc func openLocationSettings(_ call: CAPPluginCall) { DispatchQueue.main.async { if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }; call.resolve() } }
    @objc func pendingTrips(_ call: CAPPluginCall) { DispatchQueue.main.async { call.resolve(["trips": AutoDriveState.pending(call.getString("ownerId") ?? "")]) } }
    @objc func acknowledgeTrips(_ call: CAPPluginCall) { DispatchQueue.main.async {
        let owner = call.getString("ownerId") ?? "", ids = call.getArray("ids", String.self) ?? [], tracker = NativeTracker.shared
        AutoDriveState.acknowledge(owner, ids)
        if tracker.state["ownerId"] as? String == owner, tracker.state["active"] as? Bool != true, ids.contains(tracker.state["id"] as? String ?? "") { tracker.state = [:]; tracker.persist(); UserDefaults.standard.removeObject(forKey: "autocare-gps-owner-v1-"+owner) }
        call.resolve()
    } }
    @objc func updateAutomationVehicle(_ call: CAPPluginCall) { DispatchQueue.main.async {
        let owner = call.getString("ownerId") ?? "", vehicle = call.getString("vehicleId") ?? "", tracker = NativeTracker.shared
        if tracker.state["active"] as? Bool == true && tracker.state["vehicleId"] as? String == vehicle { call.resolve(); return }
        if AutoDriveState.pending(owner).contains(where: { $0["vehicleId"] as? String == vehicle }) { call.resolve(); return }
        var all = AutoDriveState.bindings; if var config = all[vehicle], config["ownerId"] as? String == owner { config["baseline"] = call.getInt("baseline") ?? 0; all[vehicle] = config; AutoDriveState.bindings = all }; call.resolve()
    } }
}
