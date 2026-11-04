import Foundation
import Capacitor
import CoreLocation

private final class NativeTracker: NSObject, CLLocationManagerDelegate {
    static let shared = NativeTracker()
    let manager = CLLocationManager()
    var state: [String: Any]
    var pending: ((Error?) -> Void)?
    override init() {
        state = UserDefaults.standard.dictionary(forKey: "autocare-gps-trip-v1") ?? [:]
        super.init()
        // iOS force-quit is a stop; never restart location silently on next launch.
        if state["active"] as? Bool == true { state["active"] = false; state["endedAt"] = state["updatedAt"]; persist() }
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
        if !state.isEmpty { if state["active"] as? Bool == true { state["endedAt"] = Date().timeIntervalSince1970 * 1000 }; state["active"] = false; persist() }
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { if (error as? CLError)?.code == .denied { stop() } }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard state["active"] as? Bool == true else { return }
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
    public let pluginMethods: [CAPPluginMethod] = ["snapshot", "start", "stop", "clear"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
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
        DispatchQueue.main.async { guard self.owned(call) || NativeTracker.shared.state.isEmpty else { call.resolve(NativeTracker.shared.forOwner(call.getString("ownerId") ?? "")); return }; NativeTracker.shared.stop(); call.resolve(NativeTracker.shared.state) }
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
}
