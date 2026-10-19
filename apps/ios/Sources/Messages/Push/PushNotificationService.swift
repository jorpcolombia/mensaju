import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// APNs push, tied to backend-triggered new-message notifications
/// (plan §11 milestone 7). Notification-tap deep-linking into the relevant
/// conversation still lands with the Xcode project wiring.
final class PushNotificationService: NSObject {
    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    func registerForRemoteNotifications() {
        #if canImport(UIKit)
        UIApplication.shared.registerForRemoteNotifications()
        #endif
    }

    /// Sends the APNs token to `POST /devices/register` for the signed-in user.
    func didRegister(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task {
            _ = try? await api.request(
                "devices/register",
                method: "POST",
                body: RegisterDeviceBody(platform: "ios", token: token)
            ) as RegisterDeviceResponse
        }
    }
}

private struct RegisterDeviceBody: Encodable {
    let platform: String
    let token: String
}

private struct RegisterDeviceResponse: Decodable {
    let ok: Bool
}
