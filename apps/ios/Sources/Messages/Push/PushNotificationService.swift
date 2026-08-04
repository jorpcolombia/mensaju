import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// APNs push, tied to backend-triggered new-message notifications
/// (plan §11 milestone 7). Token registration (POST to a future
/// /devices/register endpoint) and notification-tap deep-linking into the
/// relevant conversation land alongside that milestone.
final class PushNotificationService: NSObject {
    func registerForRemoteNotifications() {
        #if canImport(UIKit)
        UIApplication.shared.registerForRemoteNotifications()
        #endif
    }

    func didRegister(deviceToken: Data) {
        // TODO: POST token to backend once /devices/register exists.
    }
}
