#!/bin/bash

# SwapSmith Secrets Setup Script
# This script helps set up Docker secrets securely

set -e

SECRETS_DIR="./secrets"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔐 SwapSmith Secrets Setup"
echo "=========================="

# Create secrets directory if it doesn't exist
if [ ! -d "$SECRETS_DIR" ]; then
    echo "📁 Creating secrets directory..."
    mkdir -p "$SECRETS_DIR"
    chmod 700 "$SECRETS_DIR"
fi

# Function to create secret file
create_secret() {
    local secret_name=$1
    local secret_file="$SECRETS_DIR/${secret_name}.txt"
    local description=$2
    
    if [ -f "$secret_file" ]; then
        echo "⚠️  Secret file $secret_name already exists. Skipping..."
        return
    fi
    
    echo "🔑 Setting up $description..."
    echo -n "Enter $description: "
    read -s secret_value
    echo
    
    if [ -n "$secret_value" ]; then
        echo -n "$secret_value" > "$secret_file"
        chmod 600 "$secret_file"
        echo "✅ $description saved securely"
    else
        echo "❌ Empty value provided for $description. Skipping..."
    fi
}

# Function to create JSON secret file
create_json_secret() {
    local secret_name=$1
    local secret_file="$SECRETS_DIR/${secret_name}.json"
    local description=$2
    
    if [ -f "$secret_file" ]; then
        echo "⚠️  Secret file $secret_name already exists. Skipping..."
        return
    fi
    
    echo "🔑 Setting up $description..."
    echo "Paste the JSON content (press Ctrl+D when done):"
    cat > "$secret_file"
    chmod 600 "$secret_file"
    echo "✅ $description saved securely"
}

echo "Setting up secrets for SwapSmith..."
echo

# Create individual secret files
create_secret "groq_api_key" "GROQ API Key"
create_secret "bot_token" "Telegram Bot Token"
create_secret "sideshift_api_key" "SideShift API Key"
create_secret "brevo_api_key" "Brevo API Key"
create_secret "reward_token_private_key" "Reward Token Private Key"
create_secret "walletconnect_project_id" "WalletConnect Project ID"

# Special handling for Firebase service account (JSON)
if [ ! -f "$SECRETS_DIR/firebase_service_account_key.json" ]; then
    echo "🔑 Setting up Firebase Service Account Key..."
    echo "Please paste the entire Firebase service account JSON:"
    create_json_secret "firebase_service_account_key" "Firebase Service Account Key"
fi

echo
echo "🎉 Secrets setup complete!"
echo
echo "📋 Next steps:"
echo "1. Review the created secret files in $SECRETS_DIR"
echo "2. Ensure the secrets directory is added to .gitignore"
echo "3. Use docker-compose.secure.yaml for production deployments"
echo "4. Consider using external secret management for production"
echo
echo "⚠️  Security reminders:"
echo "- Never commit secret files to version control"
echo "- Use proper file permissions (600) for secret files"
echo "- Consider using external secret management in production"
echo "- Rotate secrets regularly"