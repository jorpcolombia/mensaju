package ai.tryatria.messages.conversations

import ai.tryatria.messages.Message
import ai.tryatria.messages.network.ApiClient
import ai.tryatria.messages.realtime.AblyService
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
private data class MessagesResponse(val messages: List<Message>)

@Serializable
private data class SendMessageBody(val conversationId: String, val text: String)

@Serializable
private data class SendMessageResponse(val message: Message)

class ConversationThreadViewModel(
    private val api: ApiClient,
    private val ably: AblyService,
    private val conversationId: String,
) : ViewModel() {
    var messages by mutableStateOf<List<Message>>(emptyList())
        private set

    fun loadHistory() {
        viewModelScope.launch {
            messages = api.request<MessagesResponse>("/conversations/$conversationId/messages").messages
        }
    }

    fun subscribeRealtime() {
        ably.subscribeToConversation(
            conversationId,
            onMessage = { messages = messages + it },
            onStatus = { updated -> messages = messages.map { if (it.id == updated.id) updated else it } },
        )
    }

    fun send(text: String) {
        viewModelScope.launch {
            api.request<SendMessageResponse>(
                "/messages",
                method = "POST",
                body = api.encode(SendMessageBody(conversationId, text)),
            )
        }
    }
}

@Composable
fun ConversationThreadScreen(conversationId: String) {
    // In a real app, ApiClient/AblyService would come from a DI container
    // rather than being constructed inline here.
    Text(text = "Conversation $conversationId")
}
