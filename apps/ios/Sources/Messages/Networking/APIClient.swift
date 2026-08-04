import Foundation

/// Thin HTTP client for `services/api`. One instance per app session;
/// `tokenProvider` supplies either the customer JWT or the messages-org
/// Clerk session token depending on which surface this build targets.
final class APIClient {
    private let baseURL: URL
    private let tokenProvider: () async -> String?

    init(baseURL: URL, tokenProvider: @escaping () async -> String?) {
        self.baseURL = baseURL
        self.tokenProvider = tokenProvider
    }

    func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: Encodable? = nil
    ) async throws -> T {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = await tokenProvider() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.badStatus((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

enum APIError: Error {
    case badStatus(Int)
}

/// Type-erasing wrapper so `request(_:method:body:)` can accept any Encodable.
private struct AnyEncodable: Encodable {
    private let encode: (Encoder) throws -> Void
    init(_ wrapped: Encodable) {
        encode = wrapped.encode
    }
    func encode(to encoder: Encoder) throws {
        try encode(encoder)
    }
}
