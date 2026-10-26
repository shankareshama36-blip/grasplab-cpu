from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.seed import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="GraspLab API",
    description="Interactive Computer Architecture Multi-Tenant SaaS Lab",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/health")
def health_check():
    return {"status": "ok"}
