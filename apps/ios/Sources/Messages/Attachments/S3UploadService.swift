import Foundation

struct PresignRequestBody: Encodable {
    let mimeType: String
    let sizeBytes: Int
    let type: String
    let conversationId: String
}

struct PresignResult: Decodable {
    let uploadUrl: String
    let s3Key: String
}

/// Presigned-URL upload flow (plan §6): ask the backend for a short-TTL S3
/// PUT URL, then upload directly — the API never proxies media bytes.
final class S3UploadService {
    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    func upload(fileData: Data, mimeType: String, type: String, conversationId: String) async throws -> String {
        let presign: PresignResult = try await api.request(
            "/attachments/presign",
            method: "POST",
            body: PresignRequestBody(
                mimeType: mimeType, sizeBytes: fileData.count, type: type, conversationId: conversationId)
        )

        var req = URLRequest(url: URL(string: presign.uploadUrl)!)
        req.httpMethod = "PUT"
        req.setValue(mimeType, forHTTPHeaderField: "Content-Type")
        req.httpBody = fileData
        _ = try await URLSession.shared.data(for: req)

        return presign.s3Key
    }
}
