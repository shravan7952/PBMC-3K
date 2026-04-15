"""
main.py – FastAPI server for CodeCell.ai scRNA Explorer.

Endpoints:
  POST /query          NL query dispatcher (expanded, conversational)
  GET  /plots/{file}   Serve generated PNG files
  GET  /health         Health check
  Dashboard endpoints mounted via api_routes router
"""

import os
import re
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import numpy as np

from preprocess import load_and_preprocess
from plot_engine import (
    plot_umap,
    plot_gene,
    compute_markers_text,
    get_cluster_list,
)
from api_routes import router as dashboard_router, set_state, annotate_cluster
from gemini_chat import gemini_query

# ─── Cell type mapping (canonical PBMC 3K) ───────────────────────────────────

CLUSTER_CELL_TYPES = {
    "0": "CD4+ T cells",
    "1": "B cells",
    "2": "Monocytes (CD14+)",
    "3": "NK / CD8+ T cells",
    "4": "Dendritic cells",
    "5": "Megakaryocytes",
}

CELL_TYPE_BIOLOGY = {
    "CD4+ T cells": (
        "CD4+ Helper T cells are the **largest population** in healthy PBMC (~44.6%). "
        "They coordinate immune responses by activating B cells, cytotoxic T cells, and macrophages. "
        "Key markers: **IL7R, CCR7, LDHB, RPS12**. The high ribosomal gene expression (RPS12, RPS25) "
        "is characteristic of rapidly dividing/active T cells."
    ),
    "B cells": (
        "B lymphocytes (~12.9%) are responsible for **antibody production** and adaptive immunity. "
        "Identified by **CD79A** (Igα) and **MS4A1** (CD20, a classic B cell marker used as drug target in rituximab therapy). "
        "HLA-DRA expression reflects their role as antigen-presenting cells."
    ),
    "Monocytes (CD14+)": (
        "Classical CD14+ Monocytes (~24.1%) are major **innate immune phagocytes**. "
        "They patrol the blood, engulf pathogens, and release cytokines. "
        "Key markers: **LYZ** (lysozyme — antibacterial enzyme), **FTL/FTH1** (ferritin, iron storage), "
        "**TYROBP** (DAP12, activates ITAM signaling). Elevated in infection and inflammation."
    ),
    "NK / CD8+ T cells": (
        "Cytotoxic lymphocytes (~16.5%) that **kill virus-infected and tumor cells**. "
        "**NKG7** (natural killer cell granule protein 7) and **GZMA/GZMB** (granzymes) are the "
        "hallmarks of cytotoxic activity — they perforate target cell membranes. "
        "This cluster likely contains both CD8+ T cells and NK cells at this clustering resolution."
    ),
    "Dendritic cells": (
        "Professional **antigen-presenting cells** (~1.4%) that bridge innate and adaptive immunity. "
        "Extremely high **HLA class II** expression (HLA-DPA1, HLA-DPB1, HLA-DRA) enables "
        "presentation of antigens to T cells. Rare in blood but critical for immune regulation."
    ),
    "Megakaryocytes": (
        "Platelet precursor cells (~0.5%) — normally found in bone marrow, rarely in blood. "
        "**PF4** (Platelet Factor 4) and **PPBP** (Pro-Platelet Basic Protein) are diagnostic markers. "
        "Their presence in PBMC suggests minor contamination with platelet-releasing megakaryocytes."
    ),
}

