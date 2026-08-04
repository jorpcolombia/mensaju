package ai.tryatria.messages.realtime

import ai.tryatria.messages.Message
import ai.tryatria.messages.network.ApiClient
import io.ably.lib.realtime.AblyRealtime
import io.ably.lib.rest.Auth
import io.ably.lib.types.ClientOptions
import kotlinx.coroutines.runBlocking

/**
 * Wraps the Ably Android SDK. Authenticates against our backend's
 * POST /ably/token (plan §4) — the client never holds an Ably API key.
 */
class AblyService(api: ApiClient) {
    private val realtime: AblyRealtime

    init {
        val options = ClientOptions()
        options.authCallback = Auth.TokenCallback { _ ->
            runBlocking { api.request<Auth.TokenDetails>("/ably/token", method = "POST") }
        }
        realtime = AblyRealtime(options)
    }

    fun subscribeToConversation(
        conversationId: String,
        onMessage: (Message) -> Unit,
        onStatus: (Message) -> Unit,
    ) {
        val channel = realtime.channels.get("conversation:$conversationId")
        channel.subscribe("message.new") { msg ->
            (msg.data as? Message)?.let(onMessage)
        }
        channel.subscribe("message.status") { msg ->
            (msg.data as? Message)?.let(onStatus)
        }
    }
}
