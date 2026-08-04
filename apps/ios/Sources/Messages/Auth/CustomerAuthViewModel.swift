import Foundation

struct RequestOtpBody: Encodable {
    let channel: String // "sms" | "whatsapp"
    let phone: String
}

struct VerifyOtpBody: Encodable {
    let phone: String
    let code: String
}

struct VerifyOtpResult: Decodable {
    let token: String
}

/// Drives the customer login flow (plan §3): phone OTP over SMS or WhatsApp,
/// or Google/Apple/Facebook OAuth. On success, stores the backend-issued
/// customer JWT in the Keychain (not shown) and hands it to APIClient's
/// tokenProvider.
@MainActor
final class CustomerAuthViewModel: ObservableObject {
    @Published var isAuthenticating = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    func requestOtp(phone: String, channel: String) async {
        isAuthenticating = true
        defer { isAuthenticating = false }
        do {
            let _: EmptyResponse = try await api.request(
                "/auth/otp/request", method: "POST", body: RequestOtpBody(channel: channel, phone: phone))
        } catch {
            errorMessage = "\(error)"
        }
    }

    func verifyOtp(phone: String, code: String) async -> String? {
        do {
            let result: VerifyOtpResult = try await api.request(
                "/auth/otp/verify", method: "POST", body: VerifyOtpBody(phone: phone, code: code))
            return result.token
        } catch {
            errorMessage = "\(error)"
            return nil
        }
    }

    // Google/Apple/Facebook: obtain a provider token via the respective
    // native SDK, then POST it to /auth/oauth/:provider/callback (same
    // pattern as verifyOtp). SDK integration deferred to milestone start.
}

private struct EmptyResponse: Decodable {}
