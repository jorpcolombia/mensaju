package ai.tryatria.messages.auth

import ai.tryatria.messages.network.ApiClient
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
data class RequestOtpBody(val channel: String, val phone: String)

@Serializable
data class VerifyOtpBody(val phone: String, val code: String)

@Serializable
data class VerifyOtpResult(val token: String)

/**
 * Drives the customer login flow (plan §3): phone OTP over SMS or WhatsApp,
 * or Google/Facebook OAuth (Apple Sign-In falls back to a web flow on
 * Android). On success, stores the backend-issued customer JWT (e.g. in
 * EncryptedSharedPreferences, not shown) for ApiClient's tokenProvider.
 */
class CustomerAuthViewModel(private val api: ApiClient) : ViewModel() {
    fun requestOtp(phone: String, channel: String) {
        viewModelScope.launch {
            api.request<Unit>(
                "/auth/otp/request",
                method = "POST",
                body = api.encode(RequestOtpBody(channel, phone)),
            )
        }
    }

    suspend fun verifyOtp(phone: String, code: String): String? =
        try {
            api.request<VerifyOtpResult>(
                "/auth/otp/verify",
                method = "POST",
                body = api.encode(VerifyOtpBody(phone, code)),
            ).token
        } catch (e: Exception) {
            null
        }

    // Google/Facebook: obtain a provider token via the respective native
    // SDK, then POST it to /auth/oauth/:provider/callback — same pattern as
    // verifyOtp. SDK integration deferred to milestone start.
}
