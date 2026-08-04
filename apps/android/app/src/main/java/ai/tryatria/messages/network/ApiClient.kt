package ai.tryatria.messages.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Thin HTTP client for services/api. `tokenProvider` supplies either the
 * customer JWT or the messages-org Clerk session token depending on which
 * surface this build targets — same shape as the iOS APIClient.
 */
class ApiClient(
    private val baseUrl: String,
    private val tokenProvider: suspend () -> String?,
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend inline fun <reified T> request(
        path: String,
        method: String = "GET",
        body: String? = null,
    ): T = withContext(Dispatchers.IO) {
        val connection = URL("$baseUrl$path").openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.setRequestProperty("Content-Type", "application/json")
        tokenProvider()?.let { connection.setRequestProperty("Authorization", "Bearer $it") }

        if (body != null) {
            connection.doOutput = true
            OutputStreamWriter(connection.outputStream).use { it.write(body) }
        }

        val code = connection.responseCode
        check(code in 200..299) { "API $path failed: $code" }
        val text = connection.inputStream.bufferedReader().readText()
        json.decodeFromString<T>(text)
    }

    inline fun <reified T> encode(value: T): String = json.encodeToString(value)
}
