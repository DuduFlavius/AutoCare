import AppIntents
import AutocareNativeTracking

@available(iOS 16.0, *)
struct AutoCareVehicle: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Mașină AutoCare"
    static var defaultQuery = AutoCareVehicleQuery()
    var id: String
    var name: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}
@available(iOS 16.0, *)
struct AutoCareVehicleQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [AutoCareVehicle] { try await suggestedEntities().filter { identifiers.contains($0.id) } }
    func suggestedEntities() async throws -> [AutoCareVehicle] { await MainActor.run { AutoCareTrackingPlugin.automationVehicles().compactMap { item in guard let id = item["id"], let name = item["name"] else { return nil }; return AutoCareVehicle(id: id, name: name) } } }
}
@available(iOS 16.0, *)
struct StartAutoCareDrive: AppIntent {
    static var title: LocalizedStringResource = "Pornește traseul AutoCare"
    static var description = IntentDescription("Pornește înregistrarea pentru mașina configurată, cu permisiunea de localizare Întotdeauna.")
    static var openAppWhenRun = false
    @Parameter(title: "Mașină") var vehicle: AutoCareVehicle
    func perform() async throws -> some IntentResult { try await MainActor.run { try AutoCareTrackingPlugin.startAutomatic(vehicleId: vehicle.id) }; return .result() }
}
@available(iOS 16.0, *)
struct StopAutoCareDrive: AppIntent {
    static var title: LocalizedStringResource = "Încheie traseul AutoCare"
    static var description = IntentDescription("Încheie sesiunea automată după două minute dacă mașina nu se reconectează.")
    static var openAppWhenRun = false
    @Parameter(title: "Mașină") var vehicle: AutoCareVehicle
    func perform() async throws -> some IntentResult { await MainActor.run { AutoCareTrackingPlugin.stopAutomatic(vehicleId: vehicle.id) }; return .result() }
}
