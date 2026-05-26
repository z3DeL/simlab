from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import Base, engine
from routers import projects, results, lab_works, auth
import os

DIST_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

app = FastAPI(
    title="SimLab API",
    description="Лабораторный комплекс: имитационное моделирование и обучение с подкреплением",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(results.router, prefix="/api")
app.include_router(lab_works.router, prefix="/api")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


# Раздаём собранный фронтенд (только если dist/ существует)
if os.path.isdir(DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(DIST_DIR, "index.html"))

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        # API-роуты обрабатываются выше, всё остальное → index.html (SPA)
        file_path = os.path.join(DIST_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))
else:
    @app.get("/")
    def root():
        return {"status": "ok", "docs": "/docs", "note": "frontend/dist not found — run build.sh first"}
