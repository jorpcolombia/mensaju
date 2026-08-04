import Foundation

// Mirrors packages/shared-types/src/models.ts — keep these two in sync by hand
// until the OpenAPI-generated Swift client lands (plan §9).

struct Organization: Codable, Identifiable {
    let id: String
    let name: String
    let approvalStatus: String
}

enum AttachmentType: String, Codable {
    case image, video, audio
}

struct Attachment: Codable {
    let type: AttachmentType
    let s3Key: String
    let mimeType: String
    let sizeBytes: Int
    let durationMs: Int?
    let width: Int?
    let height: Int?
}

enum MessageSenderType: String, Codable {
    case agent, customer
}

enum MessageStatus: String, Codable {
    case sent, delivered, read
}

struct Message: Codable, Identifiable {
    let id: String
    let conversationId: String
    let organizationId: String
    let senderType: MessageSenderType
    let senderId: String
    let text: String?
    let attachments: [Attachment]
    let status: MessageStatus
    let deliveredAt: String?
    let readAt: String?
    let createdAt: String
}

struct Conversation: Codable, Identifiable {
    let id: String
    let organizationId: String
    let customerId: String
    let lastMessageAt: String?
    let lastMessagePreview: String?
    let createdAt: String
}