GENE_BIOLOGY = {
    "CD3D": "CD3D is a T cell co-receptor subunit (CD3δ chain). Critical for T cell receptor (TCR) signaling. Expressed in all T cells.",
    "CD3E": "CD3E (CD3ε) is part of the TCR-CD3 complex. Pan-T cell marker. Used in flow cytometry to gate all T cells.",
    "MS4A1": "MS4A1 encodes CD20, a B cell surface protein and the target of rituximab (anti-cancer antibody therapy). Canonical B cell marker.",
    "CD79A": "CD79A (Igα) is essential for B cell receptor (BCR) signaling. One of the most specific B cell markers in scRNA-seq.",
    "LYZ":   "Lysozyme — an antibacterial enzyme secreted by monocytes and macrophages. Classic innate immune marker.",
    "NKG7":  "Natural Killer Cell Granule Protein 7. Expressed in NK cells and cytotoxic T cells. Associates with cytotoxic granules.",
    "GZMA":  "Granzyme A — a serine protease in cytotoxic granules. Released to induce apoptosis in target cells (viral, tumour).",
    "GNLY":  "Granulysin — antimicrobial peptide and cytotoxin from NK cells and CTLs. Kills bacteria and induces apoptosis.",
    "CD8A":  "CD8A is the alpha chain of the CD8 co-receptor. Marks cytotoxic T cells (CD8+). Recognises MHC-I complexes.",
    "PF4":   "Platelet Factor 4 (CXCL4) — secreted by megakaryocytes/platelets. Key megakaryocyte marker and thrombosis regulator.",
    "PPBP":  "Pro-Platelet Basic Protein (CXCL7) — chemokine released by activated platelets. Megakaryocyte/platelet marker.",
    "IL7R":  "IL-7 Receptor alpha chain. Marks naive and memory T cells. Critical for T cell development and survival.",
    "CCR7":  "C-C Chemokine Receptor 7. Expressed on naive T cells and central memory T cells. Guides cell trafficking to lymph nodes.",
    "HLA-DRA": "MHC class II alpha chain. Expressed on professional antigen-presenting cells: dendritic cells, B cells, monocytes.",
    "FTL":   "Ferritin Light Chain — iron storage protein. Highly expressed in monocytes. Elevated in inflammation (acute phase reactant).",
    "TYROBP": "DAP12 — adaptor protein for activating receptors in NK cells and monocytes. Part of innate immune signaling complexes.",
    "LDHB":  "Lactate Dehydrogenase B — involved in cellular energy metabolism. High in T cells reflecting their active metabolic state.",
}

# ─── Global State ─────────────────────────────────────────────────────────────

app_state: dict[str, Any] = {}
PLOTS_DIR = os.path.join(os.path.dirname(__file__), "plots")
os.makedirs(PLOTS_DIR, exist_ok=True)

# Public URL of this backend — used in plot URLs returned to the frontend
# Set BACKEND_URL env var in production (e.g. https://your-app.railway.app)
BACKEND_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")

# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 CodeCell.ai backend starting up...")
    app_state["adata"] = load_and_preprocess()
    app_state["ready"] = True
    set_state(app_state)
    print("✅ Backend ready.")
    yield
    app_state.clear()
    print("🛑 Shutdown.")

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="CodeCell.ai API",
    description="AI-powered scRNA-seq explorer for PBMC 3K",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/plots", StaticFiles(directory=PLOTS_DIR), name="plots")
app.include_router(dashboard_router)


# ─── Models ───────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    type: str   # "plot" | "text" | "table" | "error"
    data: str
    message: str = ""


# ─── Query Dispatcher ─────────────────────────────────────────────────────────

def get_gene(adata, name: str):
    """Fuzzy case-insensitive gene lookup."""
    all_genes = list(adata.raw.var_names) if adata.raw else list(adata.var_names)
    match = next((g for g in all_genes if g.upper() == name.upper()), None)
    return match

def cluster_info_text(adata) -> str:
    """Generate a human-readable cluster summary."""
    counts = adata.obs["leiden"].value_counts().sort_index()
    total  = counts.sum()
    lines  = ["## 🧬 PBMC 3K Cluster Overview\n"]
    lines.append("| Cluster | Cell Type | Cells | % | Key Markers |")
    lines.append("|---------|-----------|-------|---|-------------|")
    for clus, n in counts.items():
        ct = CLUSTER_CELL_TYPES.get(str(clus), f"Cluster {clus}")
        pct = n / total * 100
        # Top 3 markers from ranked genes
        try:
            top = [str(g) for g in adata.uns["rank_genes_groups"]["names"][str(clus)][:3]]
            markers = ", ".join(top)
        except Exception:
            markers = "—"
        lines.append(f"| {clus} | **{ct}** | {n:,} | {pct:.1f}% | `{markers}` |")
    lines.append(f"\n**Total:** {total:,} cells across {len(counts)} clusters")
    return "\n".join(lines)

