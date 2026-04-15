"""
plot_engine.py – Generates matplotlib/scanpy plots and saves them to disk.
Returns file paths relative to the /plots static directory.
"""

import os
import uuid
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend — critical for server environments
import matplotlib.pyplot as plt
import scanpy as sc
import pandas as pd

PLOTS_DIR = os.path.join(os.path.dirname(__file__), "plots")
os.makedirs(PLOTS_DIR, exist_ok=True)

# ─── Shared Plot Style ──────────────────────────────────────────────────────

DARK_BG = "#0f1117"
CARD_BG = "#1a1d27"
ACCENT  = "#6366f1"  # Indigo-500

def _apply_dark_style(fig, ax_list=None):
    """Apply a consistent dark-mode aesthetic to all figures."""
    fig.patch.set_facecolor(DARK_BG)
    if ax_list:
        for ax in ax_list:
            ax.set_facecolor(CARD_BG)
            ax.tick_params(colors="#9ca3af")
            ax.xaxis.label.set_color("#d1d5db")
            ax.yaxis.label.set_color("#d1d5db")
            ax.title.set_color("#f9fafb")
            for spine in ax.spines.values():
                spine.set_edgecolor("#374151")


def _save(fig, prefix="plot") -> str:
    """Save figure to plots directory, return the filename."""
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}.png"
    filepath = os.path.join(PLOTS_DIR, filename)
    fig.savefig(filepath, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return filename


# ─── UMAP Plot ──────────────────────────────────────────────────────────────

def plot_umap(adata: sc.AnnData, color: str = "leiden") -> str:
    """
    Generate a Leiden-colored UMAP embedding plot.
    Returns the saved PNG filename.
    """
    fig, ax = plt.subplots(figsize=(8, 6))
    sc.pl.umap(
        adata,
        color=color,
        ax=ax,
        show=False,
        title=f"PBMC 3K – UMAP ({color})",
        frameon=True,
        palette="tab20",
    )
    _apply_dark_style(fig, [ax])
    ax.set_title(f"PBMC 3K – UMAP ({color})", color="#f9fafb", fontsize=13, fontweight="bold", pad=10)
    return _save(fig, prefix="umap")


# ─── Gene Expression Plot ────────────────────────────────────────────────────

def plot_gene(adata: sc.AnnData, gene: str) -> str:
    """
    Plot gene expression overlaid on UMAP. Uses raw counts if available.
    Returns the saved PNG filename or raises ValueError for unknown genes.
    """
    # Check gene exists — search case-insensitively
    all_genes = list(adata.raw.var_names) if adata.raw else list(adata.var_names)
    gene_match = next(
        (g for g in all_genes if g.upper() == gene.upper()), None
    )
    if not gene_match:
        raise ValueError(f"Gene '{gene}' not found in dataset.")

    fig, ax = plt.subplots(figsize=(8, 6))
    sc.pl.umap(
        adata,
        color=gene_match,
        ax=ax,
        show=False,
        title=f"{gene_match} Expression",
        frameon=True,
        use_raw=True,
        color_map="magma",
    )
    _apply_dark_style(fig, [ax])
    ax.set_title(f"{gene_match} – Expression on UMAP", color="#f9fafb", fontsize=13, fontweight="bold", pad=10)
    return _save(fig, prefix=f"gene_{gene_match.lower()}")


# ─── Marker Table ────────────────────────────────────────────────────────────

def compute_markers_text(adata: sc.AnnData, cluster: str) -> str:
    """
    Run differential expression (rank_genes_groups) for all clusters,
    then return the top 10 marker genes for the requested cluster as a
    formatted markdown-style table string.
    """
    # Only run if not already computed, or cluster key missing
    if "rank_genes_groups" not in adata.uns:
        sc.tl.rank_genes_groups(adata, groupby="leiden", method="wilcoxon", use_raw=True)

    try:
        result = adata.uns["rank_genes_groups"]
        genes   = [g for g in result["names"][cluster][:10]]
        scores  = [float(s) for s in result["scores"][cluster][:10]]
        pvals   = [float(p) for p in result["pvals_adj"][cluster][:10]]
        lfc     = [float(l) for l in result["logfoldchanges"][cluster][:10]]

        rows = ["| Rank | Gene | Score | Log2FC | Adj. p-value |",
                "|------|------|-------|--------|--------------|"]
        for i, (g, s, p, l) in enumerate(zip(genes, scores, pvals, lfc), 1):
            rows.append(f"| {i} | **{g}** | {s:.2f} | {l:.2f} | {p:.2e} |")

        return "\n".join(rows)
    except (KeyError, IndexError):
        available = list(adata.obs["leiden"].unique())
        return f"❌ Cluster '{cluster}' not found. Available clusters: {', '.join(sorted(available, key=lambda x: int(x)))}"


def get_cluster_list(adata: sc.AnnData) -> str:
    """Return a formatted list of available Leiden clusters with cell counts."""
    counts = adata.obs["leiden"].value_counts().sort_index()
    lines  = ["| Cluster | Cells |", "|---------|-------|"]
    for cluster, count in counts.items():
        lines.append(f"| Cluster {cluster} | {count:,} |")
    return "\n".join(lines)
