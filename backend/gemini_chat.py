"""
gemini_chat.py – Google Gemini AI integration for CodeCell.ai AI Assistant.

Uses the google-genai SDK (Gemini 2.0 Flash) to provide a fully conversational,
bioinformatics-aware AI assistant grounded in the actual PBMC 3K dataset.

When GEMINI_API_KEY is not set, falls back to the built-in regex system.
"""

import os
import re
import numpy as np
from typing import Optional
from pathlib import Path

# ── Load .env from project root (works even when env var not set in shell) ────
def _load_dotenv():
    """Read GEMINI_API_KEY from the project's .env file if not already in env."""
    if os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
        return  # already set

    # Walk up from this file's directory to find .env
    current = Path(__file__).parent
    for _ in range(4):  # search up to 4 levels up
        env_file = current / ".env"
        if env_file.exists():
            with open(env_file) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k, v = k.strip(), v.strip()
                        if k in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
                            os.environ[k] = v
                            print(f"✅ Loaded {k} from {env_file}")
                            return
        current = current.parent

_load_dotenv()

# ─── Gemini client (lazy-initialised) ─────────────────────────────────────────
_gemini_client = None
# Model priority: newest/best first, fall back on quota errors
_MODELS = [
    "models/gemini-2.5-flash",        # best — fastest, generous quota
    "models/gemini-2.0-flash-lite",   # fallback — very generous quota
    "models/gemini-2.0-flash",        # secondary fallback
]
_gemini_model = _MODELS[0]

def get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            return None
        try:
            from google import genai
            _gemini_client = genai.Client(api_key=api_key)
        except Exception as e:
            print(f"⚠️  Gemini init failed: {e}")
            return None
    return _gemini_client


# ─── Dataset context builder ──────────────────────────────────────────────────

CLUSTER_CELL_TYPES = {
    "0": "CD4+ T cells",
    "1": "B cells",
    "2": "Monocytes (CD14+)",
    "3": "NK / CD8+ T cells",
    "4": "Dendritic cells",
    "5": "Megakaryocytes",
}

def build_dataset_context(adata) -> str:
    """Build a rich system prompt grounded in the actual PBMC 3K dataset."""

    # Cluster stats
    cluster_lines = []
    for clus in sorted(adata.obs["leiden"].unique(), key=int):
        n   = int((adata.obs["leiden"] == clus).sum())
        pct = n / adata.n_obs * 100
        ct  = CLUSTER_CELL_TYPES.get(str(clus), f"Unknown Cluster {clus}")
        try:
            top_genes = [str(g) for g in adata.uns["rank_genes_groups"]["names"][str(clus)][:5]]
            marker_str = ", ".join(top_genes)
        except Exception:
            marker_str = "N/A"
        cluster_lines.append(
            f"  - Cluster {clus}: {ct} — {n:,} cells ({pct:.1f}%) — top markers: {marker_str}"
        )

    # QC stats
    obs = adata.obs
    n_genes_med = int(obs.get("n_genes_by_counts", obs.get("n_genes", [819])).median())
    umi_med     = int(obs.get("total_counts", [2214]).median())
    mt_med      = float(obs.get("pct_counts_mt", [2.0]).median())

    return f"""You are CodeCell.ai's AI Assistant — an expert bioinformatician embedded in a scRNA-seq data portal.

## Your Role
You are directly connected to a processed PBMC 3K single-cell RNA-seq dataset. Answer questions about:
- The biology of immune cell types in the dataset
- Gene expression patterns and marker genes
- Statistical analysis (Leiden clustering, Wilcoxon DE test, UMAP)
- The Scanpy processing pipeline
- General scRNA-seq concepts and methods

## Dataset: PBMC 3K (Peripheral Blood Mononuclear Cells)
- **Source:** 10x Genomics Chromium, healthy adult donor, hg19 genome
- **Cells:** {adata.n_obs:,} (post-QC filtered)
- **Genes:** {adata.raw.n_vars if adata.raw else adata.n_vars:,} detected
- **Clustering:** Leiden algorithm, resolution=0.5 → {adata.obs['leiden'].nunique()} clusters

## Cluster Composition (Leiden)
{chr(10).join(cluster_lines)}

## QC Summary (post-filter)
- Median genes/cell: {n_genes_med:,} | Median UMIs/cell: {umi_med:,} | Median %MT: {mt_med:.2f}%
- Filters: min 200 genes, max 5% MT, min 3 cells/gene; normalised to 10,000 UMIs + log1p

## Processing Pipeline
sc.read_10x_mtx → filter_cells/genes → sc.pp.normalize_total(1e4) → log1p → 
highly_variable_genes → PCA (40 PCs) → neighbors (n=10) → leiden → UMAP

## Canonical PBMC Marker Genes
- CD4+ T cells: IL7R, CCR7, CD3D, CD3E, LDHB, RPS12
- B cells: CD79A, MS4A1 (CD20), CD79B, HLA-DRA
- Monocytes (CD14+): LYZ, CST3, FTL, FTH1, TYROBP, CD14
- NK/CD8+ T cells: NKG7, GNLY, GZMA, GZMB, CST7
- Dendritic cells: FCER1A, HLA-DPA1, HLA-DPB1, HLA-DRA
- Megakaryocytes: PF4, PPBP, GN611, SDPR

## What You Can Help With
When asked to "show", "plot", or "visualize" something, respond with a JSON block:
```json
{{"action": "plot_gene", "gene": "CD3D"}}
```
or
```json
{{"action": "show_umap"}}
```
or
```json
{{"action": "cluster_markers", "cluster": "0"}}
```
These will trigger actual visualizations in the portal. Otherwise, respond in markdown with rich biological context.

## Tone & Style
- Be conversational, expert, and helpful
- Use **bold** for gene names and cell types
- Explain biology concepts clearly — assume the user may be a life scientist, not a bioinformatician
- Reference specific numbers from this dataset (cell counts, percentages) when relevant
- If asked something outside scRNA-seq biology, politely redirect to dataset-relevant topics
"""


