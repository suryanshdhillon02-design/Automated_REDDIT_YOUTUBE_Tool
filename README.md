# Patient Voice Extraction

Automated extraction of patient voices from YouTube and Reddit for clinical research. Runs daily on GitHub Actions, extracts first-person cancer patient statements, codes them by pain theme and clinical dimension, and outputs structured JSON for RAG systems.

## Features

- **Automated daily extraction** from YouTube and Reddit
- **Intelligent quote coding**: Identifies first-person statements, filters generic sentiment, validates clinical specificity
- **Multi-dimensional classification**:
  - **Pain themes**: Physical, neuropathy, cognitive, logistical, emotional, system, financial, work/life, uncertainty
  - **Blueprint dimensions**: Logistical friction, counterintuitive advice, myths & mistakes, failed attempts, doubts & objections, desired outcomes
  - **Drug mentions**: Extracts treatment names mentioned in quotes
- **Structured JSON output** ready for RAG ingestion
- **Manual trigger support** for ad-hoc extractions

## Setup

### 1. Create GitHub Repository

```bash
gh repo create patient-voice-extraction --public
cd patient-voice-extraction
git remote add origin https://github.com/YOUR_USERNAME/patient-voice-extraction.git
git push -u origin main
```

### 2. Configure Secrets

Add these to your GitHub repository settings under **Settings > Secrets and variables > Actions**:

```
YOUTUBE_API_KEY=AIza...  # From Google Cloud Console
```

**Getting a YouTube API Key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable YouTube Data API v3
4. Create an OAuth 2.0 credential (type: API key)
5. Copy the key to GitHub Secrets

### 3. Customize Cancer Types

Edit `.github/workflows/daily-extraction.yml`:

```yaml
matrix:
  cancer_type: [breast, lung, colon, prostate, ovarian, pancreatic]
```

Supported types: breast, lung, colon, prostate, ovarian, cervical, thyroid, pancreatic, bladder, kidney, brain, melanoma, leukemia, lymphoma, myeloma, sarcoma, stomach, esophageal, liver, head and neck

## Local Usage

### Quick start

```bash
npm install
npm start
```

### Extract specific cancer type

```bash
CANCER_TYPE=lung YOUTUBE_API_KEY=your_key npm start
```

### Extract from specific source

```bash
npm run extract:youtube  # YouTube only
npm run extract:reddit   # Reddit only
npm run extract:all      # Both (default)
```

## Output Format

Results are saved to `data/patient_voices_{cancer_type}_{date}.json`:

```json
{
  "metadata": {
    "generatedAt": "2024-01-15T02:30:00.000Z",
    "cancerType": "breast",
    "sources": [
      {
        "name": "YouTube",
        "videosAnalyzed": 20,
        "commentsAnalyzed": 1250,
        "quotesExtracted": 45
      }
    ]
  },
  "quotes": [
    {
      "text": "I developed severe tingling in my fingers after my first FOLFOX infusion.",
      "theme": "neuropathy",
      "dimension": "pain_point",
      "drugs": ["folfox"],
      "source": "youtube",
      "channel": "Cancer Diaries",
      "videoTitle": "My Chemotherapy Journey",
      "url": "https://youtube.com/watch?v=...",
      "score": 42
    }
  ],
  "themes": {
    "physical": { "label": "Physical symptoms & side effects", "count": 12 },
    "neuropathy": { "label": "Peripheral neuropathy", "count": 8 }
  }
}
```

## Integrating with RAG

### LangChain Example

```python
import json
from langchain.vectorstores import Chroma
from langchain.embeddings import OpenAIEmbeddings
from langchain.document_loaders import JSONLoader
from langchain.text_splitter import CharacterTextSplitter

# Load extracted quotes
with open("data/patient_voices_breast_2024-01-15.json") as f:
    data = json.load(f)

# Convert to documents
documents = []
for quote in data["quotes"]:
    doc_text = f"""
    Quote: {quote['text']}
    Theme: {quote['theme']}
    Dimension: {quote['dimension']}
    Drugs: {', '.join(quote['drugs'])}
    Source: {quote['source']}
    """
    documents.append(doc_text)

# Create embeddings and vector store
embeddings = OpenAIEmbeddings()
text_splitter = CharacterTextSplitter(chunk_size=500, chunk_overlap=100)
docs = text_splitter.create_documents(documents)
vectorstore = Chroma.from_documents(docs, embeddings)

# Query the RAG system
query = "What are patients struggling with regarding treatment side effects?"
results = vectorstore.similarity_search(query, k=5)
```

### LlamaIndex Example

```python
import json
from llama_index.core import Document, VectorStoreIndex
from llama_index.embeddings.openai import OpenAIEmbedding

# Load extracted quotes
with open("data/patient_voices_breast_2024-01-15.json") as f:
    data = json.load(f)

# Convert to LlamaIndex documents
documents = []
for quote in data["quotes"]:
    doc = Document(
        text=quote['text'],
        metadata={
            "theme": quote['theme'],
            "dimension": quote['dimension'],
            "drugs": quote['drugs'],
            "source": quote['source'],
            "channel": quote.get('channel', ''),
            "subreddit": quote.get('subreddit', '')
        }
    )
    documents.append(doc)

# Create index
index = VectorStoreIndex.from_documents(documents)

# Query
query_engine = index.as_query_engine()
response = query_engine.query("What are the biggest patient pain points?")
print(response)
```

## Data Dictionary

| Field | Description |
|-------|-------------|
| `text` | The extracted first-person quote |
| `theme` | Pain theme classification (physical, emotional, financial, etc.) |
| `dimension` | Blueprint dimension (pain_point, logistical_friction, etc.) |
| `drugs` | Array of drug/treatment names mentioned |
| `source` | "youtube" or "reddit" |
| `channel` / `subreddit` | Source community identifier |
| `url` | Link to original source |
| `score` | YouTube likes or Reddit score |

## Filtering & Quality

The extraction applies multiple filters:

1. **First-person check**: Must contain "I", "my", "we", etc.
2. **Length validation**: 55-400 characters
3. **Generic sentiment removal**: Excludes generic emotional statements
4. **Clinical specificity**: Validates presence of medical terminology
5. **Theme matching**: Associates with at least one pain theme (or Blueprint dimension)
6. **Deduplication**: Removes near-duplicate quotes

## GitHub Actions Details

- **Frequency**: Runs daily at 2 AM UTC
- **Parallel extraction**: One job per cancer type
- **Auto-commit**: Results automatically committed to the repo
- **Artifacts**: Retained for 90 days
- **Manual trigger**: Run via "Actions" tab with custom parameters

## Privacy & Ethics

- **No usernames collected** from YouTube comments or Reddit posts
- **Treat quotes as sensitive**: Paraphrase in published work
- **Attribution**: Link back to source video/post when citing
- **Terms of service**: Complies with YouTube Data API and Reddit API policies

## Troubleshooting

### "YouTube API quota exceeded"
- Default quota: 10,000 units/day
- Each video comment fetch ~300 units
- Solution: Reduce `maxVideos` in workflow or spread runs across days

### "Comments disabled on this video"
- Normal - the script skips these videos silently

### No quotes extracted
- Check that cancer type matches available queries
- Verify theme/dimension patterns match your content
- Try increasing `maxVideos` or `maxPosts`

## Contributing

Want to improve the extraction? PRs welcome for:
- New cancer types and search queries
- Additional pain themes or dimensions
- Better clinical specificity validation
- Performance optimizations

## License

MIT

## Contact

For questions about the methodology, see the original [Patient Voice tool](https://github.com/anthropics/patient-voice).
