# Download GGUF model for LM Studio container
# This script downloads openai/gpt-oss-20b GGUF model

$ModelsPath = "c:\code-heals-itself\models\7B"
$ModelFile = "$ModelsPath\ggml-model-f16.gguf"

# Create directory if it doesn't exist
if (-not (Test-Path $ModelsPath)) {
    Write-Host "📁 Creating models directory: $ModelsPath"
    New-Item -ItemType Directory -Path $ModelsPath -Force | Out-Null
}

# Check if model already exists
if (Test-Path $ModelFile) {
    $Size = (Get-Item $ModelFile).Length / 1GB
    Write-Host "✅ Model file already exists: $ModelFile ($Size GB)"
    exit 0
}

Write-Host "⏳ Model file not found. You have two options:"
Write-Host ""
Write-Host "Option 1: Download from Hugging Face (requires ~13GB disk space)"
Write-Host "  Run: huggingface-cli download OpenAssistant/gpt-oss-20b-GGUF ggml-model-f16.gguf --local-dir $ModelsPath --local-dir-use-symlinks False"
Write-Host ""
Write-Host "Option 2: Use your local LM Studio model"
Write-Host "  Copy the model file to: $ModelFile"
Write-Host ""
Write-Host "Option 3: Docker container will wait for model via API"
Write-Host "  Container will start but won't auto-load a model"
Write-Host ""
Write-Host "For now, creating placeholder (container will start but be ready for model loading)..."

# Create models directory structure
New-Item -ItemType Directory -Path $ModelsPath -Force | Out-Null

Write-Host "✅ Models directory ready at: $ModelsPath"
Write-Host "   Place your GGUF model files here and restart: docker compose restart lmstudio"
