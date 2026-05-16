class LlmBridge < Formula
  desc "Use any AI IDE's model catalog from any OpenAI-compatible client"
  homepage "https://github.com/aeswibon/llm-bridge"
  url "https://github.com/aeswibon/llm-bridge/releases/download/v2.0.0/llm-bridge-macos-arm64"
  version "2.0.0"
  sha256 "PLACEHOLDER"

  depends_on_architecture :arm64

  def install
    bin.install "llm-bridge-macos-arm64" => "llm-bridge"
  end

  test do
    assert_match "llm-bridge", shell_output("#{bin}/llm-bridge help")
  end
end
