package ai.tryatria.messages

// Mirrors packages/shared-types/src/models.ts — kept in sync by hand until
// the OpenAPI-generated Kotlin client lands (plan §9).

data class Organization(
    val id: String,
    val name: String,
    val approvalStatus: String,
)

enum class AttachmentType { image, video, audio }

data class Attachment(
    val type: AttachmentType,
    val s3Key: String,
    val mimeType: String,
    val sizeBytes: Long,
    val durationMs: Int? = null,
    val width: Int? = null,
    val height: Int? = null,
)

enum class MessageSenderType { agent, customer }
enum class MessageStatus { sent, delivered, read }

data class Message(
    val id: String,
    val conversationId: String,
    val organizationId: String,
    val senderType: MessageSenderType,
    val senderId: String,
    val text: String?,
    val attachments: List<Attachment>,
    val status: MessageStatus,
    val deliveredAt: String?,
    val readAt: String?,
    val createdAt: String,
)

data class Conversation(
    val id: String,
    val organizationId: String,
    val customerId: String,
    val lastMessageAt: String?,
    val lastMessagePreview: String?,
    val createdAt: String,
)
