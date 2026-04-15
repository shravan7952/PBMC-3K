"""
preprocess.py – Scanpy preprocessing pipeline for PBMC 3K dataset.

Data loading priority:
  1. Pre-processed cache (cache/pbmc3k_processed.h5ad) — instant load
  2. Raw local data (relative path from repo root)
  3. Auto-download from Scanpy datasets (requires internet)
"""

import scanpy as sc
import os
from pathlib import Path

# ── Paths (portable — works locally AND on Railway/Render) ─────────────────────
THIS_DIR   = Path(__file__).parent                      # backend/
ROOT_DIR   = THIS_DIR.parent                            # project root
CACHE_FILE = THIS_DIR / "cache" / "pbmc3k_processed.h5ad"
RAW_DIR    = ROOT_DIR / "pbmc3k_filtered_gene_bc_matrices" / "filtered_gene_bc_matrices" / "hg19"

os.makedirs(THIS_DIR / "cache", exist_ok=True)


def load_and_preprocess() -> sc.AnnData:
    """
    Load the 10x Genomics PBMC 3K dataset and run the full preprocessing pipeline.
    Uses cache when available (dramatically faster restarts).
    """
    # ── 1. Load from processed cache (fastest) ─────────────────────────────
    if CACHE_FILE.exists():
        print(f"⚡ Loading processed AnnData from cache: {CACHE_FILE}")
        adata = sc.read_h5ad(CACHE_FILE)
        print(f"✅ Loaded {adata.n_obs:,} cells × {adata.n_vars:,} genes from cache.")
        return adata

    # ── 2. Load raw data (local or download) ──────────────────────────────
    if RAW_DIR.exists():
        print(f"📦 Loading raw PBMC 3K from: {RAW_DIR}")
        adata = sc.read_10x_mtx(str(RAW_DIR), var_names="gene_symbols", cache=True)
    else:
        print("🌐 Raw data not found locally. Downloading from Scanpy datasets...")
        adata = sc.datasets.pbmc3k()
        print("✅ Download complete.")

    adata.var_names_make_unique()

    # ── 3. Preprocessing pipeline ──────────────────────────────────────────
    print("🔬 Filtering cells and genes...")
    sc.pp.filter_cells(adata, min_genes=200)
    sc.pp.filter_genes(adata, min_cells=3)

    # Mitochondrial QC
    adata.var["mt"] = adata.var_names.str.startswith("MT-")
    sc.pp.calculate_qc_metrics(adata, qc_vars=["mt"], percent_top=None, log1p=False, inplace=True)
    adata = adata[adata.obs.pct_counts_mt < 5, :].copy()

    print("📊 Normalizing and log-transforming...")
    sc.pp.normalize_total(adata, target_sum=1e4)
    sc.pp.log1p(adata)

    # Store raw counts for gene expression plotting
    adata.raw = adata

    print("🧬 Selecting highly variable genes...")
    sc.pp.highly_variable_genes(adata, min_mean=0.0125, max_mean=3, min_disp=0.5)
    adata = adata[:, adata.var.highly_variable].copy()

    print("📐 Scaling and running PCA...")
    sc.pp.regress_out(adata, ["total_counts", "pct_counts_mt"])
    sc.pp.scale(adata, max_value=10)
    sc.tl.pca(adata, svd_solver="arpack")

    print("🔗 Computing neighborhood graph...")
    sc.pp.neighbors(adata, n_neighbors=10, n_pcs=40)

    print("🗺️  Computing UMAP embedding...")
    sc.tl.umap(adata)

    print("🔵 Running Leiden clustering...")
    sc.tl.leiden(adata, resolution=0.5, flavor="igraph", n_iterations=2)

    # ── 4. Rank marker genes (needed for cluster analysis) ────────────────
    print("📈 Ranking marker genes per cluster...")
    sc.tl.rank_genes_groups(adata, "leiden", method="wilcoxon")

    print(f"✅ Preprocessing complete! {adata.n_obs:,} cells × {adata.n_vars:,} genes")

    # ── 5. Save to cache for fast future restarts ─────────────────────────
    print(f"💾 Saving processed data to cache: {CACHE_FILE}")
    adata.write_h5ad(CACHE_FILE)
    print("✅ Cache saved.")

    return adata
