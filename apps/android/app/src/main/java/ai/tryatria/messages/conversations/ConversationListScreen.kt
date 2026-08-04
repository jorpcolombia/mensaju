package ai.tryatria.messages.conversations

import ai.tryatria.messages.Conversation
import ai.tryatria.messages.network.ApiClient
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
private data class ConversationsResponse(val conversations: List<Conversation>)

class ConversationListViewModel(private val api: ApiClient) : ViewModel() {
    var conversations by mutableStateOf<List<Conversation>>(emptyList())
        private set

    fun refresh() {
        viewModelScope.launch {
            conversations = api.request<ConversationsResponse>("/conversations").conversations
        }
    }
}

@Composable
fun ConversationListScreen(viewModel: ConversationListViewModel, onOpen: (String) -> Unit) {
    LaunchedEffect(Unit) { viewModel.refresh() }
    LazyColumn {
        items(viewModel.conversations) { conversation ->
            Text(
                text = conversation.lastMessagePreview ?: "(no messages yet)",
                modifier = Modifier.clickable { onOpen(conversation.id) },
            )
        }
    }
}
