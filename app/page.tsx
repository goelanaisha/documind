"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }

      // Navigate to chat page with the document ID
      router.push(`/chat/${data.docId}?filename=${encodeURIComponent(data.filename)}`);

    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">DocuMind</h1>
          <p className="text-gray-400 text-lg">
            Upload a PDF and ask questions about it
          </p>
        </div>

        {/* Upload Card */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">

          {/* File Drop Area */}
          <label
            htmlFor="file-input"
            className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-gray-800 transition-all"
          >
            {file ? (
              <div className="text-center">
                <p className="text-blue-400 font-medium text-lg">{file.name}</p>
                <p className="text-gray-500 text-sm mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <p className="text-gray-600 text-xs mt-3">Click to change file</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-5xl mb-3">📄</p>
                <p className="text-gray-300 font-medium">Click to upload PDF</p>
                <p className="text-gray-600 text-sm mt-1">PDF files only</p>
              </div>
            )}
          </label>

          <input
            id="file-input"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full mt-6 py-3 px-6 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
          >
            {uploading ? "Processing PDF..." : "Upload & Start Chatting"}
          </button>

        </div>

        {/* Footer note */}
        <p className="text-center text-gray-600 text-sm mt-6">
          Your document is processed locally and never stored permanently
        </p>

      </div>
    </main>
  );
}