import SwiftUI

@MainActor
final class ConversationThreadViewModel: ObservableObject {
    @Published var messages: [Message] = []
    @Published var draft: String = ""

    private let api: APIClient
    private let ably: AblyService
    private let conversationId: String

    init(api: APIClient, ably: AblyService, conversationId: String) {
        self.api = api
        self.ably = ably
        self.conversationId = conversationId
    }

    func loadHistory() async {
        struct Response: Decodable { let messages: [Message] }
        do {
            let result: Response = try await api.request("/conversations/\(conversationId)/messages")
            messages = result.messages
        } catch {
            // TODO: surface error state
        }
    }

    func subscribeRealtime() {
        ably.subscribeToConversation(
            conversationId,
            onMessage: { [weak self] message in self?.messages.append(message) },
            onStatus: { [weak self] updated in
                guard let self else { return }
                if let index = self.messages.firstIndex(where: { $0.id == updated.id }) {
                    self.messages[index] = updated
                }
            }
        )
    }

    func send() async {
        guard !draft.isEmpty else { return }
        struct Body: Encodable { let conversationId: String; let text: String }
        struct Response: Decodable { let message: Message }
        do {
            let _: Response = try await api.request(
                "/messages", method: "POST", body: Body(conversationId: conversationId, text: draft))
            draft = ""
        } catch {
            // TODO: surface error state
        }
    }
}

struct ConversationThreadView: View {
    let conversationId: String
    // In a real app, api/ably would come from an environment-injected
    // dependency container rather than being constructed inline here.

    var body: some View {
        Text("Conversation \(conversationId)")
        // Full message list + composer wiring lands with the API client
        // dependency-injection setup at milestone start.
    }
}
