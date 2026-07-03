#!/usr/bin/env python3
"""
RAG Integration Example: Load patient voice data into a vector database

Usage:
    python rag_integration.py data/patient_voices_*.json
"""

import json
import sys
from pathlib import Path
from datetime import datetime

try:
    from langchain.vectorstores import Chroma
    from langchain.embeddings import OpenAIEmbeddings
    from langchain.schema import Document
    from langchain.chat_models import ChatOpenAI
    from langchain.chains import RetrievalQA
except ImportError:
    print("Error: Install required packages:")
    print("  pip install langchain openai chromadb")
    sys.exit(1)


class PatientVoiceRAG:
    """RAG system for patient voice data"""

    def __init__(self, persist_dir: str = "./.rag_db"):
        self.persist_dir = persist_dir
        self.embeddings = OpenAIEmbeddings()
        self.vectorstore = None
        self.qa_chain = None

    def load_patient_data(self, json_file: str) -> list[Document]:
        """Load extracted patient voices from JSON"""
        with open(json_file) as f:
            data = json.load(f)

        documents = []
        cancer_type = data["metadata"].get("cancerType", "unknown")

        for i, quote in enumerate(data["quotes"]):
            # Create rich metadata for filtering
            metadata = {
                "quote_id": f"{cancer_type}_{i}",
                "cancer_type": cancer_type,
                "theme": quote.get("theme", "unknown"),
                "dimension": quote.get("dimension", "pain_point"),
                "drugs": ",".join(quote.get("drugs", [])),
                "source": quote.get("source", "unknown"),
                "extracted_date": data["metadata"].get("generatedAt", ""),
            }

            # Add source-specific metadata
            if quote.get("source") == "youtube":
                metadata["channel"] = quote.get("channel", "")
                metadata["video_title"] = quote.get("videoTitle", "")
                metadata["url"] = quote.get("url", "")
            elif quote.get("source") == "reddit":
                metadata["subreddit"] = quote.get("subreddit", "")
                metadata["post_title"] = quote.get("postTitle", "")
                metadata["url"] = quote.get("url", "")

            # Create document with quote text
            doc = Document(
                page_content=quote["text"],
                metadata=metadata
            )
            documents.append(doc)

        print(f"✅ Loaded {len(documents)} patient voice documents from {json_file}")
        return documents

    def build_vectorstore(self, documents: list[Document]):
        """Create or update vector store with documents"""
        self.vectorstore = Chroma.from_documents(
            documents=documents,
            embedding=self.embeddings,
            persist_directory=self.persist_dir,
            collection_metadata={"hnsw:space": "cosine"}
        )
        self.vectorstore.persist()
        print(f"✅ Vector store built with {len(documents)} documents")

    def create_qa_chain(self):
        """Create RAG QA chain"""
        if not self.vectorstore:
            raise ValueError("Vector store not initialized. Call build_vectorstore() first.")

        llm = ChatOpenAI(temperature=0, model="gpt-4")
        self.qa_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",
            retriever=self.vectorstore.as_retriever(k=5),
            return_source_documents=True,
            verbose=True
        )
        print("✅ QA chain created")

    def query(self, question: str) -> dict:
        """Query the RAG system"""
        if not self.qa_chain:
            raise ValueError("QA chain not initialized. Call create_qa_chain() first.")

        result = self.qa_chain({"query": question})
        return {
            "question": question,
            "answer": result["result"],
            "sources": [
                {
                    "quote": doc.page_content,
                    "metadata": doc.metadata
                }
                for doc in result["source_documents"]
            ]
        }

    def batch_query(self, questions: list[str]) -> list[dict]:
        """Run multiple queries"""
        results = []
        for q in questions:
            print(f"\n🔍 Query: {q}")
            result = self.query(q)
            results.append(result)
            print(f"✅ Found {len(result['sources'])} relevant quotes")
        return results

    def filter_by_theme(self, theme: str, limit: int = 10) -> list[dict]:
        """Get quotes filtered by pain theme"""
        if not self.vectorstore:
            raise ValueError("Vector store not initialized.")

        results = self.vectorstore.search(
            f"theme:{theme}",
            filter={"theme": theme},
            k=limit
        )
        return results

    def export_insights(self, output_file: str):
        """Export RAG insights to markdown"""
        if not self.qa_chain:
            raise ValueError("QA chain not initialized.")

        queries = [
            "What are the most common patient pain points?",
            "What financial barriers do patients face?",
            "What cognitive side effects are reported?",
            "What logistical challenges do patients mention?",
            "What drug-specific side effects are mentioned?"
        ]

        with open(output_file, "w") as f:
            f.write("# Patient Voice RAG Analysis\n\n")
            f.write(f"Generated: {datetime.now().isoformat()}\n\n")

            for q in queries:
                result = self.query(q)
                f.write(f"## {q}\n\n")
                f.write(f"{result['answer']}\n\n")
                f.write("**Source quotes:**\n")
                for source in result["sources"]:
                    f.write(f"- *{source['quote']}*\n")
                    if source["metadata"].get("url"):
                        f.write(f"  ([{source['metadata']['source']}]({source['metadata']['url']}))\n")
                f.write("\n---\n\n")

        print(f"✅ Insights exported to {output_file}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python rag_integration.py <json_file>")
        print("\nExample:")
        print("  python rag_integration.py data/patient_voices_breast_2024-01-15.json")
        sys.exit(1)

    json_file = sys.argv[1]
    if not Path(json_file).exists():
        print(f"❌ File not found: {json_file}")
        sys.exit(1)

    print("🚀 Initializing Patient Voice RAG System\n")

    # Initialize RAG
    rag = PatientVoiceRAG()

    # Load and process documents
    documents = rag.load_patient_data(json_file)
    rag.build_vectorstore(documents)
    rag.create_qa_chain()

    # Example queries
    example_queries = [
        "What physical side effects are patients experiencing?",
        "What insurance and financial barriers do patients face?",
        "What cognitive effects are reported?",
        "What advice do patients have for others?"
    ]

    print("\n📊 Running example queries:\n")
    for result in rag.batch_query(example_queries):
        print(f"\nQuestion: {result['question']}")
        print(f"Answer: {result['answer'][:200]}...")
        print(f"Found {len(result['sources'])} supporting quotes")

    # Export comprehensive insights
    output_file = "rag_insights.md"
    rag.export_insights(output_file)
    print(f"\n✅ Analysis complete! See {output_file} for full insights")


if __name__ == "__main__":
    main()