def gene_info_text(gene: str, adata) -> str:
    """Generate detailed gene biology + expression stats."""
    bio = GENE_BIOLOGY.get(gene.upper() if gene.upper() in GENE_BIOLOGY else gene,
                           GENE_BIOLOGY.get(gene, None))
    lines = [f"## 🧬 Gene: **{gene}**\n"]
    if bio:
        lines.append(f"> {bio}\n")

    # Expression stats per cluster
    g = get_gene(adata, gene)
    if g:
        import scipy.sparse
        gene_idx = list(adata.raw.var_names).index(g) if adata.raw else list(adata.var_names).index(g)
        expr_mat  = adata.raw.X if adata.raw else adata.X
        if scipy.sparse.issparse(expr_mat):
            vals = expr_mat[:, gene_idx].toarray().flatten()
        else:
            vals = np.array(expr_mat[:, gene_idx]).flatten()

        clusters = adata.obs["leiden"].tolist()
        lines.append("### Expression per Cell Type\n")
        lines.append("| Cell Type | Cluster | Mean | % Expressing |")
        lines.append("|-----------|---------|------|-------------|")
        for clus in sorted(adata.obs["leiden"].unique(), key=int):
            mask = np.array([c == clus for c in clusters])
            cv   = vals[mask]
            ct   = CLUSTER_CELL_TYPES.get(str(clus), f"Cluster {clus}")
            pct  = float(np.mean(cv > 0) * 100)
            mean = float(np.mean(cv))
            lines.append(f"| {ct} | C{clus} | {mean:.4f} | {pct:.1f}% |")

        overall_pct = float(np.mean(vals > 0) * 100)
        lines.append(f"\n**Overall:** expressed in {overall_pct:.1f}% of all cells")
    return "\n".join(lines)

def cell_type_info_text(cell_type_query: str) -> str:
    """Return biology info about a queried cell type — best-match algorithm."""
    q = cell_type_query.lower()

    # Keywords that specifically identify each cell type
    CELL_TYPE_KEYWORDS = {
        "Megakaryocytes":     ["megakaryocyte", "platelet precursor", "ppbp", "pf4"],
        "Dendritic cells":    ["dendritic", "fcer1a", "antigen.presenting"],
        "B cells":            [r"\bb\s+cell", "ms4a1", "cd79a", "cd79b", "cd20", "lymphocyte"],
        "NK / CD8+ T cells":  ["nk cell", "nkg7", "natural killer", "cytotoxic", "gnly", "gzma"],
        "Monocytes (CD14+)":  ["monocyte", "lyz", "cd14", "classical monocyte","fcgr3a"],
        "Monocytes":          ["monocyte", "lyz"],
        "CD8+ T cells":       ["cd8", "cytotoxic t"],
        "CD4+ T cells":       [r"cd4\b", r"helper\s+t", r"t\s+help", "il7r", "ccr7"],
    }

    # Score each cell type by how many keywords match
    best_ct, best_score = None, 0
    for ct, keywords in CELL_TYPE_KEYWORDS.items():
        score = sum(1 for kw in keywords if re.search(kw, q))
        if score > best_score:
            best_score = score
            best_ct = ct

    # Also try direct substring of the cell type name itself
    for ct in CELL_TYPE_BIOLOGY:
        main_word = ct.lower().split()[0]  # e.g. "b", "monocytes", "dendritic"
        if len(main_word) > 1 and main_word in q:
            if best_score == 0:
                best_ct = ct

    if not best_ct or best_ct not in CELL_TYPE_BIOLOGY:
        return None

    clus_id = next((k for k, v in CLUSTER_CELL_TYPES.items() if v == best_ct), "—")
    n_cells = ""
    if best_ct in CLUSTER_CELL_TYPES.values():
        pass  # could add counts if we had adata here — skip for now

    return (
        f"## {best_ct} (Cluster {clus_id})\n\n"
        f"{CELL_TYPE_BIOLOGY[best_ct]}\n\n"
        f"**In this PBMC 3K dataset:** Cluster {clus_id} · {CLUSTER_CELL_TYPES.get(clus_id, best_ct)}"
    )

