package ai.tryatria.messages.attachments

import ai.tryatria.messages.network.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.net.HttpURLConnection
import java.net.URL

@Serializable
data class PresignRequestBody(
    val mimeType: String,
    val sizeBytes: Long,
    val type: String,
    val conversationId: String,
)

@Serializable
data class PresignResult(val uploadUrl: String, val s3Key: String)

/**
 * Presigned-URL upload flow (plan §6): ask the backend for a short-TTL S3
 * PUT URL, then upload directly — mirrors the iOS S3UploadService.
 */
class S3UploadService(private val api: ApiClient) {
    suspend fun upload(fileBytes: ByteArray, mimeType: String, type: String, conversationId: String): String {
        val presign = api.request<PresignResult>(
            "/attachments/presign",
            method = "POST",
            body = api.encode(PresignRequestBody(mimeType, fileBytes.size.toLong(), type, conversationId)),
        )

        withContext(Dispatchers.IO) {
            val connection = URL(presign.uploadUrl).openConnection() as HttpURLConnection
            connection.requestMethod = "PUT"
            connection.setRequestProperty("Content-Type", mimeType)
            connection.doOutput = true
            connection.outputStream.use { it.write(fileBytes) }
            connection.responseCode
        }

        return presign.s3Key
    }
}
