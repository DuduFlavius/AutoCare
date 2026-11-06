// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "AutocareNativeTracking", platforms: [.iOS(.v15)], products: [.library(name: "AutocareNativeTracking", targets: ["AutocareNativeTracking"])], dependencies: [.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.6.0")], targets: [.target(name: "AutocareNativeTracking", dependencies: [.product(name: "Capacitor", package: "capacitor-swift-pm")], path: "ios/Sources/AutoCareTracking", resources: [.process("PrivacyInfo.xcprivacy")])])