def qc_summary_text(adata) -> str:
    """Return a QC summary in markdown."""
    obs = adata.obs
    n_genes     = obs.get("n_genes_by_counts", obs.get("n_genes", None))
    total_counts= obs.get("total_counts", None)
    pct_mt      = obs.get("pct_counts_mt", None)
    lines = ["## 📊 Quality Control Summary — PBMC 3K\n"]
    lines.append("| Metric | Value |")
    lines.append("|--------|-------|")
    lines.append(f"| Total cells (post-QC) | **{adata.n_obs:,}** |")
    total_genes = adata.raw.n_vars if adata.raw else adata.n_vars
    lines.append(f"| Total genes detected | **{total_genes:,}** |")
    lines.append(f"| Leiden clusters | **{adata.obs['leiden'].nunique()}** |")
    if n_genes is not None:
        lines.append(f"| Median genes/cell | **{int(n_genes.median()):,}** |")
        lines.append(f"| Min / Max genes/cell | {int(n_genes.min()):,} / {int(n_genes.max()):,} |")
    if total_counts is not None:
        lines.append(f"| Median UMIs/cell | **{int(total_counts.median()):,}** |")
    if pct_mt is not None:
        lines.append(f"| Median %MT | **{pct_mt.median():.2f}%** |")
        lines.append(f"| Cells with >5% MT | {(pct_mt > 5).sum():,} (already filtered) |")
    lines.append("\n### Filters Applied\n")
    lines.append("- ✅ Cells with < 200 genes removed\n- ✅ Cells with > 5% mitochondrial reads removed\n- ✅ Genes expressed in < 3 cells removed\n- ✅ Normalised to 10,000 counts/cell → log1p transformed")
    return "\n".join(lines)

def compare_clusters_text(adata, a: str, b: str) -> str:
    """Quick text comparison between two clusters."""
    ct_a = CLUSTER_CELL_TYPES.get(a, f"Cluster {a}")
    ct_b = CLUSTER_CELL_TYPES.get(b, f"Cluster {b}")
    bio_a = CELL_TYPE_BIOLOGY.get(ct_a, "")
    bio_b = CELL_TYPE_BIOLOGY.get(ct_b, "")
    n_a = (adata.obs["leiden"] == a).sum()
    n_b = (adata.obs["leiden"] == b).sum()
    return (
        f"## Cluster {a} vs Cluster {b}\n\n"
        f"### Cluster {a} — {ct_a} ({n_a:,} cells)\n{bio_a}\n\n"
        f"### Cluster {b} — {ct_b} ({n_b:,} cells)\n{bio_b}\n\n"
        f"Use the **DEG Compare** tab in the Clusters page for full differential expression analysis."
    )

def capabilities_text() -> str:
    return """## 🤖 CodeCell.ai AI Assistant — What I Can Do

### 🔬 Gene Queries
- `Plot CD3D` — UMAP colored by any gene's expression
- `What is MS4A1?` — Biology, function, and expression stats
- `CD79A expression` — Per-cluster expression breakdown

### 🧫 Cell Type Biology
- `Tell me about B cells` — Deep biology of any cell type
- `What are NK cells?` — Function, markers, and clinical significance
- `Explain monocytes` — Detailed immunology

### 🗺️ UMAP & Visualization
- `Show UMAP` — Full UMAP colored by Leiden clusters
- `UMAP colored by NKG7` — Gene expression overlay

### 📊 Cluster Analysis
- `Top markers cluster 0` — Ranked marker genes (Wilcoxon)
- `List clusters` — Full cluster composition table
- `Compare cluster 0 and 2` — Side-by-side cell type comparison
- `Markers for B cells` — Find markers for a cell type

### 📈 QC & Statistics
- `Show QC` or `Quality control summary` — Full QC metrics
- `How many cells?` — Dataset stats

### 🧬 Biology Questions
- `What does GZMA do?` — Gene function explanation
- `Why is LYZ high in monocytes?` — Contextual biology

### 💡 Tips
You can ask me in **plain English** — I understand natural phrasing.
Try: *"What genes are specific to T cells?"*  or  *"Explain the difference between clusters 0 and 3"*
"""


