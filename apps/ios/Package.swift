// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Messages",
    platforms: [.iOS(.v16)],
    products: [
        .library(name: "Messages", targets: ["Messages"])
    ],
    dependencies: [
        // Ably iOS SDK — realtime subscribe/publish scoped by backend-issued
        // tokens (plan §4). Add via Xcode's Swift Package Manager UI when
        // wiring this into an actual .xcodeproj:
        //   https://github.com/ably/ably-cocoa
        .package(url: "https://github.com/ably/ably-cocoa.git", from: "1.2.0")
    ],
    targets: [
        .target(
            name: "Messages",
            dependencies: [.product(name: "Ably", package: "ably-cocoa")]
        )
    ]
)
