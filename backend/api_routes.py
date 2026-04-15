"""Updated api_routes.py with accurate PBMC 3K cell type annotations"""

import numpy as np
import pandas as pd
import scanpy as sc
import matplotlib
matplotlib.use("Agg")

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

router = APIRouter()
_state = {}

def set_state(state: dict):
    _state.update(state)

def get_adata():
    if not _state.get("ready"):
        raise HTTPException(503, "Dataset is still preprocessing. Please wait.")
    return _state["adata"]


# ─── Precise PBMC cell type marker rules ────────────────────────────────────
# Based on canonical PBMC 3K Seurat/Scanpy tutorial + literature
CELL_TYPE_RULES = [
    # (marker_genes_present, cell_type_label, color)
    # Order matters — more specific markers first
    (["PF4", "PPBP", "SDPR", "GN611"],                       "Megakaryocytes",      "#f59e0b"),
    (["CD79A", "MS4A1", "CD79B"],                             "B cells",             "#8b5cf6"),
    (["GNLY", "NKG7", "GZMA", "CST7"],                       "NK / CD8+ T cells",   "#10b981"),
    (["GZMA", "CD8A", "CD8B"],                                "CD8+ T cells",        "#34d399"),
    (["LYZ", "TYROBP", "FTL", "FTH1"],                       "Monocytes (CD14+)",   "#f97316"),
    (["FCGR3A", "MS4A7", "IFITM3"],                          "Monocytes (FCGR3A+)", "#fb923c"),
    (["FCER1A", "HLA-DPA1", "HLA-DPB1"],                     "Dendritic cells",     "#ec4899"),
    (["HLA-DRA", "HLA-DPB1", "HLA-DPA1", "CD74"],            "Dendritic cells",     "#ec4899"),
    (["IL7R", "CCR7", "LDHB", "RPS12"],                      "CD4+ T cells",        "#60a5fa"),
    # Fallbacks — single strong marker
    (["MS4A1"],                                               "B cells",             "#8b5cf6"),
    (["LYZ"],                                                 "Monocytes",           "#f97316"),
    (["GNLY", "NKG7"],                                        "NK cells",            "#10b981"),
    (["LDHB", "RPS25", "RPS12"],                              "CD4+ T cells",        "#60a5fa"),
]

DESCRIPTION_MAP = {
    "CD4+ T cells":       "Helper T cells expressing IL7R/CCR7. Largest PBMC fraction in healthy donors.",
    "B cells":            "B lymphocytes identified by CD79A/MS4A1 (CD20). Produce antibodies.",
    "Monocytes (CD14+)":  "Classical monocytes expressing LYZ and CD14. Innate immune phagocytes.",
    "Monocytes (FCGR3A+)":"Non-classical monocytes with high FCGR3A (CD16) expression.",
    "NK / CD8+ T cells":  "Cytotoxic lymphocytes expressing NKG7, GZMA. Kill infected/tumor cells.",
    "CD8+ T cells":       "Cytotoxic T cells with CD8A/GZMA. Target virus-infected cells.",
    "NK cells":           "Natural killer cells — innate cytotoxic lymphocytes.",
    "Dendritic cells":    "Professional antigen-presenting cells with high HLA-II expression.",
    "Megakaryocytes":     "Platelet precursors expressing PF4/PPBP. Rare in PBMCs.",
    "T cells":            "T lymphocytes (mixed CD4/CD8). Adaptive immune cells.",
    "Monocytes":          "Innate immune monocytes expressing LYZ.",
}