def dispatch_query(query: str) -> QueryResponse:
    adata = app_state["adata"]
    q_raw = query.strip()
    q     = q_raw.lower()

    # ── UMAP ────────────────────────────────────────────────────────────────
    if re.search(r"\bumap\b|show.*(cluster|embedding|map|overview)|scatter plot|dimensionality", q):
        filename = plot_umap(adata, color="leiden")
        return QueryResponse(
            type="plot",
            data=f"{BACKEND_URL}/plots/{filename}",
            message="UMAP embedding colored by Leiden cluster (with cell type annotations)",
        )

    # ── Help / Capabilities ───────────────────────────────────────────────
    if re.search(r"\b(help|what can you|capabilities|guide|tutorial|how to|what do you)\b", q):
        return QueryResponse(type="text", data=capabilities_text(), message="Capabilities")

    # ── QC Summary ───────────────────────────────────────────────────────
    if re.search(r"\b(qc|quality control|quality|metrics|statistics|stats|how many (cells|genes))\b", q):
        return QueryResponse(type="table", data=qc_summary_text(adata), message="QC Summary")

    # ── Cell type biology query ───────────────────────────────────────────
    # Must check BEFORE gene_bio so "What are B cells?" doesn't match gene 'B'
    cell_type_patterns = [
        r"(what (are|is)|tell me about|explain|describe|about)\s+(the\s+)?([a-z\+/ ]+\bcells?\b)",
        r"(what (are|is)|tell me about|explain|describe)\s+(monocytes?|dendritic\s+cells?|megakaryocytes?|nk\s+cells?|t\s+cells?|b\s+cells?|lymphocytes?|granulocytes?)",
        r"(explain|describe)\s+(monocytes?|dendritic|megakaryocytes?)",
    ]
    for pat in cell_type_patterns:
        m = re.search(pat, q)
        if m:
            result = cell_type_info_text(m.group(0))
            if result:
                return QueryResponse(type="text", data=result, message=f"Cell type biology")

    # ── Compare two clusters ──────────────────────────────────────────────
    compare_m = re.search(r"compare\s+(?:cluster\s*)?(\d+)\s+(?:and|vs|versus|with)\s+(?:cluster\s*)?(\d+)", q)
    if compare_m:
        a, b = compare_m.group(1), compare_m.group(2)
        return QueryResponse(type="text", data=compare_clusters_text(adata, a, b), message=f"Cluster {a} vs {b}")

    # ── Marker genes for a cell type ─────────────────────────────────────
    ct_marker_m = re.search(r"markers?\s+(?:for\s+|of\s+)?([a-z\+ /]+(?:cells?|cytes?))", q)
    if ct_marker_m:
        ct_name = ct_marker_m.group(1)
        clus_id = next((k for k, v in CLUSTER_CELL_TYPES.items()
                        if any(w in v.lower() for w in ct_name.split())), None)
        if clus_id:
            table_text = compute_markers_text(adata, clus_id)
            ct = CLUSTER_CELL_TYPES[clus_id]
            return QueryResponse(type="table", data=f"## Marker Genes — {ct}\n\n" + table_text,
                                 message=f"Top markers for {ct}")

    # ── Top markers for a numbered cluster ────────────────────────────────
    marker_m = re.search(r"(?:marker|top\s*gene|rank|differentially|de\b).*?cluster\s*(\d+)", q)
    if not marker_m:
        marker_m = re.search(r"cluster\s*(\d+)\s*(?:marker|gene|top)", q)
    if not marker_m:
        # "top markers 0" or "markers 0"
        marker_m = re.search(r"(?:top\s+)?markers?\s+(\d+)$", q)
    if marker_m:
        clus_id = marker_m.group(1)
        ct = CLUSTER_CELL_TYPES.get(clus_id, f"Cluster {clus_id}")
        table_text = compute_markers_text(adata, clus_id)
        return QueryResponse(type="table",
                             data=f"## Top Markers — Cluster {clus_id} ({ct})\n\n{table_text}",
                             message=f"Markers for Cluster {clus_id} ({ct})")

    # ── Gene biology / what is gene ───────────────────────────────────────
    gene_bio_m = re.search(r"(?:what\s+is|what\s+does|explain|tell\s+me\s+about|about|function\s+of)\s+([A-Za-z0-9\-]+)", q_raw, re.IGNORECASE)
    if gene_bio_m:
        candidate = gene_bio_m.group(1).upper()
        if candidate in GENE_BIOLOGY or get_gene(adata, candidate):
            gene = get_gene(adata, candidate) or candidate
            return QueryResponse(type="text", data=gene_info_text(gene, adata),
                                 message=f"Gene biology: {gene}")

    # ── Gene expression plot ──────────────────────────────────────────────
    gene_plot_m = re.search(r"\b(?:plot|show|visualize|display|color|colour|highlight)\s+([A-Za-z][A-Za-z0-9\-]+)", q_raw, re.IGNORECASE)
    if not gene_plot_m:
        # bare gene name like "CD3D expression"
        gene_plot_m = re.search(r"^([A-Za-z][A-Za-z0-9\-]+)\s*(?:expression|expr)?$", q_raw.strip(), re.IGNORECASE)
    if gene_plot_m:
        candidate = gene_plot_m.group(1).upper()
        gene = get_gene(adata, candidate)
        if gene:
            try:
                filename = plot_gene(adata, gene)
                bio = GENE_BIOLOGY.get(gene, "")
                msg = f"{gene} expression on UMAP"
                if bio:
                    msg += f" · {bio[:80]}…"
                return QueryResponse(type="plot",
                                     data=f"{BACKEND_URL}/plots/{filename}",
                                     message=msg)
            except ValueError as e:
                return QueryResponse(type="error", data="", message=str(e))

    # ── Cluster list ─────────────────────────────────────────────────────
    if re.search(r"\b(cluster|leiden|group|all clusters|list cluster|how many cluster)\b", q):
        return QueryResponse(type="table", data=cluster_info_text(adata), message="Cluster overview")

    # ── Dataset info ─────────────────────────────────────────────────────
    if re.search(r"\b(dataset|pbmc|what data|sample|donor|sequencing|10x)\b", q):
        info = (
            "## 📦 PBMC 3K Dataset\n\n"
            "| Property | Value |\n|----------|-------|\n"
            f"| Dataset | PBMC 3K (Peripheral Blood Mononuclear Cells) |\n"
            f"| Source | 10x Genomics Chromium |\n"
            f"| Organism | *Homo sapiens* (hg19) |\n"
            f"| Tissue | Peripheral Blood |\n"
            f"| Donor | Healthy adult |\n"
            f"| Cells (post-QC) | {adata.n_obs:,} |\n"
            f"| Genes detected | {adata.raw.n_vars if adata.raw else adata.n_vars:,} |\n"
            f"| Clusters | {adata.obs['leiden'].nunique()} (Leiden, res=0.5) |\n\n"
            "Downloaded from the [10x Genomics website](https://www.10xgenomics.com/resources/datasets/pbmc-3-k-from-a-healthy-donor-1-standard-1-1-0). "
            "The canonical reference dataset for scRNA-seq methods benchmarking."
        )
        return QueryResponse(type="text", data=info, message="Dataset info")

    # ── Fallback: try to find any gene name in the query ─────────────────
    words = re.findall(r"\b[A-Za-z][A-Za-z0-9\-]{2,}\b", q_raw)
    for word in words:
        gene = get_gene(adata, word)
        if gene:
            # Return gene info + offer to plot
            info = gene_info_text(gene, adata)
            info += f"\n\n💡 *Try: `Plot {gene}` to see expression on UMAP*"
            return QueryResponse(type="text", data=info, message=f"Gene: {gene}")

    # ── Final fallback ────────────────────────────────────────────────────
    return QueryResponse(
        type="text",
        data=(
            f"I understood your question but couldn't find a specific match for **\"{q_raw}\"**.\n\n"
            "Here are some things you can try:\n"
            "- `Show UMAP` — visualise the embedding\n"
            "- `Plot CD3D` — any gene expression\n"
            "- `What are B cells?` — cell type biology\n"
            "- `What is NKG7?` — gene function\n"
            "- `Top markers cluster 0` — ranked markers\n"
            "- `List clusters` — full cluster table\n"
            "- `QC summary` — quality control metrics\n"
            "- `Help` — full list of capabilities"
        ),
        message="No match found",
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ready" if app_state.get("ready") else "loading",
        "cells": int(app_state["adata"].n_obs) if app_state.get("ready") else 0,
        "clusters": int(app_state["adata"].obs["leiden"].nunique()) if app_state.get("ready") else 0,
    }

