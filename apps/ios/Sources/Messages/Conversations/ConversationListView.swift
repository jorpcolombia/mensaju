import SwiftUI

@MainActor
final class ConversationListViewModel: ObservableObject {
    @Published var conversations: [Conversation] = []
    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    func refresh() async {
        struct Response: Decodable { let conversations: [Conversation] }
        do {
            let result: Response = try await api.request("/conversations")
            conversations = result.conversations
        } catch {
            // TODO: surface error state
        }
    }
}

struct ConversationListView: View {
    @StateObject var viewModel: ConversationListViewModel

    var body: some View {
        List(viewModel.conversations) { conversation in
            NavigationLink(
                conversation.lastMessagePreview ?? "(no messages yet)",
                destination: ConversationThreadView(conversationId: conversation.id)
            )
        }
        .task { await viewModel.refresh() }
    }
}
