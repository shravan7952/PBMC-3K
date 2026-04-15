"""
preprocess.py – One-time Scanpy preprocessing pipeline for PBMC 3K dataset.
Runs at server startup and caches the AnnData object in memory.
"""

import scanpy as sc
import os

DATA_PATH = r"C:\antigravity projects\PBMC 3K\pbmc3k_filtered_gene_bc_matrices\filtered_gene_bc_matrices\hg19"


def load_and_preprocess() -> sc.AnnData:
    """
    Load the 10x Genomics PBMC 3K dataset and run the full preprocessing pipeline:
    filter → normalize → log1p → HVG → scale → PCA → neighbors → UMAP → Leiden.
    Returns a fully annotated AnnData object ready for downstream queries.
    """
    print("📦 Loading PBMC 3K dataset...")
    adata = sc.read_10x_mtx(
        DATA_PATH,
        var_names="gene_symbols",
        cache=True,
    )
    adata.var_names_make_unique()

    print("🔬 Filtering cells and genes...")
    sc.pp.filter_cells(adata, min_genes=200)
    sc.pp.filter_genes(adata, min_cells=3)

    # Mitochondrial QC
    adata.var["mt"] = adata.var_names.str.startswith("MT-")
    sc.pp.calculate_qc_metrics(
        adata, qc_vars=["mt"], percent_top=None, log1p=False, inplace=True
    )
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

    print("✅ Preprocessing complete!")
    return adata