@app.post("/query", response_model=QueryResponse)
async def query_endpoint(req: QueryRequest):
    if not app_state.get("ready"):
        raise HTTPException(status_code=503, detail="Dataset is still loading. Please wait...")
    try:
        return dispatch_query(req.query)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return QueryResponse(type="error", data="", message=f"Internal error: {str(e)}")


# ─── Gemini Chat Endpoint ──────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str    # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[list[ChatMessage]] = []

class ChatResponse(BaseModel):
    text: str
    type: str = "text"    # "text" | "plot" | "table"
    plot_url: Optional[str] = None
    powered_by: str = "gemini"   # "gemini" | "builtin"

@app.get("/chat-status")
async def chat_status():
    """Check whether Gemini API is configured."""
    import os
    has_key = bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
    return {"gemini_available": has_key, "model": "gemini-2.5-flash" if has_key else None}

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    """
    Conversational AI endpoint.
    - If GEMINI_API_KEY is set → uses Gemini 2.0 Flash with full dataset context
    - Otherwise → falls back to the built-in smart regex system
    """
    if not app_state.get("ready"):
        raise HTTPException(status_code=503, detail="Dataset is still loading.")

    adata = app_state["adata"]

    # Try Gemini first
    history = [{"role": m.role, "content": m.content} for m in (req.history or [])]
    result  = gemini_query(req.message, adata, history)

    if result["error"]:
        reason = result.get("reason", "")
        if reason == "no_api_key":
            # Fall back to built-in regex system
            qr = dispatch_query(req.message)
            return ChatResponse(
                text=qr.data or qr.message,
                type=qr.type,
                plot_url=qr.data if qr.type == "plot" else None,
                powered_by="builtin",
            )
        elif reason == "quota_exceeded":
            # All models hit quota — fall back to builtin with friendly message
            qr = dispatch_query(req.message)
            fallback_text = (
                "> ⚠️ **Gemini API rate limit reached.** All models (gemini-1.5-flash, gemini-1.5-flash-8b, gemini-2.0-flash) "
                "are temporarily throttled. This happens on the free tier (~15 req/min). "
                "The limit resets every minute. Using built-in assistant now:\n\n---\n\n"
            ) + (qr.data or qr.message)
            return ChatResponse(
                text=fallback_text,
                type=qr.type,
                plot_url=qr.data if qr.type == "plot" else None,
                powered_by="builtin",
            )
        elif reason == "invalid_key":
            return ChatResponse(
                text="⚠️ **Gemini API key is invalid.** Please check your `GEMINI_API_KEY` environment variable and restart the server.\n\nFalling back to built-in assistant…",
                type="text", powered_by="builtin",
            )
        else:
            # Other Gemini error — fallback gracefully
            qr = dispatch_query(req.message)
            return ChatResponse(
                text=qr.data or qr.message,
                type=qr.type,
                plot_url=qr.data if qr.type == "plot" else None,
                powered_by="builtin",
            )

    # Gemini returned a response — check for action requests
    action   = result.get("action")
    plot_url = None
    resp_type = "text"

    if action:
        action_name = action.get("action", "")
        try:
            if action_name == "plot_gene":
                gene = action.get("gene", "").upper()
                real_gene = get_gene(adata, gene)
                if real_gene:
                    filename = plot_gene(adata, real_gene)
                    plot_url  = f"{BACKEND_URL}/plots/{filename}"
                    resp_type = "plot"
            elif action_name == "show_umap":
                filename  = plot_umap(adata, color="leiden")
                plot_url  = f"{BACKEND_URL}/plots/{filename}"
                resp_type = "plot"
            elif action_name == "cluster_markers":
                clus = str(action.get("cluster", "0"))
                marker_text = compute_markers_text(adata, clus)
                # Prepend markers table to Gemini's explanation
                result["text"] = marker_text + "\n\n---\n\n" + result["text"]
                resp_type = "table"
        except Exception as e:
            print(f"Action execution failed: {e}")

    return ChatResponse(
        text=result["text"],
        type=resp_type,
        plot_url=plot_url,
        powered_by="gemini",
    )
