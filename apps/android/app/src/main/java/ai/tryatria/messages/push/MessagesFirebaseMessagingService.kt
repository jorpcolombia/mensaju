package ai.tryatria.messages.push

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * FCM push, tied to backend-triggered new-message notifications
 * (plan §11 milestone 7). Token registration (POST to a future
 * /devices/register endpoint) and notification-tap deep-linking into the
 * relevant conversation land alongside that milestone.
 */
class MessagesFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        // TODO: POST token to backend once /devices/register exists.
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // TODO: show a notification, deep-link to the conversation on tap.
    }
}
