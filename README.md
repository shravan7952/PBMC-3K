# CodeCell.ai – scRNA Explorer

> AI-powered single-cell RNA-seq interface for the **PBMC 3K** dataset.
> Built with **FastAPI + Scanpy** (backend) and **React + Vite + Tailwind CSS** (frontend).

---

## 🗂️ Project Structure

```
PBMC 3K/
├── backend/
│   ├── main.py          ← FastAPI server + query router
│   ├── preprocess.py    ← Scanpy preprocessing pipeline (runs once at startup)
│   ├── plot_engine.py   ← Plot generation (UMAP, gene expression, markers)
│   ├── plots/           ← Auto-generated PNG files (served as static files)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── ChatWindow.jsx
│   │   │   ├── MessageBubble.jsx
│   │   │   └── PlotViewer.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── start.ps1            ← One-click launcher
└── README.md
```

---

## 🚀 Quick Start

### Option 1 — One-click launcher (recommended)
```powershell
# Open PowerShell in the project root and run:
.\start.ps1
```

### Option 2 — Manual

**Terminal 1 – Backend:**
```powershell
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 – Frontend:**
```powershell
cd frontend
npm install      # first time only
npm run dev
```

Then open: **http://localhost:5173**

---

## ⏳ First Run Note

On first launch, the backend will:
1. Load the PBMC 3K dataset from the `hg19` directory
2. Run the full Scanpy preprocessing pipeline (~60 seconds)
   - Filter → Normalize → log1p → HVG → PCA → Neighbors → UMAP → Leiden

The status indicator in the top-right corner shows **"Preprocessing…"** until ready.

---

## 💬 Supported Queries

| Query | Result |
|-------|--------|
| `Show UMAP` | UMAP colored by Leiden cluster |
| `Plot CD3D` | CD3D gene expression on UMAP |
| `Plot MS4A1` | MS4A1 gene expression on UMAP |
| `Top markers cluster 0` | Wilcoxon rank-sum top 10 DEGs |
| `List clusters` | Cell counts per cluster |
| `help` | Full capability list |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI · Uvicorn · Scanpy · Matplotlib |
| Frontend | React 18 · Vite 5 · Tailwind CSS 3 |
| Language | Python 3.13 · JavaScript (ESM) |
| Dataset | 10x Genomics PBMC 3K (hg19) |
