import Foundation
import Ably

/// Wraps ably-cocoa. Authenticates against our backend's POST /ably/token
/// (plan §4) — the client never holds an Ably API key.
final class AblyService {
    private let realtime: ARTRealtime

    init(api: APIClient) {
        let options = ARTClientOptions()
        options.authCallback = { _, callback in
            Task {
                do {
                    let tokenRequest: ARTTokenDetails = try await api.request(
                        "/ably/token", method: "POST")
                    callback(tokenRequest, nil)
                } catch {
                    callback(nil, error)
                }
            }
        }
        realtime = ARTRealtime(options: options)
    }

    func subscribeToConversation(
        _ conversationId: String,
        onMessage: @escaping (Message) -> Void,
        onStatus: @escaping (Message) -> Void
    ) {
        let channel = realtime.channels.get("conversation:\(conversationId)")
        channel.subscribe("message.new") { msg in
            guard let data = try? JSONSerialization.data(withJSONObject: msg.data ?? [:]),
                  let decoded = try? JSONDecoder().decode(Message.self, from: data)
            else { return }
            onMessage(decoded)
        }
        channel.subscribe("message.status") { msg in
            guard let data = try? JSONSerialization.data(withJSONObject: msg.data ?? [:]),
                  let decoded = try? JSONDecoder().decode(Message.self, from: data)
            else { return }
            onStatus(decoded)
        }
    }
}