# ─── Main Gemini query function ───────────────────────────────────────────────

def gemini_query(user_message: str, adata, chat_history: list = None) -> dict:
    """
    Send a message to Gemini with full dataset context.
    
    Returns:
        dict with keys: 'text' (str), 'action' (optional dict), 'error' (bool)
    """
    client = get_gemini_client()
    if client is None:
        return {"text": None, "action": None, "error": True, "reason": "no_api_key"}

    try:
        from google import genai
        from google.genai import types

        system_prompt = build_dataset_context(adata)

        # Build conversation history
        contents = []
        if chat_history:
            for msg in chat_history[-8:]:  # keep last 8 turns for context
                role    = "user" if msg.get("role") == "user" else "model"
                content = msg.get("content", "")
                if content:
                    contents.append(types.Content(
                        role=role,
                        parts=[types.Part(text=content)]
                    ))

        # Add current message
        contents.append(types.Content(
            role="user",
            parts=[types.Part(text=user_message)]
        ))

        response = None
        last_err = None
        for model in _MODELS:
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.7,
                        max_output_tokens=1500,
                    )
                )
                break  # success
            except Exception as model_err:
                last_err = model_err
                err_s = str(model_err)
                if "429" in err_s or "RESOURCE_EXHAUSTED" in err_s:
                    print(f"⚠️  {model} quota exceeded, trying next model…")
                    continue
                raise  # non-quota error → propagate

        if response is None:
            raise last_err

        text = response.text or ""

        # Check if Gemini is requesting an action (plot/umap)
        import json, re
        action = None
        json_match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
        if json_match:
            try:
                action = json.loads(json_match.group(1))
                # Remove the JSON block from the displayed text
                text = text[:json_match.start()].strip() + text[json_match.end():].strip()
            except Exception:
                pass

        return {"text": text.strip(), "action": action, "error": False}

    except Exception as e:
        err_str = str(e)
        print(f"Gemini error: {err_str}")
        if "API_KEY_INVALID" in err_str or "API key not valid" in err_str:
            return {"text": None, "action": None, "error": True, "reason": "invalid_key"}
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
            return {"text": None, "action": None, "error": True, "reason": "quota_exceeded"}
        return {"text": None, "action": None, "error": True, "reason": str(e)}
