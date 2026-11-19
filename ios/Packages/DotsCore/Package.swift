// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DotsCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "DotsCore", targets: ["DotsCore"]),
    ],
    targets: [
        .target(name: "DotsCore"),
        .testTarget(name: "DotsCoreTests", dependencies: ["DotsCore"]),
    ]
)
