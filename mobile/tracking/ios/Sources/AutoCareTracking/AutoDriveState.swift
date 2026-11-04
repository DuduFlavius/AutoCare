import Foundation
import CoreLocation

internal enum AutoDriveState {
    static let stopDelay: Double = 120000
    static var owner: String { get { UserDefaults.standard.string(forKey: "autocare-auto-owner") ?? "" } set { UserDefaults.standard.set(newValue, forKey: "autocare-auto-owner") } }
    static var bindings: [String: [String: Any]] { get { UserDefaults.standard.dictionary(forKey: "autocare-auto-bindings") as? [String: [String: Any]] ?? [:] } set { UserDefaults.standard.set(newValue, forKey: "autocare-auto-bindings") } }
    static func pending(_ owner: String) -> [[String: Any]] { UserDefaults.standard.array(forKey: "autocare-auto-pending-"+owner) as? [[String: Any]] ?? [] }
    static func enqueue(_ state: [String: Any]) {
        guard state["automatic"] as? Bool == true, let owner = state["ownerId"] as? String, let id = state["id"] as? String, (state["distance"] as? Double ?? 0)>0 else { return }
        var rows = pending(owner); if rows.contains(where: { $0["id"] as? String == id }) { return }
        var summary = state; summary["points"] = [[String: Any]](); rows.append(summary)
        UserDefaults.standard.set(rows, forKey: "autocare-auto-pending-"+owner)
    }
    static func acknowledge(_ owner: String, _ ids: [String]) {
        UserDefaults.standard.set(pending(owner).filter { !ids.contains($0["id"] as? String ?? "") }, forKey: "autocare-auto-pending-"+owner)
    }
    static func configure(owner: String, vehicle: String, name: String, baseline: Int) {
        UserDefaults.standard.removeObject(forKey: "autocare-auto-suppressed-"+vehicle)
        var all = bindings; all[vehicle] = ["ownerId": owner, "vehicleId": vehicle, "vehicleName": name, "baseline": baseline, "enabled": true]; bindings = all; self.owner = owner
    }
    static func disable(owner: String, vehicle: String?) {
        var all = bindings
        for (id, var value) in all where value["ownerId"] as? String == owner && (vehicle == nil || vehicle == id) { value["enabled"] = false; all[id] = value }
        bindings = all; if vehicle == nil && self.owner == owner { self.owner = "" }
    }
    static func error(_ message: String) -> NSError { NSError(domain: "AutoCareAutomation", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}
