package ai.tryatria.messages.push

import ai.tryatria.messages.network.ApiClient
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

/**
 * FCM push, tied to backend-triggered new-message notifications
 * (plan §11 milestone 7). Notification display and tap deep-linking into the
 * relevant conversation still land with the Android project wiring.
 */
class MessagesFirebaseMessagingService : FirebaseMessagingService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Set by the app once the user is signed in so the token can be registered. */
    companion object {
        var apiClient: ApiClient? = null
    }

    @Serializable
    private data class RegisterDeviceBody(val platform: String, val token: String)

    @Serializable
    private data class RegisterDeviceResponse(val ok: Boolean)

    override fun onNewToken(token: String) {
        val api = apiClient ?: return // Registered on next sign-in via the same call.
        scope.launch {
            runCatching {
                api.request<RegisterDeviceResponse>(
                    path = "/devices/register",
                    method = "POST",
                    body = api.encode(RegisterDeviceBody("android", token)),
                )
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // TODO: show a notification, deep-link to the conversation on tap.
    }
}