def annotate_cluster(top_genes: list) -> tuple:
    """Return (cell_type, color) for a cluster given its top expressed genes."""
    top_set = set(g.upper() for g in top_genes)
    for markers, cell_type, color in CELL_TYPE_RULES:
        hits = sum(1 for m in markers if m.upper() in top_set)
        if hits >= max(1, len(markers) // 2):
            return cell_type, color
    return "Unknown", "#64748b"


# ─── 1. UMAP Coordinate Data ─────────────────────────────────────────────────
@router.get("/umap-data")
async def umap_data(color_by: str = "leiden"):
    adata = get_adata()
    coords = adata.obsm["X_umap"]
    x = coords[:, 0].tolist()
    y = coords[:, 1].tolist()

    all_genes = list(adata.raw.var_names) if adata.raw else list(adata.var_names)
    gene_match = next((g for g in all_genes if g.upper() == color_by.upper()), None)

    if gene_match and color_by not in ["leiden"] and color_by not in adata.obs.columns:
        gene_idx = list(adata.raw.var_names).index(gene_match) if adata.raw else list(adata.var_names).index(gene_match)
        expr_mat = adata.raw.X if adata.raw else adata.X
        if hasattr(expr_mat, "toarray"):
            vals = expr_mat[:, gene_idx].toarray().flatten().tolist()
        else:
            vals = expr_mat[:, gene_idx].flatten().tolist()
        color_type = "continuous"
        color_values = vals
        color_label = gene_match
    elif color_by in adata.obs.columns and color_by != "leiden":
        color_type = "continuous"
        color_values = [float(v) if pd.notna(v) else 0.0 for v in adata.obs[color_by]]
        color_label = color_by
    else:
        # Gene check for leiden override
        gm = next((g for g in all_genes if g.upper() == color_by.upper()), None) if color_by != "leiden" else None
        if gm:
            gene_idx = list(adata.raw.var_names).index(gm) if adata.raw else list(adata.var_names).index(gm)
            expr_mat = adata.raw.X if adata.raw else adata.X
            if hasattr(expr_mat, "toarray"):
                vals = expr_mat[:, gene_idx].toarray().flatten().tolist()
            else:
                vals = expr_mat[:, gene_idx].flatten().tolist()
            color_type = "continuous"
            color_values = vals
            color_label = gm
        else:
            color_type = "categorical"
            color_values = adata.obs["leiden"].tolist()
            color_label = "leiden"

    return {
        "x": x, "y": y,
        "color_values": color_values,
        "color_type": color_type,
        "color_label": color_label,
        "cell_ids": adata.obs_names.tolist(),
        "clusters": adata.obs["leiden"].tolist(),
        "n_cells": len(x),
    }


# ─── 2. QC Metrics ────────────────────────────────────────────────────────────
@router.get("/qc-metrics")
async def qc_metrics():
    adata = get_adata()
    obs = adata.obs

    def safe_list(series):
        return [float(v) if pd.notna(v) else 0.0 for v in series]

    n_genes      = safe_list(obs.get("n_genes_by_counts", obs.get("n_genes", pd.Series([]))))
    total_counts = safe_list(obs.get("total_counts", pd.Series([])))
    pct_mt       = safe_list(obs.get("pct_counts_mt", pd.Series([])))
    clusters     = obs["leiden"].tolist()

    return {
        "stats": {
            "total_cells":   int(adata.n_obs),
            "total_genes":   int(adata.raw.n_vars) if adata.raw else int(adata.n_vars),
            "n_clusters":    int(obs["leiden"].nunique()),
            "median_genes":  float(np.median(n_genes)) if n_genes else 0,
            "median_umi":    float(np.median(total_counts)) if total_counts else 0,
            "median_pct_mt": float(np.median(pct_mt)) if pct_mt else 0,
        },
        "scatter":    {"x": total_counts, "y": n_genes, "pct_mt": pct_mt, "clusters": clusters},
        "histograms": {"n_genes": n_genes, "total_counts": total_counts, "pct_mt": pct_mt},
    }


# ─── 3. Gene List ─────────────────────────────────────────────────────────────
@router.get("/gene-list")
async def gene_list(q: str = "", limit: int = 60):
    adata = get_adata()
    all_genes = list(adata.raw.var_names) if adata.raw else list(adata.var_names)
    filtered = [g for g in all_genes if q.upper() in g.upper()][:limit] if q else all_genes[:limit]
    return {"genes": filtered, "total": len(all_genes)}


# ─── 4. Violin Data ───────────────────────────────────────────────────────────
@router.get("/violin")
async def violin_data(gene: str):
    adata = get_adata()
    all_genes = list(adata.raw.var_names) if adata.raw else list(adata.var_names)
    gene_match = next((g for g in all_genes if g.upper() == gene.upper()), None)
    if not gene_match:
        raise HTTPException(404, f"Gene '{gene}' not found")

    gene_idx = list(adata.raw.var_names).index(gene_match) if adata.raw else list(adata.var_names).index(gene_match)
    expr_mat = adata.raw.X if adata.raw else adata.X
    if hasattr(expr_mat, "toarray"):
        vals = expr_mat[:, gene_idx].toarray().flatten()
    else:
        vals = np.array(expr_mat[:, gene_idx]).flatten()

    clusters = adata.obs["leiden"].tolist()
    unique_clusters = sorted(adata.obs["leiden"].unique(), key=lambda x: int(x))
    per_cluster = {}
    for clus in unique_clusters:
        mask = np.array([c == clus for c in clusters])
        cv = vals[mask].tolist()
        per_cluster[clus] = {
            "values": cv,
            "mean": float(np.mean(cv)), "median": float(np.median(cv)),
            "q25": float(np.percentile(cv, 25)), "q75": float(np.percentile(cv, 75)),
            "max": float(np.max(cv)),
            "pct_expressing": float(np.mean([v > 0 for v in cv]) * 100),
        }
    return {"gene": gene_match, "per_cluster": per_cluster, "clusters": unique_clusters}


# ─── 5. Dot Plot ──────────────────────────────────────────────────────────────
@router.get("/dotplot")
async def dotplot_data(genes: str = "CD3D,MS4A1,LYZ,CD79A,GNLY,NKG7,CD8A,PPBP"):
    adata = get_adata()
    all_genes = list(adata.raw.var_names) if adata.raw else list(adata.var_names)
    matched = []
    for g in [x.strip() for x in genes.split(",")]:
        m = next((x for x in all_genes if x.upper() == g.upper()), None)
        if m:
            matched.append(m)
    if not matched:
        raise HTTPException(404, "None of the requested genes found")

    unique_clusters = sorted(adata.obs["leiden"].unique(), key=lambda x: int(x))
    clusters = adata.obs["leiden"].tolist()
    result = []
    for gene in matched:
        gene_idx = list(adata.raw.var_names).index(gene) if adata.raw else list(adata.var_names).index(gene)
        expr_mat = adata.raw.X if adata.raw else adata.X
        if hasattr(expr_mat, "toarray"):
            vals = expr_mat[:, gene_idx].toarray().flatten()
        else:
            vals = np.array(expr_mat[:, gene_idx]).flatten()
        for clus in unique_clusters:
            mask = np.array([c == clus for c in clusters])
            cv = vals[mask]
            result.append({
                "gene": gene, "cluster": str(clus),
                "mean_expr": float(np.mean(cv)),
                "pct_expressing": float(np.mean(cv > 0) * 100),
            })
    return {"data": result, "genes": matched, "clusters": unique_clusters}


# ─── 6. Cluster Summary with accurate cell type annotation ────────────────────
@router.get("/cluster-summary")
async def cluster_summary():
    adata = get_adata()
    counts = adata.obs["leiden"].value_counts().sort_index()

    if "rank_genes_groups" not in adata.uns:
        sc.tl.rank_genes_groups(adata, groupby="leiden", method="wilcoxon", use_raw=True)

    clusters_data = []
    for clus in sorted(counts.index, key=lambda x: int(x)):
        top_genes = [str(g) for g in adata.uns["rank_genes_groups"]["names"][clus][:10]]
        cell_type, color = annotate_cluster(top_genes)
        description = DESCRIPTION_MAP.get(cell_type, "")
        clusters_data.append({
            "cluster":     str(clus),
            "n_cells":     int(counts[clus]),
            "pct":         float(counts[clus] / counts.sum() * 100),
            "top_genes":   top_genes[:5],
            "annotation":  cell_type,
            "color":       color,
            "description": description,
        })

    return {"clusters": clusters_data, "total_cells": int(counts.sum())}


# ─── 7. Cluster DEG Compare ───────────────────────────────────────────────────
@router.get("/cluster-compare")
async def cluster_compare(a: str = "0", b: str = "1", n_genes: int = 15):
    adata = get_adata()
    available = sorted(adata.obs["leiden"].unique())
    if a not in available or b not in available:
        raise HTTPException(400, f"Clusters must be one of: {', '.join(available)}")
    subset = adata[adata.obs["leiden"].isin([a, b])].copy()
    sc.tl.rank_genes_groups(subset, groupby="leiden", groups=[a], reference=b, method="wilcoxon", use_raw=True)
    return {
        "cluster_a": a, "cluster_b": b,
        "genes":          [str(g) for g in subset.uns["rank_genes_groups"]["names"][a][:n_genes]],
        "scores":         [float(s) for s in subset.uns["rank_genes_groups"]["scores"][a][:n_genes]],
        "logfoldchanges": [float(l) for l in subset.uns["rank_genes_groups"]["logfoldchanges"][a][:n_genes]],
        "pvals_adj":      [float(p) for p in subset.uns["rank_genes_groups"]["pvals_adj"][a][:n_genes]],
    }


# ─── 8. Annotation ────────────────────────────────────────────────────────────
class AnnotateRequest(BaseModel):
    cluster: str
    label: str

@router.post("/annotate-cluster")
async def annotate_cluster_endpoint(req: AnnotateRequest):
    _state.setdefault("annotations", {})[req.cluster] = req.label
    return {"cluster": req.cluster, "label": req.label, "all": _state["annotations"]}

@router.get("/annotations")
async def get_annotations():
    return _state.get("annotations", {})
