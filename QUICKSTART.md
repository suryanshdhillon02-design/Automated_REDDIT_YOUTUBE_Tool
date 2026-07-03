# Quick Start

## 1. Create the GitHub Repository

```bash
cd /path/to/patient-voice-extraction
git init
git add .
git commit -m "Initial commit: Patient voice extraction tool"
gh repo create patient-voice-extraction --public --source=. --remote=origin --push
```

## 2. Add API Keys to GitHub

Go to your repository on GitHub:
- **Settings** → **Secrets and variables** → **Actions**
- Click **New repository secret**
- Add `YOUTUBE_API_KEY` with your YouTube Data API v3 key

Get your YouTube API key:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Search for "YouTube Data API v3"
4. Click **Enable**
5. Go to **Credentials** → **Create Credentials** → **API Key**
6. Copy the key to GitHub Secrets

## 3. Test Locally

```bash
npm install

# Copy the example env file
cp .env.example .env

# Add your YouTube API key to .env
# YOUTUBE_API_KEY=AIza...

# Run extraction for breast cancer
CANCER_TYPE=breast npm start

# Check results
cat data/patient_voices_breast_*.json | head -50
```

## 4. Trigger the Workflow

- Go to **Actions** tab on your repo
- Click **Daily Patient Voice Extraction**
- Click **Run workflow**
- Select parameters and run

Or wait for the automatic daily run (2 AM UTC).

## 5. Use with RAG

```bash
pip install langchain openai chromadb

python rag_integration.py data/patient_voices_breast_*.json
```

## Common Tasks

### Extract specific cancer type
```bash
CANCER_TYPE=lung npm start
```

### Extract from specific source
```bash
npm run extract:youtube  # YouTube only
npm run extract:reddit   # Reddit only
```

### View extraction results
```bash
# JSON format (for RAG)
cat data/patient_voices_breast_*.json | jq .quotes

# Pretty print
cat data/patient_voices_breast_*.json | jq . | less
```

### Filter quotes by theme
```bash
cat data/patient_voices_breast_*.json | jq '.quotes[] | select(.theme == "neuropathy")'
```

## Troubleshooting

**"YouTube API quota exceeded"**
- Reduce number of videos in workflow or wait 24 hours
- Each video ~300-500 API units

**"No quotes extracted"**
- Check that cancer type is supported
- Try increasing `maxVideos` parameter

**"Missing API key"**
- Verify GitHub secret is set correctly
- Check `.env` file has `YOUTUBE_API_KEY`

## Next Steps

1. ✅ Set up GitHub repo
2. ✅ Configure API keys
3. ✅ Test locally
4. ✅ Enable daily runs
5. → Integrate with your RAG system using `rag_integration.py`

See [README.md](README.md) for full documentation.
